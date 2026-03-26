pub mod jsonrpc;
pub mod resources;
pub mod tools;
pub mod transport;

use crate::persistence::Db;

/// Shared state for all MCP tool/resource handlers.
#[derive(Clone)]
pub struct McpState {
    pub db: Db,
    pub claude_path: String,
    pub model: String,
}

/// Start the MCP HTTP server on the given port in a background thread.
pub fn start_server(state: McpState, port: u16) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("MCP tokio runtime");
        rt.block_on(async {
            let router = transport::create_router(state);
            let addr = format!("127.0.0.1:{}", port);
            let listener = tokio::net::TcpListener::bind(&addr)
                .await
                .unwrap_or_else(|e| panic!("MCP server failed to bind {}: {}", addr, e));
            log::info!("MCP server listening on http://{}", addr);
            axum::serve(listener, router)
                .await
                .expect("MCP server error");
        });
    });
}
