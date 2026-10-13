# ChatGPT UI Scripts

A personal collection of ChatGPT web enhancement scripts by duro.

[中文](README.md) | English

## Preview

![ChatGPT Claude-like dark theme applied to a logged-in conversation](assets/chatgpt-claude-style-demo.png)

This repository contains two main enhancements:

| File | Type | Purpose |
| --- | --- | --- |
| `GPT Claude-like Style.user.css` | Stylus/UserStyle | Dark UI theme for ChatGPT that brings the page closer to Claude's narrow, warm-gray, low-distraction reading experience. |
| `chatgpt-claude-like-separator.user.js` | Tampermonkey userscript | Companion to the style: detects plain-text separator paragraphs in replies and adds a class so the style can render them as natural dividers. |

The repo also includes these extra scripts:

| File | Type | Purpose |
| --- | --- | --- |
| `chatgpt-project-source-preview.user.js` | Tampermonkey userscript | Previews `.md` / `.txt` files inside ChatGPT project sources instead of downloading them on click. |
| `chatgpt-conversation-rail.user.js` | Tampermonkey userscript | Short horizontal navigation marks with previews, active-turn highlighting, jumps, and optional history indexing. |

## Installation

### Stylus style

Recommended (auto-update from GitHub):

1. Install the Stylus browser extension.
2. Open the raw file URL: `https://raw.githubusercontent.com/Duro02/chatgpt-ui-scripts/main/GPT%20Claude-like%20Style.user.css`
3. Stylus shows an install page — click Install.

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
- More reliable divider lines inside the theme: also install `chatgpt-claude-like-separator.user.js`.
- Preview project-source Markdown/text files: install `chatgpt-project-source-preview.user.js`.
- Restore conversation navigation: install `chatgpt-conversation-rail.user.js`; it works independently of the theme.

## Features

### ChatGPT Claude-like Style

- Warm-gray dark theme.
- Narrower reading column for prose.
- Claude-like text, code blocks, quote blocks, and divider styling.
- Tries not to disturb ChatGPT's original layout nodes so it coexists with other scripts.
- Supports all three ChatGPT frontend variants: the legacy `html.dark` marker, the newer `html[data-color-scheme="dark"]` marker, and the logged-in app's `html[data-theme="dark"]` marker.

### ChatGPT Claude-like Separators

- Scans ChatGPT replies for plain-text separator paragraphs.
- Adds the `claude-like-separator` class to matching paragraphs.
- The Stylus style handles the final visual rendering.

### ChatGPT Conversation Rail

Move left from a hovered rail mark into its bubble to expand up to seven neighboring turns. The center shows the question and answer; three smaller prompts appear on each side. Wheel or arrow keys browse previews without moving the transcript; click a card to navigate. Leaving dismisses the panel, and Esc closes it immediately.

After expansion, a circular search button appears at the panel’s left midpoint. Click to expand a pill input leftward, then press Enter to reveal matching cached question/answer summaries. Space-separated keywords must all match. Results reuse the seven-card preview: the center always shows both question and answer summaries, while neighbors show user prompts only. Wheel/arrow/Home/End browse matches independently and results stay open while browsing the right preview or rail; clicking a result navigates by ID without synchronizing the right preview. Leaving the entire group dismisses it even if the input is focused. Undiscovered history must be indexed first.

Search and preview reuse card geometry, shell/card radii, insets and hover colors. Edge windows fill with actual neighbors from the other side to retain up to seven cards, so browsing keeps a stable shell size and position. Wheel events coalesce once per frame; cards fill immediately without overlapping position/size/opacity tweens. Opening transitions remain. First/last highlights keep equal shell gutters. A match position indicator tracks the left panel independently of the right preview.

A standalone rail visually inspired by DSH's TurnNavigator: fixed-pitch horizontal marks, a longer/brighter active mark, and prompt/answer previews on hover or keyboard focus. It does not include the archived script's backup or Prompt manager.

- Click a mark to jump. Arrow keys, Home and End select marks; Enter activates them.
- When history is incomplete, the first mark is red. Hover to see “Click to load earlier conversation” (Chinese UI text); click to load and index history. The red mark disappears once all history is indexed. This temporarily scrolls the transcript and restores the reading position afterward. Click again or press Esc to cancel; wheel/touch input interrupts scanning. Keep the tab visible while indexing.
- A clicked turn stays active until manual transcript interaction. One white focus moves smoothly between turns; overflowing rails support wheel/touch and arrows, PageUp/PageDown, Home/End, with synchronized focus and viewport transitions.
- The index uses the conversation ID, retaining discovered turns across project-prefix changes and transcript container remounts.
- Save discovered IDs, order and short previews locally. Reopening restores the rail immediately; unmounted entries appear dim. Clicking them loads earlier pages only as needed, stops at the target and calibrates by ID. Click again or press Esc to cancel; keep the tab visible. Switching conversations saves/restores the corresponding index.
- Dots (`/dots/...`) uses user `.self` message articles and the first following text reply. Preview, search, jump and cache reuse existing components. Caches are isolated by path and visible message namespace, including namespace changes on the same URL. Completeness requires explicit history scanning.
- Unmounted cached targets stay selected through consecutive server pages. Paging progress uses mounted IDs, counts and geometry, with a 15-second no-progress grace and 120-second overall timeout. Replacing the message wrapper in the same scrollport retains the jump job; a final-page target is calibrated before restoring the old viewport. No simulated clicks or background polling are added.
- Virtual unmounts retain IDs, positions and short summaries while releasing user and answer DOM references. Stale-route suppression is weak. Stop cancels restore/wait work, observers and listeners, then clears runtime indexes. Persistent storage supports up to 32 threads and 10,000 entries per thread; a full count/character budget retains the newest fitting suffix and marks history incomplete. Live metadata still grows with the current conversation’s discovered node count.
- Bare Dots client UUIDs are provisional and remain navigable only while mounted. Confirmation retires the provisional node; only confirmed identities are persisted. Older provisional cache rows migrate automatically, while identical prompts with distinct confirmed IDs stay separate.
- Opening the Dot profile hides navigation and dismisses preview/search. Closing or unmounting restores the same indexed nodes without reloading history. Visibility watches only the small floating-panel branch, with no polling.
- SPA history changes clear stale navigation immediately; clicks also check the current route.
- Supports current `data-turn-key` and legacy `conversation-turn-*` wrappers, including negative `scrollTop` in a reversed scrollport.

Normal reading and idle time have no polling or ongoing storage I/O. Scrolling uses cached coordinates and binary search, then updates the old and new active marks. Observers watch direct structural containers, not streamed answer text; size changes are coalesced at 180ms. Previews have bounded text/tree traversal, and the rail mounts only roughly 50 buttons regardless of history size. Snapshot writes are debounced for 1.5 seconds and run during idle time, with a final flush on page exit. Saves merge IDs discovered by other tabs of the same conversation, preserving a larger index against a partial snapshot. Scanning, on-demand loading and position correction have time/attempt limits.

The site's localStorage stores only IDs, order, bounded previews and approximate positions; no full transcript or DOM is saved or uploaded. Retain up to 32 recently used conversations within a two-million-character budget, with at most 10,000 nodes per thread and no fixed expiry. Storage failures fall back to the in-memory rail. Legacy ordinal-only IDs are not restored across reloads.

No direct conversation API calls are made: scrolling triggers the page's own history loader. Coordinates are estimates; IDs determine final alignment. Missing/changed-branch entries remain cached with a retry message. The red first mark represents undiscovered history, separately from loading already cached turns.

Validation: run `node tests/chatgpt-conversation-rail.test.js`. Serve the repository locally, open `tests/conversation-rail.browser.html`, and choose “运行全部回归” to exercise a thousand turns, streaming/scrolling costs, current/legacy DOM, virtual history, navigation and cleanup. For a real document reload test, open `tests/c/persistence-reload/`, save its index, then reload; only five turns mount while all thirty navigation entries restore.

Visual reference: [DSH TurnNavigator](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/client/ui-chat/src/client/chat/TurnNavigator.tsx). The new script is independently implemented under this repository's MIT license.

### ChatGPT Conversation Navigator (archived)

File lives at `archived/chatgpt-conversation-navigator.user.js`. It is a modified version of YukonKong's `ChatGPT体验增强插件`, offering long-conversation timeline navigation, a prompt manager, conversation backup, and more.

This version was archived when ChatGPT provided its own navigation. It remains **not guaranteed to work** and is kept for archival purposes. Use the new Conversation Rail for lightweight navigation.

Changes in this modified version relative to the original:

- Uses `conversation-turn-*` wrappers as timeline anchors for long conversations.
- Adapts to ChatGPT's virtualized DOM to reduce jump misalignment in long conversations.
- Adds a Prompt manager with naming, categories, save, and append-to-input.
- Adds per-conversation backup and improved scrolling capture for long conversations.
- Marks branch conversations in the chat list and right-side timeline, distinguishing "branches from edited user messages" and "branches from regenerated answers".
- Supports clicking `Index Missing` to backfill preview text and branch markers for uncached nodes in long conversations.
- Removes the original GreasyFork auto-update URL so the modified version is not overwritten by upstream updates.

Usage:

- The right-side dot timeline jumps to the corresponding user question.
- Click the right-side list button to expand the conversation list; search and jump by index or text.
- For long or old conversations, click `Index Missing` to have the script scroll-scan uncached nodes and backfill previews and branch status.
- Long-press a timeline dot to manually flag it as important; long-press again to unflag.
- The prompt-manager button at the bottom right saves common prompts by category and appends them to the input box.
- The backup button exports the current conversation as Markdown; long conversations reuse existing backups and only scan the unbacked-up portion.

Color legend:

- Gray dot: normal conversation node.
- Yellow dot: manually flagged node.
- Blue dot / `2/2` blue label: the user question has branches created by edits and resends.
- White dot / `A 2/2` white label: the GPT answer has branches created by regeneration.
- Yellow + blue: manually flagged and has a user-question branch.
- Yellow + white: manually flagged and has an answer branch.
- Blue + white: the same turn has both a user-question branch and an answer branch.
- Yellow + blue + white: the node has a manual flag, a user-question branch, and an answer branch.

## License and attribution

- `archived/chatgpt-conversation-navigator.user.js` (archived) is modified from YukonKong's original script, which is licensed under `CC-BY-NC-4.0`. This modified version keeps the original author's attribution and the same license restrictions — use and redistribution only within what the license permits, especially the non-commercial clause.
- `GPT Claude-like Style.user.css`, `chatgpt-claude-like-separator.user.js`, and `chatgpt-project-source-preview.user.js` are written by duro. Unless a file states otherwise, they are released under the `MIT` license.

Original script source:

- `ChatGPT体验增强插件` by YukonKong
- GreasyFork update URL: `https://update.greasyfork.org/scripts/570234/ChatGPT%E4%BD%93%E9%AA%8C%E5%A2%9E%E5%BC%BA%E6%8F%92%E4%BB%B6.user.js`

## Notes

ChatGPT's DOM changes quickly, and all these scripts depend on the current page structure. If a feature suddenly stops working, you usually need to re-check the relevant DOM nodes or request paths with the browser's developer tools.

Conversation Rail performance: existing-turn layout refreshes process the mounted window without rebuilding the entire cached index. Observer connections and rail attributes update only when changed. See [the audit and reproduction steps](CONVERSATION_RAIL_PERFORMANCE.md).

For the synthetic Dots message-structure demo, serve the repository locally and open `dots/home/`. It contains no personal conversation.
