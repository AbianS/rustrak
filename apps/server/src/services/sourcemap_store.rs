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
        if key.len() != 40 || !key.bytes().all(|b| b.is_ascii_hexdigit()) {
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
        let shard_dir = self.shard_dir(key);
        tokio::task::spawn_blocking(move || -> Result<(), std::io::Error> {
            // Idempotent: if the file already exists (same SHA1 → same content), skip.
            if dest_path.exists() {
                return Ok(());
            }
            std::fs::create_dir_all(&shard_dir)?;
            // Atomic write: write to temp file in the same directory, then rename.
            let tmp = tempfile::Builder::new().tempfile_in(&shard_dir)?;
            let (mut file, tmp_path) = tmp.into_parts();
            use std::io::Write;
            file.write_all(&data)?;
            file.flush()?;
            drop(file);
            // Atomic rename; if dest appeared between our exists() check and now, that's fine —
            // content is identical by the CAS invariant.
            match tmp_path.persist(&dest_path) {
                Ok(_) => {}
                Err(e) => {
                    // If the file now exists (race), it's idempotent — ignore.
                    if !dest_path.exists() {
                        return Err(e.error);
                    }
                }
            }
            Ok(())
        })
        .await
        .map_err(|e| StoreError::Io(std::io::Error::other(e)))??;
        Ok(())
    }

    async fn get(&self, key: &str) -> Result<Bytes, StoreError> {
        Self::validate_key(key)?;
        let path = self.dest_path(key);
        let key_owned = key.to_string();
        match tokio::fs::read(&path).await {
            Ok(data) => Ok(Bytes::from(data)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                Err(StoreError::NotFound(key_owned))
            }
            Err(e) => Err(StoreError::Io(e)),
        }
    }

    async fn exists(&self, key: &str) -> Result<bool, StoreError> {
        Self::validate_key(key)?;
        tokio::fs::try_exists(self.dest_path(key))
            .await
            .map_err(StoreError::Io)
    }

    async fn delete(&self, key: &str) -> Result<(), StoreError> {
        Self::validate_key(key)?;
        let path = self.dest_path(key);
        match tokio::fs::remove_file(&path).await {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(StoreError::Io(e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_key_rejects_non_hex_chars() {
        assert!(LocalSourceMapStore::validate_key("hello_world!!!_too_short_for_sha1xx").is_err());
    }

    #[test]
    fn validate_key_rejects_wrong_length_too_short() {
        assert!(LocalSourceMapStore::validate_key("da39a3ee5e6b4b0d").is_err());
    }

    #[test]
    fn validate_key_rejects_wrong_length_too_long() {
        assert!(
            LocalSourceMapStore::validate_key("da39a3ee5e6b4b0d3255bfef95601890afd807091").is_err()
        );
    }

    #[test]
    fn validate_key_accepts_valid_sha1_hex() {
        assert!(
            LocalSourceMapStore::validate_key("da39a3ee5e6b4b0d3255bfef95601890afd80709").is_ok()
        );
    }

    #[test]
    fn validate_key_rejects_multibyte_unicode_key() {
        // "€" is 3 bytes; old code checked len() >= 2 which passes, but &key[..2]
        // would slice in the middle of a multi-byte char and panic.
        let key = "€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€"; // not hex
        assert!(LocalSourceMapStore::validate_key(key).is_err());
    }

    #[test]
    fn validate_key_rejects_path_traversal_chars() {
        // Old code blocked these explicitly; new code rejects them implicitly (not hex)
        assert!(LocalSourceMapStore::validate_key("../../../../etc/passwd_too_long").is_err());
    }
}
