use crate::error::{AppError, AppResult};
use crate::ingest::envelope::{EnvelopeHeaders, EnvelopeItemKind, ItemHeaders, ParsedEnvelope};

/// Maximum header size (8KB)
const MAX_HEADER_SIZE: usize = 8 * 1024;

/// Maximum size for non-"event" items (session, transaction, attachment, etc.)
const MAX_ITEM_SIZE: usize = 1024 * 1024;

/// The size digest's trimming pass (`services::event_trim`) targets shrinking
/// event payloads under. Matches the original, un-relaxed per-item limit.
pub(crate) const TARGET_EVENT_SIZE: usize = 1024 * 1024;

/// Hard abuse ceiling for "event" items specifically — raised above
/// `TARGET_EVENT_SIZE` so a verbose-but-legitimate event (deep stack traces,
/// frame `vars`, large breadcrumb trails) survives ingest long enough for the
/// digest pipeline to trim it down, instead of being rejected outright for
/// being over budget before anyone got a chance to shrink it.
pub(crate) const MAX_RAW_EVENT_SIZE: usize = 4 * 1024 * 1024;

/// Sentry envelope parser
pub struct EnvelopeParser<'a> {
    data: &'a [u8],
    position: usize,
}

impl<'a> EnvelopeParser<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, position: 0 }
    }

    /// Parses the complete envelope
    pub fn parse(&mut self) -> AppResult<ParsedEnvelope> {
        // 1. Parse envelope headers (first line)
        let headers = self.parse_envelope_headers()?;

        // 2. Parse items
        let mut items = Vec::new();
        while !self.at_eof() {
            if let Some(item) = self.parse_item()? {
                items.push(item);
            }
        }

        Ok(ParsedEnvelope { headers, items })
    }

    fn parse_envelope_headers(&mut self) -> AppResult<EnvelopeHeaders> {
        let line = self.read_line(MAX_HEADER_SIZE)?;

        if line.is_empty() {
            return Err(AppError::Validation("Empty envelope headers".to_string()));
        }

        serde_json::from_slice(&line)
            .map_err(|e| AppError::Validation(format!("Invalid envelope headers JSON: {}", e)))
    }

    fn parse_item(&mut self) -> AppResult<Option<EnvelopeItemKind>> {
        // Read item headers
        let header_line = self.read_line(MAX_HEADER_SIZE)?;

        if header_line.is_empty() {
            return Ok(None);
        }

        let headers: ItemHeaders = serde_json::from_slice(&header_line)
            .map_err(|e| AppError::Validation(format!("Invalid item headers JSON: {}", e)))?;

        // "event" items get the relaxed abuse ceiling — see MAX_RAW_EVENT_SIZE.
        let max_size = if headers.item_type == "event" {
            MAX_RAW_EVENT_SIZE
        } else {
            MAX_ITEM_SIZE
        };

        // Read payload
        let payload = if let Some(length) = headers.length {
            // Explicit length
            if length > max_size {
                return Err(AppError::PayloadTooLarge(format!(
                    "Item payload exceeds {} bytes",
                    max_size
                )));
            }
            let payload = self.read_bytes(length)?;

            // Consume newline after payload (if exists)
            self.skip_newline();

            payload
        } else {
            // Read until newline
            self.read_line(max_size)?
        };

        Ok(Some(EnvelopeItemKind::from((headers, payload))))
    }

    fn read_line(&mut self, max_size: usize) -> AppResult<Vec<u8>> {
        let start = self.position;
        let mut end = self.position;

        while end < self.data.len() && self.data[end] != b'\n' {
            end += 1;
            if end - start > max_size {
                return Err(AppError::PayloadTooLarge(format!(
                    "Line exceeds {} bytes",
                    max_size
                )));
            }
        }

        let line = self.data[start..end].to_vec();
        self.position = if end < self.data.len() { end + 1 } else { end };

        Ok(line)
    }

    fn read_bytes(&mut self, length: usize) -> AppResult<Vec<u8>> {
        if self.position + length > self.data.len() {
            return Err(AppError::Validation(
                "Unexpected EOF while reading item payload".to_string(),
            ));
        }

        let bytes = self.data[self.position..self.position + length].to_vec();
        self.position += length;

        Ok(bytes)
    }

    fn skip_newline(&mut self) {
        if self.position < self.data.len() && self.data[self.position] == b'\n' {
            self.position += 1;
        }
    }

    fn at_eof(&self) -> bool {
        self.position >= self.data.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a minimal envelope with one item of the given type and payload size.
    fn envelope_with_item(item_type: &str, payload_len: usize) -> Vec<u8> {
        let mut data = b"{}\n".to_vec();
        data.extend_from_slice(
            format!(r#"{{"type":"{}","length":{}}}"#, item_type, payload_len).as_bytes(),
        );
        data.push(b'\n');
        data.extend(std::iter::repeat_n(b'a', payload_len));
        data
    }

    #[test]
    fn event_item_between_1mb_and_4mb_is_accepted() {
        let data = envelope_with_item("event", 2 * 1024 * 1024);
        let result = EnvelopeParser::new(&data).parse();
        assert!(
            result.is_ok(),
            "a 2MB event item should be accepted (only >4MB event items are rejected): {:?}",
            result.err()
        );
    }

    #[test]
    fn event_item_over_4mb_is_rejected() {
        let data = envelope_with_item("event", 5 * 1024 * 1024);
        let result = EnvelopeParser::new(&data).parse();
        assert!(
            matches!(result, Err(AppError::PayloadTooLarge(_))),
            "a 5MB event item should still hit the abuse ceiling: {:?}",
            result
        );
    }

    #[test]
    fn non_event_item_over_1mb_is_still_rejected() {
        let data = envelope_with_item("session", 2 * 1024 * 1024);
        let result = EnvelopeParser::new(&data).parse();
        assert!(
            matches!(result, Err(AppError::PayloadTooLarge(_))),
            "non-event items must not get the relaxed event ceiling: {:?}",
            result
        );
    }
}
