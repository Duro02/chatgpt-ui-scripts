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
