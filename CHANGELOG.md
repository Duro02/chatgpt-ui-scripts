# 更新记录

## Claude-like Theme 0.4.12 — 2026-10-26

- 为右侧面板补充局部背景变量，使侧边聊天的内容区、底板与主会话使用相同的暖深色，消除原生近黑色背景和输入框周围的色块；不修改全局原生 surface 变量。

## Claude-like Theme 0.4.11 — 2026-10-23

- 底栏实体背景板不再依赖 `inset-x-0` 工具类，适配 Work 使用 CSS 模块定位的新结构，消除输入框背后整片近黑色区域；保留对旧底栏及独立渐变层的区分。
- 清除 Work 顶栏标题容器自带的近黑色背景，让标题融入页面；标题按钮自身的悬停和键盘焦点高亮保持可用。

## Conversation Rail 0.4.13 — 2026-10-22

- 已知节点也按当前挂载的正文顺序校正，修复 Dot 分页加载后旧索引错序、旧消息被排到导航末尾的问题；校正结果写回缓存，重启后保留。
- 确认 Dot 已挂载内容的底部时，将错排在最新窗口后面的旧缓存保留在前面；存在预留虚拟空间时不进行这种末尾校正，不删除尚未挂载的消息。
- 滚到实际底部（包括点击 ChatGPT 自带按钮）时高亮最后一轮提问，兼容回答由多个独立卡片组成的情况；上滚后恢复当前位置定位，显式导航选择仍优先。
- 顺序校正仅在发现冲突或新节点时重建索引；普通滚动仍不读取布局。增加旧缓存、分页顺序、保存重启、原生式底部跳转及虚拟空间的浏览器回归。

## Conversation Rail 0.4.12 — 2026-10-22

- 从同页保留的多份会话 DOM 中选择有实际尺寸的可见内容，避免隐藏缓存页将导航挤到右上角；仅通过 CSS 显示页面时也能重新绑定。
- 历史索引已完整覆盖时跳过逐屏扫描；仍需扫描虚拟消息时显示对应进度提示。
- 从底部发起的加载结束或取消后恢复当前底部，内部定位使用即时滚动，避免继承平滑滚动；用户手动滚动仍可打断恢复。
- 增加隐藏页面、CSS 切换、完整长会话扫描及底部恢复的回归测试。

## Claude-like Theme 0.4.10 — 2026-10-22

- 适配新版自适应输入框底栏，让思考强度按钮所在背景与输入框同色，消除多行输入时的深色横条。
- 为新版思考强度弹窗和滑块应用局部暖色配色。
- 适配 Dot 新的输入区渐变背景层，以页面暖深色替换近黑色，保留底部遮挡效果。

已在 Chrome 新标签页中注入完整本地样式，验证首页及会话的单行、多行输入、思考强度弹窗和 Dot 底部背景。

## Conversation Rail 0.4.11 — 2026-10-14

- Confirm the rendered conversation ending before trimming an obsolete cached suffix. Keep reserved virtual tail space, pending turns and paged Dots windows protected.
- Prevent snapshot merging from restoring a trimmed tail and highlight the confirmed last prompt when refreshing at the bottom. Explicit clicked selections still take precedence.
- Cover ending changes, partial-window retention, restart persistence and bottom highlighting.

## Conversation Rail 0.4.10 — 2026-10-14

- Exclude previous-conversation elements throughout slow and mixed SPA transitions, while accepting reused elements with changed message IDs and fresh mounts.
- Ignore zero-height message nodes and migrate flat cached records without discarding valid history. Keep route ownership weak and avoid polling for a transition deadline.
- Verify mixed routes, slow transitions, repeated navigation, cache repair and resource teardown.

## 仓库发布整理 — 2026-10-13

- 将 ChatGPT Conversation Rail 列为合集仓库的正式导航脚本，保留现有文件名和安装标识。
- 移除过期的归档导航代码及其使用说明，更新中英文 README 和当前版本的 MIT 许可证说明；旧代码及原许可证仍可在 Git 历史中查阅。
- 清理不再适用于当前导航脚本的参考说明；导航功能和版本号不变。

## Conversation Rail 0.4.9 — 2026-10-13

- Stabilize both expanded preview and search windows during fast wheel browsing: fill edge windows with up to seven real neighbors and keep the preview shell position fixed. Preserve equal first/last insets and compact short lists.
- Coalesce wheel targets per frame, preserving bound reversals and message IDs through pagination. Recycled cards fill immediately; browsing temporarily suppresses layout/opacity tweens while opening transitions remain.
- Cancel pending wheel frames/timers on close, stop and query changes. Verify rapid bidirectional browsing frame by frame, shared search behavior and resource teardown; no transcript scans or geometry reads are added to the wheel path.

## Conversation Rail 0.4.8 — 2026-10-13

- Preserve the newest cached suffix when the 10,000-entry or serialized character limit is exceeded, rather than silently abandoning the entire save. Keep storage budgets unchanged and mark trimmed history incomplete.
- Cover oversized entry counts, long confirmed IDs, newest-node retention, ordering and non-mutating serialization.

## Conversation Rail 0.4.7 — 2026-10-13

- Release both user and answer DOM references when Dots messages unmount or their wrapper detaches. Use weak references for stale-route suppression, so old message trees are not retained while waiting for the next conversation.
- Track/cancel restore timers and resolve pending asynchronous waits on stop. Clear stopped controller indexes and respect ownership of other scripts’ History API wrappers.
- Add deterministic 100-window resource teardown tests and a real-browser WeakRef pressure fixture. Full Node and Chrome feature regression passes; long-cache refreshes remain independent of cached count and idle has no periodic work.

## Conversation Rail 0.4.6 — 2026-10-13

- Keep an unloaded navigation target across consecutive server pages. Replace the 2.4-second height-only cutoff with message/geometry progress and a 15-second no-progress grace period; preserve cancellation and the 120-second overall limit.
- Preserve the same jump job and its original anchor when paging replaces the message wrapper in the same scrollport. Keep the waiting target through a temporarily missing root, and calibrate a target arriving on the final wait before restoring the previous viewport.
- Reproduce the old failure and verify a six-page Dots jump with no status sentinel, a slow page and scroll anchoring. Loading uses existing bounded scroll/wait work, with no simulated clicks or background polling.

## Conversation Rail 0.4.5 — 2026-10-13

- Treat bare Dots client UUIDs as provisional: show them while mounted, retire them after replacement/unmount, and persist only confirmed message identities. Automatically discard legacy provisional cache rows while preserving all confirmed IDs and actual repeated messages.
- Observe message-ID attribute changes for in-place confirmation. Keep the Dots namespace stable through provisional/empty mounted windows; preserve confirmed nodes across virtual unmounts.
- Replace provisional search matches with confirmed matches using the submitted query and mounted window only. Validate cache migration, confirmation by replacement/attribute changes, real repeated prompts, native UUID isolation and unchanged-refresh performance.

## Conversation Rail 0.4.4 — 2026-10-13

- Hide the rail while the Dot profile panel is open; dismiss previews/search and restore the existing node list as soon as the panel closes or unmounts. Preserve indexed nodes and selection.
- Observe only the small floating-panel branch and its visibility attributes; no transcript geometry reads, history reloading or polling for panel visibility. Clean up the observer on teardown.
- Verify opening, closing states, removal, blocked interactions and unchanged-state zero DOM writes. Add profile-toggle/outside-click/Esc behavior to the synthetic Dots recording demo.

## Conversation Rail 0.4.3 — 2026-10-13

- Adapt Dots message lists using user `.self` articles and stable `data-message-id` values. Pair each user node with its first following text reply and use the actual message scroller.
- Separate Dots caches by URL and visible message namespace; detect namespace changes even on `/dots/home`. Reuse preview, search, jump, persistence and bounded history loading without private APIs.
- Resolve Dots theme colors through its own CSS variables while retaining ordinary ChatGPT theme support.
- Do not infer complete Dots history merely from mounted articles. Validate route transitions, duplicate nested IDs, replies, search, cache isolation and reload initialization; add a standalone Dots structure demo.

## Conversation Rail 0.4.2 — 2026-10-13

- Clear stale navigation immediately on SPA pushState/replaceState changes, even without transcript mutations or popstate. Guard clicks against stale routes and restore history wrappers on teardown.
- Verify route isolation and restoring the original conversation cache.

## Conversation Rail 0.4.1 — 2026-10-13

- Reuse the preview's geometry, card renderer and keyed CSS transitions for search results: one central question/answer with up to three smaller user prompts above and below.
- Always show the central result's answer summary, including question-only matches. Wheel/arrow/Home/End browse matching nodes without moving the transcript or right-hand candidate; clicks navigate and retain both panels.
- Share shell/card radii, insets and hover colors. Keep equal first/last highlight gutters; center the search submit button inside its pill and fit neighboring labels to their row height.
- Bound each panel to seven cards with no background search. Verify boundary geometry, card reuse, keyboard/wheel independence and question-only answers. Add a “展示搜索与预览” control for recording the local fixture.

## Conversation Rail 0.4.0 — 2026-10-13

- Add a circular search button at the preview panel’s left midpoint. Expand it leftward into a matching pill input, then into an independently scrolling result list on submission.
- Search cached question/answer summaries on Enter, with case/Unicode normalization and space-separated keywords; do no searching while typing and no automatic history scan.
- Keep results open while browsing the right preview or rail; result hover does not synchronize the right preview. Click results to navigate by ID, retaining search UI through target loading and content-root replacement.
- Dismiss the entire group on pointer exit even when the input is focused; isolate input/list keyboard and wheel events from right-hand browsing.
- Virtualize large result sets, bound query length, retain equal preview insets from 0.3.2, and validate keyboard access, cached targets, empty results, independent scrolling and modeled narrow-width layout.

## Conversation Rail 0.3.2 — 2026-10-13

- Reserve equal inset space at the top and bottom of preview cards, including the first and last conversation nodes. Adjust the central highlight radius to fit the outer shell.
- Include the inset in viewport height calculations and verify first/last highlight gaps against horizontal gaps.

## Conversation Rail 0.3.1 — 2026-10-13

- Keep the single hover bubble flat. Apply the inner central-card highlight and card hover backgrounds only after the pointer enters and expands the panel.

## Conversation Rail 0.3.0 — 2026-10-13

- Let the pointer cross from a rail mark into its bubble, then expand a seven-node preview panel with three neighboring user prompts above and below the central question/answer.
- Browse the central preview with wheel or arrow keys without scrolling the transcript; click any card to navigate using the existing mounted/cached target logic.
- Animate expansion and keyed card promotion, retain the central node on entry, clamp to viewport edges, and show only available neighbors at conversation boundaries.
- Keep preview DOM bounded to seven cards, reread only the central bounded summary, avoid unchanged expanded-panel DOM writes, and stop entry frames/close timers on dismissal. Respect reduced motion and keep collapsed neighbors out of the accessibility tree.
- Add browser interaction regressions, real mouse/wheel verification and jsdom checks for bounded rendering, zero transcript geometry reads during preview wheel browsing, and no DOM rewrites on unchanged refreshes.

## Conversation Rail 0.2.2 — 2026-10-13

- Write rail labels, positions, visibility, unloaded/current states and overflow attributes only when values change. Unchanged renders no longer mutate the rail DOM.
- Avoid repeated rail geometry style writes and identical focus transforms. Use the existing key index for keyboard navigation.
- Verify unchanged-render mutation counts alongside index-refresh, observer-topology and timer regressions.

## Conversation Rail 0.2.1 — 2026-10-13

- Refresh existing mounted records in place; rebuild chronological arrays and key indexes only when new IDs appear.
- Clear only the preceding mounted window on unmount, and reconnect observers only when their targets or subtree modes change.
- Consume queued observer refreshes during explicit refreshes and remove duplicate geometry measurements during target loading/calibration.
- Add a reproducible jsdom performance/regression harness; measurements cover script/DOM work, excluding browser layout, paint and GPU costs.

## Conversation Rail 0.2.0 — 2026-10-12

- Persist per-conversation IDs, order, short previews and approximate coordinates in bounded localStorage snapshots, restoring the rail before older transcript content mounts.
- Load cached targets on demand through page scrolling and older-history pagination, stop at the requested ID, then calibrate its position. Support cancellation and bounded failure handling without a full history scan.
- Keep complete saved indexes separate from the page's current history-loading sentinel. Dim unloaded entries; reserve the red mark for unknown history.
- Debounce snapshot writes to idle time, flush on page exit, isolate conversations and retain at most 32 recent indexes within a size budget. Storage errors preserve the in-memory rail.
- Add schema/eviction tests, paging/cancellation regressions and a real document reload fixture.

## Conversation Rail 0.1.5 — 2026-10-12

- Scroll overflowing rails with wheel/touch and keyboard arrows, PageUp/PageDown, Home/End; fade clipped edges as an overflow cue.
- Move the white focus and rail viewport together over 260 ms when a target crosses the visible range. Interrupt or retarget ongoing transitions without snapping through unrelated active nodes.
- Reveal the restored reading focus after history indexing even while the pointer remains over the rail; preserve explicit selections across indexing.
- Keep rail buttons bounded and perform animation frames only during transitions, without per-frame transcript scans or geometry reads.

## Conversation Rail 0.1.4 — 2026-10-12

- Animate one white focus line between turns instead of toggling independent white marks.
- Keep accessibility selection immediate while the visual focus transitions, including rapid repeat clicks.
- Respect reduced-motion preferences; use CSS animation without a persistent JavaScript loop.

## Conversation Rail 0.1.3 — 2026-10-12

- Keep the clicked turn active throughout virtual mounting and position correction, even at a clamped bottom boundary.
- Resume automatic active-turn inference on manual wheel, touch, keyboard or pointer interaction outside the rail.
- Infer reading position from freshly measured mounted turns, avoiding outdated coordinates from unloaded history.

## Conversation Rail 0.1.2 — 2026-10-12

- Keep discovered latest turns when an indexing pass misses delayed virtual mounts.
- Preserve chronological order separately from shifting coordinates; translate cached positions when older history is prepended.
- Verify delayed latest mounts and prepend ordering with focused browser regressions.

## Conversation Rail 0.1.1 — 2026-10-12

- Fix disappearing navigation during hydration: identify threads by conversation ID, accept remounted nodes with existing message IDs, and rebind replaced transcript containers.
- Replace the separate index button with a red first mark, using the same preview card with “点击加载过去的对话”. Hide it when all history is indexed.
- Add browser regressions for route normalization, container replacement, reused DOM, and history mark visibility. Keep normal scrolling free of full index rebuilds and geometry scans.

## Conversation Rail 0.1.0 — 2026-10-12

- 新增独立实现的短横线对话导航。
- 适配新版虚拟化消息节点及旧版消息 wrapper，处理反向容器的负滚动位置。
- 缓存坐标、二分查询、直接结构观察和横线列表虚拟化，控制滚动及流式输出期间的持续开销。
- 按需扫描历史，支持取消、阅读位置恢复和卸载节点跳转校准。
- 添加 Node 算法检查和本机浏览器验证页面。

## 0.4.9 — 2026-10-10

- 合并重复的暗色模式选择器，减少重复字体覆盖，并让部分面板文字继承容器字体。
- 收窄代码框和输入器的关联查询，减少对无关容器的匹配。
- 聊天/工作切换改用兄弟选择器，保留文字悬停高亮。
- 将窄屏设置标题的关联查询从整页限定到对应的 `main` 容器；Dot 浮动标题改为直接匹配。
- 关闭导航图标的颜色和透明度过渡，使高亮反馈立即出现，保留其他界面动画。

在当前 Chrome 前端验证了首页侧栏、复杂 Markdown、Dot、智慧 UI 和宽窄屏设置页。
本次保留已验证的本地优化；全文件审计中收益不稳定或改变视觉效果的实验方案未纳入。
选择器分支由 895 个减少到 331 个，该数量变化不代表同比性能提升。
