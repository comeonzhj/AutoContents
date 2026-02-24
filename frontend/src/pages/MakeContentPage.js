import React, { useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { contentAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './MakeContentPage.css';

// 生产模式用空串（同域），开发模式通过 package.json proxy 代理到后端
const API_BASE = process.env.NODE_ENV === 'production'
  ? (process.env.REACT_APP_API_URL?.replace('/api', '') || '')
  : '';

// 图片上传区域
function ImageUploader({ images, onImagesChange }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(async (files) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // 先生成本地预览立即显示，用临时 id 占位
    const previews = imageFiles.map((f) => ({
      filename: `preview-${Date.now()}-${f.name}`,
      url: URL.createObjectURL(f),
      originalname: f.name,
      uploading: true,
    }));
    onImagesChange((prev) => [...prev, ...previews]);

    // 异步上传
    const formData = new FormData();
    imageFiles.forEach((f) => formData.append('images', f));
    try {
      const resp = await contentAPI.uploadImages(formData);
      if (resp.data.success) {
        const uploaded = resp.data.data;
        // 用服务端返回的数据替换占位项
        onImagesChange((prev) => {
          let result = [...prev];
          previews.forEach((p, i) => {
            const idx = result.findIndex((r) => r.filename === p.filename);
            if (idx !== -1) result[idx] = uploaded[i];
          });
          return result;
        });
        // 释放本地 objectURL
        previews.forEach((p) => URL.revokeObjectURL(p.url));
      }
    } catch (e) {
      // 上传失败移除占位项
      onImagesChange((prev) => prev.filter((r) => !previews.some((p) => p.filename === r.filename)));
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      console.error('上传失败', e);
    }
  }, [onImagesChange]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePaste = useCallback(
    (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItems = Array.from(items).filter((i) => i.type.startsWith('image/'));
      const files = imageItems.map((i) => i.getAsFile()).filter(Boolean);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const removeImage = (filename) => {
    onImagesChange((prev) => prev.filter((img) => img.filename !== filename));
  };

  return (
    <div
      className={`image-uploader ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div className="uploader-inner" onClick={() => fileInputRef.current?.click()}>
        <span className="uploader-icon">⊕</span>
        <span className="uploader-text">点击上传、拖拽或粘贴图片</span>
        <span className="uploader-hint">支持 JPG、PNG、GIF、WebP，最多 10 张</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {images.length > 0 && (
        <div className="image-preview-list">
          {images.map((img) => (
            <div key={img.filename} className="image-preview-item">
              <img
                src={img.uploading ? img.url : `${API_BASE}${img.url}`}
                alt={img.originalname}
                style={img.uploading ? { opacity: 0.5 } : {}}
              />
              <button className="remove-image-btn" onClick={(e) => { e.stopPropagation(); removeImage(img.filename); }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 可编辑内容字段
function EditableField({ label, value, onChange, multiline, hint }) {
  return (
    <div className="editable-field">
      <label className="field-label">{label}</label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
        />
      ) : (
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="form-hint">{hint}</p>}
    </div>
  );
}

// 预览卡片（小红书风格）
function RedBookPreview({ title, content, coverUrl, detailUrls }) {
  const [currentImg, setCurrentImg] = useState(0);
  const allImages = [coverUrl, ...detailUrls].filter(Boolean);

  const copyText = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="redbook-preview">
      <h3 className="preview-title-bar">预览</h3>
      <div className="redbook-card">
        {/* 左侧图片轮播 */}
        <div className="redbook-images">
          {allImages.length > 0 ? (
            <>
              <div className="main-image">
                <img src={`${API_BASE}${allImages[currentImg]}`} alt="" />
                {allImages.length > 1 && (
                  <>
                    <button
                      className="img-nav prev"
                      onClick={() => setCurrentImg((p) => (p - 1 + allImages.length) % allImages.length)}
                    >
                      ‹
                    </button>
                    <button
                      className="img-nav next"
                      onClick={() => setCurrentImg((p) => (p + 1) % allImages.length)}
                    >
                      ›
                    </button>
                  </>
                )}
                <div className="img-dots">
                  {allImages.map((_, i) => (
                    <span
                      key={i}
                      className={`dot ${i === currentImg ? 'active' : ''}`}
                      onClick={() => setCurrentImg(i)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="image-placeholder">
              <span>无图片</span>
            </div>
          )}
        </div>

        {/* 右侧文字 */}
        <div className="redbook-text">
          <div
            className="redbook-post-title"
            onClick={() => copyText(title)}
            title="点击复制标题"
          >
            {title || '内容标题'}
          </div>
          <div
            className="redbook-post-content"
            onClick={() => copyText(content)}
            title="点击复制正文"
          >
            {content || '内容正文将在此显示…'}
          </div>
          <div className="copy-hint">点击文字可复制</div>
        </div>
      </div>
    </div>
  );
}

export default function MakeContentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const initialData = location.state || {};

  const [images, setImages] = useState([]);
  const [extraInfo, setExtraInfo] = useState('');
  const [creating, setCreating] = useState(false);
  const [rendering, setRendering] = useState(false);

  const [renderResult, setRenderResult] = useState(null);

  // 可编辑字段
  const [editContent, setEditContent] = useState(null);

  const handleCreate = async () => {
    if (!initialData.title) {
      toast.error('缺少资讯标题');
      return;
    }
    setCreating(true);
    try {
      const resp = await contentAPI.create({
        title: initialData.title,
        description: initialData.description,
        extra_info: extraInfo,
      });
      if (resp.data.success) {
        const data = resp.data.data;
        setEditContent({ ...data });
        toast.success('内容创作完成！');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '创作失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRender = async () => {
    if (!editContent) {
      toast.error('请先创作内容');
      return;
    }
    setRendering(true);
    try {
      const resp = await contentAPI.render({
        cover_word: editContent.cover_word,
        cover_title: editContent.cover_title,
        cover_description: editContent.cover_description,
        cover_emoji: editContent.cover_emoji,
        image_filenames: images.map((img) => img.filename),
      });
      if (resp.data.success) {
        setRenderResult(resp.data.data);
        toast.success('渲染完成！');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '渲染失败');
    } finally {
      setRendering(false);
    }
  };

  const updateEdit = (key) => (val) => {
    setEditContent((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="make-content-page">
      <div className="make-content-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h1 className="make-content-title">内容创作</h1>
      </div>

      <div className="make-content-body">
        {/* 左栏：输入与创作 */}
        <div className="make-content-left">
          {/* 资讯信息 */}
          <div className="card news-info-card">
            <h3 className="card-section-title">资讯信息</h3>
            <div className="news-info-title">{initialData.title || '无标题'}</div>
            {initialData.description && (
              <div className="news-info-desc">
                {initialData.description.substring(0, 300)}
                {initialData.description.length > 300 ? '…' : ''}
              </div>
            )}
            {initialData.link && (
              <a
                href={initialData.link}
                target="_blank"
                rel="noopener noreferrer"
                className="news-info-link"
              >
                查看原文 ↗
              </a>
            )}
          </div>

          {/* 图片上传 */}
          <div className="card">
            <h3 className="card-section-title">图片素材</h3>
            <ImageUploader images={images} onImagesChange={setImages} />
          </div>

          {/* 补充信息 */}
          <div className="card">
            <h3 className="card-section-title">补充信息（选填）</h3>
            <textarea
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
              placeholder="可以填写创作方向、风格偏好、补充背景信息等…"
              rows={4}
            />
          </div>

          {/* 创作按钮 */}
          <button
            className="btn btn-primary create-btn"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                内容创作中…
              </>
            ) : (
              '✦ 开始创作内容'
            )}
          </button>

          {/* 创作结果编辑 */}
          {editContent && (
            <div className="card created-content-card">
              <h3 className="card-section-title">创作结果（可编辑）</h3>
              <div className="edit-fields-grid">
                <EditableField
                  label="封面英文词 (cover_word)"
                  value={editContent.cover_word}
                  onChange={updateEdit('cover_word')}
                  hint="一个概括性英文单词"
                />
                <EditableField
                  label="封面 Emoji (cover_emoji)"
                  value={editContent.cover_emoji}
                  onChange={updateEdit('cover_emoji')}
                />
                <EditableField
                  label="封面主标题 (cover_title)"
                  value={editContent.cover_title}
                  onChange={updateEdit('cover_title')}
                  hint="不超过 15 字"
                />
                <EditableField
                  label="封面描述 (cover_description)"
                  value={editContent.cover_description}
                  onChange={updateEdit('cover_description')}
                  hint="不超过 20 字"
                />
                <div style={{ gridColumn: '1/-1' }}>
                  <EditableField
                    label="内容标题 (title)"
                    value={editContent.title}
                    onChange={updateEdit('title')}
                    hint="不超过 20 字"
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <EditableField
                    label="内容正文 (content)"
                    value={editContent.content}
                    onChange={updateEdit('content')}
                    multiline
                  />
                </div>
              </div>

              <button
                className="btn btn-primary render-btn"
                onClick={handleRender}
                disabled={rendering}
              >
                {rendering ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                    渲染中…
                  </>
                ) : (
                  '◈ 渲染封面和图片'
                )}
              </button>
            </div>
          )}
        </div>

        {/* 右栏：预览 */}
        <div className="make-content-right">
          {(renderResult || editContent) && (
            <RedBookPreview
              title={editContent?.title || ''}
              content={editContent?.content || ''}
              coverUrl={renderResult?.cover_url || ''}
              detailUrls={renderResult?.detail_urls || []}
            />
          )}
          {!editContent && (
            <div className="preview-placeholder">
              <div className="preview-placeholder-inner">
                <span style={{ fontSize: 48 }}>◈</span>
                <p>点击「开始创作内容」后，预览将在此显示</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
