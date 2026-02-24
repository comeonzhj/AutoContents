import React, { useState, useEffect, useCallback } from 'react';
import { sourcesAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './SourcesPage.css';

const EMPTY_SOURCE = {
  name: '',
  type: 'rsshub',
  route: '',
  enabled: true,
  limit_count: 20,
  translate: false,
};

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  );
}

function SourceRow({ source, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...source });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await onUpdate(source.id, form);
      if (resp) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (val) => {
    try {
      await onUpdate(source.id, { ...source, enabled: val });
    } catch (e) {
      toast.error('更新失败');
    }
  };

  if (editing) {
    return (
      <tr className="source-row editing">
        <td>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="信源名称"
          />
        </td>
        <td>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="rsshub">RSSHub</option>
            <option value="rss">RSS</option>
          </select>
        </td>
        <td>
          <input
            value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
            placeholder={form.type === 'rsshub' ? '/路由/路径' : 'https://...'}
          />
        </td>
        <td className="center-cell">
          <Toggle checked={!!form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
        </td>
        <td className="center-cell">
          {form.type === 'rsshub' ? (
            <input
              type="number"
              value={form.limit_count}
              onChange={(e) => setForm({ ...form, limit_count: parseInt(e.target.value) || 20 })}
              min="1"
              max="100"
              style={{ width: 70 }}
            />
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className="center-cell">
          <Toggle checked={!!form.translate} onChange={(v) => setForm({ ...form, translate: v })} />
        </td>
        <td>
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? '保存…' : '保存'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="source-row">
      <td className="source-name-cell">{source.name}</td>
      <td>
        <span className={`badge ${source.type === 'rsshub' ? 'badge-success' : 'badge-warning'}`}>
          {source.type.toUpperCase()}
        </span>
      </td>
      <td className="route-cell">
        <code className="route-code">{source.route}</code>
      </td>
      <td className="center-cell">
        <Toggle checked={!!source.enabled} onChange={handleToggleEnabled} />
      </td>
      <td className="center-cell">
        {source.type === 'rsshub' ? source.limit_count : <span className="text-muted">—</span>}
      </td>
      <td className="center-cell">
        {source.translate ? (
          <span className="badge badge-warning">开启</span>
        ) : (
          <span className="text-muted">关闭</span>
        )}
      </td>
      <td>
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(source.id)}>
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddSourceForm({ onAdd }) {
  const [form, setForm] = useState({ ...EMPTY_SOURCE });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.route) {
      toast.error('请填写信源名称和订阅源地址');
      return;
    }
    setSaving(true);
    try {
      await onAdd(form);
      setForm({ ...EMPTY_SOURCE });
      toast.success('信源添加成功');
    } catch (e) {
      toast.error(e.response?.data?.error || '添加失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-source-form card">
      <h3 className="form-section-title">添加新信源</h3>
      <form onSubmit={handleSubmit}>
        <div className="add-form-grid">
          <div className="form-group">
            <label className="form-label">信源名称 *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：36kr快讯"
            />
          </div>
          <div className="form-group">
            <label className="form-label">类型 *</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="rsshub">RSSHub</option>
              <option value="rss">RSS</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">
              {form.type === 'rsshub' ? 'RSSHub 路由 *' : 'RSS 订阅地址 *'}
            </label>
            <input
              value={form.route}
              onChange={(e) => setForm({ ...form, route: e.target.value })}
              placeholder={form.type === 'rsshub' ? '/36kr/newsflashes' : 'https://example.com/feed'}
            />
            {form.type === 'rsshub' && (
              <p className="form-hint">只需输入路由部分，如 /hackernews</p>
            )}
          </div>
          {form.type === 'rsshub' && (
            <div className="form-group">
              <label className="form-label">每次拉取条数</label>
              <input
                type="number"
                value={form.limit_count}
                onChange={(e) => setForm({ ...form, limit_count: parseInt(e.target.value) || 20 })}
                min="1"
                max="100"
              />
            </div>
          )}
          <div className="form-group toggle-row">
            <label className="form-label">开启拉取</label>
            <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
          <div className="form-group toggle-row">
            <label className="form-label">翻译为中文</label>
            <Toggle checked={form.translate} onChange={(v) => setForm({ ...form, translate: v })} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '添加中…' : '+ 添加信源'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const toastError = toast.error;
  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await sourcesAPI.list();
      if (resp.data.success) setSources(resp.data.data);
    } catch (e) {
      toastError('加载信源失败');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleAdd = async (form) => {
    const resp = await sourcesAPI.create(form);
    if (resp.data.success) {
      setSources((prev) => [...prev, resp.data.data]);
    }
  };

  const handleUpdate = async (id, form) => {
    try {
      const resp = await sourcesAPI.update(id, form);
      if (resp.data.success) {
        setSources((prev) => prev.map((s) => (s.id === id ? resp.data.data : s)));
        toast.success('已更新');
        return true;
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '更新失败');
    }
    return false;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除此信源？相关资讯也会被删除。')) return;
    try {
      await sourcesAPI.delete(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success('已删除');
    } catch (e) {
      toast.error('删除失败');
    }
  };

  return (
    <div className="sources-page page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">信源管理</h1>
          <span className="total-badge">{sources.length} 个信源</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', padding: 60, gap: 12, color: 'var(--text-muted)' }}>
          <span className="spinner" />加载中…
        </div>
      ) : (
        <>
          <div className="card sources-table-card">
            <table className="sources-table">
              <thead>
                <tr>
                  <th>信源名称</th>
                  <th>类型</th>
                  <th>订阅路由/地址</th>
                  <th className="center-cell">开启拉取</th>
                  <th className="center-cell">拉取条数</th>
                  <th className="center-cell">翻译</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      暂无信源，请在下方添加
                    </td>
                  </tr>
                ) : (
                  sources.map((s) => (
                    <SourceRow
                      key={s.id}
                      source={s}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AddSourceForm onAdd={handleAdd} />
        </>
      )}
    </div>
  );
}
