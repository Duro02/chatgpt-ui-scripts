# ChatGPT UI Scripts

ChatGPT 网页界面增强脚本与样式集合。

中文 | [English](README_en.md)

## 预览

![登录态会话页应用 Claude 风格主题的效果](assets/chatgpt-claude-style-demo.png)

这个仓库包含以下增强：

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| [`chatgpt-conversation-rail.user.js`](chatgpt-conversation-rail.user.js) | Tampermonkey userscript | ChatGPT 与 Dots 对话节点导航、节点持久化与节点搜索。 |
| `GPT Claude-like Style.user.css` | Stylus/UserStyle | ChatGPT 深色界面样式，提供类似 Claude 的窄栏、暖灰阅读体验。 |
| `chatgpt-claude-like-separator.user.js` | Tampermonkey userscript | 配合主题样式，使正文分隔线更自然。 |

## 安装

### Stylus 样式

推荐方式（可自动更新）：

1. 安装浏览器扩展 Stylus。
2. 打开原始文件地址：`https://raw.githubusercontent.com/Duro02/chatgpt-ui-scripts/main/GPT%20Claude-like%20Style.user.css`
3. Stylus 会弹出安装页，点击安装即可；后续在管理面板检查更新即可同步最新样式。

手动方式：

1. 安装浏览器扩展 Stylus。
2. 新建样式。
3. 粘贴 `GPT Claude-like Style.user.css` 的内容。
4. 打开 `https://chatgpt.com/`。

### 字体与回退顺序

主题使用本机已安装的字体，不会自动下载或安装字体。字体列表按从前到后的顺序匹配；浏览器会为每个字符选择列表中最先可用且包含该字符的字体。因此，中英文可能使用不同字体，不同设备的显示效果也可能有所差异。

- **界面文字**：优先使用系统无衬线字体，如 Apple 系统字体、Segoe UI、Roboto 等，最后回退到通用无衬线字体。
- **正文文字**：
  - 西文优先顺序：Iowan Old Style → Charter → Georgia → Times New Roman。
  - 中文优先顺序：Noto Serif CJK SC → Noto Serif SC → Source Han Serif SC（思源宋体）→ Songti SC → SimSun。
  - 最后回退到浏览器的通用衬线字体。
- **代码文字**：依次尝试 SFMono-Regular → Consolas → Liberation Mono → Menlo；这些字体未覆盖的中文字符继续按上述中文字体顺序匹配，最后回退到通用等宽字体。

若希望中文正文呈现主题预设的宋体风格，可安装上述中文字体之一。请注意，安装列表中靠后的字体不会使其优先于前面已可用的字体；若要指定首选字体，需要在 Stylus 中调整对应的字体列表：`--claude-font`（界面）、`--claude-prose-font`（正文）和 `--claude-mono`（代码）。

### Tampermonkey 脚本

1. 安装浏览器扩展 Tampermonkey。
2. 新建脚本。
3. 分别粘贴需要使用的 `.user.js` 文件内容。
4. 保存后刷新 ChatGPT 页面。

建议组合：

- 只想改外观：安装 `GPT Claude-like Style.user.css`。
- 想让外观里的分隔线更自然：再安装 `chatgpt-claude-like-separator.user.js`。
- 需要右侧对话导航：安装 `chatgpt-conversation-rail.user.js`，可单独使用。

## 主要功能

### ChatGPT Claude-like Style

- 暖灰深色主题。
- 更窄的正文阅读宽度。
- 更接近 Claude 的文本、代码块、引用块和分隔线视觉。

### ChatGPT Claude-like Separators

配合主题样式，让回答中的分隔线更自然。

### ChatGPT Conversation Rail

为 ChatGPT 和 Dots 添加右侧对话节点导航，点击节点即可跳转到对应提问。已发现的节点会保留，下次打开会话时仍可浏览，也可以按关键词搜索提问和回答摘要。

滚动正文时，当前提问对应的横线会在原位变长、变亮。

## 许可证

[MIT](LICENSE.md)

## 注意

ChatGPT 网页更新后，部分功能可能需要适配。如遇到问题，欢迎提交 Issue。
