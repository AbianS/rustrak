//! The grouping key exactly as Rustrak computed it up to v0.14.10.
//!
//! Frozen on purpose. Every later change to grouping — reading
//! `message.formatted`, resolving exception-group wrappers, composing the key
//! from the whole chain, normalizing event-specific values — moves events to a
//! different key. Without this, the first event after an upgrade would not find
//! its issue and would open a new one, leaving the old issue frozen beside it.
//!
//! The digest looks up the current key first and falls back to this one, then
//! records the current key against the issue it found, so each issue migrates
//! itself on its next event.
//!
//! Do not fix bugs here. This is not what Rustrak does; it is what Rustrak did.

use serde_json::Value;

const GROUPING_SEPARATOR: &str = " ⋄ ";

/// The v0.14.10 grouping key.
pub fn calculate_grouping_key_v1(event_data: &Value) -> String {
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

/// Extracts type and value from the event
fn get_type_and_value(event_data: &Value) -> (String, String) {
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
fn get_title(calculated_type: &str, calculated_value: &str) -> String {
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
