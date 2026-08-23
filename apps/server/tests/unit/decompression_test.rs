//! Unit tests for decompression
//!
//! Tests gzip, deflate, brotli, and zstd decompression.

use actix_web::{http::header, test as actix_test, web, App, HttpResponse};
use bytes::Bytes;
use flate2::write::{DeflateEncoder, GzEncoder, ZlibEncoder};
use flate2::Compression;
use rustrak::ingest::decompression::{decompress_body, get_content_encoding};
use std::io::Write;

// =============================================================================
// No Encoding Tests
// =============================================================================

#[test]
fn test_decompress_no_encoding() {
    let data = b"Hello, World!";
    let result = decompress_body(Bytes::from_static(data), None).unwrap();
    assert_eq!(result.as_ref(), data);
}

#[test]
fn test_decompress_no_encoding_json() {
    let data = b"{\"message\":\"Hello, World!\"}";
    let result = decompress_body(Bytes::from_static(data), None).unwrap();
    assert_eq!(result.as_ref(), data);
}

#[test]
fn test_decompress_no_encoding_binary() {
    let data: Vec<u8> = (0..=255).collect();
    let result = decompress_body(Bytes::from(data.clone()), None).unwrap();
    assert_eq!(result.as_ref(), data);
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
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_decompress_gzip_json_payload() {
    let original = br#"{"event_id":"abc123","exception":{"values":[{"type":"Error"}]}}"#;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_decompress_gzip_already_decompressed() {
    // Data doesn't have gzip magic bytes - should return as-is
    let data = b"{\"already\":\"decompressed\"}";
    let result = decompress_body(Bytes::from_static(data), Some("gzip")).unwrap();
    assert_eq!(result.as_ref(), data);
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
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_decompress_gzip_large_payload() {
    // 100KB of data
    let original: Vec<u8> = (0..100_000).map(|i| (i % 256) as u8).collect();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_decompresses_all_gzip_members() {
    let mut first = GzEncoder::new(Vec::new(), Compression::default());
    first.write_all(b"first").unwrap();
    let first = first.finish().unwrap();
    let mut second = GzEncoder::new(Vec::new(), Compression::default());
    second.write_all(b"second").unwrap();
    let second = second.finish().unwrap();

    let mut concatenated = first;
    concatenated.extend_from_slice(&second);

    let decompressed = decompress_body(Bytes::from(concatenated), Some("gzip")).unwrap();

    assert_eq!(decompressed.as_ref(), b"firstsecond");
}

#[test]
fn test_rejects_trailing_gzip_data() {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(b"payload").unwrap();
    let mut compressed = encoder.finish().unwrap();
    compressed.extend_from_slice(b"trailing");

    assert!(decompress_body(Bytes::from(compressed), Some("gzip")).is_err());
}

#[test]
fn test_gzip_decompression_limit_is_enforced() {
    let original = vec![b'x'; rustrak::ingest::decompression::MAX_DECOMPRESSED_SIZE + 1];
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&original).unwrap();
    let compressed = encoder.finish().unwrap();

    let result = decompress_body(Bytes::from(compressed), Some("gzip"));

    assert!(matches!(
        result,
        Err(rustrak::error::AppError::PayloadTooLarge(_))
    ));
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
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_decompresses_large_raw_deflate_across_output_buffers() {
    let original: Vec<u8> = (0..100_000).map(|i| (i % 251) as u8).collect();
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("deflate")).unwrap();

    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_decompresses_http_deflate_zlib_wrapper() {
    let original = b"Hello, zlib!";
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("deflate")).unwrap();

    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_rejects_trailing_deflate_data() {
    let original = b"Hello, deflate!";
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let mut compressed = encoder.finish().unwrap();
    compressed.extend_from_slice(b"trailing");

    assert!(decompress_body(Bytes::from(compressed), Some("deflate")).is_err());
}

#[test]
fn test_invalid_deflate_data_is_rejected() {
    let result = decompress_body(Bytes::from_static(b"not deflate"), Some("deflate"));

    assert!(result.is_err());
}

#[test]
fn test_decompress_deflate_json_assumes_decompressed() {
    // If data starts with { or [, assume already decompressed
    let data = b"{\"already\":\"json\"}";
    let result = decompress_body(Bytes::from_static(data), Some("deflate")).unwrap();
    assert_eq!(result.as_ref(), data);
}

#[test]
fn test_decompress_deflate_array_json() {
    let data = b"[1,2,3]";
    let result = decompress_body(Bytes::from_static(data), Some("deflate")).unwrap();
    assert_eq!(result.as_ref(), data);
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
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_rejects_trailing_brotli_data() {
    let mut compressed = Vec::new();
    {
        let mut encoder = brotli::CompressorWriter::new(&mut compressed, 4096, 5, 22);
        encoder.write_all(b"Hello, Brotli!").unwrap();
    }
    compressed.extend_from_slice(b"trailing");

    assert!(decompress_body(Bytes::from(compressed), Some("br")).is_err());
}

#[test]
fn test_rejects_truncated_brotli_data() {
    let mut compressed = Vec::new();
    {
        let mut encoder = brotli::CompressorWriter::new(&mut compressed, 4096, 5, 22);
        encoder.write_all(b"truncated Brotli payload").unwrap();
    }
    compressed.pop();

    assert!(decompress_body(Bytes::from(compressed), Some("br")).is_err());
}

#[test]
fn test_decompresses_large_brotli_across_output_buffers() {
    let original = vec![b'b'; 100_000];
    let mut compressed = Vec::new();
    {
        let mut encoder = brotli::CompressorWriter::new(&mut compressed, 4096, 5, 22);
        encoder.write_all(&original).unwrap();
    }

    let decompressed = decompress_body(Bytes::from(compressed), Some("br")).unwrap();

    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_invalid_brotli_data_is_rejected() {
    let result = decompress_body(Bytes::from_static(b"not brotli"), Some("br"));

    assert!(result.is_err());
}

#[test]
fn test_brotli_decompression_limit_is_enforced() {
    let original = vec![b'x'; rustrak::ingest::decompression::MAX_DECOMPRESSED_SIZE + 1];
    let mut compressed = Vec::new();
    {
        let mut encoder = brotli::CompressorWriter::new(&mut compressed, 4096, 5, 22);
        encoder.write_all(&original).unwrap();
    }

    let result = decompress_body(Bytes::from(compressed), Some("br"));

    assert!(matches!(
        result,
        Err(rustrak::error::AppError::PayloadTooLarge(_))
    ));
}

#[test]
fn test_decompress_brotli_json_assumes_decompressed() {
    let data = b"{\"already\":\"json\"}";
    let result = decompress_body(Bytes::from_static(data), Some("br")).unwrap();
    assert_eq!(result.as_ref(), data);
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
fn test_decompress_zstd() {
    let original = b"Hello, World!";
    let compressed = zstd::stream::encode_all(original.as_slice(), 0).unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("zstd")).unwrap();
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn test_zstd_window_above_payload_budget_is_rejected() {
    let mut encoder = zstd::stream::write::Encoder::new(Vec::new(), 0).unwrap();
    encoder.window_log(28).unwrap();
    encoder.write_all(b"small payload").unwrap();
    let compressed = encoder.finish().unwrap();

    let result = decompress_body(Bytes::from(compressed), Some("zstd"));

    assert!(result.is_err());
}

#[test]
fn test_decompresses_content_encoding_chain_in_reverse_order() {
    let original = b"Hello, World!";
    let mut gzip = GzEncoder::new(Vec::new(), Compression::default());
    gzip.write_all(original).unwrap();
    let gzip = gzip.finish().unwrap();
    let zstd = zstd::stream::encode_all(gzip.as_slice(), 0).unwrap();

    let decompressed = decompress_body(Bytes::from(zstd), Some(" GZip,  ZSTD ")).unwrap();
    assert_eq!(decompressed.as_ref(), original);
}

#[test]
fn malformed_content_encoding_lists_are_rejected() {
    let result = decompress_body(Bytes::from_static(b"{}"), Some("gzip,,br"));
    assert!(result.is_err());
}

#[test]
fn test_content_encoding_header_is_normalized_as_a_coding_list() {
    let request = actix_test::TestRequest::default()
        .insert_header((header::CONTENT_ENCODING, " GZip,  ZSTD "))
        .to_http_request();

    assert_eq!(
        get_content_encoding(&request).unwrap().as_deref(),
        Some("gzip,zstd")
    );
}

#[test]
fn invalid_content_encoding_header_bytes_are_rejected() {
    let request = actix_test::TestRequest::default()
        .insert_header((
            header::CONTENT_ENCODING,
            header::HeaderValue::from_bytes(b"gzip,\xff").unwrap(),
        ))
        .to_http_request();

    assert!(get_content_encoding(&request).is_err());
}

#[test]
fn empty_content_encoding_tokens_are_rejected() {
    let request = actix_test::TestRequest::default()
        .insert_header((header::CONTENT_ENCODING, "gzip,,br"))
        .to_http_request();

    assert!(get_content_encoding(&request).is_err());
}

#[test]
fn test_identity_content_encoding_passes_the_body_through() {
    let body = Bytes::from_static(b"identity body");

    let result = decompress_body(body.clone(), Some("identity")).unwrap();

    assert_eq!(result, body);
}

#[actix_web::test]
async fn test_response_compression_negotiates_zstd() {
    let app = actix_test::init_service(
        App::new()
            .wrap(actix_web::middleware::Compress::default())
            .default_service(web::to(|| async {
                HttpResponse::Ok().body("compressed response")
            })),
    )
    .await;
    let request = actix_test::TestRequest::get()
        .insert_header((header::ACCEPT_ENCODING, "zstd"))
        .to_request();

    let response = actix_test::call_service(&app, request).await;
    assert_eq!(
        response.headers().get(header::CONTENT_ENCODING).unwrap(),
        "zstd"
    );
    assert_eq!(
        response.headers().get(header::VARY).unwrap(),
        "accept-encoding"
    );

    let body = actix_test::read_body(response).await;
    assert_eq!(
        zstd::stream::decode_all(body.as_ref()).unwrap(),
        b"compressed response"
    );
}

#[actix_web::test]
async fn test_response_compression_promotes_zstd_over_brotli_ties() {
    let app = actix_test::init_service(
        App::new()
            .wrap(actix_web::middleware::Compress::default())
            .wrap(actix_web::middleware::from_fn(
                rustrak::middleware::compression::prefer_zstd,
            ))
            .default_service(web::to(|| async {
                HttpResponse::Ok().body("compressed response")
            })),
    )
    .await;
    let request = actix_test::TestRequest::get()
        .insert_header((header::ACCEPT_ENCODING, "br, zstd, gzip"))
        .to_request();

    let response = actix_test::call_service(&app, request).await;
    assert_eq!(
        response.headers().get(header::CONTENT_ENCODING).unwrap(),
        "zstd"
    );

    let body = actix_test::read_body(response).await;
    assert_eq!(
        zstd::stream::decode_all(body.as_ref()).unwrap(),
        b"compressed response"
    );
}

#[actix_web::test]
async fn test_response_compression_combines_repeated_accept_encoding_headers() {
    let app = actix_test::init_service(
        App::new()
            .wrap(actix_web::middleware::Compress::default())
            .wrap(actix_web::middleware::from_fn(
                rustrak::middleware::compression::prefer_zstd,
            ))
            .default_service(web::to(|| async {
                HttpResponse::Ok().body("compressed response")
            })),
    )
    .await;
    let request = actix_test::TestRequest::get()
        .insert_header((header::ACCEPT_ENCODING, "br"))
        .insert_header((header::ACCEPT_ENCODING, "zstd"))
        .to_request();

    let response = actix_test::call_service(&app, request).await;
    assert_eq!(
        response.headers().get(header::CONTENT_ENCODING).unwrap(),
        "zstd"
    );
}

#[actix_web::test]
async fn test_response_compression_preserves_brotli_quality_preference() {
    let app = actix_test::init_service(
        App::new()
            .wrap(actix_web::middleware::Compress::default())
            .wrap(actix_web::middleware::from_fn(
                rustrak::middleware::compression::prefer_zstd,
            ))
            .default_service(web::to(|| async {
                HttpResponse::Ok().body("compressed response")
            })),
    )
    .await;
    let request = actix_test::TestRequest::get()
        .insert_header((header::ACCEPT_ENCODING, "br;q=1, zstd;q=0.5"))
        .to_request();

    let response = actix_test::call_service(&app, request).await;
    assert_eq!(
        response.headers().get(header::CONTENT_ENCODING).unwrap(),
        "br"
    );
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

#[test]
fn test_invalid_zstd_data() {
    let result = decompress_body(Bytes::from_static(b"not zstd"), Some("zstd"));

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Invalid zstd"));
}

#[test]
fn test_decompress_zstd_json_assumes_decompressed() {
    let body = Bytes::from_static(br#"{"already":"json"}"#);

    let result = decompress_body(body.clone(), Some("zstd")).unwrap();

    assert_eq!(result, body);
    assert_eq!(result.as_ptr(), body.as_ptr());
}

#[test]
fn test_zstd_decompression_limit_is_enforced() {
    let original = vec![b'x'; rustrak::ingest::decompression::MAX_DECOMPRESSED_SIZE + 1];
    let compressed = zstd::stream::encode_all(original.as_slice(), 0).unwrap();

    let result = decompress_body(Bytes::from(compressed), Some("zstd"));

    assert!(matches!(
        result,
        Err(rustrak::error::AppError::PayloadTooLarge(_))
    ));
}

#[test]
fn test_raw_deflate_decompression_limit_is_enforced() {
    let original = vec![b'x'; rustrak::ingest::decompression::MAX_DECOMPRESSED_SIZE + 1];
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&original).unwrap();
    let compressed = encoder.finish().unwrap();

    let result = decompress_body(Bytes::from(compressed), Some("deflate"));

    assert!(matches!(
        result,
        Err(rustrak::error::AppError::PayloadTooLarge(_))
    ));
}

#[test]
fn test_zlib_deflate_decompression_limit_is_enforced() {
    let original = vec![b'x'; rustrak::ingest::decompression::MAX_DECOMPRESSED_SIZE + 1];
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&original).unwrap();
    let compressed = encoder.finish().unwrap();

    let result = decompress_body(Bytes::from(compressed), Some("deflate"));

    assert!(matches!(
        result,
        Err(rustrak::error::AppError::PayloadTooLarge(_))
    ));
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
    assert_eq!(result.as_ref(), b"x");
}

#[test]
fn test_unicode_payload() {
    let original = "¡Hola! 你好 🎉".as_bytes();
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(original).unwrap();
    let compressed = encoder.finish().unwrap();

    let decompressed = decompress_body(Bytes::from(compressed), Some("gzip")).unwrap();
    assert_eq!(decompressed.as_ref(), original);
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
    assert_eq!(decompressed.as_ref(), envelope);
}
