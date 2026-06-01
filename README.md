# ChatGPT UI Scripts

个人自用的 ChatGPT 网页增强脚本集合，作者：duro。

这个仓库主要包含三类增强：

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `GPT Claude-like Style.css` | Stylus/UserStyle | ChatGPT 深色界面样式，让页面更接近 Claude 的窄版、暖灰、低干扰阅读体验。 |
| `chatgpt-claude-like-separator.user.js` | Tampermonkey userscript | 配合上面的样式使用，识别纯文本分隔符段落并添加 class，方便样式渲染为更自然的分割线。 |
| `chatgpt-conversation-navigator.user.js` | Tampermonkey userscript | 基于 YukonKong 原脚本修改，修复长对话节点跳转，增加 Prompt 管理、对话备份、虚拟化 DOM 适配等功能。 |

仓库里也包含一个附加脚本：

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `chatgpt-project-source-preview.user.js` | Tampermonkey userscript | 在 ChatGPT 项目源里预览 `.md` / `.txt` 文件，避免点击后直接下载。 |

## 安装

### Stylus 样式

1. 安装浏览器扩展 Stylus。
2. 新建样式。
3. 粘贴 `GPT Claude-like Style.css` 的内容。
4. 打开 `https://chatgpt.com/`。

### Tampermonkey 脚本

1. 安装浏览器扩展 Tampermonkey。
2. 新建脚本。
3. 分别粘贴需要使用的 `.user.js` 文件内容。
4. 保存后刷新 ChatGPT 页面。

建议组合：

- 只想改外观：安装 `GPT Claude-like Style.css`。
- 想让外观里的分隔线更稳定：再安装 `chatgpt-claude-like-separator.user.js`。
- 想要长对话导航、Prompt 管理和备份：安装 `chatgpt-conversation-navigator.user.js`。
- 想预览项目源 Markdown/text 文件：安装 `chatgpt-project-source-preview.user.js`。

## 主要功能

### ChatGPT Claude-like Style

- 暖灰深色主题。
- 更窄的正文阅读宽度。
- 更接近 Claude 的文本、代码块、引用块和分隔线视觉。
- 尽量不破坏 ChatGPT 原始布局节点，方便与其他脚本共存。

### ChatGPT Claude-like Separators

- 扫描 ChatGPT 回答中的纯文本分隔符段落。
- 给匹配段落添加 `claude-like-separator` class。
- 由 Stylus 样式负责最终视觉渲染。

### ChatGPT Conversation Navigator

这是对 YukonKong 原始 `ChatGPT体验增强插件` 的修改版，重点改动包括：

- 使用 `conversation-turn-*` wrapper 作为长对话时间线锚点。
- 适配 ChatGPT 虚拟化 DOM，减少长对话跳转错位。
- 增加 Prompt 管理器，支持命名、分类、保存、追加到当前输入。
- 增加当前会话备份能力，并改进长对话滚动采集。
- 在对话列表和右侧时间线中标记分支对话，区分“编辑用户消息产生的分支”和“重新生成回答产生的分支”。
- 支持点击 `Index Missing` 补全长对话中尚未缓存的预览文本与分支标记。
- 移除原脚本 GreasyFork 自动更新地址，避免修改版被自动更新回原版。

使用方式：

- 右侧圆点时间线可快速跳转到对应用户提问。
- 点击右侧列表按钮可展开“对话列表”，按序号或文本搜索并跳转。
- 对长对话或旧对话，点击 `Index Missing` 可以让脚本滚动检查未缓存节点，补全预览文本和分支状态。
- 长按右侧时间线圆点可手动重点标记，再次长按可取消。
- 右下角 Prompt 管理按钮可保存常用 prompt，按分类管理，并追加到当前输入框末尾。
- 备份按钮可导出当前对话 Markdown；长对话会优先复用已有备份记录，只扫描未备份部分。

颜色含义：

- 灰色圆点：普通对话节点。
- 黄色圆点：手动重点标记的节点。
- 蓝色圆点 / `2/2` 蓝色标签：该用户提问存在编辑后重发产生的分支。
- 白色圆点 / `A 2/2` 白色标签：该轮 GPT 回答存在重新生成产生的回答分支。
- 黄蓝双色：既是手动重点标记，又存在用户提问分支。
- 黄白双色：既是手动重点标记，又存在回答分支。
- 蓝白双色：同一轮同时存在用户提问分支和回答分支。
- 黄蓝白三色：同一轮同时存在手动重点标记、用户提问分支和回答分支。

## 许可证与署名

- `chatgpt-conversation-navigator.user.js` 基于 YukonKong 的原始脚本修改，原脚本许可证为 `CC-BY-NC-4.0`。本修改版继续保留原作者署名和同一许可证限制，仅可在许可证允许范围内使用和再发布，尤其注意非商业限制。
- `GPT Claude-like Style.css`、`chatgpt-claude-like-separator.user.js`、`chatgpt-project-source-preview.user.js` 由 duro 编写。除非单个文件另有说明，按 `MIT` 许可发布。

原始脚本来源：

- `ChatGPT体验增强插件` by YukonKong
- GreasyFork update URL: `https://update.greasyfork.org/scripts/570234/ChatGPT%E4%BD%93%E9%AA%8C%E5%A2%9E%E5%BC%BA%E6%8F%92%E4%BB%B6.user.js`

## 注意

ChatGPT 网页 DOM 变化很快，这些脚本都依赖当前网页结构。若某个功能突然失效，通常需要用浏览器开发者工具重新确认相关 DOM 或请求路径。
