# ChatGPT UI Scripts

A collection of enhancement scripts and styles for the ChatGPT web interface.

[中文](README.md) | English

## Preview

![Claude-like style applied to a conversation page](assets/chatgpt-claude-style-demo.png)

This repository includes the following enhancements:

| File | Type | Purpose |
| --- | --- | --- |
| [`chatgpt-conversation-rail.user.js`](chatgpt-conversation-rail.user.js) | Tampermonkey userscript | Conversation node navigation, node persistence, and node search for ChatGPT and Dots. |
| `GPT Claude-like Style.user.css` | Stylus/UserStyle | Dark theme for ChatGPT, providing a Claude-like narrow, warm-gray reading experience. |
| `chatgpt-claude-like-separator.user.js` | Tampermonkey userscript | Pairs with the theme to make message separators more natural. |

## Installation

### Stylus Style

Recommended method (supports auto-updates):

1. Install the Stylus browser extension.
2. Open the raw file URL: `https://raw.githubusercontent.com/Duro02/chatgpt-ui-scripts/main/GPT%20Claude-like%20Style.user.css`
3. Stylus will open the installation page; click Install. Check for updates in the management panel later to sync the latest style.

Manual method:

1. Install the Stylus browser extension.
2. Create a new style.
3. Paste the contents of `GPT Claude-like Style.user.css`.
4. Open `https://chatgpt.com/`.

### Fonts and Fallback Order

The theme uses fonts installed on your device and does not automatically download or install fonts. Font lists are checked from first to last; for each character, the browser selects the first available font that contains that character. As a result, Latin and Chinese text may use different fonts, and the appearance may vary across devices.

- **Interface text**: Prefers system sans-serif fonts, such as Apple's system font, Segoe UI, and Roboto, with a generic sans-serif fallback.
- **Body text**:
  - Latin font priority: Iowan Old Style → Charter → Georgia → Times New Roman.
  - Chinese font priority: Noto Serif CJK SC → Noto Serif SC → Source Han Serif SC → Songti SC → SimSun.
  - The final fallback is the browser's generic serif font.
- **Code text**: Tries SFMono-Regular → Consolas → Liberation Mono → Menlo in order. Chinese characters not covered by these fonts then follow the Chinese font order above, with a generic monospace font as the final fallback.

To give Chinese body text the theme's intended Song-style serif appearance, you can install one of the Chinese fonts listed above. Installing a font later in the list does not give it priority over an earlier available font. To choose a preferred font, adjust the corresponding font list in Stylus: `--claude-font` (interface), `--claude-prose-font` (body), or `--claude-mono` (code).

### Tampermonkey Scripts

1. Install the Tampermonkey browser extension.
2. Create a new script.
3. Paste the contents of each `.user.js` file you want to use.
4. Save and refresh the ChatGPT page.

Recommended combinations:

- Visual changes only: Install `GPT Claude-like Style.user.css`.
- Make separators more natural with the theme: Also install `chatgpt-claude-like-separator.user.js`.
- Need right-side conversation rail: Install `chatgpt-conversation-rail.user.js` (can be used standalone).

## Key Features

### ChatGPT Claude-like Style

- Warm-gray dark theme.
- Narrower content reading width.
- Claude-inspired visuals for text, code blocks, blockquotes, and dividers.

### ChatGPT Claude-like Separators

Pairs with the theme to make dividers in responses more natural.

### ChatGPT Conversation Rail

Adds a right-side conversation node rail for ChatGPT and Dots. Click a node to jump to the corresponding question. Discovered nodes are retained for browsing when reopening the conversation, and you can search questions and answer summaries by keyword.

As you scroll the conversation, the current question's mark grows longer and brighter in place.

## License

[MIT](LICENSE.md)

## Notes

Certain features may need adjustments after ChatGPT web updates. If you encounter any issues, feel free to submit an Issue.
