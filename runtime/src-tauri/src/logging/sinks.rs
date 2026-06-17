//! Built-in sink implementations for the logging framework.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::formatter::Formatter;
use super::{LogRecord, Sink};

/// Writes log records to standard output.
#[derive(Debug)]
pub struct StdoutSink;

impl Sink for StdoutSink {
    fn write(&self, record: &LogRecord) {
        let line = Formatter::format(record);
        // Stdout is best-effort; failures are swallowed.
        let _ = writeln!(std::io::stdout(), "{}", line);
    }
}

/// Writes log records to a file, creating the file if it does not exist
/// and appending to it otherwise.
#[derive(Debug)]
pub struct FileSink {
    path: PathBuf,
    lock: Mutex<()>,
}

impl FileSink {
    pub fn new(path: impl AsRef<Path>) -> std::io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self {
            path,
            lock: Mutex::new(()),
        })
    }
}

impl Sink for FileSink {
    fn write(&self, record: &LogRecord) {
        let line = Formatter::format(record);
        // Serialise writes to a single file so records do not interleave.
        let _guard = self.lock.lock();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&self.path) {
            let _ = writeln!(file, "{}", line);
        }
    }
}
