# MakeContents API 参考文档

本文档描述 MakeContents 应用暴露的所有 API 接口，供 Agent 调用。

## 基础信息

- **Base URL**：`http://localhost:3710/api`（本地开发）或 `http://<服务器IP>:3710/api`（Docker 部署）
- 所有请求/响应均为 JSON（下载接口除外）
- 成功响应格式：`{ "success": true, "data": ... }`
- 失败响应格式：`{ "success": false, "error": "错误信息" }`

---

## 资讯接口

### 拉取最新资讯
```
POST /news/fetch
Body: {} （全部信源）
```
响应：每个信源的拉取结果，含新增条数。

### 获取资讯列表（分组）
```
GET /news/grouped          # 人工模式：显示所有未隐藏资讯（含已推送）
GET /news/grouped?agent=1  # Agent 模式：额外过滤掉已推送(ai_newsed=1)的条目，避免重复处理
```
响应：按信源分组的资讯列表（hidden=0）。Agent 调用时**必须加 `?agent=1`**。

### 获取 Agent 学习摘要
```
GET /news/agent-summary
```
响应：
```json
{
  "saved_news": [...],         // 最近 5 条已保存资讯（含 push_type）
  "saved_contents": [...],      // 最近 5 条已保存内容
  "all_news_in_period": [...]   // 对应时段全量资讯标题（用于学习选择规律）
}
```

### 推送资讯（支持 Agent 直传内容）
```
POST /news/{id}/ainews
POST /news/{id}/aitopics
POST /news/{id}/aitools
```
**Agent 模式**（直接传入内容，跳过 LLM 总结）：
```json
{
  "news_title": "Agent 生成的标题（≤30字）",
  "news_summary": "Agent 生成的摘要（100-200字）"
}
```
**人工模式**：body 为空，后端自动调用 LLM 生成。

推送后自动：
- 微信推送（带对应 tag：#AINews / #AITopic / #AITools）
- 飞书知识库写入（带对应 emoji：🆕 / 💬 / 🛠）
- 标记资讯为已保存，记录 push_type

### 保存/取消保存资讯
```
POST /news/{id}/save
POST /news/{id}/unsave
```

### 隐藏资讯
```
POST /news/{id}/hide
```

### 获取已保存资讯
```
GET /news/saved
```

---

## 内容创作接口

### Agent 一步完成创作渲染（推荐 Agent 使用）
```
POST /content/agent-render
```
请求体：
```json
{
  "news_id": 42,                    // 关联的资讯 ID（可选）
  "source_url": "https://...",      // 原始链接，有则截图作为详情图
  "cover_word": "INNOVATION",       // 封面英文词（必填）
  "cover_title": "AI重塑未来",      // 封面主标题，≤15字（必填）
  "cover_description": "探索无限可能的新时代", // 封面描述，≤20字
  "cover_emoji": "🚀",              // 封面 Emoji
  "cover_title_color": "#06FFA5",   // 可选，留空则按 content_type 自动选
  "content_type": "news",           // 用于自动选色："news"|"tools"|"topics"|"default"
  "title": "AI正在重塑每个行业",    // 内容标题，≤20字（必填）
  "content": "正文内容...",          // 内容正文（必填）
  "tags": "AI,大模型,未来"           // 逗号分隔的标签（可选）
}
```
响应：
```json
{
  "saved_content_id": 5,
  "session_id": "uuid",
  "cover_url": "/uploads/rendered/xxx_cover.png",
  "detail_urls": ["/uploads/rendered/xxx_detail_0.png"],
  "title_color": "#FF6B35"
}
```

**颜色自动选择规则**（当 cover_title_color 为空时按 content_type 选）：
| content_type | 颜色 | 场景 |
|---|---|---|
| `default` / 不确定 | `#06FFA5` 翠绿 | 通用 |
| `news` | `#FF6B35` 橙红 | 新闻资讯 |
| `tools` | `#5478EB` 蓝紫 | 工具推荐 |
| `topics` | `#FFD700` 金黄 | 话题讨论 |

**截图规则**：
- 有 `source_url` 且可访问：截图作为详情图
- 页面宽高比 < 3:4（长页面）：自动裁切为多张 3:4 图，逐张渲染（最多 5 张）
- 页面宽高比 ≥ 3:4：整张截图渲染
- 截图失败：静默跳过，只生成封面

### 保存内容到飞书多维表
```
POST /content/save-to-bitable
```
请求体（方式一，推荐）：
```json
{ "saved_content_id": 5 }
```
请求体（方式二，直接传数据）：
```json
{
  "title": "标题",
  "content": "正文",
  "source_url": "https://...",
  "news_title": "原始资讯标题",
  "news_source_url": "原始资讯链接",
  "tags": "AI,工具",
  "cover_url": "/uploads/rendered/xxx_cover.png",
  "detail_urls": ["/uploads/rendered/xxx_detail_0.png"]
}
```

### 飞书机器人通知
```
POST /content/notify-bot
Body: { "message": "通知内容文本" }
```
使用场景：Agent 完成任务后通知人类。

### 发布笔记到小红书
```
POST /content/publish-xhs
```
请求体：
```json
{
  "title": "笔记标题（≤20字，超长自动截断）",
  "desc": "笔记正文（支持 #话题[话题]# 格式插入话题标签）",
  "cover_url": "/uploads/rendered/xxx_cover.png",
  "detail_urls": [
    "/uploads/rendered/xxx_detail_0.png",
    "/uploads/rendered/xxx_detail_1.png"
  ]
}
```
响应：
```json
{
  "success": true,
  "data": {
    "note_id": "67a1b2c3d4e5f6...",
    "note_url": "https://www.xiaohongshu.com/explore/67a1b2c3d4e5f6..."
  }
}
```
**前置条件**：
- 系统配置页「小红书发布」Tab 中填写了有效的 Cookie（含 `a1` 和 `web_session` 字段）
- 「发布开关」已开启（`xhs_enabled = 1`）
- 图片文件必须是已通过 `/content/render` 或 `/content/agent-render` 渲染生成的本地文件

**错误情况**：
- `小红书发布功能未开启` — 需在配置页开启开关
- `未配置小红书 Cookie` — 需在配置页填写 Cookie
- `Cookie 不完整，缺少 a1 或 web_session 字段` — Cookie 无效，需重新获取
- `发布失败: ...` — 小红书接口返回错误，可能 Cookie 已过期

### 获取已保存内容列表
```
GET /content/saved
```

---

## 完整 Agent 工作流

### 资讯推送流程
```
1. POST /news/fetch                    # 拉取最新资讯
2. GET  /news/grouped?agent=1          # 获取资讯列表（自动排除已处理条目）
3. 根据学习到的规律筛选资讯
4. 对每条目标资讯，确定推送类型：
   - 新闻速报 → POST /news/{id}/ainews    (body 含 news_title + news_summary)
   - 话题讨论 → POST /news/{id}/aitopics   (body 含 news_title + news_summary)
   - 工具推荐 → POST /news/{id}/aitools    (body 含 news_title + news_summary)
```

### 内容创作流程
```
1. 选定目标资讯（从 /news/grouped?agent=1 列表中）
2. 判断 content_type（news/tools/topics/default）
3. 生成创作参数（cover_word, cover_title, cover_description, cover_emoji, title, content, tags）
4. POST /content/agent-render           # 一步完成渲染，自动截图+保存
5. POST /content/save-to-bitable        # 存入飞书多维表供审核（传 saved_content_id）
6. POST /content/notify-bot             # 通知人类审核
   message 示例："✅ 已完成内容创作：《{title}》\n封面：{cover_url}\n请在飞书多维表查看审核"
```

### 发布到小红书流程（需人类开启开关）

> ⚠️ 此流程只有在系统配置中「小红书发布开关」开启时才可执行。Agent 不得绕过此开关。

```
1. （前提）确认 xhs_enabled 已开启，否则跳过此流程
2. 完成内容创作流程，获得 cover_url 和 detail_urls
3. POST /content/publish-xhs            # 发布到小红书
   - title: 笔记标题（来自 agent-render 的 title 字段，≤20字）
   - desc:  笔记正文（来自 agent-render 的 content 字段）
   - cover_url / detail_urls: 渲染结果路径
4. 检查响应中的 note_url，确认发布成功
5. POST /content/notify-bot             # 通知人类（附上笔记链接）
   message 示例："✅ 已发布到小红书：《{title}》\n🔗 {note_url}"
```

### 学习选择规律流程
```
1. GET /news/agent-summary              # 获取学习数据
2. 分析 saved_news 和 all_news_in_period 的差异，学习人类的筛选偏好
3. 将学习到的规律写入 Agent 的永久记忆文档
```
