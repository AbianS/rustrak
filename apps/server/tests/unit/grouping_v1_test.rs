//! The frozen v0.14.10 grouping key.
//!
//! These are the keys the shipped release produced. If one changes, every issue
//! created before the upgrade stops being findable.

use rustrak::services::calculate_grouping_key_v1;
use serde_json::json;

#[test]
fn exception_key_is_the_last_of_the_chain_untouched() {
    let event = json!({
        "exception": { "values": [
            { "type": "IOError", "value": "disk full" },
            { "type": "RuntimeError", "value": "save failed for order 4213" }
        ]},
        "transaction": "/api/checkout"
    });

    assert_eq!(
        calculate_grouping_key_v1(&event),
        "RuntimeError: save failed for order 4213 ⋄ /api/checkout"
    );
}

#[test]
fn an_exception_group_wrapper_still_wins() {
    let event = json!({
        "exception": { "values": [
            { "type": "MyApp.Exception", "value": "Test 1",
              "mechanism": { "exception_id": 1, "parent_id": 0 } },
            { "type": "System.AggregateException", "value": "One or more errors occurred.",
              "mechanism": { "exception_id": 0, "is_exception_group": true } }
        ]}
    });

    assert_eq!(
        calculate_grouping_key_v1(&event),
        "System.AggregateException: One or more errors occurred. ⋄ <no transaction>"
    );
}

#[test]
fn message_formatted_is_still_unread() {
    let event = json!({
        "message": { "formatted": "Disk almost full", "message": null, "params": null }
    });

    assert_eq!(
        calculate_grouping_key_v1(&event),
        "Unknown ⋄ <no transaction>"
    );
}

#[test]
fn logentry_prefers_message_and_never_interpolates() {
    let event = json!({
        "logentry": { "message": "User %s logged in", "params": ["john"] }
    });

    assert_eq!(
        calculate_grouping_key_v1(&event),
        "Log Message: User %s logged in ⋄ <no transaction>"
    );
}

#[test]
fn a_custom_fingerprint_behaves_as_it_did() {
    let event = json!({
        "exception": { "values": [{ "type": "Error", "value": "boom" }] },
        "fingerprint": ["custom-group", "{{ default }}"]
    });

    assert_eq!(
        calculate_grouping_key_v1(&event),
        "custom-group ⋄ Error: boom ⋄ <no transaction>"
    );
}
