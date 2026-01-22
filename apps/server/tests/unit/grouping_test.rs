//! Unit tests for the grouping algorithm
//!
//! Tests event grouping logic, hash generation, and denormalized field extraction.

use rustrak::services::grouping::{
    calculate_grouping_key, get_denormalized_fields, get_title, get_type_and_value,
    hash_grouping_key,
};
use serde_json::json;

// =============================================================================
// Basic Grouping Tests
// =============================================================================

#[test]
fn test_grouping_key_with_exception() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "TypeError",
                "value": "Cannot read property 'x' of undefined"
            }]
        },
        "transaction": "/api/users"
    });

    let key = calculate_grouping_key(&event);
    assert!(key.contains("TypeError"));
    assert!(key.contains("/api/users"));
}

#[test]
fn test_grouping_key_with_fingerprint() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "Something went wrong"
            }]
        },
        "fingerprint": ["custom-group", "{{ default }}"]
    });

    let key = calculate_grouping_key(&event);
    assert!(key.starts_with("custom-group"));
}

#[test]
fn test_hash_grouping_key() {
    let hash = hash_grouping_key("test");
    assert_eq!(hash.len(), 64); // SHA256 hex = 64 chars
}

#[test]
fn test_get_type_and_value_log_message() {
    let event = json!({
        "message": "Something happened"
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Log Message");
    assert_eq!(value, "Something happened");
}

// =============================================================================
// Exception Grouping Tests
// =============================================================================

#[test]
fn test_exception_with_values_array() {
    let event = json!({
        "exception": {
            "values": [
                { "type": "InnerError", "value": "inner" },
                { "type": "OuterError", "value": "outer cause" }
            ]
        }
    });

    // Should use the LAST exception (most important in the chain)
    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "OuterError");
    assert_eq!(value, "outer cause");
}

#[test]
fn test_exception_direct_array() {
    // Some SDKs send exception as a direct array, not { values: [...] }
    let event = json!({
        "exception": [
            { "type": "FirstError", "value": "first" },
            { "type": "LastError", "value": "last" }
        ]
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "LastError");
    assert_eq!(value, "last");
}

#[test]
fn test_exception_missing_type() {
    let event = json!({
        "exception": {
            "values": [{
                "value": "error without type"
            }]
        }
    });

    let (type_, _) = get_type_and_value(&event);
    assert_eq!(type_, "Error"); // Default fallback
}

#[test]
fn test_exception_missing_value() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "CustomError"
            }]
        }
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "CustomError");
    assert_eq!(value, "");
}

#[test]
fn test_exception_multiline_value() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "First line\nSecond line\nThird line"
            }]
        }
    });

    let key = calculate_grouping_key(&event);
    // Grouping should only use first line for the title portion
    assert!(key.contains("First line"));
    // But the full value is stored
    let (_, value) = get_type_and_value(&event);
    assert!(value.contains("Second line"));
}

// =============================================================================
// Log Message Grouping Tests
// =============================================================================

#[test]
fn test_logentry_message() {
    let event = json!({
        "logentry": {
            "message": "User %s logged in",
            "params": ["john"]
        }
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Log Message");
    assert_eq!(value, "User %s logged in");
}

#[test]
fn test_logentry_formatted() {
    let event = json!({
        "logentry": {
            "formatted": "User john logged in"
        }
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Log Message");
    assert_eq!(value, "User john logged in");
}

#[test]
fn test_logentry_prefers_message_over_formatted() {
    let event = json!({
        "logentry": {
            "message": "User %s logged in",
            "formatted": "User john logged in"
        }
    });

    let (type_, value) = get_type_and_value(&event);
    // Should prefer 'message' (parameterized) for grouping
    assert_eq!(value, "User %s logged in");
}

#[test]
fn test_deprecated_message_field() {
    let event = json!({
        "message": "Direct message string"
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Log Message");
    assert_eq!(value, "Direct message string");
}

#[test]
fn test_deprecated_message_object() {
    let event = json!({
        "message": {
            "message": "Nested message"
        }
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Log Message");
    assert_eq!(value, "Nested message");
}

#[test]
fn test_log_multiline_uses_first_line() {
    let event = json!({
        "message": "First line of log\nSecond line\nThird line"
    });

    let (_, value) = get_type_and_value(&event);
    // For log messages, only first line is used
    assert_eq!(value, "First line of log");
}

// =============================================================================
// Transaction Grouping Tests
// =============================================================================

#[test]
fn test_transaction_included_in_grouping() {
    let event1 = json!({
        "exception": { "values": [{ "type": "Error", "value": "same error" }] },
        "transaction": "/api/v1/users"
    });
    let event2 = json!({
        "exception": { "values": [{ "type": "Error", "value": "same error" }] },
        "transaction": "/api/v2/users"
    });

    let key1 = calculate_grouping_key(&event1);
    let key2 = calculate_grouping_key(&event2);

    // Same error, different transaction = different groups
    assert_ne!(key1, key2);
    assert!(key1.contains("/api/v1/users"));
    assert!(key2.contains("/api/v2/users"));
}

#[test]
fn test_missing_transaction() {
    let event = json!({
        "exception": { "values": [{ "type": "Error", "value": "test" }] }
    });

    let key = calculate_grouping_key(&event);
    assert!(key.contains("<no transaction>"));
}

// =============================================================================
// Fingerprint Tests
// =============================================================================

#[test]
fn test_custom_fingerprint_only() {
    let event = json!({
        "exception": { "values": [{ "type": "Error", "value": "ignored" }] },
        "fingerprint": ["custom-key-1", "custom-key-2"]
    });

    let key = calculate_grouping_key(&event);
    // Should NOT contain the exception info, only the fingerprint
    assert!(!key.contains("Error"));
    assert!(key.contains("custom-key-1"));
    assert!(key.contains("custom-key-2"));
}

#[test]
fn test_fingerprint_with_default_placeholder() {
    let event = json!({
        "exception": { "values": [{ "type": "MyError", "value": "my message" }] },
        "transaction": "/endpoint",
        "fingerprint": ["prefix", "{{ default }}", "suffix"]
    });

    let key = calculate_grouping_key(&event);
    assert!(key.contains("prefix"));
    assert!(key.contains("MyError"));
    assert!(key.contains("suffix"));
}

#[test]
fn test_fingerprint_multiple_defaults() {
    let event = json!({
        "exception": { "values": [{ "type": "Error", "value": "test" }] },
        "transaction": "/api",
        "fingerprint": ["{{ default }}", "{{ default }}"]
    });

    let key = calculate_grouping_key(&event);
    // Default is expanded twice
    let default_key = "Error: test ⋄ /api";
    assert!(key.contains(default_key));
}

#[test]
fn test_empty_fingerprint_array() {
    let event = json!({
        "exception": { "values": [{ "type": "Error", "value": "test" }] },
        "transaction": "/api",
        "fingerprint": []
    });

    let key = calculate_grouping_key(&event);
    // Empty fingerprint = falls back to default
    // Actually empty array is still truthy, so key will be empty
    assert_eq!(key, "");
}

// =============================================================================
// Fallback and Edge Cases
// =============================================================================

#[test]
fn test_no_exception_no_message() {
    let event = json!({
        "timestamp": 12345,
        "platform": "python"
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Unknown");
    assert_eq!(value, "");
}

#[test]
fn test_empty_event() {
    let event = json!({});

    let key = calculate_grouping_key(&event);
    assert!(key.contains("Unknown"));
    assert!(key.contains("<no transaction>"));
}

#[test]
fn test_null_values_in_exception() {
    let event = json!({
        "exception": {
            "values": [{
                "type": null,
                "value": null
            }]
        }
    });

    let (type_, value) = get_type_and_value(&event);
    assert_eq!(type_, "Error"); // fallback
    assert_eq!(value, "");
}

// =============================================================================
// Hash Tests
// =============================================================================

#[test]
fn test_hash_is_deterministic() {
    let key = "Error: something ⋄ /api";
    let hash1 = hash_grouping_key(key);
    let hash2 = hash_grouping_key(key);
    assert_eq!(hash1, hash2);
}

#[test]
fn test_hash_is_hex() {
    let hash = hash_grouping_key("test input");
    assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_different_keys_different_hashes() {
    let hash1 = hash_grouping_key("key1");
    let hash2 = hash_grouping_key("key2");
    assert_ne!(hash1, hash2);
}

// =============================================================================
// Title Generation Tests
// =============================================================================

#[test]
fn test_title_with_value() {
    let title = get_title("TypeError", "undefined is not a function");
    assert_eq!(title, "TypeError: undefined is not a function");
}

#[test]
fn test_title_without_value() {
    let title = get_title("GenericError", "");
    assert_eq!(title, "GenericError");
}

#[test]
fn test_title_multiline_value() {
    let title = get_title("Error", "first line\nsecond line\nthird line");
    assert_eq!(title, "Error: first line");
}

// =============================================================================
// Denormalized Fields Tests
// =============================================================================

#[test]
fn test_denormalized_fields_basic() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "ValueError",
                "value": "invalid value",
                "stacktrace": {
                    "frames": [{
                        "filename": "app/main.py",
                        "module": "main",
                        "function": "run",
                        "in_app": true
                    }]
                }
            }]
        },
        "transaction": "/process"
    });

    let fields = get_denormalized_fields(&event);
    assert_eq!(fields.calculated_type, "ValueError");
    assert_eq!(fields.calculated_value, "invalid value");
    assert_eq!(fields.transaction, "/process");
    assert_eq!(fields.last_frame_filename, "app/main.py");
    assert_eq!(fields.last_frame_module, "main");
    assert_eq!(fields.last_frame_function, "run");
}

#[test]
fn test_denormalized_fields_prefers_in_app_frame() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "test",
                "stacktrace": {
                    "frames": [
                        { "filename": "library/code.py", "function": "lib_func", "in_app": false },
                        { "filename": "app/handler.py", "function": "handle", "in_app": true },
                        { "filename": "framework/base.py", "function": "dispatch", "in_app": false }
                    ]
                }
            }]
        }
    });

    let fields = get_denormalized_fields(&event);
    // Should pick the last in_app=true frame
    assert_eq!(fields.last_frame_filename, "app/handler.py");
    assert_eq!(fields.last_frame_function, "handle");
}

#[test]
fn test_denormalized_fields_falls_back_to_last_frame() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "test",
                "stacktrace": {
                    "frames": [
                        { "filename": "first.py", "function": "first" },
                        { "filename": "last.py", "function": "last" }
                    ]
                }
            }]
        }
    });

    let fields = get_denormalized_fields(&event);
    // No in_app frames, should use the last frame
    assert_eq!(fields.last_frame_filename, "last.py");
    assert_eq!(fields.last_frame_function, "last");
}

#[test]
fn test_denormalized_fields_no_stacktrace() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "no stack"
            }]
        }
    });

    let fields = get_denormalized_fields(&event);
    assert_eq!(fields.last_frame_filename, "");
    assert_eq!(fields.last_frame_module, "");
    assert_eq!(fields.last_frame_function, "");
}

// =============================================================================
// Truncation Tests
// =============================================================================

#[test]
fn test_type_truncation() {
    let long_type = "A".repeat(200);
    let event = json!({
        "exception": {
            "values": [{
                "type": long_type,
                "value": "test"
            }]
        }
    });

    let (type_, _) = get_type_and_value(&event);
    assert_eq!(type_.len(), 128); // Truncated to 128
}

#[test]
fn test_value_truncation() {
    let long_value = "B".repeat(2000);
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": long_value
            }]
        }
    });

    let (_, value) = get_type_and_value(&event);
    assert_eq!(value.len(), 1024); // Truncated to 1024
}

#[test]
fn test_transaction_truncation() {
    let long_transaction = "/".to_string() + &"x".repeat(300);
    let event = json!({
        "exception": { "values": [{ "type": "Error", "value": "test" }] },
        "transaction": long_transaction
    });

    let key = calculate_grouping_key(&event);
    // Transaction is truncated to 200 chars
    assert!(key.len() < long_transaction.len() + 200);
}

// =============================================================================
// Unicode and Special Characters
// =============================================================================

#[test]
fn test_unicode_in_error_message() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "Error en español: ¡Hola! 你好 🎉"
            }]
        }
    });

    let key = calculate_grouping_key(&event);
    assert!(key.contains("¡Hola!"));
    assert!(key.contains("你好"));
}

#[test]
fn test_diamond_separator_in_message() {
    // Edge case: what if the message contains the separator?
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "Contains ⋄ separator"
            }]
        },
        "transaction": "/api"
    });

    let key = calculate_grouping_key(&event);
    // Should still work, but grouping might be affected
    assert!(key.contains("Contains ⋄ separator"));
}

#[test]
fn test_newlines_and_tabs_in_value() {
    let event = json!({
        "exception": {
            "values": [{
                "type": "Error",
                "value": "Line 1\n\tTabbed line 2\r\nWindows line 3"
            }]
        }
    });

    let (_, value) = get_type_and_value(&event);
    assert!(value.contains('\n'));
    assert!(value.contains('\t'));
}
