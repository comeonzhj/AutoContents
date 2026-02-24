const axios = require('axios');
const { getLLMConfig } = require('./configService');

async function callLLM(type, userContent, schema = null) {
  const { model, baseUrl, apiKey, sysPrompt } = getLLMConfig(type);

  if (!apiKey || !model) {
    throw new Error(`LLM 配置不完整：${type} 模型未配置 API Key 或模型名称`);
  }

  // 去掉末尾的 /v1 或 / 避免重复拼接
  const base = (baseUrl || 'https://api.openai.com').replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const url = `${base}/v1/chat/completions`;

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userContent },
  ];

  const body = {
    model,
    messages,
    temperature: 0.7,
  };

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'output',
        strict: true,
        schema,
      },
    };
  }

  const resp = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  const content = resp.data.choices[0].message.content;
  if (schema) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
  return content;
}

// 翻译文本
async function translate(text) {
  if (!text || text.trim() === '') return text;
  return callLLM('translate', text);
}

// 格式化新闻（AINews）
async function formatNewsForAINews(title, description) {
  const prompt = `请将以下新闻内容结构化提炼：
标题：${title}
内容：${description}`;

  const schema = {
    type: 'object',
    properties: {
      news_title: { type: 'string', description: '简短精炼的资讯标题，不超过30字' },
      news_summary: { type: 'string', description: '新闻概要，100-200字，简明扼要' },
    },
    required: ['news_title', 'news_summary'],
    additionalProperties: false,
  };

  return callLLM('edit', prompt, schema);
}

// 创作内容（MakeContent）
async function createContent(title, description, extraInfo) {
  const parts = [`资讯标题：${title}`];
  if (description) parts.push(`资讯详情：${description}`);
  if (extraInfo) parts.push(`补充信息：${extraInfo}`);

  const prompt = parts.join('\n\n');

  const schema = {
    type: 'object',
    properties: {
      cover_word: { type: 'string', description: '一个概括性的英文单词' },
      cover_title: { type: 'string', description: '主标题，不超过15字' },
      cover_description: { type: 'string', description: '描述性文本，不超过20字' },
      cover_emoji: { type: 'string', description: '一个相关Emoji' },
      title: { type: 'string', description: '内容标题，不超过20字' },
      content: { type: 'string', description: '内容正文，关于内容的论述' },
    },
    required: ['cover_word', 'cover_title', 'cover_description', 'cover_emoji', 'title', 'content'],
    additionalProperties: false,
  };

  return callLLM('create', prompt, schema);
}

module.exports = { translate, formatNewsForAINews, createContent };
