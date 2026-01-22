use bytes::Bytes;
use flate2::read::{DeflateDecoder, GzDecoder};
use std::io::Read;

use crate::error::{AppError, AppResult};

/// Maximum compressed content (100MB)
pub const MAX_COMPRESSED_SIZE: usize = 100 * 1024 * 1024;

/// Maximum decompressed content (100MB)
pub const MAX_DECOMPRESSED_SIZE: usize = 100 * 1024 * 1024;

/// Reads and decompresses the body according to Content-Encoding
pub fn decompress_body(body: Bytes, content_encoding: Option<&str>) -> AppResult<Vec<u8>> {
    // Verify compressed size
    if body.len() > MAX_COMPRESSED_SIZE {
        return Err(AppError::PayloadTooLarge(format!(
            "Compressed payload exceeds {} bytes",
            MAX_COMPRESSED_SIZE
        )));
    }

    let decompressed = match content_encoding {
        Some("gzip") => decompress_gzip(&body)?,
        Some("deflate") => decompress_deflate(&body)?,
        Some("br") => decompress_brotli(&body)?,
        Some(other) => {
            return Err(AppError::Validation(format!(
                "Unsupported Content-Encoding: {}",
                other
            )));
        }
        None => body.to_vec(),
    };

    // Verify decompressed size
    if decompressed.len() > MAX_DECOMPRESSED_SIZE {
        return Err(AppError::PayloadTooLarge(format!(
            "Decompressed payload exceeds {} bytes",
            MAX_DECOMPRESSED_SIZE
        )));
    }

    Ok(decompressed)
}

fn decompress_gzip(data: &[u8]) -> AppResult<Vec<u8>> {
    // Check for gzip magic bytes (1f 8b)
    // If not present, the data might have been auto-decompressed by the framework
    if data.len() < 2 || data[0] != 0x1f || data[1] != 0x8b {
        log::debug!(
            "decompress_gzip: data doesn't have gzip magic bytes, assuming already decompressed"
        );
        return Ok(data.to_vec());
    }

    let mut decoder = GzDecoder::new(data);
    let mut decompressed = Vec::new();
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| AppError::Validation(format!("Invalid gzip data: {}", e)))?;
    Ok(decompressed)
}

fn decompress_deflate(data: &[u8]) -> AppResult<Vec<u8>> {
    // Deflate doesn't have magic bytes, but we can try to detect if it's already JSON
    if data.starts_with(b"{") || data.starts_with(b"[") {
        log::debug!("decompress_deflate: data looks like JSON, assuming already decompressed");
        return Ok(data.to_vec());
    }

    let mut decoder = DeflateDecoder::new(data);
    let mut decompressed = Vec::new();
    decoder
        .read_to_end(&mut decompressed)
        .map_err(|e| AppError::Validation(format!("Invalid deflate data: {}", e)))?;
    Ok(decompressed)
}

fn decompress_brotli(data: &[u8]) -> AppResult<Vec<u8>> {
    // Brotli doesn't have reliable magic bytes, but we can try to detect if it's already JSON
    if data.starts_with(b"{") || data.starts_with(b"[") {
        log::debug!("decompress_brotli: data looks like JSON, assuming already decompressed");
        return Ok(data.to_vec());
    }

    let mut decompressed = Vec::new();
    brotli::BrotliDecompress(&mut std::io::Cursor::new(data), &mut decompressed)
        .map_err(|e| AppError::Validation(format!("Invalid brotli data: {}", e)))?;
    Ok(decompressed)
}

/// Extracts Content-Encoding from the request headers
pub fn get_content_encoding(req: &actix_web::HttpRequest) -> Option<String> {
    req.headers()
        .get("content-encoding")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase())
}
