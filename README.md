# RuYi-Nodes

**[English](#english) | [简体中文](#简体中文)**

A lightweight, metadata-aware multi-LoRA toolkit for ComfyUI.  
面向 ComfyUI 的轻量多 LoRA 管理与元数据增强工具节点。

> **Project note / 项目说明**
>
> I have no programming background. **RuYi-Nodes was developed entirely through ChatGPT-assisted coding**: ChatGPT was used for code implementation, debugging, optimization, and documentation. I defined the feature requirements, workflow and UI direction, performed the actual ComfyUI testing, and made the final decisions on behavior and interface.
>
> 我没有编程基础。**RuYi-Nodes 的开发完全依靠 ChatGPT 辅助编程完成**：代码实现、调试、优化和文档整理均由 ChatGPT 协助完成；节点的功能需求、工作流程、界面方向、实际 ComfyUI 测试以及最终取舍由我负责。
>
> Bug reports, compatibility feedback, and code review from experienced developers are very welcome.  
> 非常欢迎有经验的开发者提供 Bug 报告、兼容性反馈和代码审查。

---

## English

**RuYi-Nodes** is a lightweight collection of practical custom nodes for ComfyUI. The current release focuses on a metadata-aware multi-LoRA workflow and a simple STRING monitor for inspecting merged prompt text.

Current version: **v0.1.17**

![RuYi Multi-LoRA Loader](docs/images/en-multi-lora-loader.jpg)

### Highlights

- Manage multiple LoRAs inside a single node.
- Enable or disable each LoRA independently.
- Independent MODEL / CLIP strengths in the full loader.
- Reorder and delete LoRAs, or toggle all entries at once.
- In-node preview thumbnails.
- Searchable LoRA picker with separate **Folder** and **Base model** filters.
- Per-node **Show N LoRAs** viewport control (`3` by default, `0` = unlimited).
- Optional trigger-word output with de-duplication across enabled LoRAs.
- Per-LoRA **Output trigger** toggle controls whether that LoRA contributes trigger words to the STRING output.
- Trigger Words preview with copy action.
- Metadata-aware display for usage tips, notes, source links, base model and recommended weights.
- Compact clipped metadata regions with full text available on hover.
- Fixed 4:5 preview crops and RAM-only low-resolution thumbnail caching for a responsive picker.
- English and Simplified Chinese localization.
- No additional Python packages are required beyond the libraries already used by a normal ComfyUI installation.
- Uses ComfyUI's native `LoraLoader` / `LoraLoaderModelOnly` for the actual LoRA loading path.

### Recommended companion: ComfyUI-Lora-Manager

RuYi-Nodes works **without any additional custom nodes for basic LoRA loading**.

For the full metadata-aware experience, however, **[ComfyUI-Lora-Manager](https://github.com/willmiao/ComfyUI-Lora-Manager)** is strongly recommended.

LoRA Manager can generate `<lora-name>.metadata.json` sidecar files next to your LoRA models. RuYi-Nodes reads these files to provide richer information and controls.

**RuYi-Nodes alone:**

- Multi-LoRA loading
- Independent enable / disable
- MODEL / CLIP strength control
- Reordering and deletion
- Normal LoRA selection and loading

**With ComfyUI-Lora-Manager metadata:**

- LoRA preview images
- Base-model information and filtering
- Trigger words
- Recommended MODEL / CLIP strengths
- Usage tips
- Personal notes
- Source links

Expected sidecar layout:

```text
my_lora.safetensors
my_lora.metadata.json
my_lora.jpeg
```

![LoRA metadata sidecar example](docs/images/lora-info.jpg)

RuYi-Nodes currently targets the `.metadata.json` schema used by ComfyUI-Lora-Manager. Other LoRA metadata formats are **not guaranteed to be compatible** unless they follow the same field structure.

Metadata fields currently consumed include:

- `model_name`
- `base_model`
- `preview_url`
- `notes`
- `civitai.trainedWords`
- `usage_tips`

If metadata is missing, core LoRA loading still works; metadata-dependent enhancements simply become unavailable.

### Included nodes

| Node | Input | Output | Purpose |
| --- | --- | --- | --- |
| **RuYi multi-Lora-loader** | `MODEL`, `CLIP` | `MODEL`, `CLIP`, `trigger_words` | Load multiple LoRAs with independent MODEL and CLIP strengths. |
| **RuYi multi-Lora-loader (model only)** | `MODEL` | `MODEL`, `trigger_words` | Load multiple LoRAs into MODEL only; useful for Krea2 / Flux-style workflows. |
| **RuYi text-preview** | `STRING` | `STRING` | Display the complete input STRING after execution and pass it through unchanged. |

### Installation

#### Option A — Git clone (recommended)

Open a terminal in `ComfyUI/custom_nodes` and run:

```bash
git clone https://github.com/RuYi-Xiao/RuYi-Nodes.git
```

Restart ComfyUI after installation.

To update later:

```bash
cd RuYi-Nodes
git pull
```

#### Option B — Manual ZIP installation

1. Download the repository ZIP from GitHub.
2. Extract it into your ComfyUI `custom_nodes` directory.
3. Make sure the final directory is named `RuYi-Nodes` and contains `__init__.py` directly inside it.
4. Restart ComfyUI.

Example for ComfyUI Desktop on Windows:

```text
D:\Comfy-Desktop\ComfyUI\ComfyUI\custom_nodes\RuYi-Nodes\
├─ __init__.py
├─ ruyi_multi_lora.py
├─ pyproject.toml
├─ README.md
├─ js\
│  └─ ruyi_multi_lora.js
└─ locales\
   ├─ en\
   │  └─ nodeDefs.json
   └─ zh\
      └─ nodeDefs.json
```

After restarting ComfyUI, search for:

```text
RuYi multi-Lora-loader
RuYi multi-Lora-loader (model only)
RuYi text-preview
```

The LoRA nodes are under `RuYi-Nodes/loaders`; the text monitor is under `RuYi-Nodes/text`.

### Quick Start

1. Add **RuYi multi-Lora-loader** or **RuYi multi-Lora-loader (model only)**.
2. Connect `MODEL` and, for the full loader, `CLIP`.
3. Click **Add LoRA** and select one or more LoRAs.
4. Adjust MODEL / CLIP strengths as needed.
5. Enable **Output trigger** for any LoRA whose trigger words should be included in the `trigger_words` STRING output.
6. Connect `trigger_words` into your prompt STRING workflow when required.
7. Use **RuYi text-preview** to inspect the final merged prompt text.

### LoRA Picker

The LoRA picker provides searchable preview cards with separate **Folder** and **Base model** filters. Metadata and preview thumbnails are shown when available.

![RuYi LoRA Picker](docs/images/en-lora-picker.jpg)

### Trigger-word output

Both LoRA loaders expose an optional `trigger_words` STRING output.

For each enabled LoRA, **Output trigger** determines whether its trigger words are included. Trigger words from all selected entries are combined and de-duplicated.

Leaving `trigger_words` unconnected is valid and does not affect LoRA loading.

A common prompt workflow is:

```text
Main prompt STRING ───────────┐
                              ├─ STRING concatenate / combine ──> final prompt STRING
RuYi trigger_words STRING ───┘
                                                    │
                                                    └─> RuYi text-preview
```

`RuYi text-preview` is an output node, so it executes even when its passthrough STRING output is not connected. It is useful for checking the final merged prompt and LoRA trigger text.

### Krea2 / model-only workflow

For Krea2-style workflows where LoRAs are applied to MODEL only, use:

```text
MODEL / UNET
    │
    ▼
RuYi multi-Lora-loader (model only)
    │
    ▼
MODEL
```

Keep the text encoder / CLIP path separate unless your workflow specifically requires otherwise.

### Metadata refresh

After changing LoRA Manager metadata or previews, use **Refresh list / metadata** in the RuYi node. This refreshes the catalog and causes trigger-word output to be recalculated when the metadata has changed.

### Design notes

RuYi-Nodes keeps the loading core intentionally conservative:

- Native ComfyUI loader classes perform LoRA application.
- LoRA Manager integration is sidecar-based rather than dependent on private/internal APIs.
- The rich UI is an enhancement layer; missing metadata does not block normal LoRA loading.
- LoRA paths provided through ComfyUI, including `extra_model_paths.yaml`, junctions and symlinks, are supported through ComfyUI's normal path handling.

#### Legacy Canvas Mode layering

The rich LoRA cards use ComfyUI DOMWidgets. In legacy Canvas Mode, DOMWidgets are rendered in an HTML layer above the LiteGraph canvas. As a result, ordinary canvas-rendered nodes cannot visually cover the HTML LoRA card when dragged over it. This is a frontend rendering limitation rather than a LoRA loading issue.

### Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

### License

RuYi-Nodes is released under the [MIT License](LICENSE).

---

## 简体中文

**RuYi-Nodes** 是一组轻量、实用的 ComfyUI 自定义节点。目前主要提供带 LoRA 元数据支持的多 LoRA 加载器，以及用于检查最终合并提示词的 STRING 文本监视节点。

当前版本：**v0.1.17**

![RuYi 多 LoRA 加载器](docs/images/zh-multi-lora-loader.jpg)

### 主要功能

- 在单个节点内管理多个 LoRA。
- 每个 LoRA 可独立启用或停用。
- 完整版加载器可分别设置 MODEL / CLIP 权重。
- 支持上移、下移、删除以及全部开关。
- 节点内显示 LoRA 预览图。
- 可搜索的 LoRA 选择器，并分别提供**文件夹**与**基础模型**筛选。
- 每个节点独立设置**显示 N 个 LoRA**（默认 `3`，`0` 表示无限制展开）。
- 可选的触发词 STRING 输出，并自动去重。
- 每个 LoRA 的**输出触发词**开关独立决定其触发词是否加入输出。
- 节点内显示触发词并提供复制按钮。
- 可显示使用说明、附加备注、来源链接、基础模型与推荐权重等元数据。
- 元数据区域采用紧凑截断显示，鼠标悬停可查看完整文本。
- 预览统一为 4:5 裁切，并使用仅内存缓存的低分辨率缩略图，提高大量 LoRA 浏览时的流畅度。
- 支持英文 / 简体中文本地化。
- 除正常 ComfyUI 已使用的库外，不需要额外安装 Python 依赖。
- 实际 LoRA 加载仍调用 ComfyUI 原生 `LoraLoader` / `LoraLoaderModelOnly`。

### 推荐配套：ComfyUI-Lora-Manager

RuYi-Nodes 的**基础 LoRA 加载功能不依赖其他自定义节点**，可以直接使用。

但如果希望完整使用 LoRA 元数据相关功能，**强烈推荐安装 [ComfyUI-Lora-Manager](https://github.com/willmiao/ComfyUI-Lora-Manager)**。

LoRA Manager 可以在 LoRA 模型旁生成对应的 `<LoRA名称>.metadata.json` sidecar 元数据文件。RuYi-Nodes 会读取这些文件，以提供更完整的信息显示和控制功能。

**仅使用 RuYi-Nodes：**

- 多 LoRA 加载
- 各 LoRA 独立启用 / 停用
- MODEL / CLIP 权重控制
- 排序与删除
- 正常选择和加载 LoRA

**配合 ComfyUI-Lora-Manager 元数据：**

- LoRA 预览图
- 基础模型信息与筛选
- 触发词
- 推荐 MODEL / CLIP 权重
- 使用说明
- 附加备注
- 模型来源链接

预期的 sidecar 文件结构：

```text
my_lora.safetensors
my_lora.metadata.json
my_lora.jpeg
```

![LoRA 元数据文件示例](docs/images/lora-info.jpg)

RuYi-Nodes 当前主要针对 ComfyUI-Lora-Manager 使用的 `.metadata.json` 格式进行适配。其他 LoRA 元数据格式**不保证兼容**，除非其字段结构与该格式一致。

目前读取的主要字段包括：

- `model_name`
- `base_model`
- `preview_url`
- `notes`
- `civitai.trainedWords`
- `usage_tips`

即使某个 LoRA 没有元数据文件，核心 LoRA 加载仍然可以正常工作，只是依赖元数据的增强功能不可用。

### 包含的节点

| 节点 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| **RuYi multi-Lora-loader** | `MODEL`、`CLIP` | `MODEL`、`CLIP`、`trigger_words` | 同时加载多个 LoRA，并分别控制 MODEL 与 CLIP 权重。 |
| **RuYi multi-Lora-loader（仅模型）** | `MODEL` | `MODEL`、`trigger_words` | 仅向 MODEL 加载多个 LoRA，适合 Krea2 / Flux 一类仅模型 LoRA 工作流。 |
| **RuYi 文本监视** | `STRING` | `STRING` | 执行后显示完整输入文本，并将 STRING 原样继续输出。 |

### 安装

#### 方法 A — Git clone（推荐）

在 `ComfyUI/custom_nodes` 目录打开终端：

```bash
git clone https://github.com/RuYi-Xiao/RuYi-Nodes.git
```

安装完成后重启 ComfyUI。

以后更新只需：

```bash
cd RuYi-Nodes
git pull
```

#### 方法 B — 手动下载 ZIP

1. 在 GitHub 下载仓库 ZIP。
2. 解压到 ComfyUI 的 `custom_nodes` 目录。
3. 确认最终文件夹名称为 `RuYi-Nodes`，且 `__init__.py` 直接位于该目录内。
4. 重启 ComfyUI。

ComfyUI Desktop（Windows）示例：

```text
D:\Comfy-Desktop\ComfyUI\ComfyUI\custom_nodes\RuYi-Nodes\
├─ __init__.py
├─ ruyi_multi_lora.py
├─ pyproject.toml
├─ README.md
├─ js\
│  └─ ruyi_multi_lora.js
└─ locales\
   ├─ en\
   │  └─ nodeDefs.json
   └─ zh\
      └─ nodeDefs.json
```

重启后可以搜索：

```text
RuYi multi-Lora-loader
RuYi multi-Lora-loader (model only)
RuYi 文本监视
```

两个 LoRA 节点位于 `RuYi-Nodes/loaders`，文本监视位于 `RuYi-Nodes/text`。

### 快速开始

1. 添加 **RuYi multi-Lora-loader** 或 **RuYi multi-Lora-loader（仅模型）**。
2. 连接 `MODEL`；完整版加载器还需要连接 `CLIP`。
3. 点击**添加 LoRA**并选择一个或多个 LoRA。
4. 根据需要调整 MODEL / CLIP 权重。
5. 对需要自动输出触发词的 LoRA 开启**输出触发词**。
6. 如有需要，将 `trigger_words` 接入你的提示词 STRING 合并流程。
7. 使用 **RuYi 文本监视**检查最终合并后的完整提示词。

### LoRA 选择器

LoRA 选择器提供可搜索的预览卡片，并分别支持**文件夹**与**基础模型**筛选；存在元数据和预览图时会一并显示。

![RuYi LoRA 选择器](docs/images/zh-lora-picker.jpg)

### 触发词输出

两个 LoRA 加载器都会提供一个可选的 `trigger_words` STRING 输出。

对于每个已启用的 LoRA，**输出触发词**决定它的触发词是否加入最终 STRING。多个 LoRA 的触发词会合并并自动去重。

`trigger_words` 不连接任何节点也不会报错，也不会影响 LoRA 本身的加载。

一种常见连接方式：

```text
主提示词 STRING ─────────────┐
                              ├─ STRING 合并节点 ──> 最终提示词 STRING
RuYi trigger_words STRING ───┘
                                           │
                                           └─> RuYi 文本监视
```

`RuYi 文本监视`属于输出节点，因此即使它自己的 passthrough STRING 输出未连接，也会在队列执行时刷新显示。它很适合用来检查最终合并后的提示词和 LoRA 触发词。

### Krea2 / 仅模型工作流

对于 Krea2 一类只需要把 LoRA 应用到 MODEL 的工作流，建议使用：

```text
MODEL / UNET
    │
    ▼
RuYi multi-Lora-loader（仅模型）
    │
    ▼
MODEL
```

文本编码器 / CLIP 路径保持独立，除非你的具体工作流另有要求。

### 刷新元数据

修改 LoRA Manager 的元数据或预览图后，可以点击 RuYi 节点中的**刷新列表/资料**。该操作会刷新目录，并在元数据发生变化时使下一次运行重新计算触发词输出。

### 设计说明

RuYi-Nodes 的核心加载逻辑尽量保持简单和保守：

- LoRA 实际应用由 ComfyUI 原生加载器完成。
- LoRA Manager 集成基于 sidecar 文件，而不是内部私有 API。
- 富 UI 只是增强层；元数据缺失不会阻止正常加载。
- 通过 ComfyUI 配置的 `loras` 路径，包括 `extra_model_paths.yaml`、junction 和 symlink，继续使用 ComfyUI 自身的路径处理逻辑。

#### 旧版 Canvas Mode 的层级限制

RuYi 的富 LoRA 卡片使用 ComfyUI DOMWidgets。旧版 Canvas Mode 中，DOMWidgets 位于 LiteGraph 画布之上的 HTML 图层，因此普通画布节点拖到 LoRA 卡片上方时，无法真正遮住该 HTML 卡片。这属于前端渲染架构限制，与 LoRA 加载逻辑无关。

### 更新记录

版本历史见 [CHANGELOG.md](CHANGELOG.md)。

### 许可证

RuYi-Nodes 使用 [MIT License](LICENSE) 发布。
