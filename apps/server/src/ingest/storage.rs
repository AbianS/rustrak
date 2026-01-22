use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

/// Default base directory for pending events
const DEFAULT_INGEST_DIR: &str = "/tmp/rustrak/ingest";

/// Gets the file path for an event_id
pub fn get_event_path(base_dir: &Path, event_id: &str) -> AppResult<PathBuf> {
    // Validate that event_id is a valid UUID (security)
    let uuid = Uuid::parse_str(event_id)
        .map_err(|_| AppError::Validation("Invalid event_id format".to_string()))?;

    // Use hex without dashes for the filename
    let filename = format!("{}.json", uuid.as_simple());

    Ok(base_dir.join(filename))
}

/// Saves the event to the filesystem
pub async fn store_event(base_dir: &Path, event_id: &str, event_data: &[u8]) -> AppResult<PathBuf> {
    // Create directory if it doesn't exist
    fs::create_dir_all(base_dir)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create ingest directory: {}", e)))?;

    let path = get_event_path(base_dir, event_id)?;

    fs::write(&path, event_data)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write event file: {}", e)))?;

    Ok(path)
}

/// Reads an event from the filesystem
pub async fn read_event(base_dir: &Path, event_id: &str) -> AppResult<Vec<u8>> {
    let path = get_event_path(base_dir, event_id)?;

    fs::read(&path)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read event file: {}", e)))
}

/// Deletes an event from the filesystem
pub async fn delete_event(base_dir: &Path, event_id: &str) -> AppResult<()> {
    let path = get_event_path(base_dir, event_id)?;

    // Ignore error if the file doesn't exist (may have been processed twice)
    let _ = fs::remove_file(&path).await;

    Ok(())
}

/// Gets the ingest directory from config or uses default
pub fn get_ingest_dir(configured_dir: Option<&str>) -> PathBuf {
    configured_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(DEFAULT_INGEST_DIR))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_event_path_valid_uuid() {
        let base = Path::new("/tmp/test");
        let path = get_event_path(base, "9ec79c33-ec99-42ab-8353-589fcb2e04dc").unwrap();
        assert!(path
            .to_string_lossy()
            .contains("9ec79c33ec9942ab8353589fcb2e04dc.json"));
    }

    #[test]
    fn test_get_event_path_invalid_uuid() {
        let base = Path::new("/tmp/test");
        let result = get_event_path(base, "not-a-uuid");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_ingest_dir_default() {
        let dir = get_ingest_dir(None);
        assert_eq!(dir, PathBuf::from("/tmp/rustrak/ingest"));
    }

    #[test]
    fn test_get_ingest_dir_custom() {
        let dir = get_ingest_dir(Some("/custom/path"));
        assert_eq!(dir, PathBuf::from("/custom/path"));
    }
}
