# AutoContents  

基于 RSSHub 的 AI 资讯聚合、内容创作与 Agent 自动化工具。

订阅 RSS/RSSHub 信源 → 自动拉取资讯 → AI 翻译 / 筛选 → 一键推送微信 / 同步飞书 → 图文内容创作与渲染 → Agent 全自动运行。

---

## 功能概览

| 模块 | 功能 |
|---|---|
| **资讯聚合** | 支持 RSSHub 路由和标准 RSS，按信源分组展示，正向/黑名单关键词双重过滤 |
| **AI 翻译** | 对指定信源自动调用大模型翻译为中文 |
| **三类推送** | AINews（速报）/ AITopics（话题引导）/ AITools（工具推荐），并行推送微信和飞书知识库 |
| **内容创作** | 图片上传 + 大模型生成封面文案，渲染 1080×1440 封面图与详情图，小红书风格预览 |
| **资源库** | 原始资讯归档、已保存资讯列表、已保存内容宫格展示 |
| **飞书多维表** | 创作内容一键存入多维表，供人工审核后发布 |
| **Agent 接口** | 暴露完整 API，配合 Agent Skills 实现全自动资讯筛选、推送、创作、归档、通知 |

---

## 技术栈

- **后端**：Node.js + Express + SQLite（better-sqlite3）
- **前端**：React 18 + React Router 6
- **渲染**：Puppeteer（Headless Chromium）截图，支持彩色 Emoji 和中文字体
- **信源**：RSSHub + rss-parser

---

## 本地开发

### 前置要求

- Node.js 20+
- [非必须]本地运行中的 [RSSHub](https://github.com/DIYgod/RSSHub)（默认 `http://localhost:1200`）
- macOS 需安装 Google Chrome（渲染图片用）

### 启动

```bash
git clone https://github.com/comeonzhj/AutoContents.git
cd AutoContents

# 复制环境变量模板
cp backend/.env.example backend/.env

# 一键启动（自动安装依赖）
./start.sh
```

启动后访问：
- 前端：`http://localhost:3711`
- 后端 API：`http://localhost:3710/api`

---

## Docker 部署

项目已包含完整的 Docker Compose 配置，内含 AutoContents 主服务 + RSSHub + Redis。

```bash
git clone https://github.com/comeonzhj/AutoContents.git
cd AutoContents

# 构建并启动
docker compose -p makecontent up -d --build

# 查看日志
docker compose -p makecontent logs -f makecontents
```

访问 `http://服务器IP:3710`。

> **说明**：若服务器已运行独立 RSSHub，可删除 `docker-compose.yml` 中的 `rsshub` 和 `redis` 服务，并修改 `RSSHUB_URL` 指向现有实例。

### 数据持久化

Docker Compose 自动创建两个 named volume：

| Volume | 内容 |
|---|---|
| `makecontents-data` | SQLite 数据库 |
| `makecontents-uploads` | 上传图片与渲染产物 |

**数据库迁移**：服务每次启动时自动执行 schema 迁移，已有数据库会自动补全新字段，无需手动操作。

---

## 系统配置

首次运行后进入「系统配置」页面完成以下配置：

### 大模型

翻译、编辑（推送）、创作三个场景可使用不同模型，兼容所有 OpenAI 接口格式（DeepSeek、通义、Kimi 等）。推送风格中 AITopics 和 AITools 可单独配置系统提示词。

| 字段 | 说明 |
|---|---|
| 模型名称 | 如 `deepseek-chat`、`gpt-4o` |
| Base URL | 如 `https://api.deepseek.com`（末尾无需加 `/v1`） |
| API Key | 对应平台的密钥 |
| 系统提示词 | 留空使用内置默认值 |

### 飞书

在[飞书开放平台](https://open.feishu.cn/)创建自建应用，开通文档/知识库/多维表读写权限。

| 字段 | 说明 |
|---|---|
| App ID / App Secret | 应用凭证 |
| Space ID | 知识库 ID |
| 父节点 Token | AINews 文档存放的父节点 |
| 多维表 URL | 直接粘贴浏览器地址栏 URL，自动解析参数 |
| 机器人 Webhook | Agent 完成创作后的通知地址 |

### 微信推送

使用 [aibotk](https://api-bot.aibotk.com) 微信机器人 API。支持配置多个 wxid 和群聊，发送间隔随机 5-10 秒。

### 关键词过滤

- **正向关键词**：只有命中列表中任意关键词的资讯才显示（留空则全部显示），默认仅匹配标题
- **屏蔽关键词**：包含关键词的资讯直接过滤，不进入数据库

---

## Agent 使用

项目内置 Cursor Skill（位于 `Skills/makecontents/`），可让 AI Agent 自主完成完整工作流：

1. **资讯推送流程**：拉取 → 筛选 → 生成推送内容 → 微信+飞书分发
2. **内容创作流程**：选题 → 生成文案 → 截图配图 → 渲染图片 → 存入多维表 → 通知审核
3. **学习规律流程**：分析历史保存记录，归纳用户偏好，写入规则记忆文件

Agent 调用接口自动去重：推送过的资讯标记 `ai_newsed=1`，调用 `GET /api/news/grouped?agent=1` 时自动过滤，无需人工干预。

详细 API 文档见 `Skills/makecontents/references/api.md`。

---

## 目录结构

```
AutoContents/
├── backend/
│   ├── db/            # SQLite 初始化与迁移
│   ├── routes/        # API 路由（sources/news/config/content）
│   ├── services/      # 业务逻辑（RSS/LLM/微信/飞书/渲染）
│   ├── .env.example   # 环境变量模板
│   └── index.js       # 服务入口（端口 3710）
├── frontend/
│   └── src/
│       ├── pages/     # 五个页面（首页/信源/资源库/配置/内容创作）
│       ├── components/
│       └── services/  # API 封装
├── Skills/
│   └── makecontents/  # Cursor Agent Skill
│       ├── SKILL.md
│       └── references/ # API 文档 & 规律记忆模板
├── style_demos/        # 封面/详情图样式参考
├── docs/              # API 参考文档
├── Dockerfile
├── docker-compose.yml
└── start.sh           # 本地一键启动脚本
```

---

## License

MIT
