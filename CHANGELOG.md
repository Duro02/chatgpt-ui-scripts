# 更新记录

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

- 新增独立的短横线对话导航，视觉参考 DSH 的 TurnNavigator。
- 适配新版虚拟化消息节点及旧版消息 wrapper，处理反向容器的负滚动位置。
- 缓存坐标、二分查询、直接结构观察和横线列表虚拟化，控制滚动及流式输出期间的持续开销。
- 按需扫描历史，支持取消、阅读位置恢复和卸载节点跳转校准。
- 添加 Node 算法检查和本机浏览器验证页面；旧版大型导航继续保留在 archived 中。

## 0.4.9 — 2026-10-10

- 合并重复的暗色模式选择器，减少重复字体覆盖，并让部分面板文字继承容器字体。
- 收窄代码框和输入器的关联查询，减少对无关容器的匹配。
- 聊天/工作切换改用兄弟选择器，保留文字悬停高亮。
- 将窄屏设置标题的关联查询从整页限定到对应的 `main` 容器；Dot 浮动标题改为直接匹配。
- 关闭导航图标的颜色和透明度过渡，使高亮反馈立即出现，保留其他界面动画。

在当前 Chrome 前端验证了首页侧栏、复杂 Markdown、Dot、智慧 UI 和宽窄屏设置页。
本次保留已验证的本地优化；全文件审计中收益不稳定或改变视觉效果的实验方案未纳入。
选择器分支由 895 个减少到 331 个，该数量变化不代表同比性能提升。
