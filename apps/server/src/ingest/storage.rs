use base64::{engine::general_purpose::STANDARD, Engine};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{File as StdFile, OpenOptions as StdOpenOptions};
use std::io;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::fs::{self, OpenOptions};
use tokio::io::{AsyncWriteExt, BufWriter};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::ingest::{decompression::decompress_zstd_payload, EventMetadata};

/// Default base directory for pending events
const DEFAULT_INGEST_DIR: &str = "/tmp/rustrak/ingest";
const PENDING_EVENT_VERSION: u8 = 1;
const PENDING_EVENT_ZSTD_VERSION: u8 = 2;
const ORPHANED_TEMPORARY_FILE_GRACE: Duration = Duration::from_secs(300);
const BASE64_WRITE_CHUNK_SIZE: usize = 48 * 1024;
const PENDING_PUBLISH_LOCK_SUFFIX: &str = ".publish.lock";
const PENDING_PUBLISH_REGISTRY_LOCK_NAME: &str = ".publish-lock-registry";

static PENDING_PUBLISH_LOCKS: OnceLock<Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>> = OnceLock::new();

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
    if !matches!(
        record.version,
        PENDING_EVENT_VERSION | PENDING_EVENT_ZSTD_VERSION
    ) || !same_event_id(&record.metadata.event_id, event_id)
        || project_id.is_some_and(|id| record.metadata.project_id != id)
    {
        return Err(AppError::Internal(
            "Invalid pending event record identity".to_string(),
        ));
    }
    let encoded = STANDARD
        .decode(record.event_data)
        .map_err(|e| AppError::Internal(format!("Invalid pending event payload: {}", e)))?;
    if record.version == PENDING_EVENT_ZSTD_VERSION {
        decompress_zstd_payload(&encoded)
    } else {
        Ok(encoded)
    }
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

fn base64_chunk_ranges(data_len: usize) -> impl Iterator<Item = Range<usize>> {
    let full_len = data_len - data_len % 3;
    let mut offset = 0;
    std::iter::from_fn(move || {
        if offset < full_len {
            let start = offset;
            offset = (offset + BASE64_WRITE_CHUNK_SIZE).min(full_len);
            Some(start..offset)
        } else if offset == full_len && full_len < data_len {
            offset = data_len;
            Some(full_len..data_len)
        } else {
            None
        }
    })
}

fn encode_base64_chunk(input: &[u8], output: &mut String) {
    output.clear();
    STANDARD.encode_string(input, output);
}

fn pending_publish_lock_path(path: &Path) -> AppResult<PathBuf> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Internal("Invalid ingest file path".to_string()))?;
    Ok(path.with_file_name(format!(".{file_name}{PENDING_PUBLISH_LOCK_SUFFIX}")))
}

fn pending_publish_registry_lock_path(path: &Path) -> AppResult<PathBuf> {
    path.parent()
        .map(|parent| parent.join(PENDING_PUBLISH_REGISTRY_LOCK_NAME))
        .ok_or_else(|| AppError::Internal("Invalid ingest file path".to_string()))
}

fn open_pending_publish_registry_lock(path: &Path) -> io::Result<StdFile> {
    StdOpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
}

fn pending_publish_lock_identity_matches(lock: &StdFile, path: &Path) -> io::Result<bool> {
    let lock_metadata = lock.metadata()?;
    let path_metadata = std::fs::metadata(path)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;

        Ok(
            lock_metadata.dev() == path_metadata.dev()
                && lock_metadata.ino() == path_metadata.ino(),
        )
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        Ok(
            lock_metadata.volume_serial_number() == path_metadata.volume_serial_number()
                && lock_metadata.file_index() == path_metadata.file_index(),
        )
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = (lock_metadata, path_metadata);
        Ok(true)
    }
}

async fn acquire_pending_publish_lock(path: &Path) -> AppResult<StdFile> {
    let lock_path = pending_publish_lock_path(path)?;
    let registry_path = pending_publish_registry_lock_path(path)?;
    tokio::task::spawn_blocking(move || loop {
        let registry_lock = open_pending_publish_registry_lock(&registry_path).map_err(|e| {
            AppError::Internal(format!(
                "Failed to open ingest publish registry lock: {}",
                e
            ))
        })?;
        registry_lock.lock_exclusive().map_err(|e| {
            AppError::Internal(format!("Failed to lock ingest publish registry: {}", e))
        })?;

        let lock = StdOpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&lock_path)
            .map_err(|e| {
                AppError::Internal(format!("Failed to open ingest publish lock: {}", e))
            })?;
        match lock.try_lock_exclusive() {
            Ok(()) => {
                drop(registry_lock);
                return Ok(lock);
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                drop(registry_lock);
                lock.lock_exclusive().map_err(|e| {
                    AppError::Internal(format!("Failed to lock ingest publish file: {}", e))
                })?;

                let registry_lock =
                    open_pending_publish_registry_lock(&registry_path).map_err(|e| {
                        AppError::Internal(format!(
                            "Failed to open ingest publish registry lock: {}",
                            e
                        ))
                    })?;
                registry_lock.lock_exclusive().map_err(|e| {
                    AppError::Internal(format!("Failed to lock ingest publish registry: {}", e))
                })?;
                let identity_matches = pending_publish_lock_identity_matches(&lock, &lock_path)
                    .map_err(|e| {
                        AppError::Internal(format!(
                            "Failed to validate ingest publish lock identity: {}",
                            e
                        ))
                    })?;
                drop(registry_lock);
                if identity_matches {
                    return Ok(lock);
                }
            }
            Err(error) => {
                return Err(AppError::Internal(format!(
                    "Failed to try-lock ingest publish file: {}",
                    error
                )));
            }
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("Failed to join ingest publish lock task: {}", e)))?
}

fn remove_stale_pending_publish_lock_locked(
    path: &Path,
    _registry_lock: &StdFile,
) -> io::Result<bool> {
    let lock = match StdOpenOptions::new().read(true).write(true).open(path) {
        Ok(lock) => lock,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    };
    match lock.try_lock_exclusive() {
        Ok(()) => {
            drop(lock);
            let removed = match std::fs::remove_file(path) {
                Ok(()) => true,
                Err(error) if error.kind() == io::ErrorKind::NotFound => false,
                Err(error) => return Err(error),
            };
            Ok(removed)
        }
        Err(error) if error.kind() == io::ErrorKind::WouldBlock => Ok(false),
        Err(error) => Err(error),
    }
}

async fn remove_stale_pending_publish_lock(path: &Path) -> io::Result<bool> {
    let path = path.to_owned();
    let registry_path = pending_publish_registry_lock_path(&path)
        .map_err(|error| io::Error::other(error.to_string()))?;
    tokio::task::spawn_blocking(move || {
        let registry_lock = open_pending_publish_registry_lock(&registry_path)?;
        registry_lock.lock_exclusive()?;
        remove_stale_pending_publish_lock_locked(&path, &registry_lock)
    })
    .await
    .map_err(io::Error::other)?
}

async fn write_pending_record(
    file: &mut fs::File,
    metadata: &EventMetadata,
    event_data: &[u8],
) -> io::Result<()> {
    let metadata_bytes = serde_json::to_vec(metadata).map_err(io::Error::other)?;
    let mut writer = BufWriter::new(file);
    let version = PENDING_EVENT_VERSION;
    let payload = event_data;
    writer
        .write_all(format!(r#"{{"version":{version},"metadata":"#).as_bytes())
        .await?;
    writer.write_all(&metadata_bytes).await?;
    writer.write_all(br#","event_data":""#).await?;
    let initial_chunk_len = payload.len().min(BASE64_WRITE_CHUNK_SIZE);
    let mut encoded = String::with_capacity(initial_chunk_len.div_ceil(3) * 4);
    for range in base64_chunk_ranges(payload.len()) {
        encode_base64_chunk(&payload[range], &mut encoded);
        writer.write_all(encoded.as_bytes()).await?;
    }
    writer.write_all(br#""}"#).await?;
    writer.flush().await?;
    writer.get_mut().sync_all().await
}

async fn publish_pending_file(
    path: &Path,
    temporary_path: &Path,
    event_id: &str,
    project_id: i32,
) -> AppResult<()> {
    let locks = PENDING_PUBLISH_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
    let lock = {
        let mut locks = locks.lock().await;
        Arc::clone(
            locks
                .entry(path.to_path_buf())
                .or_insert_with(|| Arc::new(Mutex::new(()))),
        )
    };
    let guard = lock.lock().await;
    let result = match acquire_pending_publish_lock(path).await {
        Ok(filesystem_lock) => {
            let result =
                publish_pending_file_locked(path, temporary_path, event_id, project_id).await;
            drop(filesystem_lock);
            result
        }
        Err(error) => Err(error),
    };
    drop(guard);

    let mut locks = locks.lock().await;
    if locks
        .get(path)
        .is_some_and(|candidate| Arc::ptr_eq(candidate, &lock) && Arc::strong_count(candidate) == 2)
    {
        locks.remove(path);
    }
    result
}

async fn publish_pending_file_locked(
    path: &Path,
    temporary_path: &Path,
    event_id: &str,
    project_id: i32,
) -> AppResult<()> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Internal("Invalid ingest file path".to_string()))?;

    match fs::hard_link(temporary_path, path).await {
        Ok(()) => {
            let _ = fs::remove_file(temporary_path).await;
        }
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
            let is_symlink = match fs::symlink_metadata(path).await {
                Ok(metadata) => metadata.file_type().is_symlink(),
                Err(metadata_error) => {
                    let _ = fs::remove_file(temporary_path).await;
                    return Err(AppError::Internal(format!(
                        "Failed to inspect existing ingest file: {}",
                        metadata_error
                    )));
                }
            };
            let is_complete = if is_symlink {
                false
            } else {
                let existing = match fs::read(path).await {
                    Ok(existing) => existing,
                    Err(read_error) => {
                        let _ = fs::remove_file(temporary_path).await;
                        return Err(AppError::Internal(format!(
                            "Failed to inspect existing ingest file: {}",
                            read_error
                        )));
                    }
                };
                match serde_json::from_slice::<PendingEventRecord>(&existing) {
                    Ok(existing) => {
                        validate_pending_record(existing, event_id, Some(project_id)).is_ok()
                    }
                    Err(_) => false,
                }
            };
            if is_complete {
                // A duplicate event ID is idempotent: keep the first complete
                // record instead of allowing a later payload to win a race.
                let _ = fs::remove_file(temporary_path).await;
                return Ok(());
            }

            let quarantine =
                path.with_file_name(format!(".{file_name}.corrupt-{}", Uuid::new_v4()));
            log::warn!(
                "Quarantining malformed pending ingest file {:?} as {:?}",
                path,
                quarantine
            );
            // Preserve the malformed inode without removing the canonical
            // name first.  The subsequent rename replaces that name
            // atomically, so a crash cannot leave recovery with neither the
            // old record nor the new durable record.
            if let Err(link_error) = fs::hard_link(path, &quarantine).await {
                let _ = fs::remove_file(temporary_path).await;
                return Err(AppError::Internal(format!(
                    "Failed to quarantine ingest file: {}",
                    link_error
                )));
            }
            if let Err(rename_error) = fs::rename(temporary_path, path).await {
                let _ = fs::remove_file(temporary_path).await;
                return Err(AppError::Internal(format!(
                    "Failed to publish replacement ingest file: {}",
                    rename_error
                )));
            }
        }
        Err(e) => {
            let _ = fs::remove_file(temporary_path).await;
            return Err(AppError::Internal(format!(
                "Failed to publish ingest file: {}",
                e
            )));
        }
    }

    sync_parent_directory(path).await?;

    Ok(())
}

async fn write_pending_record_atomically(
    path: &Path,
    event_id: &str,
    project_id: i32,
    metadata: &EventMetadata,
    event_data: &[u8],
) -> AppResult<()> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Internal("Invalid ingest file path".to_string()))?;
    let temporary_path = path.with_file_name(format!(".{file_name}.tmp-{}", Uuid::new_v4()));
    let mut temporary_file = match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .await
    {
        Ok(file) => file,
        Err(e) => {
            let _ = fs::remove_file(&temporary_path).await;
            return Err(AppError::Internal(format!(
                "Failed to write temporary ingest file: {}",
                e
            )));
        }
    };
    if let Err(e) = write_pending_record(&mut temporary_file, metadata, event_data).await {
        let _ = fs::remove_file(&temporary_path).await;
        return Err(AppError::Internal(format!(
            "Failed to write temporary ingest file: {}",
            e
        )));
    }
    drop(temporary_file);
    publish_pending_file(path, &temporary_path, event_id, project_id).await
}

/// Creates the ingest directory once during server startup.
pub async fn prepare_ingest_dir(base_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(base_dir)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create ingest directory: {}", e)))
}

async fn sync_parent_directory(path: &Path) -> AppResult<()> {
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

async fn write_legacy_atomically(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::Internal("Invalid ingest file path".to_string()))?;
    let temporary_path = path.with_file_name(format!(".{file_name}.tmp-{}", Uuid::new_v4()));
    let mut temporary_file = match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .await
    {
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
    if let Err(e) = fs::rename(&temporary_path, path).await {
        let _ = fs::remove_file(&temporary_path).await;
        return Err(AppError::Internal(format!(
            "Failed to publish ingest file: {}",
            e
        )));
    }
    sync_parent_directory(path).await
}

/// Saves an event using the legacy, unscoped path.
pub async fn store_event(base_dir: &Path, event_id: &str, event_data: &[u8]) -> AppResult<PathBuf> {
    prepare_ingest_dir(base_dir).await?;
    let path = get_event_path(base_dir, event_id)?;
    write_legacy_atomically(&path, event_data).await?;
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
    let pending_path = path.with_extension("pending.json");
    prepare_ingest_dir(base_dir).await?;
    match write_pending_record_atomically(
        &pending_path,
        event_id,
        metadata.project_id,
        metadata,
        event_data,
    )
    .await
    {
        Ok(()) => {}
        Err(_error)
            if matches!(
                fs::metadata(base_dir).await,
                Err(e) if e.kind() == io::ErrorKind::NotFound
            ) =>
        {
            // Cleanup can remove the directory after preparation but before
            // the temporary file is opened; recreate it once and retry.
            prepare_ingest_dir(base_dir).await?;
            write_pending_record_atomically(
                &pending_path,
                event_id,
                metadata.project_id,
                metadata,
                event_data,
            )
            .await?
        }
        Err(error) => return Err(error),
    }
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

fn is_pending_publish_lock_file(file_name: &str) -> bool {
    file_name.starts_with('.') && file_name.ends_with(PENDING_PUBLISH_LOCK_SUFFIX)
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
        let file_name = path.file_name().and_then(|name| name.to_str());
        let is_temporary = file_name.is_some_and(is_orphaned_temporary_file);
        let is_publish_lock = file_name.is_some_and(is_pending_publish_lock_file);
        let is_expired = (is_temporary || is_publish_lock)
            && fs::metadata(&path)
                .await
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.elapsed().ok())
                .is_some_and(|age| age >= grace);
        if is_expired && is_publish_lock {
            match remove_stale_pending_publish_lock(&path).await {
                Ok(true) => log::debug!("Removed stale ingest publish lock {:?}", path),
                Ok(false) => {}
                Err(error) => log::warn!(
                    "Failed to remove stale ingest publish lock {:?}: {}",
                    path,
                    error
                ),
            }
        } else if is_expired {
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
                Ok(record)
                    if matches!(
                        record.version,
                        PENDING_EVENT_VERSION | PENDING_EVENT_ZSTD_VERSION
                    ) =>
                {
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
    use proptest::prelude::*;

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
    async fn prepare_ingest_dir_creates_nested_directory_idempotently() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("nested/ingest");

        prepare_ingest_dir(&dir).await.unwrap();
        prepare_ingest_dir(&dir).await.unwrap();

        assert!(dir.is_dir());
    }

    #[test]
    fn base64_scratch_buffer_replaces_previous_chunk() {
        let mut encoded = String::new();

        encode_base64_chunk(b"abc", &mut encoded);
        assert_eq!(encoded, "YWJj");
        encode_base64_chunk(b"d", &mut encoded);
        assert_eq!(encoded, "ZA==");
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
    async fn streamed_pending_payload_round_trips_at_base64_boundaries() {
        let dir = tempfile::tempdir().unwrap();
        let sizes = [
            0,
            1,
            2,
            3,
            4,
            32 * 1024,
            32 * 1024 + 1,
            BASE64_WRITE_CHUNK_SIZE - 1,
            BASE64_WRITE_CHUNK_SIZE,
            BASE64_WRITE_CHUNK_SIZE + 1,
            BASE64_WRITE_CHUNK_SIZE + 2,
            BASE64_WRITE_CHUNK_SIZE + 3,
            4 * 1024 * 1024,
        ];

        for (index, size) in sizes.into_iter().enumerate() {
            let event_id = Uuid::from_u128((index + 1) as u128).to_string();
            let metadata = metadata(&event_id, 7);
            let payload: Vec<u8> = (0..size).map(|byte| (byte % 251) as u8).collect();

            store_event_with_metadata(dir.path(), &event_id, &payload, &metadata)
                .await
                .unwrap();

            let pending_path = get_project_pending_event_path(dir.path(), 7, &event_id).unwrap();
            let record: PendingEventRecord =
                serde_json::from_slice(&fs::read(&pending_path).await.unwrap()).unwrap();
            assert_eq!(record.version, PENDING_EVENT_VERSION);
            assert_eq!(record.metadata.event_id, event_id);
            let stored_payload = STANDARD.decode(record.event_data).unwrap();
            assert_eq!(stored_payload, payload);
            assert_eq!(
                read_event_for_project(dir.path(), 7, &event_id)
                    .await
                    .unwrap(),
                payload
            );
        }
    }

    #[tokio::test]
    async fn malformed_compressed_pending_payload_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        let record = PendingEventRecord {
            version: PENDING_EVENT_ZSTD_VERSION,
            metadata: metadata(event_id, 7),
            event_data: STANDARD.encode(b"not-zstd"),
        };

        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&pending_path, serde_json::to_vec(&record).unwrap())
            .await
            .unwrap();

        assert!(read_event_for_project(dir.path(), 7, event_id)
            .await
            .is_err());
        assert!(fs::try_exists(pending_path).await.unwrap());
    }

    #[tokio::test]
    async fn compressed_pending_record_is_recovered_after_restart() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        let compressed = zstd::stream::encode_all(&b"{\"event\":true}"[..], 0).unwrap();
        let record = PendingEventRecord {
            version: PENDING_EVENT_ZSTD_VERSION,
            metadata: metadata(event_id, 7),
            event_data: STANDARD.encode(compressed),
        };

        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&pending_path, serde_json::to_vec(&record).unwrap())
            .await
            .unwrap();

        let pending = list_pending_event_metadata(dir.path()).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].event_id, event_id);
        assert_eq!(pending[0].project_id, 7);
        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            b"{\"event\":true}"
        );
    }

    #[tokio::test]
    async fn metadata_store_recreates_directory_removed_after_startup() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("ingest");
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let event_metadata = metadata(event_id, 7);

        prepare_ingest_dir(&dir).await.unwrap();
        fs::remove_dir_all(&dir).await.unwrap();
        store_event_with_metadata(&dir, event_id, br"{}", &event_metadata)
            .await
            .unwrap();
        assert!(dir.is_dir());
    }

    proptest! {
        #[test]
        fn base64_chunk_ranges_cover_input_without_midstream_padding(
            data in prop::collection::vec(
                any::<u8>(),
                0..(BASE64_WRITE_CHUNK_SIZE * 3 + 10)
            )
        ) {
            let ranges: Vec<_> = base64_chunk_ranges(data.len()).collect();
            let mut covered = 0;
            let mut chunked_encoding = String::new();

            for (index, range) in ranges.iter().enumerate() {
                prop_assert_eq!(range.start, covered);
                prop_assert!(range.end > range.start);
                prop_assert!(range.end - range.start <= BASE64_WRITE_CHUNK_SIZE);
                if index + 1 < ranges.len() {
                    prop_assert_eq!((range.end - range.start) % 3, 0);
                }
                chunked_encoding.push_str(&STANDARD.encode(&data[range.clone()]));
                covered = range.end;
            }

            prop_assert_eq!(covered, data.len());
            prop_assert_eq!(chunked_encoding, STANDARD.encode(&data));
        }
    }

    #[tokio::test]
    async fn concurrent_duplicate_writes_keep_one_complete_record() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let metadata = metadata(event_id, 7);

        let (first, second) = tokio::join!(
            store_event_with_metadata(dir.path(), event_id, br#"{"first":true}"#, &metadata),
            store_event_with_metadata(dir.path(), event_id, br#"{"second":true}"#, &metadata),
        );
        first.unwrap();
        second.unwrap();

        let stored = read_event_for_project(dir.path(), 7, event_id)
            .await
            .unwrap();
        assert!(stored == br#"{"first":true}"# || stored == br#"{"second":true}"#);
        assert_eq!(
            list_pending_event_metadata(dir.path()).await.unwrap().len(),
            1
        );

        let mut entries = fs::read_dir(dir.path()).await.unwrap();
        while let Some(entry) = entries.next_entry().await.unwrap() {
            assert!(!is_orphaned_temporary_file(
                &entry.file_name().to_string_lossy()
            ));
        }
    }

    #[tokio::test]
    async fn concurrent_replacement_of_malformed_record_keeps_one_payload() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let event_metadata = metadata(event_id, 7);
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();

        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&pending_path, b"malformed").await.unwrap();

        let (first, second) = tokio::join!(
            store_event_with_metadata(dir.path(), event_id, br#"{"first":true}"#, &event_metadata),
            store_event_with_metadata(dir.path(), event_id, br#"{"second":true}"#, &event_metadata),
        );
        first.unwrap();
        second.unwrap();

        let stored = read_event_for_project(dir.path(), 7, event_id)
            .await
            .unwrap();
        assert!(stored == br#"{"first":true}"# || stored == br#"{"second":true}"#);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn cross_process_replacement_serializes_malformed_record_recovery() {
        const ROLE: &str = "RUSTRAK_STORAGE_LOCK_TEST_ROLE";
        const ROOT: &str = "RUSTRAK_STORAGE_LOCK_TEST_ROOT";
        const START: &str = "RUSTRAK_STORAGE_LOCK_TEST_START";
        const RELEASE: &str = "RUSTRAK_STORAGE_LOCK_TEST_RELEASE";

        if let Ok(role) = std::env::var(ROLE) {
            let root = PathBuf::from(std::env::var(ROOT).unwrap());
            let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
            let pending_path = get_project_pending_event_path(&root, 7, event_id).unwrap();
            let start = root.join(std::env::var(START).unwrap());
            let release = root.join(std::env::var(RELEASE).unwrap());

            match role.as_str() {
                "hold" => {
                    let lock = acquire_pending_publish_lock(&pending_path).await.unwrap();
                    fs::write(root.join("lock-held"), b"ready").await.unwrap();
                    tokio::time::timeout(Duration::from_secs(10), async {
                        while !fs::try_exists(&release).await.unwrap() {
                            tokio::time::sleep(Duration::from_millis(5)).await;
                        }
                    })
                    .await
                    .expect("timed out waiting for the parent to release the lock test");
                    drop(lock);
                    store_event_with_metadata(
                        &root,
                        event_id,
                        br#"{"first":true}"#,
                        &metadata(event_id, 7),
                    )
                    .await
                    .unwrap();
                }
                "writer" => {
                    fs::write(root.join("writer-ready"), b"ready")
                        .await
                        .unwrap();
                    tokio::time::timeout(Duration::from_secs(10), async {
                        while !fs::try_exists(&start).await.unwrap() {
                            tokio::time::sleep(Duration::from_millis(5)).await;
                        }
                    })
                    .await
                    .expect("timed out waiting for the parent to start the writer");
                    store_event_with_metadata(
                        &root,
                        event_id,
                        br#"{"second":true}"#,
                        &metadata(event_id, 7),
                    )
                    .await
                    .unwrap();
                }
                _ => panic!("unknown lock test role: {role}"),
            }
            return;
        }

        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&pending_path, b"malformed").await.unwrap();

        let executable = std::env::current_exe().unwrap();
        let test_module = module_path!()
            .strip_prefix(concat!(env!("CARGO_PKG_NAME"), "::"))
            .unwrap_or(module_path!());
        let test_name = format!(
            "{test_module}::{}",
            stringify!(cross_process_replacement_serializes_malformed_record_recovery)
        );
        let mut holder = std::process::Command::new(&executable)
            .args(["--exact", &test_name, "--nocapture"])
            .env(ROLE, "hold")
            .env(ROOT, dir.path())
            .env(START, "writer-start")
            .env(RELEASE, "release")
            .spawn()
            .unwrap();

        let held = dir.path().join("lock-held");
        tokio::time::timeout(Duration::from_secs(10), async {
            while !fs::try_exists(&held).await.unwrap() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();

        let mut writer = std::process::Command::new(&executable)
            .args(["--exact", &test_name, "--nocapture"])
            .env(ROLE, "writer")
            .env(ROOT, dir.path())
            .env(START, "writer-start")
            .env(RELEASE, "release")
            .spawn()
            .unwrap();
        let writer_ready = dir.path().join("writer-ready");
        tokio::time::timeout(Duration::from_secs(10), async {
            while !fs::try_exists(&writer_ready).await.unwrap() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        fs::write(dir.path().join("writer-start"), b"go")
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(writer.try_wait().unwrap().is_none());

        fs::write(dir.path().join("release"), b"go").await.unwrap();
        let holder_status = tokio::task::spawn_blocking(move || holder.wait())
            .await
            .unwrap()
            .unwrap();
        let writer_status = tokio::task::spawn_blocking(move || writer.wait())
            .await
            .unwrap()
            .unwrap();
        assert!(holder_status.success());
        assert!(writer_status.success());

        let stored = read_event_for_project(dir.path(), 7, event_id)
            .await
            .unwrap();
        assert!(stored == br#"{"first":true}"# || stored == br#"{"second":true}"#);
        let mut entries = fs::read_dir(dir.path()).await.unwrap();
        let mut quarantined = 0;
        while let Some(entry) = entries.next_entry().await.unwrap() {
            if entry.file_name().to_string_lossy().contains(".corrupt-") {
                quarantined += 1;
            }
        }
        assert_eq!(quarantined, 1);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn stale_cleanup_cannot_split_publish_lock_identity() {
        const ROLE: &str = "RUSTRAK_STORAGE_LOCK_INTERLEAVING_ROLE";
        const ROOT: &str = "RUSTRAK_STORAGE_LOCK_INTERLEAVING_ROOT";
        const OPENED: &str = "RUSTRAK_STORAGE_LOCK_INTERLEAVING_OPENED";
        const CLEANUP_READY: &str = "RUSTRAK_STORAGE_LOCK_INTERLEAVING_CLEANUP_READY";
        const RELEASE: &str = "RUSTRAK_STORAGE_LOCK_INTERLEAVING_RELEASE";
        const PUBLISHED: &str = "RUSTRAK_STORAGE_LOCK_INTERLEAVING_PUBLISHED";

        if let Ok(role) = std::env::var(ROLE) {
            let root = PathBuf::from(std::env::var(ROOT).unwrap());
            let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
            let pending_path = get_project_pending_event_path(&root, 7, event_id).unwrap();

            match role.as_str() {
                "publisher" => {
                    let registry_path = pending_publish_registry_lock_path(&pending_path).unwrap();
                    let registry = tokio::task::spawn_blocking(move || {
                        let registry = open_pending_publish_registry_lock(&registry_path).unwrap();
                        registry.lock_exclusive().unwrap();
                        registry
                    })
                    .await
                    .unwrap();
                    let lock_path = pending_publish_lock_path(&pending_path).unwrap();
                    let lock = StdOpenOptions::new()
                        .read(true)
                        .write(true)
                        .open(lock_path)
                        .unwrap();
                    fs::write(root.join(OPENED), b"ready").await.unwrap();
                    tokio::time::timeout(Duration::from_secs(10), async {
                        let release = root.join(RELEASE);
                        while !fs::try_exists(&release).await.unwrap() {
                            tokio::time::sleep(Duration::from_millis(5)).await;
                        }
                    })
                    .await
                    .expect("timed out waiting for stale cleanup interleaving release");
                    let lock = tokio::task::spawn_blocking(move || {
                        lock.lock_exclusive().unwrap();
                        lock
                    })
                    .await
                    .unwrap();
                    let temporary_path =
                        pending_path.with_file_name(".project-7-event.pending.json.tmp-interleave");
                    let mut temporary_file = OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .open(&temporary_path)
                        .await
                        .unwrap();
                    write_pending_record(
                        &mut temporary_file,
                        &metadata(event_id, 7),
                        br#"{"interleaving":true}"#,
                    )
                    .await
                    .unwrap();
                    drop(temporary_file);
                    publish_pending_file_locked(&pending_path, &temporary_path, event_id, 7)
                        .await
                        .unwrap();
                    fs::write(root.join(PUBLISHED), b"done").await.unwrap();
                    drop(lock);
                    drop(registry);
                }
                "cleanup" => {
                    let lock_path = pending_publish_lock_path(&pending_path).unwrap();
                    let registry_path = pending_publish_registry_lock_path(&lock_path).unwrap();
                    let registry_lock = open_pending_publish_registry_lock(&registry_path).unwrap();
                    assert!(matches!(
                        registry_lock.try_lock_exclusive(),
                        Err(error) if error.kind() == io::ErrorKind::WouldBlock
                    ));
                    std::fs::write(root.join(CLEANUP_READY), b"ready").unwrap();
                    registry_lock.lock_exclusive().unwrap();
                    remove_stale_pending_publish_lock_locked(&lock_path, &registry_lock).unwrap();
                }
                _ => panic!("unknown lock interleaving role: {role}"),
            }
            return;
        }

        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        let lock_path = pending_publish_lock_path(&pending_path).unwrap();
        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&pending_path, b"malformed").await.unwrap();
        fs::write(&lock_path, b"").await.unwrap();

        let executable = std::env::current_exe().unwrap();
        let test_module = module_path!()
            .strip_prefix(concat!(env!("CARGO_PKG_NAME"), "::"))
            .unwrap_or(module_path!());
        let test_name = format!(
            "{test_module}::{}",
            stringify!(stale_cleanup_cannot_split_publish_lock_identity)
        );
        let mut publisher = std::process::Command::new(&executable)
            .args(["--exact", &test_name, "--nocapture"])
            .env(ROLE, "publisher")
            .env(ROOT, dir.path())
            .env(RELEASE, "release")
            .spawn()
            .unwrap();
        let opened = dir.path().join(OPENED);
        tokio::time::timeout(Duration::from_secs(10), async {
            while !fs::try_exists(&opened).await.unwrap() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();

        let mut cleanup = std::process::Command::new(&executable)
            .args(["--exact", &test_name, "--nocapture"])
            .env(ROLE, "cleanup")
            .env(ROOT, dir.path())
            .spawn()
            .unwrap();
        let cleanup_ready = dir.path().join(CLEANUP_READY);
        tokio::time::timeout(Duration::from_secs(10), async {
            while !fs::try_exists(&cleanup_ready).await.unwrap() {
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        fs::write(dir.path().join(RELEASE), b"go").await.unwrap();

        let publisher_status = tokio::task::spawn_blocking(move || publisher.wait())
            .await
            .unwrap()
            .unwrap();
        let cleanup_status = tokio::task::spawn_blocking(move || cleanup.wait())
            .await
            .unwrap()
            .unwrap();
        assert!(publisher_status.success());
        assert!(cleanup_status.success());
        assert!(fs::try_exists(dir.path().join(PUBLISHED)).await.unwrap());
        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            br#"{"interleaving":true}"#
        );
        assert!(!fs::try_exists(lock_path).await.unwrap());
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
        let malformed = PendingEventRecord {
            version: PENDING_EVENT_VERSION,
            metadata: metadata(event_id, 7),
            event_data: "not-base64".to_string(),
        };
        fs::write(&pending_path, serde_json::to_vec(&malformed).unwrap())
            .await
            .unwrap();

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
    async fn legacy_event_write_is_atomic_and_does_not_follow_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let path = get_event_path(dir.path(), event_id).unwrap();
        let outside_path = outside.path().join("outside.json");
        fs::write(&outside_path, b"keep").await.unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside_path, &path).unwrap();

        #[cfg(unix)]
        {
            store_event(dir.path(), event_id, br#"{"updated":true}"#)
                .await
                .unwrap();
            assert_eq!(fs::read(&outside_path).await.unwrap(), b"keep");
            assert_eq!(fs::read(&path).await.unwrap(), br#"{"updated":true}"#);
            assert!(!fs::symlink_metadata(&path)
                .await
                .unwrap()
                .file_type()
                .is_symlink());
        }

        #[cfg(not(unix))]
        let _ = (outside_path, path);
    }

    #[tokio::test]
    async fn malformed_duplicate_record_is_quarantined_before_replacement() {
        let dir = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&pending_path, b"{").await.unwrap();

        store_event_with_metadata(
            dir.path(),
            event_id,
            br#"{"recovered":true}"#,
            &metadata(event_id, 7),
        )
        .await
        .unwrap();

        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            br#"{"recovered":true}"#
        );
        let mut entries = fs::read_dir(dir.path()).await.unwrap();
        let mut quarantined = false;
        while let Some(entry) = entries.next_entry().await.unwrap() {
            if entry.file_name().to_string_lossy().contains(".corrupt-") {
                quarantined = true;
            }
        }
        assert!(quarantined);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn pending_symlink_is_replaced_without_following_or_overwriting_target() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let event_id = "9ec79c33-ec99-42ab-8353-589fcb2e04dc";
        let pending_path = get_project_pending_event_path(dir.path(), 7, event_id).unwrap();
        let outside_path = outside.path().join("outside.pending.json");
        let old_record = PendingEventRecord {
            version: PENDING_EVENT_VERSION,
            metadata: metadata(event_id, 7),
            event_data: STANDARD.encode(br#"{"outside":true}"#),
        };
        let old_bytes = serde_json::to_vec(&old_record).unwrap();

        fs::create_dir_all(dir.path()).await.unwrap();
        fs::write(&outside_path, &old_bytes).await.unwrap();
        std::os::unix::fs::symlink(&outside_path, &pending_path).unwrap();

        store_event_with_metadata(
            dir.path(),
            event_id,
            br#"{"replacement":true}"#,
            &metadata(event_id, 7),
        )
        .await
        .unwrap();

        assert_eq!(
            read_event_for_project(dir.path(), 7, event_id)
                .await
                .unwrap(),
            br#"{"replacement":true}"#
        );
        assert_eq!(fs::read(&outside_path).await.unwrap(), old_bytes);
        assert!(!fs::symlink_metadata(&pending_path)
            .await
            .unwrap()
            .file_type()
            .is_symlink());
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
    async fn stale_publish_locks_are_cleaned_but_active_locks_are_retained() {
        let dir = tempfile::tempdir().unwrap();
        let stale = dir.path().join(".stale.pending.json.publish.lock");
        let active_path = dir.path().join("active.pending.json");
        let active_lock_path = pending_publish_lock_path(&active_path).unwrap();
        fs::write(&stale, b"").await.unwrap();
        let active_lock = acquire_pending_publish_lock(&active_path).await.unwrap();

        cleanup_orphaned_temporary_files_with_grace(dir.path(), Duration::ZERO)
            .await
            .unwrap();

        assert!(!fs::try_exists(stale).await.unwrap());
        assert!(fs::try_exists(active_lock_path).await.unwrap());
        drop(active_lock);
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
