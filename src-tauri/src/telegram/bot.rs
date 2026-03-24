/// Telegram bot: long-polling loop for remote interaction.
/// TODO: Implement reqwest-based long polling against Telegram Bot API.
pub struct TelegramBot {
    pub token: Option<String>,
    pub running: bool,
}

impl TelegramBot {
    pub fn new() -> Self {
        Self {
            token: None,
            running: false,
        }
    }
}

impl Default for TelegramBot {
    fn default() -> Self {
        Self::new()
    }
}
