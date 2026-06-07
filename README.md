# 📖 Novelist

> AI-powered novel creation — from inspiration to finished book, with AI by your side.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)

---

English | [中文 - 使用说明](#使用说明)

---

## Why

The hardest part of writing a novel isn't the writing itself — it's knowing what to write, how to structure it, and keeping momentum past chapter one.

Novelist takes your vague idea (e.g. "a programmer transmigrates into a cultivation world") and handles the rest: **brainstorming → outlining → chapter planning → full-content generation**. You're not chatting with AI — you're **crafting** your own novel.

## Features

- 🎯 **Creative Inspiration**: 8 categories × 5 creative dimensions, AI-powered brainstorming
- 📋 **Outline Planning**: Auto-generates title, volume structure (3–6 volumes), and chapter outlines
- ✏️ **Inline Editing**: Freely edit the outline after generation, regenerate at any time
- ⚡ **One-click Generation**: AI writes chapters sequentially based on your confirmed outline
- 🔄 **Resume Support**: Interrupted generation auto-detected on restart, one click to continue
- 🌐 **Bilingual UI**: Chinese / English with instant switching
- 🔌 **Multi-provider**: DeepSeek / OpenAI / SiliconFlow / Ollama / Custom API
- 📱 **Responsive**: Works on desktop and mobile

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 22+
- An AI model API key ([DeepSeek](https://platform.deepseek.com/) is cheap and good)

### 1. Clone

```bash
git clone git@github.com:MeChenkw/novelist.git
cd novelist
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure API key

```bash
cp .env.example .env
```

Edit `.env`:

```
DEEPSEEK_API_KEY=sk-your-key-here
```

You can also configure the key via the in-app settings panel, which supports more providers (see below).

### 4. Run

**One-command launch (recommended):**

```bash
./start.sh
```

Open http://localhost:5001

**Dev mode (hot reload):**

```bash
./start.sh dev
# Backend: http://localhost:5001
# Frontend: http://localhost:5173
```

## Workflow

```
Enter idea → AI suggests options → Generate outline → Edit outline → Confirm → Generate chapters → Read / Download
```

1. **Create**: pick a category, enter your story idea, set a word count target
2. **Inspire** (optional): AI recommends creative options across 5 dimensions
3. **Outline**: AI generates title, volumes, and chapter outlines
4. **Edit**: tweak volume/chapter names and outlines inline
5. **Confirm**: lock in your outline
6. **Generate**: AI writes full chapter content, one at a time, in order
7. **Download**: export as TXT when done

## State Machine

Novels progress through 5 states:

```
draft → confirmed → generating → done
                        ↓ (interrupted)
                   interrupted → generating → done
```

| State | Meaning | Available actions |
|-------|---------|-------------------|
| `draft` | No outline yet | Edit, generate outline |
| `confirmed` | Outline locked | Modify outline, start generation |
| `generating` | AI writing | View progress (read-only) |
| `interrupted` | Generation aborted | Resume with one click |
| `done` | Fully generated | Read, download |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12, Flask, SQLAlchemy (SQLite) |
| Frontend | React 19, TypeScript 6, Tailwind CSS 4, Vite 8 |
| AI | OpenAI-compatible API (DeepSeek / OpenAI / SiliconFlow / Ollama) |
| i18n | Custom frontend module (zh-CN / en-US) |

## Project Structure

```
novelist/
├── start.sh                 # One-click launcher
├── backend/
│   ├── app.py               # Flask app: models + AI calls + API routes
│   ├── requirements.txt
│   ├── .env.example
│   └── static/              # Frontend build (production mode)
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Multi-page state machine
│   │   ├── api.ts           # API client
│   │   ├── i18n.ts          # i18n dictionary
│   │   ├── types.ts         # TypeScript types
│   │   └── components/
│   │       ├── IdeaEnhancer.tsx    # Creative inspiration
│   │       ├── OutlineEditor.tsx   # Outline editor
│   │       ├── NovelReader.tsx     # Novel reader
│   │       ├── ModelSettings.tsx   # Provider settings
│   │       └── ErrorBoundary.tsx
│   └── vite.config.ts
```

## Model Providers

Your API key and model selection are stored in your browser — never uploaded.

| Provider | API URL | Default model |
|----------|---------|---------------|
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| SiliconFlow | https://api.siliconflow.cn/v1 | deepseek-llm/deepseek-chat |
| Ollama (local) | http://localhost:11434/v1 | llama3 |
| Custom | your choice | your choice |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List model providers |
| POST | `/api/test-api` | Test API config |
| POST | `/api/suggest-options` | AI creative suggestions |
| POST | `/api/novels` | Create a novel |
| POST | `/api/novels/<id>/generate-outline` | Generate outline |
| GET | `/api/novels/<id>` | Get novel details |
| PUT | `/api/novels/<id>/confirm` | Confirm outline |
| PUT | `/api/novels/<id>/outline` | Update outline |
| POST | `/api/novels/<id>/generate` | Start generation |
| GET | `/api/novels/<id>/progress` | Get generation progress |
| GET | `/api/novels/<id>/download` | Download TXT |
| GET | `/api/novels` | List all novels |
| DELETE | `/api/novels/<id>` | Delete a novel |
| GET | `/api/novels/<id>/chapters/<chapter_id>` | Get chapter content |

## Contributing

Issues and PRs welcome. See [AGENTS.md](AGENTS.md) for conventions.

## License

MIT © [MeChenkw](https://github.com/MeChenkw)

---

# 📖 使用说明

> AI 驱动的小说创作工具——从灵感到成书，全程 AI 陪伴。

## 这是什么

写小说最难的往往不是动笔，而是动笔**之前**——不知道写什么、不知道怎么展开、写了一章就卡住了。

小说家让你只需输入一个模糊的灵感（比如「一个穿越到修真世界的程序员」），AI 就帮你完成：**创意启发 → 大纲规划 → 分卷分章 → 逐章成书**。你不是在跟 AI 聊天，而是在**定制**属于你自己的小说。

## 功能

- 🎯 **灵感启发**：8 个分类 × 5 个创作维度，AI 帮你脑暴创意点子
- 📋 **大纲策划**：AI 自动生成小说名、分卷结构（3-6 卷）、各章节大纲
- ✏️ **在线编辑**：大纲生成后可自由修改，不满意随时重来
- ⚡ **一键成书**：确认大纲后，AI 按序逐章生成正文内容
- 🔄 **断点续写**：生成意外中断（API 报错、服务器重启），自动标记中断状态，一键继续
- 🌐 **中英双语**：界面支持中文 / English 实时切换
- 🔌 **多模型可选**：DeepSeek / OpenAI / 硅基流动 / Ollama 本地 / 自定义 API 地址
- 📱 **响应式**：桌面端和移动端都能用

## 怎么用

### 环境要求

- Python 3.12 以上
- Node.js 22 以上
- 一个 AI 模型的 API Key（推荐 [DeepSeek](https://platform.deepseek.com/)，便宜好用）

### 安装启动

```bash
# 1. 克隆项目
git clone git@github.com:MeChenkw/novelist.git
cd novelist

# 2. 安装后端依赖
cd backend
python -m venv venv
source venv/bin/activate   # Windows 用: venv\Scripts\activate
pip install -r requirements.txt

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env 填入你的 API Key，也可以在启动后的网页设置里配置

# 4. 启动（一键）
./start.sh
```

打开浏览器访问 **http://localhost:5001**，就可以用了。

### 创作流程

```
输入灵感 → AI 推荐创意 → 生成大纲 → 编辑修改 → 确认大纲 → 开始生成 → 在线阅读/下载 TXT
```

1. **创建小说**：选分类（玄幻/奇幻/都市/历史/科幻/悬疑/言情/武侠），输入故事创意，设字数目标
2. **灵感挖掘**（可选）：AI 从世界观、主角设定、核心冲突、故事基调、叙事视角 5 个维度给出创意选项
3. **生成大纲**：点击「生成大纲」，AI 输出小说名 + 分卷 + 各章大纲
4. **编辑调优**：在线修改卷名、章名、大纲描述，确认后点击「确认大纲」
5. **生成正文**：点击「生成小说」，AI 按卷逐章生成，可在阅读器中实时查看进度
6. **下载带走**：生成完毕后下载 TXT 文件

### 模型设置

首次使用点击右上角 ⚙️ 图标配置模型。支持以下提供商：

| 提供商 | API 地址 | 推荐模型 |
|--------|----------|----------|
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| 硅基流动 | https://api.siliconflow.cn/v1 | deepseek-llm/deepseek-chat |
| Ollama | http://localhost:11434/v1 | llama3 |
| 自定义 | 自填 | 自填 |

API Key 和模型选择保存在你的浏览器本地，不会上传到任何服务器。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.12, Flask, SQLAlchemy (SQLite) |
| 前端 | React 19, TypeScript 6, Tailwind CSS 4, Vite 8 |
| AI | OpenAI 兼容接口（DeepSeek / OpenAI / 硅基流动 / Ollama） |
| 国际化 | 自研纯前端 i18n 方案 |

## 项目结构

```
novelist/
├── start.sh                 # 一键启动脚本
├── backend/
│   ├── app.py               # Flask 主应用（数据模型 + AI 调用 + 全部 API）
│   ├── requirements.txt     # Python 依赖
│   ├── .env.example         # API Key 配置模板
│   └── static/              # 前端构建产物（生产模式）
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # 主应用（多页面状态机）
│   │   ├── api.ts           # API 客户端
│   │   ├── i18n.ts          # 国际化字典
│   │   ├── types.ts         # TypeScript 类型定义
│   │   └── components/
│   │       ├── IdeaEnhancer.tsx    # 创意灵感引导
│   │       ├── OutlineEditor.tsx   # 大纲编辑器
│   │       ├── NovelReader.tsx     # 小说阅读器
│   │       ├── ModelSettings.tsx   # 模型设置面板
│   │       └── ErrorBoundary.tsx   # 错误边界
│   └── vite.config.ts
```

## 参与贡献

欢迎提 Issue 和 PR。开发规范见 [AGENTS.md](AGENTS.md)。

## 许可证

MIT © [MeChenkw](https://github.com/MeChenkw)
