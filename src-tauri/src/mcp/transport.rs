use axum::{
    extract::State,
    http::Method,
    response::{IntoResponse, Sse},
    routing::{get, post},
    Json, Router,
};
use tower_http::cors::{Any, CorsLayer};

use super::jsonrpc::{dispatch, JsonRpcRequest};
use super::McpState;

pub fn create_router(state: McpState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    Router::new()
        .route("/message", post(handle_message))
        .route("/sse", get(handle_sse))
        .layer(cors)
        .with_state(state)
}

async fn handle_message(
    State(state): State<McpState>,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    let response = dispatch(req, &state);
    Json(response)
}

/// SSE endpoint — server-to-client notifications.
/// For now it just sends an initial endpoint event so MCP clients can discover the POST path.
async fn handle_sse(State(_state): State<McpState>) -> impl IntoResponse {
    use axum::response::sse::{Event, KeepAlive};
    use futures::stream;

    // Send a single "endpoint" event with the POST message URL, then keep alive.
    let events = stream::iter(vec![
        Ok::<Event, std::convert::Infallible>(
            Event::default()
                .event("endpoint")
                .data("/message"),
        ),
    ]);

    Sse::new(events).keep_alive(KeepAlive::default())
}
