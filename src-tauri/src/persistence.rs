/// SQLite persistence layer.
/// TODO: Implement connection pool, migrations, and typed queries.
pub struct Database {
    pub path: String,
}

impl Database {
    pub fn new(path: String) -> Self {
        Self { path }
    }
}
