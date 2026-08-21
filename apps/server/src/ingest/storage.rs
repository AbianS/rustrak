use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::ingest::EventMetadata;

/// Default base directory for pending events
const DEFAULT_INGEST_DIR: &str = "/tmp/rustrak/ingest";
const PENDING_EVENT_VERSION: u8 = 1;
const ORPHANED_TEMPORARY_FILE_GRACE: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum EventStorageLocation {
    Project,
    Legacy,
}

#[derive(Debug, Deserialize, Serialize)]
struct PendingEventRecord {
    version: u8,
    metadata: EventMetadata,
    event_data: String,
}

/// Gets the legacy file path for an event_id.
pub fn get_event_path(base_dir: &Path, event_id: &str) -> AppResult<PathBuf> {
    let uuid = Uuid::parse_str(event_id)
        .map_err(|_| AppError::Validation("Invalid event_id format".to_string()))?;
    Ok(base_dir.join(format!("{}.json", uuid.as_simple())))
}

fn get_event_metadata_path(base_dir: &Path, event_id: &str) -> AppResult<PathBuf> {
    Ok(get_event_path(base_dir, event_id)?.with_extension("meta.json"))
}

fn get_pending_event_path(base_dir: &Path, event_id: &str) -> AppResult<PathBuf> {
    Ok(get_event_path(base_dir, event_id)?.with_extension("pending.json"))
}

fn get_project_event_path(base_dir: &Path, project_id: i32, event_id: &str) -> AppResult<PathBuf> {
    let uuid = Uuid::parse_str(event_id)
        .map_err(|_| AppError::Validation("Invalid event_id format".to_string()))?;
    Ok(base_dir.join(format!("project-{project_id}-{}.json", uuid.as_simple())))
}

fn get_project_pending_event_path(
    base_dir: &Path,
    project_id: i32,
    event_id: &str,
) -> AppResult<PathBuf> {
    Ok(get_project_event_path(base_dir, project_id, event_id)?.with_extension("pending.json"))
}

fn same_event_id(left: &str, right: &str) -> bool {
    Uuid::parse_str(left).ok() == Uuid::parse_str(right).ok()
}

fn validate_pending_record(
    record: PendingEventRecord,
    event_id: &str,
    project_id: Option<i32>,
) -> AppResult<Vec<u8>> {
    if record.version != PENDING_EVENT_VERSION
        || !same_event_id(&record.metadata.event_id, event_id)
        || project_id.is_some_and(|id| record.metadata.project_id != id)
    {
        return Err(AppError::Internal(
            "Invalid pending event record identity".to_string(),
        ));
    }
    STANDARD
        .decode(record.event_data)
        .map_err(|e| AppError::Internal(format!("Invalid pending event payload: {}", e)))
}

async fn read_pending_record(
    path: &Path,
    event_id: &str,
    project_id: Option<i32>,
) -> AppResult<Vec<u8>> {
    let bytes = fs::read(path)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read event file: {}", e)))?;
    let record: PendingEventRecord = serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Internal(format!("Invalid pending event record: {}", e)))?;
    validate_pending_record(record, event_id, project_id)
}

async fn write_atomically(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Internal("Invalid ingest file path".to_string()))?;
    let temporary_path = path.with_file_name(format!(".{file_name}.tmp-{}", Uuid::new_v4()));

    let mut temporary_file = match fs::File::create(&temporary_path).await {
        Ok(file) => file,
        Err(e) => {
            let _ = fs::remove_file(&temporary_path).await;
            return Err(AppError::Internal(format!(
                "Failed to write temporary ingest file: {}",
                e
            )));
        }
    };
    if let Err(e) = temporary_file.write_all(bytes).await {
        let _ = fs::remove_file(&temporary_path).await;
        return Err(AppError::Internal(format!(
            "Failed to write temporary ingest file: {}",
            e
        )));
    }
    if let Err(e) = temporary_file.sync_all().await {
        let _ = fs::remove_file(&temporary_path).await;
        return Err(AppError::Internal(format!(
            "Failed to sync temporary ingest file: {}",
            e
        )));
    }

    match fs::hard_link(&temporary_path, path).await {
        Ok(()) => {
            let _ = fs::remove_file(&temporary_path).await;
        }
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
            // A duplicate event ID is idempotent: keep the first complete
            // record instead of allowing a later payload to win a race.
            let _ = fs::remove_file(&temporary_path).await;
            return Ok(());
        }
        Err(e) => {
            let _ = fs::remove_file(&temporary_path).await;
            return Err(AppError::Internal(format!(
                "Failed to publish ingest file: {}",
                e
            )));
        }
    }

    if let Some(parent) = path.parent() {
        let directory = fs::File::open(parent)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to open ingest directory: {}", e)))?;
        directory
            .sync_all()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to sync ingest directory: {}", e)))?;
    }

    Ok(())
}

/// Saves an event using the legacy, unscoped path.
pub async fn store_event(base_dir: &Path, event_id: &str, event_data: &[u8]) -> AppResult<PathBuf> {
    fs::create_dir_all(base_dir)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create ingest directory: {}", e)))?;
    let path = get_event_path(base_dir, event_id)?;
    fs::write(&path, event_data)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write event file: {}", e)))?;
    Ok(path)
}

/// Saves an event and the metadata needed to recover it after a worker restart.
pub async fn store_event_with_metadata(
    base_dir: &Path,
    event_id: &str,
    event_data: &[u8],
    metadata: &EventMetadata,
) -> AppResult<PathBuf> {
    if !same_event_id(&metadata.event_id, event_id) {
        return Err(AppError::Validation(
            "Event metadata does not match event_id".to_string(),
        ));
    }
    let path = get_project_event_path(base_dir, metadata.project_id, event_id)?;
    let pending_path = get_project_pending_event_path(base_dir, metadata.project_id, event_id)?;
    let record = PendingEventRecord {
        version: PENDING_EVENT_VERSION,
        metadata: metadata.clone(),
        event_data: STANDARD.encode(event_data),
    };
    let record_bytes = serde_json::to_vec(&record)
        .map_err(|e| AppError::Internal(format!("Failed to serialize pending event: {}", e)))?;

    fs::create_dir_all(base_dir)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create ingest directory: {}", e)))?;
    write_atomically(&pending_path, &record_bytes).await?;
    Ok(path)
}

/// Reads an event from the legacy filesystem path.
pub async fn read_event(base_dir: &Path, event_id: &str) -> AppResult<Vec<u8>> {
    let path = get_event_path(base_dir, event_id)?;
    let pending_path = get_pending_event_path(base_dir, event_id)?;
    match fs::try_exists(&pending_path).await {
        Ok(true) => read_pending_record(&pending_path, event_id, None).await,
        Ok(false) => fs::read(&path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read event file: {}", e))),
        Err(e) => Err(AppError::Internal(format!(
            "Failed to read event file: {}",
            e
        ))),
    }
}

pub(crate) async fn read_event_with_location(
    base_dir: &Path,
    project_id: i32,
    event_id: &str,
) -> AppResult<(Vec<u8>, EventStorageLocation)> {
    let project_pending_path = get_project_pending_event_path(base_dir, project_id, event_id)?;
    match fs::try_exists(&project_pending_path).await {
        Ok(true) => {
            return Ok((
                read_pending_record(&project_pending_path, event_id, Some(project_id)).await?,
                EventStorageLocation::Project,
            ));
        }
        Ok(false) => {}
        Err(e) => {
            return Err(AppError::Internal(format!(
                "Failed to read event file: {}",
                e
            )))
        }
    }

    let project_path = get_project_event_path(base_dir, project_id, event_id)?;
    match fs::try_exists(&project_path).await {
        Ok(true) => {
            return Ok((
                fs::read(&project_path)
                    .await
                    .map_err(|e| AppError::Internal(format!("Failed to read event file: {}", e)))?,
                EventStorageLocation::Project,
            ));
        }
        Ok(false) => {}
        Err(e) => {
            return Err(AppError::Internal(format!(
                "Failed to read event file: {}",
                e
            )))
        }
    }

    let legacy_pending_path = get_pending_event_path(base_dir, event_id)?;
    match fs::try_exists(&legacy_pending_path).await {
        Ok(true) => Ok((
            read_pending_record(&legacy_pending_path, event_id, Some(project_id)).await?,
            EventStorageLocation::Legacy,
        )),
        Ok(false) => {
            let legacy_path = get_event_path(base_dir, event_id)?;
            match fs::read(&legacy_path).await {
                Ok(bytes) => Ok((bytes, EventStorageLocation::Legacy)),
                Err(e) => Err(AppError::Internal(format!(
                    "Failed to read event file: {}",
                    e
                ))),
            }
        }
        Err(e) => Err(AppError::Internal(format!(
            "Failed to read event file: {}",
            e
        ))),
    }
}

pub async fn read_event_for_project(
    base_dir: &Path,
    project_id: i32,
    event_id: &str,
) -> AppResult<Vec<u8>> {
    Ok(read_event_with_location(base_dir, project_id, event_id)
        .await?
        .0)
}

/// Deletes an event from the legacy filesystem path.
pub async fn delete_event(base_dir: &Path, event_id: &str) -> AppResult<()> {
    delete_paths(vec![
        get_event_path(base_dir, event_id)?,
        get_event_metadata_path(base_dir, event_id)?,
        get_pending_event_path(base_dir, event_id)?,
    ])
    .await
}

pub(crate) async fn delete_event_at(
    base_dir: &Path,
    project_id: i32,
    event_id: &str,
    location: EventStorageLocation,
) -> AppResult<()> {
    let paths = match location {
        EventStorageLocation::Project => vec![
            get_project_event_path(base_dir, project_id, event_id)?,
            get_project_pending_event_path(base_dir, project_id, event_id)?,
        ],
        EventStorageLocation::Legacy => vec![
            get_event_path(base_dir, event_id)?,
            get_event_metadata_path(base_dir, event_id)?,
            get_pending_event_path(base_dir, event_id)?,
        ],
    };
    delete_paths(paths).await
}

pub async fn delete_event_for_project(
    base_dir: &Path,
    project_id: i32,
    event_id: &str,
) -> AppResult<()> {
    delete_event_at(
        base_dir,
        project_id,
        event_id,
        EventStorageLocation::Project,
    )
    .await
}

async fn delete_paths(paths: Vec<PathBuf>) -> AppResult<()> {
    for path in paths {
        match fs::remove_file(&path).await {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => log::warn!("Failed to delete event file {:?}: {}", path, e),
        }
    }
    Ok(())
}

fn is_orphaned_temporary_file(file_name: &str) -> bool {
    file_name.starts_with('.') && file_name.contains(".tmp-")
}

async fn cleanup_orphaned_temporary_files(base_dir: &Path) -> AppResult<()> {
    cleanup_orphaned_temporary_files_with_grace(base_dir, ORPHANED_TEMPORARY_FILE_GRACE).await
}

async fn cleanup_orphaned_temporary_files_with_grace(
    base_dir: &Path,
    grace: Duration,
) -> AppResult<()> {
    let mut entries = match fs::read_dir(base_dir).await {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(e) => {
            return Err(AppError::Internal(format!(
                "Failed to read ingest directory: {}",
                e
            )))
        }
    };
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read ingest entry: {}", e)))?
    {
        let path = entry.path();
        if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(is_orphaned_temporary_file)
            && fs::metadata(&path)
                .await
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.elapsed().ok())
                .is_some_and(|age| age >= grace)
        {
            match fs::remove_file(&path).await {
                Ok(()) => log::debug!("Removed orphaned ingest temp file {:?}", path),
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                Err(e) => log::warn!(
                    "Failed to remove orphaned ingest temp file {:?}: {}",
                    path,
                    e
                ),
            }
        }
    }
    Ok(())
}

fn parse_project_pending_filename(file_name: &str) -> Option<(i32, Uuid)> {
    let stem = file_name.strip_suffix(".pending.json")?;
    let stem = stem.strip_prefix("project-")?;
    let (project_id, event_id) = stem.rsplit_once('-')?;
    Some((project_id.parse().ok()?, Uuid::parse_str(event_id).ok()?))
}

fn pending_filename_matches(file_name: &str, metadata: &EventMetadata, event_id: Uuid) -> bool {
    match parse_project_pending_filename(file_name) {
        Some((project_id, filename_id)) => {
            project_id == metadata.project_id && filename_id == event_id
        }
        None => {
            file_name
                .strip_suffix(".pending.json")
                .and_then(|id| Uuid::parse_str(id).ok())
                == Some(event_id)
        }
    }
}

/// Reads pending event metadata left by an interrupted or exhausted digest.
pub async fn list_pending_event_metadata(base_dir: &Path) -> AppResult<Vec<EventMetadata>> {
    cleanup_orphaned_temporary_files(base_dir).await?;
    let mut entries = match fs::read_dir(base_dir).await {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => {
            return Err(AppError::Internal(format!(
                "Failed to read ingest directory: {}",
                e
            )))
        }
    };
    let mut pending = Vec::new();
    let mut seen_events = HashSet::new();

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read ingest entry: {}", e)))?
    {
        let path = entry.path();
        let file_name = match path.file_name().and_then(|name| name.to_str()) {
            Some(file_name) => file_name,
            None => continue,
        };
        let is_pending_record = file_name.ends_with(".pending.json");
        let is_legacy_metadata = file_name.ends_with(".meta.json");
        if !is_pending_record && !is_legacy_metadata {
            continue;
        }

        let bytes = match fs::read(&path).await {
            Ok(bytes) => bytes,
            Err(e) => {
                log::warn!("Skipping unreadable pending event file {:?}: {}", path, e);
                continue;
            }
        };
        if is_pending_record {
            match serde_json::from_slice::<PendingEventRecord>(&bytes) {
                Ok(record) if record.version == PENDING_EVENT_VERSION => {
                    match Uuid::parse_str(&record.metadata.event_id) {
                        Ok(metadata_id) => {
                            let filename_matches =
                                pending_filename_matches(file_name, &record.metadata, metadata_id);
                            if filename_matches
                                && seen_events.insert((record.metadata.project_id, metadata_id))
                            {
                                pending.push(record.metadata);
                            } else if !filename_matches {
                                log::warn!("Skipping invalid pending event identity: {:?}", path);
                            }
                        }
                        Err(_) => log::warn!("Skipping invalid pending event identity: {:?}", path),
                    }
                }
                Ok(_) => log::warn!("Skipping invalid pending event identity: {:?}", path),
                Err(e) => log::warn!("Skipping malformed pending event {:?}: {}", path, e),
            }
        } else {
            match serde_json::from_slice::<EventMetadata>(&bytes) {
                Ok(metadata) => {
                    if let Ok(event_id) = Uuid::parse_str(&metadata.event_id) {
                        if seen_events.insert((metadata.project_id, event_id)) {
                            pending.push(metadata);
                        }
                    } else {
                        log::warn!("Skipping invalid event metadata identity: {:?}", path);
                    }
                }
                Err(e) => log::warn!("Skipping malformed event metadata {:?}: {}", path, e),
            }
        }
    }

    Ok(pending)
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

    fn metadata(event_id: &str, project_id: i32) -> EventMetadata {
        EventMetadata {
            event_id: event_id.to_string(),
            project_id,
            ingested_at: chrono::Utc::now(),
            remote_addr: None,
        }
    }

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

    #[tokio::test]
    async fn project_scopes_same_event_id_and_recovery_listing() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let first = metadata(event_id, 7);
        let second = metadata(event_id, 8);

        store_event_with_metadata(dir.path(), event_id, br#"{"project":7}"#, &first)
            .await
            .unwrap();
        store_event_with_metadata(dir.path(), event_id, br#"{"project":8}"#, &second)
            .await
            .unwrap();

        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            br#"{"project":7}"#
        );
        assert_eq!(
            read_event_for_project(dir.path(), 8, event_id)
                .await
                .unwrap(),
            br#"{"project":8}"#
        );
        let pending = list_pending_event_metadata(dir.path()).await.unwrap();
        assert_eq!(pending.len(), 2);
        assert!(pending.iter().any(|item| item.project_id == 7));
        assert!(pending.iter().any(|item| item.project_id == 8));

        delete_event_at(dir.path(), 7, event_id, EventStorageLocation::Project)
            .await
            .unwrap();
        assert_eq!(
            read_event_for_project(dir.path(), 8, event_id)
                .await
                .unwrap(),
            br#"{"project":8}"#
        );
    }

    #[tokio::test]
    async fn duplicate_event_id_keeps_the_first_payload() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let metadata = metadata(event_id, 7);

        store_event_with_metadata(dir.path(), event_id, br#"{"first":true}"#, &metadata)
            .await
            .unwrap();
        store_event_with_metadata(dir.path(), event_id, br#"{"second":true}"#, &metadata)
            .await
            .unwrap();

        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            br#"{"first":true}"#
        );
    }

    #[tokio::test]
    async fn mismatched_metadata_is_rejected_without_writing() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let result =
            store_event_with_metadata(dir.path(), event_id, br"{}", &metadata("bad", 7)).await;
        assert!(result.is_err());
        let mut entries = fs::read_dir(dir.path()).await.unwrap();
        assert!(entries.next_entry().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn malformed_pending_record_is_retained_for_recovery() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        store_event(dir.path(), event_id, br#"{"legacy":true}"#)
            .await
            .unwrap();
        store_event_with_metadata(dir.path(), event_id, br"{}", &metadata(event_id, 7))
            .await
            .unwrap();
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        fs::write(&pending_path, b"{").await.unwrap();

        assert!(read_event_for_project(dir.path(), 7, event_id)
            .await
            .is_err());
        assert!(fs::try_exists(pending_path).await.unwrap());
        assert!(
            fs::try_exists(get_event_path(dir.path(), event_id).unwrap())
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn orphaned_atomic_write_temp_files_are_cleaned() {
        let dir = tempfile::tempdir().unwrap();
        let orphan = dir.path().join(".project-7-event.pending.json.tmp-crash");
        fs::write(&orphan, b"partial").await.unwrap();

        cleanup_orphaned_temporary_files_with_grace(dir.path(), Duration::ZERO)
            .await
            .unwrap();
        assert!(!fs::try_exists(orphan).await.unwrap());
    }

    #[tokio::test]
    async fn active_atomic_write_temp_files_are_retained() {
        let dir = tempfile::tempdir().unwrap();
        let active = dir.path().join(".project-7-event.pending.json.tmp-active");
        fs::write(&active, b"partial").await.unwrap();

        list_pending_event_metadata(dir.path()).await.unwrap();

        assert!(fs::try_exists(active).await.unwrap());
    }

    #[tokio::test]
    async fn legacy_pending_event_metadata_round_trips_and_deletes_with_event() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let metadata = metadata(event_id, 7);

        let legacy_path = get_pending_event_path(dir.path(), event_id).unwrap();
        fs::create_dir_all(dir.path()).await.unwrap();
        let record = PendingEventRecord {
            version: PENDING_EVENT_VERSION,
            metadata: metadata.clone(),
            event_data: STANDARD.encode(br"{}"),
        };
        fs::write(&legacy_path, serde_json::to_vec(&record).unwrap())
            .await
            .unwrap();
        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            br"{}"
        );
        delete_event_at(dir.path(), 7, event_id, EventStorageLocation::Legacy)
            .await
            .unwrap();
        assert!(list_pending_event_metadata(dir.path())
            .await
            .unwrap()
            .is_empty());
    }
}
