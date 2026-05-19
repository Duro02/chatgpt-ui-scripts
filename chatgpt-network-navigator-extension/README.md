# ChatGPT Network Navigator Extension

This is an experimental Chrome/Edge Manifest V3 extension that builds a ChatGPT user-turn timeline from captured conversation network responses instead of the virtualized DOM.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   `D:\Projects\gpt_plugin\chatgpt-network-navigator-extension`

## Notes

- The extension injects `page-hook.js` into the page context to observe `fetch` and `XMLHttpRequest` responses.
- It caches user turns in `chrome.storage.local`.
- Double-click the right-side dot rail to toggle the text panel.
- If ChatGPT does not request the full conversation JSON on page load, open/reload the conversation once so the extension can capture it.
