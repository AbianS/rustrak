use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct CliConfig {
    pub url: Option<String>,
    pub token: Option<String>,
}

impl CliConfig {
    pub fn path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("rustrak")
            .join("config.json")
    }

    pub fn load() -> Self {
        let path = Self::path();
        if path.exists() {
            let data = std::fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> std::io::Result<()> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, data)
    }

    pub fn url(&self) -> Result<&str, &'static str> {
        self.url
            .as_deref()
            .ok_or("Server URL not configured. Run: rustrak config --url <url> --token <token>")
    }

    pub fn token(&self) -> Result<&str, &'static str> {
        self.token
            .as_deref()
            .ok_or("Token not configured. Run: rustrak config --url <url> --token <token>")
    }
}
