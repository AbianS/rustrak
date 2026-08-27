use serde_json::Value;
use sha2::{Digest, Sha256};

/// Separator used in grouping keys (diamond character)
const GROUPING_SEPARATOR: &str = " ⋄ ";

/// Calculates the grouping key for an event
pub fn calculate_grouping_key(event_data: &Value) -> String {
    let (calculated_type, calculated_value) = get_type_and_value(event_data);
    let transaction = get_transaction(event_data);

    // Check for custom fingerprint. An empty fingerprint (sent as `[]` by
    // sentry-ruby, or left empty after Relay drops null/array/object parts)
    // means "no custom fingerprint" and falls back to default grouping, as
    // in Sentry (`event.data.get("fingerprint") or ["{{ default }}"]`).
    if let Some(fingerprint) = event_data.get("fingerprint").and_then(|f| f.as_array()) {
        let parts: Vec<String> = fingerprint
            .iter()
            .filter_map(|part| {
                let coerced = coerce_fingerprint_element(part)?;
                if coerced == "{{ default }}" {
                    Some(default_grouping_key(
                        &calculated_type,
                        &calculated_value,
                        &transaction,
                    ))
                } else {
                    Some(coerced)
                }
            })
            .collect();
        if !parts.is_empty() {
            return parts.join(GROUPING_SEPARATOR);
        }
    }

    // Default grouping
    default_grouping_key(&calculated_type, &calculated_value, &transaction)
}

/// Coerces a single fingerprint array element to a string, mirroring Relay's
/// `LenientString` (relay-event-schema/src/protocol/types.rs:722-747).
///
/// Returns `None` for elements Relay drops (null, arrays, objects) so the
/// caller can skip them rather than emit an empty component.
fn coerce_fingerprint_element(part: &Value) -> Option<String> {
    match part {
        Value::String(s) => Some(s.clone()),
        // True/False (capitalized) for legacy python compatibility.
        Value::Bool(true) => Some("True".to_string()),
        Value::Bool(false) => Some("False".to_string()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Some(i.to_string())
            } else if let Some(u) = n.as_u64() {
                Some(u.to_string())
            } else {
                // Float: truncate toward zero, like Relay's `num.trunc()`.
                n.as_f64().map(|f| f.trunc().to_string())
            }
        }
        // null, arrays, and objects are dropped.
        _ => None,
    }
}

/// Default grouping key: "Type: value ⋄ transaction"
fn default_grouping_key(
    calculated_type: &str,
    calculated_value: &str,
    transaction: &str,
) -> String {
    let title = get_title(calculated_type, calculated_value);
    format!("{}{}{}", title, GROUPING_SEPARATOR, transaction)
}

/// Calculates the SHA256 hash of the grouping key
pub fn hash_grouping_key(grouping_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(grouping_key.as_bytes());
    hex::encode(hasher.finalize())
}

/// Extracts type and value from the event
pub fn get_type_and_value(event_data: &Value) -> (String, String) {
    // Try to extract from exception, unless it is synthetic. Relay ignores the
    // type/value of synthetic exceptions (signal/segfault wrappers) for
    // grouping and falls through to the next component
    // (relay-event-schema/src/protocol/mechanism.rs:113).
    if let Some(exception) = get_main_exception(event_data).filter(|e| !is_synthetic(e)) {
        let exc_type = exception
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or("Error")
            .to_string();

        let exc_value = exception
            .get("value")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        return (truncate(&exc_type, 128), truncate(&exc_value, 1024));
    }

    // Try to extract from logentry/message
    if let Some(message) = get_log_message(event_data) {
        return ("Log Message".to_string(), truncate(&message, 1024));
    }

    // Fallback
    ("Unknown".to_string(), String::new())
}

/// Gets the main exception (the last one in the chain)
fn get_main_exception(event_data: &Value) -> Option<&Value> {
    let exception = event_data.get("exception")?;

    // Can be a direct array or an object with "values"
    let values = if exception.is_array() {
        exception.as_array()?
    } else {
        exception.get("values")?.as_array()?
    };

    // Return the last exception (most important)
    values.last()
}

/// Whether an exception is marked synthetic via `mechanism.synthetic`.
fn is_synthetic(exception: &Value) -> bool {
    exception
        .get("mechanism")
        .and_then(|m| m.get("synthetic"))
        .and_then(|s| s.as_bool())
        .unwrap_or(false)
}

/// Gets the log message
fn get_log_message(event_data: &Value) -> Option<String> {
    // Try logentry.message or logentry.formatted
    if let Some(logentry) = event_data.get("logentry") {
        if let Some(msg) = logentry.get("message").and_then(|m| m.as_str()) {
            return Some(msg.lines().next().unwrap_or("").to_string());
        }
        if let Some(msg) = logentry.get("formatted").and_then(|m| m.as_str()) {
            return Some(msg.lines().next().unwrap_or("").to_string());
        }
    }

    // Fallback to message (deprecated)
    if let Some(message) = event_data.get("message") {
        if let Some(msg) = message.as_str() {
            return Some(msg.lines().next().unwrap_or("").to_string());
        }
        if let Some(msg) = message.get("message").and_then(|m| m.as_str()) {
            return Some(msg.lines().next().unwrap_or("").to_string());
        }
    }

    None
}

/// Gets the transaction from the event
fn get_transaction(event_data: &Value) -> String {
    event_data
        .get("transaction")
        .and_then(|t| t.as_str())
        .map(|s| truncate(s, 200))
        .unwrap_or_else(|| "<no transaction>".to_string())
}

/// Generates the error title
pub fn get_title(calculated_type: &str, calculated_value: &str) -> String {
    if calculated_value.is_empty() {
        calculated_type.to_string()
    } else {
        match calculated_value
            .lines()
            .map(|l| l.trim())
            .find(|l| !l.is_empty())
        {
            Some(first_line) => format!("{}: {}", calculated_type, first_line),
            None => calculated_type.to_string(),
        }
    }
}

/// Truncates a string to max_len
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        s.chars().take(max_len).collect()
    }
}

/// Extracts denormalized fields from the event
pub fn get_denormalized_fields(event_data: &Value) -> DenormalizedFields {
    let (calculated_type, calculated_value) = get_type_and_value(event_data);

    // Try to get the last frame from the stacktrace
    let (filename, module, function) = get_last_frame_info(event_data);

    let transaction = get_transaction(event_data);
    let culprit = get_culprit(&function, &filename, &transaction);
    // Limits match Relay's exactly (relay-event-schema/src/protocol/event.rs
    // @97f9c4b): `logger` max_chars = 64, `release` max_chars = 200.
    let logger = event_data
        .get("logger")
        .and_then(|l| l.as_str())
        .map(|s| truncate(s, 64))
        .unwrap_or_default();
    let release = event_data
        .get("release")
        .and_then(|r| r.as_str())
        .map(|s| truncate(s, 200))
        .unwrap_or_default();

    DenormalizedFields {
        calculated_type,
        calculated_value,
        transaction,
        last_frame_filename: filename,
        last_frame_module: module,
        last_frame_function: function,
        culprit,
        logger,
        release,
    }
}

/// Derives the issue culprit — a short string identifying the error source.
/// Prefers the relevant frame's function, then filename, then the transaction.
fn get_culprit(function: &str, filename: &str, transaction: &str) -> String {
    let chosen = if !function.is_empty() {
        function
    } else if !filename.is_empty() {
        filename
    } else if transaction != "<no transaction>" {
        transaction
    } else {
        ""
    };
    truncate(chosen, 255)
}

/// Denormalized fields extracted from event data
#[derive(Debug, Clone)]
pub struct DenormalizedFields {
    pub calculated_type: String,
    pub calculated_value: String,
    pub transaction: String,
    pub last_frame_filename: String,
    pub last_frame_module: String,
    pub last_frame_function: String,
    pub culprit: String,
    pub logger: String,
    pub release: String,
}

/// Extracts information from the last stacktrace frame
fn get_last_frame_info(event_data: &Value) -> (String, String, String) {
    let exception = match get_main_exception(event_data) {
        Some(e) => e,
        None => return (String::new(), String::new(), String::new()),
    };

    let frames = exception
        .get("stacktrace")
        .and_then(|st| st.get("frames"))
        .and_then(|f| f.as_array());

    let frames = match frames {
        Some(f) if !f.is_empty() => f,
        _ => return (String::new(), String::new(), String::new()),
    };

    // Find the last "in_app" frame or the last frame
    let frame = frames
        .iter()
        .rev()
        .find(|f| f.get("in_app").and_then(|v| v.as_bool()).unwrap_or(false))
        .or_else(|| frames.last());

    match frame {
        Some(f) => {
            let filename = f
                .get("filename")
                .and_then(|v| v.as_str())
                .map(|s| truncate(s, 255))
                .unwrap_or_default();

            let module = f
                .get("module")
                .and_then(|v| v.as_str())
                .map(|s| truncate(s, 255))
                .unwrap_or_default();

            let function = f
                .get("function")
                .and_then(|v| v.as_str())
                .map(|s| truncate(s, 255))
                .unwrap_or_default();

            (filename, module, function)
        }
        None => (String::new(), String::new(), String::new()),
    }
}
