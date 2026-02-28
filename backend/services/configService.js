const db = require('../db/database');

const DEFAULT_CONFIG = {
  // 翻译模型
  translate_model: '',
  translate_base_url: '',
  translate_api_key: '',
  translate_sys_prompt: '你是一个专业翻译，请将以下内容翻译为简体中文，保持原意，输出纯文本，不要加任何解释。',

  // 编辑模型（AINews / AITopics / AITools 共用）
  edit_model: '',
  edit_base_url: '',
  edit_api_key: '',
  edit_sys_prompt: '你是一个专业的新闻编辑，请将提供的新闻标题和内容进行结构化提炼，输出简短精炼的资讯标题和新闻概要。',
  aitopics_sys_prompt: '你是一个擅长引导话题讨论的内容编辑，请将新闻改写为能激发读者思考和参与讨论的资讯推文，要有鲜明观点，结尾提出引导性问题。',
  aitools_sys_prompt: '你是一个 AI 工具评测达人，请将新闻改写为工具推荐性资讯，突出工具的核心功能、使用场景和亮点，语气积极热情，让读者有想尝试的冲动。',

  // 创作模型（MakeContent 使用）
  create_model: '',
  create_base_url: '',
  create_api_key: '',
  create_sys_prompt: '你是一个优秀的内容创作者，擅长将资讯内容改写为小红书风格的内容。',

  // 飞书配置
  feishu_app_id: '',
  feishu_app_secret: '',
  feishu_space_id: '',
  feishu_parent_node_token: '',

  // 微信推送
  wechat_api_key: '',
  wechat_wxids: '[]',
  wechat_room_names: '[]',
  wechat_wxids_enabled: '1',
  wechat_rooms_enabled: '1',
  wechat_enabled: '1',

  // 屏蔽关键词
  blacklist_keywords: '["广告","推广","招聘","求职"]',

  // 正向筛选关键词（为空则不过滤）
  allowlist_keywords: '[]',

  // 正向筛选范围：title（仅标题）或 all（标题+描述）
  allowlist_scope: 'title',
};

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  if (row) return row.value;
  return DEFAULT_CONFIG[key] ?? null;
}

function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
}

function getAllConfig() {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const result = { ...DEFAULT_CONFIG };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

function setMultiConfig(obj) {
  const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  const setMany = db.transaction((entries) => {
    for (const [k, v] of entries) {
      upsert.run(k, String(v ?? ''));
    }
  });
  setMany(Object.entries(obj));
}

// 获取黑名单关键词数组
function getBlacklist() {
  const raw = getConfig('blacklist_keywords');
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

// 获取正向筛选关键词数组
function getAllowlist() {
  const raw = getConfig('allowlist_keywords');
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

// 获取正向筛选范围
function getAllowlistScope() {
  return getConfig('allowlist_scope') || 'title';
}

// 获取 LLM 配置（translate/edit/create）
function getLLMConfig(type) {
  const cfg = getAllConfig();
  const model = cfg[`${type}_model`] || '';
  const baseUrl = cfg[`${type}_base_url`] || '';
  const apiKey = cfg[`${type}_api_key`] || '';
  const sysPrompt = cfg[`${type}_sys_prompt`] || DEFAULT_CONFIG[`${type}_sys_prompt`] || '';
  return { model, baseUrl, apiKey, sysPrompt };
}

module.exports = { getConfig, setConfig, getAllConfig, setMultiConfig, getBlacklist, getAllowlist, getAllowlistScope, getLLMConfig };
