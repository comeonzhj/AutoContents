import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { newsAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './HomePage.css';

function NewsCard({ item, onHide, onPushed, onSaved, onMakeContent }) {
  const [pushLoading, setPushLoading] = useState(false); // false | 'ainews' | 'aitopics' | 'aitools'
  const [saveLoading, setSaveLoading] = useState(false);
  const toast = useToast();

  const displayTitle = item.translated_title || item.title || '无标题';
  const displayDesc = item.translated_description || item.description || '';

  const handlePush = async (type) => {
    if (pushLoading) return;
    setPushLoading(type);
    try {
      const apiMap = { ainews: newsAPI.ainews, aitopics: newsAPI.aitopics, aitools: newsAPI.aitools };
      const resp = await apiMap[type](item.id);
      if (resp.data.success) {
        toast.success('推送成功！');
        onPushed && onPushed(item.id);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '推送失败');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      if (item.saved) {
        await newsAPI.unsave(item.id);
        toast.success('已取消保存');
        onSaved && onSaved(item.id, false);
      } else {
        await newsAPI.save(item.id);
        toast.success('已保存到资源库');
        onSaved && onSaved(item.id, true);
      }
    } catch (e) {
      toast.error('操作失败');
    } finally {
      setSaveLoading(false);
    }
  };

  const pubDate = item.pub_date
    ? new Date(item.pub_date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`news-card ${item.ai_newsed ? 'ai-newsed' : ''}`}>
      <div className="news-card-header">
        {item.ai_newsed && <span className="badge badge-success" style={{ fontSize: '10px' }}>已推送</span>}
        {item.saved ? <span className="badge badge-warning" style={{ fontSize: '10px' }}>已保存</span> : null}
        {pubDate && <span className="news-date">{pubDate}</span>}
      </div>
      <div className="news-title">{displayTitle}</div>
      {displayDesc && (
        <div className="news-desc">{displayDesc.substring(0, 200)}{displayDesc.length > 200 ? '…' : ''}</div>
      )}
      <div className="news-actions">
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            原文
          </a>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => handlePush('ainews')}
          disabled={pushLoading}
          title="资讯速报 #AINews"
        >
          {pushLoading === 'ainews' ? <span className="spinner" style={{ width: 11, height: 11 }} /> : null}
          AINews
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => handlePush('aitopics')}
          disabled={pushLoading}
          title="话题讨论 #AITopic"
        >
          {pushLoading === 'aitopics' ? <span className="spinner" style={{ width: 11, height: 11 }} /> : null}
          AITopics
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => handlePush('aitools')}
          disabled={pushLoading}
          title="工具推荐 #AITools"
        >
          {pushLoading === 'aitools' ? <span className="spinner" style={{ width: 11, height: 11 }} /> : null}
          AITools
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMakeContent(item)}
          title="进入内容创作"
        >
          创作
        </button>
        <button
          className={`btn btn-sm ${item.saved ? 'btn-warning-ghost' : 'btn-ghost'}`}
          onClick={handleSave}
          disabled={saveLoading}
          title={item.saved ? '取消保存' : '保存到资源库'}
        >
          {item.saved ? '★' : '☆'}
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onHide(item.id)}
          title="移除此条资讯"
        >
          移除
        </button>
      </div>
    </div>
  );
}

function SourceSection({ sourceData, onHide, onPushed, onSaved, onMakeContent }) {
  const { source, items } = sourceData;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="source-section">
      <div className="source-header" onClick={() => setExpanded(!expanded)}>
        <div className="source-info">
          <span className="source-name">{source.name}</span>
          <span className={`badge ${source.type === 'rsshub' ? 'badge-success' : 'badge-warning'}`}>
            {source.type.toUpperCase()}
          </span>
          {source.translate ? <span className="badge badge-warning">翻译中</span> : null}
          <span className="news-count">{items.length} 条</span>
        </div>
        <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="news-list">
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <div className="empty-state-text">暂无资讯，点击「拉取」获取最新内容</div>
            </div>
          ) : (
            items.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                onHide={onHide}
                onPushed={onPushed}
                onSaved={onSaved}
                onMakeContent={onMakeContent}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [groupedNews, setGroupedNews] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchResults, setFetchResults] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const toastError = toast.error;
  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await newsAPI.grouped();
      if (resp.data.success) {
        setGroupedNews(resp.data.data);
      }
    } catch (e) {
      toastError('加载资讯失败');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const handleFetch = async () => {
    setFetching(true);
    setFetchResults(null);
    try {
      const resp = await newsAPI.fetch();
      if (resp.data.success) {
        setFetchResults(resp.data.data);
        toast.success('拉取完成！');
        await loadNews();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '拉取失败');
    } finally {
      setFetching(false);
    }
  };

  const handleHide = async (newsId) => {
    try {
      await newsAPI.hide(newsId);
      setGroupedNews((prev) =>
        prev.map((sg) => ({
          ...sg,
          items: sg.items.filter((i) => i.id !== newsId),
        }))
      );
      toast.success('已移除');
    } catch (e) {
      toast.error('移除失败');
    }
  };

  const handlePushed = (newsId) => {
    setGroupedNews((prev) =>
      prev.map((sg) => ({
        ...sg,
        items: sg.items.map((i) => (i.id === newsId ? { ...i, ai_newsed: 1 } : i)),
      }))
    );
  };

  const handleSaved = (newsId, saved) => {
    setGroupedNews((prev) =>
      prev.map((sg) => ({
        ...sg,
        items: sg.items.map((i) => (i.id === newsId ? { ...i, saved: saved ? 1 : 0 } : i)),
      }))
    );
  };

  const handleMakeContent = (item) => {
    navigate('/make-content', {
      state: {
        title: item.translated_title || item.title,
        description: item.translated_description || item.description,
        link: item.link,
      },
    });
  };

  const totalCount = groupedNews.reduce((sum, sg) => sum + sg.items.length, 0);

  return (
    <div className="home-page page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">资讯聚合</h1>
          <span className="total-badge">{totalCount} 条</span>
        </div>
        <div className="header-actions">
          {fetchResults && (
            <div className="fetch-summary">
              {fetchResults.map((r, i) => (
                <span key={i} className="fetch-result-item">
                  {r.source}: {r.error ? `❌ ${r.error}` : `+${r.newCount ?? 0}`}
                </span>
              ))}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleFetch}
            disabled={fetching}
          >
            {fetching ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                拉取中…
              </>
            ) : (
              '↻ 拉取最新'
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>加载资讯…</span>
        </div>
      ) : groupedNews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📰</div>
          <div className="empty-state-text">暂无启用的信源，请先在「信源管理」中配置信源</div>
        </div>
      ) : (
        <div className="sources-grid">
          {groupedNews.map((sg) => (
            <SourceSection
              key={sg.source.id}
              sourceData={sg}
              onHide={handleHide}
              onPushed={handlePushed}
              onSaved={handleSaved}
              onMakeContent={handleMakeContent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
