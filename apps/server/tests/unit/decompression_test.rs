//! Unit tests for decompression
//!
//! Tests gzip, deflate, and brotli decompression.

use bytes::Bytes;
use flate2::write::{DeflateEncoder, GzEncoder};
use flate2::Compression;
use rustrak::ingest::decompression::decompress_body;
use std::io::Write;

// =============================================================================
// No Encoding Tests
// =============================================================================

#[test]
fn test_decompress_no_encoding() {
    let data = b"Hello, World!";
    let result = decompress_body(Bytes::from_static(data), None).unwrap();
    assert_eq!(result, data);
}

#[test]
fn test_decompress_no_encoding_json() {
    let data = b"{\"message\":\"Hello, World!\"}";
    let result = decompress_body(Bytes::from_static(data), None).unwrap();
    assert_eq!(result, data);
}

#[test]
fn test_decompress_no_encoding_binary() {
    let data: Vec<u8> = (0..=255).collect();
    let result = decompress_body(Bytes::from(data.clone()), None).unwrap();
    assert_eq!(result, data);
}

// =============================================================================
// Gzip Tests
// =============================================================================

#[test]
fn test_decompress_gzip() {
    let original = b"Hello, World!";
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed, original);
}

#[test]
fn test_decompress_gzip_json_payload() {
    let original = br#"{"event_id":"abc123","exception":{"values":[{"type":"Error"}]}}"#;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed, original);
}

#[test]
fn test_decompress_gzip_already_decompressed() {
    // Data doesn't have gzip magic bytes - should return as-is
    let data = b"{\"already\":\"decompressed\"}";
    let result = decompress_body(Bytes::from_static(data), Some("gzip")).unwrap();
    assert_eq!(result, data);
}

#[test]
fn test_decompress_gzip_best_compression() {
    let original = b"Repeated data repeated data repeated data repeated data";
    let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    // Best compression should produce smaller output
    assert!(compressed.len() < original.len());

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed, original);
}

#[test]
fn test_decompress_gzip_large_payload() {
    // 100KB of data
    let original: Vec<u8> = (0..100_000).map(|i| (i % 256) as u8).collect();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed, original);
}

// =============================================================================
// Deflate Tests
// =============================================================================

#[test]
fn test_decompress_deflate() {
    let original = b"Hello, World!";
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("deflate")).unwrap();
    assert_eq!(decompressed, original);
}

#[test]
fn test_decompress_deflate_json_assumes_decompressed() {
    // If data starts with { or [, assume already decompressed
    let data = b"{\"already\":\"json\"}";
    let result = decompress_body(Bytes::from_static(data), Some("deflate")).unwrap();
    assert_eq!(result, data);
}

#[test]
fn test_decompress_deflate_array_json() {
    let data = b"[1,2,3]";
    let result = decompress_body(Bytes::from_static(data), Some("deflate")).unwrap();
    assert_eq!(result, data);
}

// =============================================================================
// Brotli Tests
// =============================================================================

#[test]
fn test_decompress_brotli() {
    let original = b"Hello, World!";
    let mut compressed = Vec::new();
    {
        let mut encoder = brotli::CompressorWriter::new(&mut compressed, 4096, 11, 22);
        encoder.write_all(original).unwrap();
    }

    let decompressed = decompress_body(Bytes::from(compressed), Some("br")).unwrap();
    assert_eq!(decompressed, original);
}

#[test]
fn test_decompress_brotli_json_assumes_decompressed() {
    let data = b"{\"already\":\"json\"}";
    let result = decompress_body(Bytes::from_static(data), Some("br")).unwrap();
    assert_eq!(result, data);
}

// =============================================================================
// Error Cases
// =============================================================================

#[test]
fn test_unsupported_encoding() {
    let data = b"Hello, World!";
    let result = decompress_body(Bytes::from_static(data), Some("unknown"));
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Unsupported Content-Encoding"));
}

#[test]
fn test_unsupported_encoding_zstd() {
    let data = b"Hello, World!";
    let result = decompress_body(Bytes::from_static(data), Some("zstd"));
    assert!(result.is_err());
}

#[test]
fn test_unsupported_encoding_lz4() {
    let data = b"Hello, World!";
    let result = decompress_body(Bytes::from_static(data), Some("lz4"));
    assert!(result.is_err());
}

#[test]
fn test_invalid_gzip_data() {
    // Data with gzip magic bytes but invalid content
    let invalid = vec![0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff, 0xff, 0xff];
    let result = decompress_body(Bytes::from(invalid), Some("gzip"));

    // Should fail with validation error
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Invalid gzip"));
}

// =============================================================================
// Edge Cases
// =============================================================================

#[test]
fn test_empty_payload_no_encoding() {
    let result = decompress_body(Bytes::new(), None).unwrap();
    assert!(result.is_empty());
}

#[test]
fn test_empty_payload_gzip() {
    // Empty payload doesn't have gzip magic bytes, so returns as-is
    let result = decompress_body(Bytes::new(), Some("gzip")).unwrap();
    assert!(result.is_empty());
}

#[test]
fn test_single_byte_payload() {
    let result = decompress_body(Bytes::from_static(b"x"), None).unwrap();
    assert_eq!(result, b"x");
}

#[test]
fn test_unicode_payload() {
    let original = "¡Hola! 你好 🎉".as_bytes();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed, original);
}

// =============================================================================
// Real World Sentry Payloads
// =============================================================================

#[test]
fn test_decompress_sentry_envelope_gzip() {
    // Simulate a real Sentry envelope compressed with gzip
    let envelope =
        br#"{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","sent_at":"2026-01-09T12:00:00.000Z"}
{"type":"event","length":89}
{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","timestamp":1704801600.0,"level":"error"}
"#;

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(envelope).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed, envelope);
}
