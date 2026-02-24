import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { newsAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './HomePage.css';

function NewsCard({ item, onHide, onAINews, onMakeContent }) {
  const [aiNewsLoading, setAINewsLoading] = useState(false);
  const toast = useToast();

  const displayTitle = item.translated_title || item.title || '无标题';
  const displayDesc = item.translated_description || item.description || '';

  const handleAINews = async () => {
    setAINewsLoading(true);
    try {
      const resp = await newsAPI.ainews(item.id);
      if (resp.data.success) {
        toast.success('AINews 推送成功！');
        onAINews && onAINews(item.id);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'AINews 失败');
    } finally {
      setAINewsLoading(false);
    }
  };

  const pubDate = item.pub_date
    ? new Date(item.pub_date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`news-card ${item.ai_newsed ? 'ai-newsed' : ''}`}>
      <div className="news-card-header">
        {item.ai_newsed && <span className="badge badge-success" style={{ fontSize: '10px' }}>已推送</span>}
        {pubDate && <span className="news-date">{pubDate}</span>}
      </div>
      <div className="news-title">{displayTitle}</div>
      {displayDesc && (
        <div className="news-desc">{displayDesc.substring(0, 200)}{displayDesc.length > 200 ? '…' : ''}</div>
      )}
      <div className="news-actions">
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            查看原文
          </a>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleAINews}
          disabled={aiNewsLoading}
          title="格式化后推送到微信并保存到飞书"
        >
          {aiNewsLoading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : null}
          AINews
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMakeContent(item)}
          title="进入内容创作"
        >
          创作内容
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

function SourceSection({ sourceData, onHide, onAINews, onMakeContent }) {
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
                onAINews={onAINews}
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

  const handleAINews = (newsId) => {
    setGroupedNews((prev) =>
      prev.map((sg) => ({
        ...sg,
        items: sg.items.map((i) => (i.id === newsId ? { ...i, ai_newsed: 1 } : i)),
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
              onAINews={handleAINews}
              onMakeContent={handleMakeContent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
