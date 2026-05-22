use std::path::PathBuf;

use bytes::Bytes;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

#[async_trait::async_trait]
pub trait SourceMapStore: Send + Sync + 'static {
    async fn put(&self, key: &str, data: Bytes) -> Result<(), StoreError>;
    async fn get(&self, key: &str) -> Result<Bytes, StoreError>;
    async fn exists(&self, key: &str) -> Result<bool, StoreError>;
    async fn delete(&self, key: &str) -> Result<(), StoreError>;
}

/// Filesystem-backed content-addressable store.
///
/// Layout: `{base_path}/{key[0..2]}/{key[2..]}.map`
///
/// Writes are atomic via tempfile + rename so concurrent readers never see partial data.
#[derive(Clone)]
pub struct LocalSourceMapStore {
    base_path: PathBuf,
}

impl LocalSourceMapStore {
    pub fn new(base_path: impl Into<PathBuf>) -> Self {
        Self {
            base_path: base_path.into(),
        }
    }

    fn dest_path(&self, key: &str) -> PathBuf {
        let shard = &key[..2];
        let rest = &key[2..];
        self.base_path.join(shard).join(format!("{}.map", rest))
    }

    fn shard_dir(&self, key: &str) -> PathBuf {
        self.base_path.join(&key[..2])
    }

    fn validate_key(key: &str) -> Result<(), StoreError> {
        if key.len() < 2 || key.contains('/') || key.contains('\\') || key.contains("..") {
            return Err(StoreError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("invalid store key: {key}"),
            )));
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl SourceMapStore for LocalSourceMapStore {
    async fn put(&self, key: &str, data: Bytes) -> Result<(), StoreError> {
        Self::validate_key(key)?;
        let dest_path = self.dest_path(key);
        // Idempotent: if the file already exists (same SHA1 → same content), skip.
        if dest_path.exists() {
            return Ok(());
        }
        let shard_dir = self.shard_dir(key);
        std::fs::create_dir_all(&shard_dir)?;
        // Atomic write: write to temp file in the same directory, then rename.
        let tmp = tempfile::Builder::new().tempfile_in(&shard_dir)?;
        let (mut file, tmp_path) = tmp.into_parts();
        use std::io::Write;
        file.write_all(&data)?;
        file.flush()?;
        drop(file);
        // Atomic rename; if dest appeared between our exists() check and now, that's fine — content
        // is identical by the CAS invariant.
        match tmp_path.persist(&dest_path) {
            Ok(_) => {}
            Err(e) => {
                // If the file now exists (race), it's idempotent — ignore.
                if !dest_path.exists() {
                    return Err(StoreError::Io(e.error));
                }
            }
        }
        Ok(())
    }

    async fn get(&self, key: &str) -> Result<Bytes, StoreError> {
        Self::validate_key(key)?;
        let path = self.dest_path(key);
        match std::fs::read(&path) {
            Ok(data) => Ok(Bytes::from(data)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                Err(StoreError::NotFound(key.to_string()))
            }
            Err(e) => Err(StoreError::Io(e)),
        }
    }

    async fn exists(&self, key: &str) -> Result<bool, StoreError> {
        Self::validate_key(key)?;
        Ok(self.dest_path(key).exists())
    }

    async fn delete(&self, key: &str) -> Result<(), StoreError> {
        Self::validate_key(key)?;
        let path = self.dest_path(key);
        match std::fs::remove_file(&path) {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(StoreError::Io(e)),
        }
    }
}
