# RuYi-Nodes

[English](README.md)

**RuYi-Nodes** 是一组轻量、实用的 ComfyUI 自定义节点。目前主要提供带 LoRA Manager 元数据支持的多 LoRA 加载器，以及用于检查最终合并提示词的 STRING 文本监视节点。

当前版本：**v0.1.17**

## 包含的节点

| 节点 | 输入 | 输出 | 用途 |
| --- | --- | --- | --- |
| **RuYi multi-Lora-loader** | `MODEL`、`CLIP` | `MODEL`、`CLIP`、`trigger_words` | 同时加载多个 LoRA，并分别控制 MODEL 与 CLIP 权重。 |
| **RuYi multi-Lora-loader（仅模型）** | `MODEL` | `MODEL`、`trigger_words` | 仅向 MODEL 加载多个 LoRA，适合 Krea2 / Flux 一类仅模型 LoRA 工作流。 |
| **RuYi 文本监视** | `STRING` | `STRING` | 执行后显示完整输入文本，并将 STRING 原样继续输出。 |

## 主要功能

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
- 显示 LoRA Manager 的 `usage_tips` 与 `notes`。
- 元数据区域采用紧凑截断显示，鼠标悬停可查看完整文本。
- 元数据存在来源信息时显示**访问发布页**。
- `usage_tips` 中包含推荐权重时可应用 LoRA Manager 推荐权重。
- 预览统一为 4:5 裁切，并使用仅内存缓存的低分辨率缩略图，提高大量 LoRA 浏览时的流畅度。
- 支持英文 / 简体中文本地化。
- 除正常 ComfyUI 已使用的库外，不需要额外安装 Python 依赖。
- 实际 LoRA 加载仍调用 ComfyUI 原生 `LoraLoader` / `LoraLoaderModelOnly`。

## 安装

### 方法 A — Git clone（推荐）

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

### 方法 B — 手动下载 ZIP

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

## ComfyUI-Lora-Manager 集成

节点运行至少需要当前版本的 ComfyUI。

如果希望获得完整的预览图、触发词、使用说明、附加备注、推荐权重和来源按钮等功能，**强烈建议配合 willmiao 的 ComfyUI-Lora-Manager 使用**；但它并不是核心 LoRA 加载功能的硬依赖。

RuYi-Nodes 不调用 LoRA Manager 的内部 Python API，而是直接读取其 `.metadata.json` sidecar 文件。这样可以尽量减少耦合：LoRA Manager 负责元数据获取、编辑和预览管理，RuYi-Nodes 负责读取并显示。

预期文件命名：

```text
my_lora.safetensors
my_lora.metadata.json
```

目前读取的主要字段包括：

- `model_name`
- `base_model`
- `preview_url`
- `notes`
- `civitai.trainedWords`
- `usage_tips`

即使某个 LoRA 没有元数据文件，核心 LoRA 加载仍然可以正常工作，只是预览和元数据增强功能不可用。

## 触发词输出

两个 LoRA 加载器都会提供一个可选的 `trigger_words` STRING 输出。

对于每个已启用的 LoRA，**Output trigger / 输出触发词**决定它的触发词是否加入最终 STRING。多个 LoRA 的触发词会合并并自动去重。

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

## Krea2 / 仅模型工作流

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

## 刷新元数据

修改 LoRA Manager 的元数据或预览图后，可以点击 RuYi 节点中的**刷新列表/资料**。该操作也会更新序列化的 stack revision，使下一次运行重新计算触发词输出。

## 设计说明

RuYi-Nodes 的核心加载逻辑尽量保持简单和保守：

- LoRA 实际应用由 ComfyUI 原生加载器完成。
- LoRA Manager 集成基于 sidecar 文件，而不是内部私有 API。
- 富 UI 只是增强层；元数据缺失不会阻止正常加载。
- 通过 ComfyUI 配置的 `loras` 路径，包括 `extra_model_paths.yaml`、junction 和 symlink，继续使用 ComfyUI 自身的路径处理逻辑。

### 旧版 Canvas Mode 的层级限制

RuYi 的富 LoRA 卡片使用 ComfyUI DOMWidgets。旧版 Canvas Mode 中，DOMWidgets 位于 LiteGraph 画布之上的 HTML 图层，因此普通画布节点拖到 LoRA 卡片上方时，无法真正遮住该 HTML 卡片。这属于前端渲染架构限制，与 LoRA 加载逻辑无关。

## 更新记录

版本历史见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

RuYi-Nodes 使用 [MIT License](LICENSE) 发布。
