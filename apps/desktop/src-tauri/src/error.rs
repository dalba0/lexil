use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("lock poisoned: {0}")]
    Lock(String),

    #[error("not found")]
    NotFound,

    #[error("invalid argument: {0}")]
    Invalid(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
