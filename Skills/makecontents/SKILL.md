---
name: makecontents
description: MakeContents AI 资讯 Agent 技能。当用户需要自动执行资讯拉取、筛选推送（AINews/AITopics/AITools）、内容创作、图片渲染、飞书多维表归档等任务时使用此技能。此技能调用本地运行的 MakeContents 应用 API，无需人工干预即可完成完整的内容创作和分发流程。
---

# MakeContents Agent 技能

## 概述

MakeContents 是一个本地运行的 RSS 资讯聚合与内容创作应用。此技能让 Agent 能够自主完成以下工作：

1. **拉取资讯** — 从配置的 RSS/RSSHub 信源获取最新内容
2. **筛选推送** — 根据学习到的规律选择有价值的资讯，直接生成推送内容并分发到微信和飞书知识库
3. **内容创作** — 为选定资讯生成小红书风格的图文内容，自动渲染封面和详情图
4. **内容归档** — 将创作结果保存到飞书多维表，通知人类审核

## 配置

在开始前确认以下配置（通过应用系统配置页面或 `.env` 设置）：

- MakeContents 服务地址：默认 `http://localhost:3710`
- 各功能所需的 API Key（飞书、微信）已在应用配置页填写
- 飞书多维表 URL 已配置（用于内容归档）
- 飞书机器人 Webhook 已配置（用于完成通知）
- 小红书 Cookie 已配置 + 发布开关已开启（用于发布笔记，**默认关闭**，需人类主动开启）

## API 参考

完整 API 文档见 `references/api.md`，包含所有接口的请求/响应格式。

## 选择规律记忆

Agent 的学习规律存储在 `references/agent-rules.md`，每次学习后更新此文件。

---

## 执行流程

### 流程一：学习选择规律

先读取`references/agent-rules.md`文档，如果包含内容筛选规律则使用此规律作为后续任务的选择标准，跳过此步骤；无可参考的规律内容时按顺序执行：

1. 调用 `GET /api/news/agent-summary` 获取学习数据
2. 分析数据：
   - `saved_news`：用户推送过的资讯（含 push_type）
   - `all_news_in_period`：对应时段所有资讯
   - 对比两个列表，提炼被选中资讯的共同特征
3. 将分析的规律追加到 `references/agent-rules.md`中

**分析角度**：
- 被选中资讯的来源分布（哪些信源更受偏好）
- 被选中资讯的主题特征（关键词、话题类型）
- 推送类型分布（用户倾向于哪类推送）
- 内容创作选题特征（哪类话题被创作）

### 流程二：资讯推送

To execute the news push workflow:

1. 调用 `POST /api/news/fetch` 拉取最新资讯
2. 调用 `GET /api/news/grouped?agent=1` 获取资讯列表（已推送条目自动排除，无需手动去重）
3. 使用 `references/agent-rules.md` 中的筛选规律
4. 根据规律从列表中筛选 0-5 条有价值的资讯（无有价值资讯可直接结束此流程）
5. 对每条资讯：
   - 判断推送类型（ainews / aitopics / aitools）
   - 生成 `news_title`（≤30字，精炼有力）和 `news_summary`（100-200字，符合对应风格）
   - 调用对应推送接口，body 中传入生成的内容
   - 推送接口：
     ```
     POST /api/news/{id}/ainews
     POST /api/news/{id}/aitopics
     POST /api/news/{id}/aitools
     ```
6. 完成后调用 `POST /api/content/notify-bot` 通知人类

**推送类型判断原则**：
- `ainews`：客观事实类资讯，速报风格
- `aitopics`：有争议或引人思考的话题，末尾加引导性问题
- `aitools`：新工具/新产品发布，突出功能和使用场景

### 流程三：内容创作

To execute the content creation workflow:

1. 从资讯列表选定  0-3 条适合内容创作的资讯（通常是有深度或有趣的话题，无有价值资讯可直接结束此流程）
2. 对每条资讯，构造以下参数并调用 `POST /api/content/agent-render`：
   - `news_id`：资讯 ID
   - `source_url`：原始链接（description中的链接，不是资讯的链接；有则填，服务会自动截图）
   - `cover_word`：1-2个英文单词，概括核心主题（全大写）
   - `cover_title`：≤15字，有冲击力的中文标题
   - `cover_description`：≤20字，补充说明
   - `cover_emoji`：1个相关 Emoji
   - `content_type`：`news`/`tools`/`topics`/`default`（决定配色）
   - `title`：≤20字，小红书风格标题
   - `content`：正文，500-800字，小红书风格，有观点有情感
   - `tags`：3-5个标签，逗号分隔
3. 获取渲染结果的 `saved_content_id`、`cover_url`、`detail_urls`
4. 调用 `POST /api/content/save-to-bitable` 存入飞书多维表（传 `saved_content_id`）
5. **（可选）发布到小红书**：若人类已在配置页开启发布开关，调用 `POST /api/content/publish-xhs`：
   ```json
   {
     "title": "{title（≤20字）}",
     "desc": "{content}",
     "cover_url": "{cover_url}",
     "detail_urls": ["{detail_urls[0]}", "..."]
   }
   ```
   - 成功后从响应中取 `note_url`
   - 若接口返回错误"小红书发布功能未开启"，**不重试、不报错**，跳过此步骤即可
6. 调用 `POST /api/content/notify-bot` 发送通知，消息格式：
   ```
   ✅ 内容创作完成
   
   标题：{title}
   类型：{content_type}
   标签：{tags}
   
   已存入飞书多维表，请审核。
   {如已发布到小红书：🔗 小红书链接：{note_url}}
   ```

---

## 注意事项

- 截图详情图可能因目标网站防爬而失败，失败时静默跳过，只生成封面
- 推送接口会自动标记资讯为已保存，无需手动调用 save 接口
- Agent 生成内容时，`news_title` 和 `news_summary` 直接作为推送内容，需保证质量
- 每次执行完整流程后，建议执行一次学习流程以更新规律记忆
- **小红书发布**：发布开关默认关闭，由人类决定是否授权。Agent 应尊重此开关，收到"未开启"错误时静默跳过，不得反复重试或提示人类开启
