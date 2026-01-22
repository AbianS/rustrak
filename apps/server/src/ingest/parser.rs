use crate::error::{AppError, AppResult};
use crate::ingest::envelope::{EnvelopeHeaders, EnvelopeItem, ItemHeaders, ParsedEnvelope};

/// Maximum header size (8KB)
const MAX_HEADER_SIZE: usize = 8 * 1024;

/// Maximum event size (1MB)
const MAX_EVENT_SIZE: usize = 1024 * 1024;

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

    fn parse_item(&mut self) -> AppResult<Option<EnvelopeItem>> {
        // Read item headers
        let header_line = self.read_line(MAX_HEADER_SIZE)?;

        if header_line.is_empty() {
            return Ok(None);
        }

        let headers: ItemHeaders = serde_json::from_slice(&header_line)
            .map_err(|e| AppError::Validation(format!("Invalid item headers JSON: {}", e)))?;

        // Read payload
        let payload = if let Some(length) = headers.length {
            // Explicit length
            if length > MAX_EVENT_SIZE {
                return Err(AppError::PayloadTooLarge(format!(
                    "Item payload exceeds {} bytes",
                    MAX_EVENT_SIZE
                )));
            }
            let payload = self.read_bytes(length)?;

            // Consume newline after payload (if exists)
            self.skip_newline();

            payload
        } else {
            // Read until newline
            self.read_line(MAX_EVENT_SIZE)?
        };

        Ok(Some(EnvelopeItem { headers, payload }))
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
