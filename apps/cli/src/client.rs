use crate::config::CliConfig;
use reqwest::header;

/// Build a progenitor Client with bearer token auth from config.
pub fn build_client(config: &CliConfig) -> Result<crate::generated::Client, String> {
    let url = config.url()?;
    let token = config.token()?;

    let mut headers = header::HeaderMap::new();
    let auth_value = header::HeaderValue::from_str(&format!("Bearer {}", token))
        .map_err(|e| format!("Invalid token: {}", e))?;
    headers.insert(header::AUTHORIZATION, auth_value);

    let http_client = reqwest::ClientBuilder::new()
        .default_headers(headers)
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    Ok(crate::generated::Client::new_with_client(url, http_client))
}
