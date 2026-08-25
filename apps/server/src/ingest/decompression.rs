use bytes::Bytes;
use flate2::{Decompress, FlushDecompress, Status};
use std::io::Read;

use crate::error::{AppError, AppResult};

/// Maximum compressed content (100MB)
pub const MAX_COMPRESSED_SIZE: usize = 100 * 1024 * 1024;

/// Maximum decompressed content (100MB)
pub const MAX_DECOMPRESSED_SIZE: usize = 100 * 1024 * 1024;

// zstd windows are powers of two.  A 2^27 window is the smallest one that
// covers the decompressed payload limit, and prevents a frame header from
// making the decoder reserve an unnecessarily large history buffer.
const MAX_ZSTD_WINDOW_LOG: u32 = 27;

/// Reads and decompresses the body according to Content-Encoding.
///
/// Returns [`Bytes`] so an already-uncompressed body is passed through without
/// an additional copy; only actual decompression allocates a new buffer.
pub fn decompress_body(body: Bytes, content_encoding: Option<&str>) -> AppResult<Bytes> {
    // Verify compressed size
    if body.len() > MAX_COMPRESSED_SIZE {
        return Err(AppError::PayloadTooLarge(format!(
            "Compressed payload exceeds {} bytes",
            MAX_COMPRESSED_SIZE
        )));
    }

    let Some(content_encoding) = content_encoding else {
        return Ok(body);
    };

    // Content-Encoding lists codings in application order, so decode them in
    // reverse order (for example, "gzip, zstd" is decoded as zstd then gzip).
    let encodings = content_encoding
        .split(',')
        .map(str::trim)
        .collect::<Vec<_>>();
    if encodings.iter().any(|encoding| encoding.is_empty()) {
        return Err(AppError::Validation(
            "Malformed Content-Encoding header".to_string(),
        ));
    }

    let mut decompressed = body;
    for encoding in encodings.into_iter().rev() {
        let encoding = encoding.to_ascii_lowercase();
        decompressed = match encoding.as_str() {
            "gzip" => decompress_gzip(&decompressed)?,
            "deflate" => decompress_deflate(&decompressed)?,
            "br" => decompress_brotli(&decompressed)?,
            "zstd" => decompress_zstd(&decompressed)?,
            "identity" => decompressed,
            other => {
                return Err(AppError::Validation(format!(
                    "Unsupported Content-Encoding: {}",
                    other
                )));
            }
        };
    }

    Ok(decompressed)
}

fn decompress_gzip(data: &Bytes) -> AppResult<Bytes> {
    // Check for gzip magic bytes (1f 8b)
    // If not present, the data might have been auto-decompressed by the framework
    if data.len() < 2 || data[0] != 0x1f || data[1] != 0x8b {
        log::debug!(
            "decompress_gzip: data doesn't have gzip magic bytes, assuming already decompressed"
        );
        return Ok(data.clone());
    }

    let mut decoder = flate2::read::MultiGzDecoder::new(data.as_ref());
    let mut decompressed = Vec::new();
    decoder
        .by_ref()
        .take((MAX_DECOMPRESSED_SIZE + 1) as u64)
        .read_to_end(&mut decompressed)
        .map_err(|e| AppError::Validation(format!("Invalid gzip data: {}", e)))?;
    reject_oversized_decompressed(&decompressed)?;
    Ok(Bytes::from(decompressed))
}

fn decompress_deflate(data: &Bytes) -> AppResult<Bytes> {
    // Deflate has no magic bytes, but we can detect whether it already looks
    // like JSON.
    let assume_decompressed = data.starts_with(b"{") || data.starts_with(b"[");

    // RFC 9110 defines HTTP `deflate` as the zlib-wrapped format.  A raw
    // DEFLATE fallback keeps compatibility with older clients and servers.
    let decompressed = match decompress_deflate_stream(data, true) {
        Ok(decompressed) => decompressed,
        Err(DeflateError::TooLarge) => {
            return Err(AppError::PayloadTooLarge(format!(
                "Decompressed payload exceeds {} bytes",
                MAX_DECOMPRESSED_SIZE
            )))
        }
        Err(DeflateError::Invalid(_)) => match decompress_deflate_stream(data, false) {
            Ok(decompressed) => decompressed,
            Err(DeflateError::TooLarge) => {
                return Err(AppError::PayloadTooLarge(format!(
                    "Decompressed payload exceeds {} bytes",
                    MAX_DECOMPRESSED_SIZE
                )))
            }
            Err(DeflateError::Invalid(error)) => {
                if assume_decompressed {
                    log::debug!(
                        "decompress_deflate: invalid stream looks like JSON, assuming already decompressed"
                    );
                    return Ok(data.clone());
                }
                return Err(AppError::Validation(format!(
                    "Invalid deflate data: {}",
                    error
                )));
            }
        },
    };
    Ok(Bytes::from(decompressed))
}

fn decompress_brotli(data: &Bytes) -> AppResult<Bytes> {
    // Brotli has no reliable magic bytes, but we can detect whether it already
    // looks like JSON.
    let assume_decompressed = data.starts_with(b"{") || data.starts_with(b"[");

    let mut state = brotli::BrotliState::new(
        brotli::enc::StandardAlloc::default(),
        brotli::enc::StandardAlloc::default(),
        brotli::enc::StandardAlloc::default(),
    );
    let mut input_offset = 0;
    let mut available_in = data.len();
    let mut total_out = 0;
    let mut decompressed = Vec::new();
    let mut output = [0u8; 8192];

    loop {
        let mut available_out = output.len();
        let mut output_offset = 0;
        let result = brotli::BrotliDecompressStream(
            &mut available_in,
            &mut input_offset,
            data.as_ref(),
            &mut available_out,
            &mut output_offset,
            &mut output,
            &mut total_out,
            &mut state,
        );
        decompressed.extend_from_slice(&output[..output_offset]);
        if decompressed.len() > MAX_DECOMPRESSED_SIZE {
            return Err(AppError::PayloadTooLarge(format!(
                "Decompressed payload exceeds {} bytes",
                MAX_DECOMPRESSED_SIZE
            )));
        }

        match result {
            brotli::BrotliResult::ResultSuccess => {
                if available_in != 0 {
                    if assume_decompressed {
                        log::debug!(
                            "decompress_brotli: invalid stream looks like JSON, assuming already decompressed"
                        );
                        return Ok(data.clone());
                    }
                    return Err(AppError::Validation(
                        "Invalid brotli data: trailing bytes".to_string(),
                    ));
                }
                return Ok(Bytes::from(decompressed));
            }
            brotli::BrotliResult::NeedsMoreOutput => {}
            brotli::BrotliResult::NeedsMoreInput => {
                if assume_decompressed {
                    log::debug!(
                        "decompress_brotli: invalid stream looks like JSON, assuming already decompressed"
                    );
                    return Ok(data.clone());
                }
                return Err(AppError::Validation(
                    "Invalid brotli data: truncated stream".to_string(),
                ));
            }
            brotli::BrotliResult::ResultFailure => {
                if assume_decompressed {
                    log::debug!(
                        "decompress_brotli: invalid stream looks like JSON, assuming already decompressed"
                    );
                    return Ok(data.clone());
                }
                return Err(AppError::Validation(
                    "Invalid brotli data: decoder failure".to_string(),
                ));
            }
        }
    }
}

enum DeflateError {
    Invalid(String),
    TooLarge,
}

fn decompress_deflate_stream(data: &[u8], zlib_header: bool) -> Result<Vec<u8>, DeflateError> {
    let mut decoder = Decompress::new(zlib_header);
    let mut decompressed = Vec::new();
    let mut output = [0u8; 8192];

    loop {
        let input_offset = decoder.total_in() as usize;
        if input_offset > data.len() {
            return Err(DeflateError::Invalid(
                "decoder consumed too much input".to_string(),
            ));
        }
        let input_before = decoder.total_in();
        let output_before = decoder.total_out();
        let flush = if input_offset < data.len() {
            FlushDecompress::None
        } else {
            FlushDecompress::Finish
        };
        let status = decoder
            .decompress(&data[input_offset..], &mut output, flush)
            .map_err(|error| DeflateError::Invalid(error.to_string()))?;
        let produced = (decoder.total_out() - output_before) as usize;
        decompressed.extend_from_slice(&output[..produced]);
        if decompressed.len() > MAX_DECOMPRESSED_SIZE {
            return Err(DeflateError::TooLarge);
        }

        match status {
            Status::StreamEnd => {
                if decoder.total_in() != data.len() as u64 {
                    return Err(DeflateError::Invalid("trailing bytes".to_string()));
                }
                return Ok(decompressed);
            }
            Status::Ok => {
                if decoder.total_in() == input_before && decoder.total_out() == output_before {
                    return Err(DeflateError::Invalid(
                        "decoder made no progress".to_string(),
                    ));
                }
            }
            Status::BufError => {
                if decoder.total_in() == input_before && decoder.total_out() == output_before {
                    return Err(DeflateError::Invalid(
                        "decoder made no progress".to_string(),
                    ));
                }
            }
        }
    }
}

fn decompress_zstd(data: &Bytes) -> AppResult<Bytes> {
    // Keep compatibility with servers/frameworks that already decompressed the
    // request before handing it to the application.
    let assume_decompressed = data.starts_with(b"{") || data.starts_with(b"[");

    let decompressed = match decompress_zstd_payload(data) {
        Ok(decompressed) => decompressed,
        Err(_error) if assume_decompressed => {
            log::debug!(
                "decompress_zstd: invalid stream looks like JSON, assuming already decompressed"
            );
            return Ok(data.clone());
        }
        Err(error) => return Err(error),
    };
    Ok(Bytes::from(decompressed))
}

pub(crate) fn decompress_zstd_payload(data: &[u8]) -> AppResult<Vec<u8>> {
    let mut decoder = zstd::stream::read::Decoder::new(data)
        .map_err(|e| AppError::Validation(format!("Invalid zstd data: {}", e)))?;
    decoder
        .window_log_max(MAX_ZSTD_WINDOW_LOG)
        .map_err(|e| AppError::Validation(format!("Invalid zstd data: {}", e)))?;
    let mut decompressed = Vec::new();
    decoder
        .take((MAX_DECOMPRESSED_SIZE + 1) as u64)
        .read_to_end(&mut decompressed)
        .map_err(|error| AppError::Validation(format!("Invalid zstd data: {}", error)))?;
    reject_oversized_decompressed(&decompressed)?;
    Ok(decompressed)
}

fn reject_oversized_decompressed(data: &[u8]) -> AppResult<()> {
    if data.len() > MAX_DECOMPRESSED_SIZE {
        return Err(AppError::PayloadTooLarge(format!(
            "Decompressed payload exceeds {} bytes",
            MAX_DECOMPRESSED_SIZE
        )));
    }
    Ok(())
}

#[cfg(test)]
struct LimitedWriter {
    data: Vec<u8>,
    limit: usize,
    exceeded: bool,
}

#[cfg(test)]
impl LimitedWriter {
    fn new(limit: usize) -> Self {
        Self {
            data: Vec::new(),
            limit,
            exceeded: false,
        }
    }
}

#[cfg(test)]
impl std::io::Write for LimitedWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        if buf.len() > self.limit.saturating_sub(self.data.len()) {
            self.exceeded = true;
            return Err(std::io::Error::other("decompressed payload limit exceeded"));
        }
        self.data.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Extracts Content-Encoding from the request headers
pub fn get_content_encoding(req: &actix_web::HttpRequest) -> AppResult<Option<String>> {
    let values = req
        .headers()
        .get_all("content-encoding")
        .map(|value| {
            value.to_str().map_err(|_| {
                AppError::Validation("Content-Encoding header is not valid ASCII".to_string())
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    let normalized = values.join(",");
    if values.is_empty() {
        return Ok(None);
    }
    if normalized.trim().is_empty() {
        return Err(AppError::Validation(
            "Malformed Content-Encoding header".to_string(),
        ));
    }
    let codings = normalized.split(',').map(str::trim).collect::<Vec<_>>();
    if codings.iter().any(|encoding| encoding.is_empty()) {
        return Err(AppError::Validation(
            "Malformed Content-Encoding header".to_string(),
        ));
    }
    let codings = codings.join(",").to_ascii_lowercase();
    Ok((!codings.is_empty()).then_some(codings))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_content_encoding_passes_the_body_through_unchanged() {
        let body = Bytes::from_static(b"{\"event_id\":\"abc\"}");
        let out = decompress_body(body.clone(), None).unwrap();
        assert_eq!(out, body);
        // Zero-copy: the returned Bytes must share the input's allocation,
        // not a copy of it.
        assert_eq!(out.as_ptr(), body.as_ptr());
    }

    #[test]
    fn blank_content_encoding_is_rejected_instead_of_treated_as_absent() {
        let request = actix_web::test::TestRequest::default()
            .insert_header(("Content-Encoding", "   "))
            .to_http_request();

        assert!(matches!(
            get_content_encoding(&request),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn gzip_body_is_decompressed() {
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        use std::io::Write;
        gz.write_all(b"{\"event_id\":\"abc\"}").unwrap();
        let compressed = Bytes::from(gz.finish().unwrap());

        let out = decompress_body(compressed, Some("gzip")).unwrap();
        assert_eq!(out.as_ref(), b"{\"event_id\":\"abc\"}");
    }

    #[test]
    fn gzip_encoding_without_magic_bytes_falls_back_to_the_input() {
        // Actix may have auto-decompressed already; the body is plain JSON.
        let body = Bytes::from_static(b"{\"event_id\":\"abc\"}");
        let out = decompress_body(body.clone(), Some("gzip")).unwrap();
        assert_eq!(out, body);
        assert_eq!(out.as_ptr(), body.as_ptr());
    }

    #[test]
    fn invalid_gzip_data_is_rejected() {
        let body = Bytes::from_static(b"\x1f\x8b\x08\x00not gzip");
        let result = decompress_body(body, Some("gzip"));
        assert!(matches!(result, Err(AppError::Validation(_))));
    }

    #[test]
    fn oversized_payload_is_rejected() {
        let body = Bytes::from(vec![b'x'; MAX_COMPRESSED_SIZE + 1]);
        let result = decompress_body(body, None);
        assert!(matches!(result, Err(AppError::PayloadTooLarge(_))));
    }

    #[test]
    fn limited_writer_rejects_output_past_its_limit() {
        use std::io::Write;

        let mut writer = LimitedWriter::new(2);
        assert!(writer.write_all(b"abc").is_err());
        assert!(writer.exceeded);
        assert!(writer.data.is_empty());
    }

    #[test]
    fn decompressed_size_guard_rejects_output_past_the_global_limit() {
        let data = vec![0; MAX_DECOMPRESSED_SIZE + 1];
        assert!(matches!(
            reject_oversized_decompressed(&data),
            Err(AppError::PayloadTooLarge(_))
        ));
    }
}
