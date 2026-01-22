use serde_json::Value;
use sha2::{Digest, Sha256};

/// Separator used in grouping keys (diamond character)
const GROUPING_SEPARATOR: &str = " ⋄ ";

/// Calculates the grouping key for an event
pub fn calculate_grouping_key(event_data: &Value) -> String {
    let (calculated_type, calculated_value) = get_type_and_value(event_data);
    let transaction = get_transaction(event_data);

    // Check for custom fingerprint
    if let Some(fingerprint) = event_data.get("fingerprint").and_then(|f| f.as_array()) {
        return fingerprint
            .iter()
            .map(|part| {
                let part_str = part.as_str().unwrap_or("");
                if part_str == "{{ default }}" {
                    default_grouping_key(&calculated_type, &calculated_value, &transaction)
                } else {
                    part_str.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join(GROUPING_SEPARATOR);
    }

    // Default grouping
    default_grouping_key(&calculated_type, &calculated_value, &transaction)
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
    format!("{:x}", hasher.finalize())
}

/// Extracts type and value from the event
pub fn get_type_and_value(event_data: &Value) -> (String, String) {
    // Try to extract from exception
    if let Some(exception) = get_main_exception(event_data) {
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
        let first_line = calculated_value.lines().next().unwrap_or("");
        format!("{}: {}", calculated_type, first_line)
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

    DenormalizedFields {
        calculated_type,
        calculated_value,
        transaction: get_transaction(event_data),
        last_frame_filename: filename,
        last_frame_module: module,
        last_frame_function: function,
    }
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
