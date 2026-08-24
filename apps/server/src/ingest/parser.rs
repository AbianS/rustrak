use bytes::Bytes;

use crate::error::{AppError, AppResult};
use crate::ingest::envelope::{EnvelopeHeaders, EnvelopeItemKind, ItemHeaders, ParsedEnvelope};

/// Maximum header size (8KB)
const MAX_HEADER_SIZE: usize = 8 * 1024;

/// Maximum size for non-"event" items (session, transaction, attachment, etc.)
const MAX_ITEM_SIZE: usize = 1024 * 1024;

/// Bound per-envelope metadata amplification from many tiny items.
const MAX_ITEM_COUNT: usize = 1024;

/// Do not retain a large envelope allocation for a tiny selected payload.
pub(crate) const RETAINED_ENVELOPE_OVERHEAD_COPY_FLOOR: usize = 16 * 1024;
/// Copy only when the retained envelope overhead is at least four times the
/// selected payload, avoiding an expensive copy of a large payload for a
/// comparatively small memory saving.
pub(crate) const RETAINED_ENVELOPE_OVERHEAD_COPY_RATIO: usize = 4;

/// The digest's trimming pass (`services::event_trim`) targets shrinking event
/// payloads under this size, matching the original per-item limit.
pub(crate) const TARGET_EVENT_SIZE: usize = 1024 * 1024;

/// Hard abuse ceiling for "event" items specifically — raised above
/// `TARGET_EVENT_SIZE` so a verbose-but-legitimate event (deep stack traces,
/// frame `vars`, large breadcrumb trails) survives ingest long enough for the
/// digest pipeline to trim it down, instead of being rejected outright for
/// being over budget before anyone got a chance to shrink it.
pub(crate) const MAX_RAW_EVENT_SIZE: usize = 4 * 1024 * 1024;

/// Sentry envelope parser.
///
/// Owns the envelope buffer and hands out [`Bytes`] zero-copy slices for item
/// payloads, so the body is never duplicated — every item shares the one
/// allocation until its slice is dropped.
pub struct EnvelopeParser {
    data: Bytes,
    position: usize,
}

pub(crate) fn detach_payload_if_needed(payload: Bytes, envelope_len: usize) -> Bytes {
    let retained_overhead = envelope_len.saturating_sub(payload.len());
    let should_detach = retained_overhead >= RETAINED_ENVELOPE_OVERHEAD_COPY_FLOOR
        && retained_overhead
            >= payload
                .len()
                .saturating_mul(RETAINED_ENVELOPE_OVERHEAD_COPY_RATIO);
    if should_detach {
        Bytes::copy_from_slice(&payload)
    } else {
        payload
    }
}

impl EnvelopeParser {
    pub fn new(data: Bytes) -> Self {
        Self { data, position: 0 }
    }

    pub(crate) fn data(&self) -> &[u8] {
        &self.data
    }

    /// Parses the complete envelope
    pub fn parse(&mut self) -> AppResult<ParsedEnvelope> {
        // 1. Parse envelope headers (first line)
        let headers = self.parse_envelope_headers()?;

        // 2. Parse items
        let mut items = Vec::new();
        while !self.at_eof() {
            if items.len() >= MAX_ITEM_COUNT {
                return Err(AppError::PayloadTooLarge(format!(
                    "Envelope contains more than {} items",
                    MAX_ITEM_COUNT
                )));
            }
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

    fn read_line(&mut self, max_size: usize) -> AppResult<Bytes> {
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

        let line = self.data.slice(start..end);
        self.position = if end < self.data.len() { end + 1 } else { end };

        Ok(line)
    }

    fn read_bytes(&mut self, length: usize) -> AppResult<Bytes> {
        if self.position + length > self.data.len() {
            return Err(AppError::Validation(
                "Unexpected EOF while reading item payload".to_string(),
            ));
        }

        let bytes = self.data.slice(self.position..self.position + length);
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
        let result = EnvelopeParser::new(Bytes::from(data)).parse();
        assert!(
            result.is_ok(),
            "a 2MB event item should be accepted (only >4MB event items are rejected): {:?}",
            result.err()
        );
    }

    #[test]
    fn event_item_over_4mb_is_rejected() {
        let data = envelope_with_item("event", 5 * 1024 * 1024);
        let result = EnvelopeParser::new(Bytes::from(data)).parse();
        assert!(
            matches!(result, Err(AppError::PayloadTooLarge(_))),
            "a 5MB event item should still hit the abuse ceiling: {:?}",
            result
        );
    }

    #[test]
    fn non_event_item_over_1mb_is_still_rejected() {
        let data = envelope_with_item("session", 2 * 1024 * 1024);
        let result = EnvelopeParser::new(Bytes::from(data)).parse();
        assert!(
            matches!(result, Err(AppError::PayloadTooLarge(_))),
            "non-event items must not get the relaxed event ceiling: {:?}",
            result
        );
    }

    #[test]
    fn envelope_with_too_many_tiny_items_is_rejected() {
        let mut data = b"{}\n".to_vec();
        for _ in 0..=MAX_ITEM_COUNT {
            data.extend_from_slice(br#"{"type":"other","length":0}"#);
            data.push(b'\n');
        }

        let result = EnvelopeParser::new(Bytes::from(data)).parse();

        assert!(matches!(result, Err(AppError::PayloadTooLarge(_))));
    }

    #[test]
    fn item_without_length_is_read_until_newline() {
        let mut data = b"{}\n".to_vec();
        data.extend_from_slice(b"{\"type\":\"event\"}\n");
        data.extend_from_slice(b"{\"message\":\"no length given\"}\n");
        let parsed = EnvelopeParser::new(Bytes::from(data)).parse().unwrap();

        assert_eq!(parsed.items.len(), 1);
        let EnvelopeItemKind::Event(payload) = &parsed.items[0] else {
            panic!("expected an event item");
        };
        assert_eq!(payload.as_ref(), b"{\"message\":\"no length given\"}");
    }

    #[test]
    fn item_without_length_is_rejected_when_the_line_exceeds_the_limit() {
        let mut data = b"{}\n{\"type\":\"session\"}\n".to_vec();
        data.extend(std::iter::repeat_n(b'a', MAX_ITEM_SIZE + 1));

        let result = EnvelopeParser::new(Bytes::from(data)).parse();
        assert!(matches!(result, Err(AppError::PayloadTooLarge(_))));
    }

    #[test]
    fn selected_payload_detaches_when_envelope_overhead_is_large() {
        let payload_len = 1024;
        let overhead = RETAINED_ENVELOPE_OVERHEAD_COPY_FLOOR
            .max(payload_len * RETAINED_ENVELOPE_OVERHEAD_COPY_RATIO)
            + 1;
        let envelope = Bytes::from(vec![b'x'; overhead + payload_len]);
        let payload = envelope.slice(..payload_len);

        let detached = detach_payload_if_needed(payload.clone(), envelope.len());

        assert_eq!(detached, payload);
        assert_ne!(detached.as_ptr(), payload.as_ptr());
    }

    #[test]
    fn selected_payload_stays_zero_copy_below_overhead_threshold() {
        let payload_len = 1024;
        let overhead = RETAINED_ENVELOPE_OVERHEAD_COPY_FLOOR - 1;
        let envelope = Bytes::from(vec![b'x'; overhead + payload_len]);
        let payload = envelope.slice(..payload_len);

        let retained = detach_payload_if_needed(payload.clone(), envelope.len());

        assert_eq!(retained, payload);
        assert_eq!(retained.as_ptr(), payload.as_ptr());
    }

    #[test]
    fn large_payload_stays_zero_copy_when_overhead_is_not_four_times_larger() {
        let payload_len = 128 * 1024;
        let overhead = RETAINED_ENVELOPE_OVERHEAD_COPY_FLOOR + 1;
        let envelope = Bytes::from(vec![b'x'; overhead + payload_len]);
        let payload = envelope.slice(..payload_len);

        let retained = detach_payload_if_needed(payload.clone(), envelope.len());

        assert_eq!(retained, payload);
        assert_eq!(retained.as_ptr(), payload.as_ptr());
    }

    #[test]
    fn payload_detaches_at_the_size_aware_boundary() {
        let payload_len = 16 * 1024;
        let overhead = payload_len * RETAINED_ENVELOPE_OVERHEAD_COPY_RATIO;
        let envelope = Bytes::from(vec![b'x'; overhead + payload_len]);
        let payload = envelope.slice(..payload_len);

        let detached = detach_payload_if_needed(payload.clone(), envelope.len());

        assert_eq!(detached, payload);
        assert_ne!(detached.as_ptr(), payload.as_ptr());
    }
}
