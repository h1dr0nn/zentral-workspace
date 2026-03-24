/// PTY handler: platform-specific pseudo-terminal management.
/// TODO: Implement Unix PTY (nix) and Windows ConPTY.
pub struct PtyHandle {
    pub id: String,
}
