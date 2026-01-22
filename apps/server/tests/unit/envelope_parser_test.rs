//! Unit tests for the Sentry envelope parser
//!
//! Tests the parsing of Sentry SDK envelopes including headers, items, and edge cases.

use rustrak::ingest::parser::EnvelopeParser;

// =============================================================================
// Basic Parsing Tests (moved from inline tests)
// =============================================================================

#[test]
fn test_parse_simple_envelope() {
    let envelope = b"{\"event_id\":\"abc123\"}\n{\"type\":\"event\",\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.headers.event_id, Some("abc123".to_string()));
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].headers.item_type, "event");
    assert_eq!(result.items[0].payload, b"{}");
}

#[test]
fn test_parse_envelope_without_length() {
    let envelope = b"{\"event_id\":\"abc123\"}\n{\"type\":\"event\"}\n{\"message\":\"hello\"}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].payload, b"{\"message\":\"hello\"}");
}

#[test]
fn test_parse_empty_envelope() {
    let envelope = b"";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    assert!(result.is_err());
}

#[test]
fn test_parse_envelope_multiple_items() {
    let envelope =
        b"{\"event_id\":\"abc123\"}\n{\"type\":\"event\",\"length\":2}\n{}\n{\"type\":\"session\",\"length\":4}\ntest\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items.len(), 2);
    assert_eq!(result.items[0].headers.item_type, "event");
    assert_eq!(result.items[1].headers.item_type, "session");
}

// =============================================================================
// Envelope Headers Tests
// =============================================================================

#[test]
fn test_parse_full_envelope_headers() {
    let envelope = b"{\"event_id\":\"9ec79c33ec9942ab8353589fcb2e04dc\",\"dsn\":\"http://key@localhost/1\",\"sent_at\":\"2026-01-09T12:00:00.000Z\",\"sdk\":{\"name\":\"sentry.python\",\"version\":\"1.0.0\"}}\n{\"type\":\"event\",\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(
        result.headers.event_id,
        Some("9ec79c33ec9942ab8353589fcb2e04dc".to_string())
    );
    assert_eq!(
        result.headers.dsn,
        Some("http://key@localhost/1".to_string())
    );
    assert_eq!(
        result.headers.sent_at,
        Some("2026-01-09T12:00:00.000Z".to_string())
    );
    assert!(result.headers.sdk.is_some());

    let sdk = result.headers.sdk.as_ref().unwrap();
    assert_eq!(sdk.name, Some("sentry.python".to_string()));
    assert_eq!(sdk.version, Some("1.0.0".to_string()));
}

#[test]
fn test_parse_minimal_envelope_headers() {
    // Sentry accepts minimal headers
    let envelope = b"{}\n{\"type\":\"event\",\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert!(result.headers.event_id.is_none());
    assert!(result.headers.dsn.is_none());
}

#[test]
fn test_parse_invalid_envelope_headers_json() {
    let envelope = b"not json\n{\"type\":\"event\"}\n{}";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Invalid envelope headers JSON"));
}

// =============================================================================
// Item Headers Tests
// =============================================================================

#[test]
fn test_parse_item_with_content_type() {
    let envelope =
        b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":2,\"content_type\":\"application/json\"}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(
        result.items[0].headers.content_type,
        Some("application/json".to_string())
    );
}

#[test]
fn test_parse_item_invalid_headers_json() {
    let envelope = b"{\"event_id\":\"abc\"}\nnot json\n{}";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Invalid item headers JSON"));
}

#[test]
fn test_parse_item_missing_type() {
    let envelope = b"{\"event_id\":\"abc\"}\n{\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    // serde should fail because "type" is required
    assert!(result.is_err());
}

// =============================================================================
// Item Types Tests
// =============================================================================

#[test]
fn test_parse_event_item() {
    let envelope =
        b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":17}\n{\"level\":\"error\"}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].headers.item_type, "event");
    assert_eq!(result.items[0].payload, b"{\"level\":\"error\"}");
}

#[test]
fn test_parse_session_item() {
    // {"status":"ok"} is 15 bytes
    let envelope =
        b"{\"event_id\":\"abc\"}\n{\"type\":\"session\",\"length\":15}\n{\"status\":\"ok\"}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].headers.item_type, "session");
}

#[test]
fn test_parse_transaction_item() {
    // {"op":"http.get"} is 17 bytes
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"transaction\",\"length\":17}\n{\"op\":\"http.get\"}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].headers.item_type, "transaction");
}

#[test]
fn test_parse_attachment_item() {
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"attachment\",\"length\":4}\ndata\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].headers.item_type, "attachment");
    assert_eq!(result.items[0].payload, b"data");
}

// =============================================================================
// Length Field Tests
// =============================================================================

#[test]
fn test_parse_explicit_length() {
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":10}\n0123456789\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].payload.len(), 10);
    assert_eq!(result.items[0].payload, b"0123456789");
}

#[test]
fn test_parse_length_zero() {
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":0}\n\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].payload.len(), 0);
}

#[test]
fn test_parse_length_mismatch_more_data() {
    // Length says 5 bytes but we have more
    // Parser reads exactly 5 bytes, then remaining "56789\n" becomes the next item header
    // which fails to parse. This is expected behavior - the envelope is malformed.
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":5}\n0123456789\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    // This envelope is malformed - the remaining data is invalid JSON
    assert!(result.is_err());
}

#[test]
fn test_parse_length_mismatch_less_data() {
    // Length says 20 bytes but we only have 10 - should fail
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":20}\n0123456789";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Unexpected EOF"));
}

#[test]
fn test_parse_without_length_reads_until_newline() {
    // When no length is specified, parser reads until newline
    // The rest becomes the next item header, which if invalid JSON, fails parsing
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\"}\nfirst line only\nignored\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    // "ignored" is parsed as item headers and fails (not valid JSON)
    assert!(result.is_err());
}

#[test]
fn test_parse_without_length_single_item() {
    // Single item without length - simpler case
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\"}\n{\"message\":\"hello\"}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].payload, b"{\"message\":\"hello\"}");
}

// =============================================================================
// Payload with Newlines Tests
// =============================================================================

#[test]
fn test_parse_payload_with_newlines_using_length() {
    // If we use length, we can have newlines in the payload
    let payload = b"line1\nline2\nline3";
    let header = format!(
        "{{\"event_id\":\"abc\"}}\n{{\"type\":\"event\",\"length\":{}}}\n",
        payload.len()
    );
    let mut envelope = header.into_bytes();
    envelope.extend_from_slice(payload);
    envelope.push(b'\n');

    let mut parser = EnvelopeParser::new(&envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].payload, payload);
}

#[test]
fn test_parse_json_payload_with_escaped_newlines() {
    // JSON with \n in strings (escaped)
    let payload = b"{\"message\":\"line1\\nline2\"}";
    let header = format!(
        "{{\"event_id\":\"abc\"}}\n{{\"type\":\"event\",\"length\":{}}}\n",
        payload.len()
    );
    let mut envelope = header.into_bytes();
    envelope.extend_from_slice(payload);
    envelope.push(b'\n');

    let mut parser = EnvelopeParser::new(&envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].payload, payload);
}

// =============================================================================
// Multiple Items Tests
// =============================================================================

#[test]
fn test_parse_three_items() {
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":2}\n{}\n{\"type\":\"session\",\"length\":2}\n{}\n{\"type\":\"transaction\",\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items.len(), 3);
    assert_eq!(result.items[0].headers.item_type, "event");
    assert_eq!(result.items[1].headers.item_type, "session");
    assert_eq!(result.items[2].headers.item_type, "transaction");
}

#[test]
fn test_parse_mixed_length_items() {
    // Mix of items with and without explicit length
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":2}\n{}\n{\"type\":\"session\"}\n{\"s\":1}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items.len(), 2);
    assert_eq!(result.items[0].payload, b"{}");
    assert_eq!(result.items[1].payload, b"{\"s\":1}");
}

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

#[test]
fn test_parse_no_items() {
    // Just headers, no items
    let envelope = b"{\"event_id\":\"abc\"}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.headers.event_id, Some("abc".to_string()));
    assert!(result.items.is_empty());
}

#[test]
fn test_parse_headers_only_no_newline() {
    let envelope = b"{\"event_id\":\"abc\"}";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.headers.event_id, Some("abc".to_string()));
    assert!(result.items.is_empty());
}

#[test]
fn test_parse_whitespace_only_headers() {
    let envelope = b"   \n{\"type\":\"event\"}\n{}";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse();

    // "   " is not valid JSON
    assert!(result.is_err());
}

#[test]
fn test_parse_empty_line_between_items() {
    // Empty line returns None from parse_item, stopping item parsing
    // BUT in this envelope the structure is: header, item1, empty_line, item2
    // The empty line causes parse_item to return None and loop continues to next line
    // which then tries to parse "{\"type\":\"session\"}" as an item header
    let envelope = b"{\"event_id\":\"abc\"}\n{\"type\":\"event\",\"length\":2}\n{}\n\n{\"type\":\"session\"}\n{}";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    // Empty line returns None, then we continue and parse the session item
    // So we get 2 items total
    assert_eq!(result.items.len(), 2);
    assert_eq!(result.items[0].headers.item_type, "event");
    assert_eq!(result.items[1].headers.item_type, "session");
}

#[test]
fn test_parse_binary_payload() {
    // Non-UTF8 binary data in payload
    let binary = vec![0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD];
    let header = format!(
        "{{\"event_id\":\"abc\"}}\n{{\"type\":\"attachment\",\"length\":{}}}\n",
        binary.len()
    );
    let mut envelope = header.into_bytes();
    envelope.extend_from_slice(&binary);
    envelope.push(b'\n');

    let mut parser = EnvelopeParser::new(&envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].payload, binary);
}

// =============================================================================
// Unicode Tests
// =============================================================================

#[test]
fn test_parse_unicode_in_payload() {
    let payload = "{\"message\":\"¡Hola! 你好 🎉\"}";
    let payload_bytes = payload.as_bytes();
    let header = format!(
        "{{\"event_id\":\"abc\"}}\n{{\"type\":\"event\",\"length\":{}}}\n",
        payload_bytes.len()
    );
    let mut envelope = header.into_bytes();
    envelope.extend_from_slice(payload_bytes);
    envelope.push(b'\n');

    let mut parser = EnvelopeParser::new(&envelope);
    let result = parser.parse().unwrap();

    assert_eq!(result.items[0].payload, payload_bytes);
}

#[test]
fn test_parse_unicode_in_event_id() {
    // Event IDs should be ASCII, but parser should handle unicode gracefully
    let envelope = b"{\"event_id\":\"test-\xC3\xA9vent\"}\n{\"type\":\"event\",\"length\":2}\n{}\n";
    let mut parser = EnvelopeParser::new(envelope);
    let result = parser.parse().unwrap();

    // Should parse without error
    assert!(result.headers.event_id.is_some());
}

// =============================================================================
// Size Limit Tests
// =============================================================================

#[test]
fn test_payload_size_exactly_at_limit() {
    // Create a payload exactly at 1MB limit
    let payload_size = 1024 * 1024; // 1MB
    let payload = vec![b'x'; payload_size];
    let header = format!(
        "{{\"event_id\":\"abc\"}}\n{{\"type\":\"event\",\"length\":{}}}\n",
        payload_size
    );
    let mut envelope = header.into_bytes();
    envelope.extend_from_slice(&payload);

    let mut parser = EnvelopeParser::new(&envelope);
    let result = parser.parse();

    // Should succeed at exactly the limit
    assert!(result.is_ok());
}

#[test]
fn test_payload_size_over_limit() {
    // Create a payload over 1MB limit
    let payload_size = 1024 * 1024 + 1; // 1MB + 1 byte
    let header = format!(
        "{{\"event_id\":\"abc\"}}\n{{\"type\":\"event\",\"length\":{}}}\n",
        payload_size
    );
    let mut envelope = header.into_bytes();
    envelope.extend(vec![b'x'; payload_size]);

    let mut parser = EnvelopeParser::new(&envelope);
    let result = parser.parse();

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("exceeds"));
}

// =============================================================================
// Real-world Envelope Formats
// =============================================================================

#[test]
fn test_parse_sentry_python_style_envelope() {
    let envelope = r#"{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","sent_at":"2026-01-09T12:00:00.000Z","sdk":{"name":"sentry.python","version":"1.45.0"}}
{"type":"event","content_type":"application/json","length":89}
{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","timestamp":1704801600.0,"level":"error"}
"#;

    let mut parser = EnvelopeParser::new(envelope.as_bytes());
    let result = parser.parse().unwrap();

    assert_eq!(
        result.headers.event_id,
        Some("9ec79c33ec9942ab8353589fcb2e04dc".to_string())
    );
    assert_eq!(result.items.len(), 1);
    assert_eq!(result.items[0].headers.item_type, "event");
}

#[test]
fn test_parse_sentry_javascript_style_envelope() {
    // JavaScript SDK sometimes sends slightly different format
    let envelope = r#"{"event_id":"abc123def456","dsn":"https://public@sentry.io/123"}
{"type":"event"}
{"event_id":"abc123def456","exception":{"values":[{"type":"Error"}]}}
"#;

    let mut parser = EnvelopeParser::new(envelope.as_bytes());
    let result = parser.parse().unwrap();

    assert_eq!(result.headers.event_id, Some("abc123def456".to_string()));
    assert!(result.headers.dsn.is_some());
}
