# ChatGPT UI Scripts

A collection of user scripts and styles to enhance the ChatGPT web interface.

[中文](README.md) | English

## Preview

![ChatGPT Claude-like dark theme applied to a logged-in conversation](assets/chatgpt-claude-style-demo.png)

This repository contains the following enhancements:

| File | Type | Purpose |
| --- | --- | --- |
| [`chatgpt-conversation-rail.user.js`](chatgpt-conversation-rail.user.js) | Tampermonkey userscript | Conversation node navigation, node persistence, and node search for ChatGPT and Dots. |
| `GPT Claude-like Style.user.css` | Stylus/UserStyle | Dark UI theme for ChatGPT that brings the page closer to Claude's narrow, warm-gray, low-distraction reading experience. |
| `chatgpt-claude-like-separator.user.js` | Tampermonkey userscript | Makes reply separators look more natural when used with the theme. |
| `chatgpt-project-source-preview.user.js` | Tampermonkey userscript | Previews `.md` / `.txt` files inside ChatGPT project sources instead of downloading them on click. |

## Installation

### Stylus style

Recommended (auto-update from GitHub):

1. Install the Stylus browser extension.
2. Open the raw file URL: `https://raw.githubusercontent.com/Duro02/chatgpt-ui-scripts/main/GPT%20Claude-like%20Style.user.css`
3. Stylus shows an install page — click Install; check for updates in the Stylus manager to stay current.

Or manually:

1. Install the Stylus browser extension.
2. Create a new style.
3. Paste the contents of `GPT Claude-like Style.user.css`.
4. Open `https://chatgpt.com/`.

### Tampermonkey scripts

1. Install the Tampermonkey browser extension.
2. Create a new script.
3. Paste the contents of each `.user.js` file you want to use.
4. Save and refresh the ChatGPT page.

Suggested combinations:

- Appearance only: install `GPT Claude-like Style.user.css`.
- More natural divider lines inside the theme: also install `chatgpt-claude-like-separator.user.js`.
- Preview project-source Markdown/text files: install `chatgpt-project-source-preview.user.js`.
- Add right-side conversation navigation: install `chatgpt-conversation-rail.user.js`; it works independently of the theme.

## Features

### ChatGPT Claude-like Style

- Warm-gray dark theme.
- Narrower reading column for prose.
- Claude-like text, code blocks, quote blocks, and divider styling.

### ChatGPT Claude-like Separators

Makes reply separators look more natural when used with the theme.

### ChatGPT Conversation Rail

Adds right-side conversation navigation to ChatGPT and Dots. Click a node to jump to its prompt. Discovered nodes are saved for your next visit, and you can search prompts and answer summaries by keyword.

## License

[MIT](LICENSE.md)

## Notes

ChatGPT updates may affect these scripts. If something stops working, please open an Issue.
