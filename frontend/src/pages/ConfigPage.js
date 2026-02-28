import React, { useState, useEffect } from 'react';
import { configAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './ConfigPage.css';

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  );
}

function LLMSection({ title, prefix, config, onChange }) {
  return (
    <div className="config-section">
      <h3 className="section-title">{title}</h3>
      <div className="config-grid">
        <div className="form-group">
          <label className="form-label">模型名称</label>
          <input
            value={config[`${prefix}_model`] || ''}
            onChange={(e) => onChange(`${prefix}_model`, e.target.value)}
            placeholder="如：gpt-4o, claude-3-5-sonnet"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Base URL</label>
          <input
            value={config[`${prefix}_base_url`] || ''}
            onChange={(e) => onChange(`${prefix}_base_url`, e.target.value)}
            placeholder="如：https://api.openai.com"
          />
        </div>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            type="password"
            value={config[`${prefix}_api_key`] || ''}
            onChange={(e) => onChange(`${prefix}_api_key`, e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div className="form-group full-width">
          <label className="form-label">系统提示词</label>
          <textarea
            value={config[`${prefix}_sys_prompt`] || ''}
            onChange={(e) => onChange(`${prefix}_sys_prompt`, e.target.value)}
            placeholder="留空使用系统默认提示词"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('llm');
  const [blacklistInput, setBlacklistInput] = useState('');
  const [allowlistInput, setAllowlistInput] = useState('');
  const [wxidsInput, setWxidsInput] = useState('');
  const [roomsInput, setRoomsInput] = useState('');
  const toast = useToast();

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConfig = async () => {
    setLoading(true);
    try {
      const resp = await configAPI.get();
      if (resp.data.success) {
        const cfg = resp.data.data;
        setConfig(cfg);
        // 解析数组字段
        try {
          const kws = JSON.parse(cfg.blacklist_keywords || '[]');
          setBlacklistInput(kws.join('\n'));
        } catch {}
        try {
          const aws = JSON.parse(cfg.allowlist_keywords || '[]');
          setAllowlistInput(aws.join('\n'));
        } catch {}
        try {
          const wxids = JSON.parse(cfg.wechat_wxids || '[]');
          setWxidsInput(wxids.join('\n'));
        } catch {}
        try {
          const rooms = JSON.parse(cfg.wechat_room_names || '[]');
          setRoomsInput(rooms.join('\n'));
        } catch {}
      }
    } catch (e) {
      toast.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 处理数组字段
      const keywords = blacklistInput.split('\n').map((s) => s.trim()).filter(Boolean);
      const allowwords = allowlistInput.split('\n').map((s) => s.trim()).filter(Boolean);
      const wxids = wxidsInput.split('\n').map((s) => s.trim()).filter(Boolean);
      const rooms = roomsInput.split('\n').map((s) => s.trim()).filter(Boolean);

      const payload = {
        ...config,
        blacklist_keywords: JSON.stringify(keywords),
        allowlist_keywords: JSON.stringify(allowwords),
        wechat_wxids: JSON.stringify(wxids),
        wechat_room_names: JSON.stringify(rooms),
      };

      await configAPI.save(payload);
      toast.success('配置已保存');
    } catch (e) {
      toast.error(e.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'llm', label: '大模型配置' },
    { id: 'feishu', label: '飞书配置' },
    { id: 'wechat', label: '微信推送' },
    { id: 'blacklist', label: '关键词过滤' },
  ];

  if (loading) {
    return (
      <div className="config-page page-container">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80, gap: 12, color: 'var(--text-muted)' }}>
          <span className="spinner" />加载中…
        </div>
      </div>
    );
  }

  return (
    <div className="config-page page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">系统配置</h1>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存配置'}
        </button>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'llm' && (
        <div className="config-content">
          <LLMSection title="翻译模型" prefix="translate" config={config} onChange={handleChange} />
          <LLMSection title="资讯编辑模型（AINews / AITopics / AITools 共用）" prefix="edit" config={config} onChange={handleChange} />
          <div className="config-section">
            <h3 className="section-title">推送风格提示词</h3>
            <p className="section-desc">AITopics 和 AITools 复用上方的编辑模型配置，可在此单独调整各自的系统提示词风格。</p>
            <div className="config-grid">
              <div className="form-group full-width">
                <label className="form-label">AITopics 系统提示词</label>
                <textarea
                  value={config.aitopics_sys_prompt || ''}
                  onChange={(e) => handleChange('aitopics_sys_prompt', e.target.value)}
                  placeholder="留空使用系统默认：引导话题讨论风格"
                  rows={3}
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">AITools 系统提示词</label>
                <textarea
                  value={config.aitools_sys_prompt || ''}
                  onChange={(e) => handleChange('aitools_sys_prompt', e.target.value)}
                  placeholder="留空使用系统默认：工具推荐风格"
                  rows={3}
                />
              </div>
            </div>
          </div>
          <LLMSection title="内容创作模型（MakeContent）" prefix="create" config={config} onChange={handleChange} />
        </div>
      )}

      {activeTab === 'feishu' && (
        <div className="config-content">
          <div className="config-section">
            <h3 className="section-title">飞书应用配置</h3>
            <div className="config-grid">
              <div className="form-group">
                <label className="form-label">App ID</label>
                <input
                  value={config.feishu_app_id || ''}
                  onChange={(e) => handleChange('feishu_app_id', e.target.value)}
                  placeholder="cli_a9..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">App Secret</label>
                <input
                  type="password"
                  value={config.feishu_app_secret || ''}
                  onChange={(e) => handleChange('feishu_app_secret', e.target.value)}
                  placeholder="k7...Lg"
                />
              </div>
            </div>
          </div>
          <div className="config-section">
            <h3 className="section-title">飞书知识库</h3>
            <div className="config-grid">
              <div className="form-group">
                <label className="form-label">Space ID（知识库 ID）</label>
                <input
                  value={config.feishu_space_id || ''}
                  onChange={(e) => handleChange('feishu_space_id', e.target.value)}
                  placeholder="75...68"
                />
              </div>
              <div className="form-group">
                <label className="form-label">父节点 Token</label>
                <input
                  value={config.feishu_parent_node_token || ''}
                  onChange={(e) => handleChange('feishu_parent_node_token', e.target.value)}
                  placeholder="CG...bg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wechat' && (
        <div className="config-content">
          <div className="config-section">
            <h3 className="section-title">微信推送配置</h3>
            <div className="config-grid">
              <div className="form-group full-width">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  value={config.wechat_api_key || ''}
                  onChange={(e) => handleChange('wechat_api_key', e.target.value)}
                  placeholder="aibotk API Key"
                />
              </div>
              <div className="form-group full-width">
                <div className="toggle-label-row">
                  <label className="form-label">整体开关</label>
                  <Toggle
                    checked={config.wechat_enabled === '1'}
                    onChange={(v) => handleChange('wechat_enabled', v ? '1' : '0')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="config-section">
            <h3 className="section-title">私信 wxid 列表</h3>
            <div className="toggle-label-row" style={{ marginBottom: 12 }}>
              <span className="form-label" style={{ marginBottom: 0 }}>开启私信推送</span>
              <Toggle
                checked={config.wechat_wxids_enabled === '1'}
                onChange={(v) => handleChange('wechat_wxids_enabled', v ? '1' : '0')}
              />
            </div>
            <textarea
              value={wxidsInput}
              onChange={(e) => setWxidsInput(e.target.value)}
              placeholder="每行一个 wxid，如：&#10;wxid_abc123&#10;wxid_def456"
              rows={5}
            />
            <p className="form-hint">每行填写一个 wxid</p>
          </div>

          <div className="config-section">
            <h3 className="section-title">群聊 roomName 列表</h3>
            <div className="toggle-label-row" style={{ marginBottom: 12 }}>
              <span className="form-label" style={{ marginBottom: 0 }}>开启群聊推送</span>
              <Toggle
                checked={config.wechat_rooms_enabled === '1'}
                onChange={(v) => handleChange('wechat_rooms_enabled', v ? '1' : '0')}
              />
            </div>
            <textarea
              value={roomsInput}
              onChange={(e) => setRoomsInput(e.target.value)}
              placeholder="每行一个群名称，如：&#10;AI交流群&#10;科技资讯群"
              rows={5}
            />
            <p className="form-hint">每行填写一个群聊名称，发送间隔 5-10 秒</p>
          </div>
        </div>
      )}

      {activeTab === 'blacklist' && (
        <div className="config-content">
          <div className="config-section">
            <h3 className="section-title">正向筛选关键词</h3>
            <p className="section-desc">
              只有包含以下任意一个关键词的资讯才会进入列表。
              <strong>留空则不启用，所有资讯均可通过。</strong>关键词匹配不区分大小写。
            </p>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">匹配范围</label>
              <div className="scope-radio-group">
                <label className="scope-radio">
                  <input
                    type="radio"
                    name="allowlist_scope"
                    value="title"
                    checked={(config.allowlist_scope || 'title') === 'title'}
                    onChange={() => handleChange('allowlist_scope', 'title')}
                  />
                  <span>仅标题（推荐，精准度高）</span>
                </label>
                <label className="scope-radio">
                  <input
                    type="radio"
                    name="allowlist_scope"
                    value="all"
                    checked={config.allowlist_scope === 'all'}
                    onChange={() => handleChange('allowlist_scope', 'all')}
                  />
                  <span>标题 + 正文（召回多但易误匹配）</span>
                </label>
              </div>
            </div>
            <textarea
              value={allowlistInput}
              onChange={(e) => setAllowlistInput(e.target.value)}
              placeholder="每行一个关键词，如：&#10;AI&#10;大模型&#10;LLM&#10;GPT&#10;人工智能"
              rows={8}
            />
            <p className="form-hint">每行填写一个正向关键词，留空表示不过滤</p>
          </div>
          <div className="config-section">
            <h3 className="section-title">屏蔽关键词</h3>
            <p className="section-desc">当资讯标题或内容中出现以下关键词时，该条资讯将被自动过滤，不会出现在列表中。</p>
            <textarea
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              placeholder="每行一个关键词，如：&#10;广告&#10;推广&#10;招聘"
              rows={8}
            />
            <p className="form-hint">每行填写一个屏蔽关键词，支持中文和英文</p>
          </div>
        </div>
      )}

      <div className="save-footer">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存所有配置'}
        </button>
      </div>
    </div>
  );
}
