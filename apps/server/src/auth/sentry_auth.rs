use std::collections::HashMap;

/// Parses the X-Sentry-Auth header value
/// Format: "Sentry sentry_key=xxx, sentry_version=7, sentry_client=..."
pub fn parse_sentry_auth_header(header_value: &str) -> HashMap<String, String> {
    if !header_value.starts_with("Sentry ") {
        return HashMap::new();
    }

    let pairs = &header_value["Sentry ".len()..];

    pairs
        .split(',')
        .filter_map(|pair| {
            let pair = pair.trim();
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.trim().to_string();
            let value = parts.next()?.trim().to_string();
            Some((key, value))
        })
        .collect()
}
