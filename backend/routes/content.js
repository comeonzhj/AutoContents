const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { createContent } = require('../services/llmService');
const { renderCover, renderDetail, OUTPUT_DIR } = require('../services/renderService');
const db = require('../db/database');

const UPLOAD_DIR = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只能上传图片文件'));
  },
});

// 上传图片
router.post('/upload', upload.array('images', 10), (req, res) => {
  const files = req.files.map((f) => ({
    filename: f.filename,
    url: `/uploads/images/${f.filename}`,
    originalname: f.originalname,
  }));
  res.json({ success: true, data: files });
});

// 内容创作
router.post('/create', async (req, res) => {
  const { title, description, extra_info } = req.body;
  if (!title) return res.status(400).json({ success: false, error: '缺少资讯标题' });

  try {
    const result = await createContent(title, description, extra_info);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 渲染图片
router.post('/render', async (req, res) => {
  const { cover_word, cover_title, cover_description, cover_emoji, cover_title_color, image_filenames } = req.body;

  if (!cover_word || !cover_title) {
    return res.status(400).json({ success: false, error: '缺少封面必要字段' });
  }

  const sessionId = uuidv4();

  try {
    const coverPath = await renderCover(
      { cover_word, cover_title, cover_description, cover_emoji, cover_title_color },
      sessionId
    );

    const detailPaths = [];
    const images = image_filenames || [];
    for (let i = 0; i < images.length; i++) {
      const imgPath = path.join(UPLOAD_DIR, images[i]);
      if (fs.existsSync(imgPath)) {
        const dp = await renderDetail(imgPath, sessionId, i, cover_title_color);
        detailPaths.push(dp);
      }
    }

    const coverUrl = `/uploads/rendered/${path.basename(coverPath)}`;
    const detailUrls = detailPaths.map((p) => `/uploads/rendered/${path.basename(p)}`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        cover_url: coverUrl,
        detail_urls: detailUrls,
      },
    });
  } catch (err) {
    console.error('渲染失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 打包下载渲染图片
router.post('/download', (req, res) => {
  const { cover_url, detail_urls } = req.body;
  const allUrls = [cover_url, ...(detail_urls || [])].filter(Boolean);

  if (allUrls.length === 0) {
    return res.status(400).json({ success: false, error: '没有可下载的图片' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="rendered_${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('打包失败:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  });
  archive.pipe(res);

  for (const url of allUrls) {
    const filePath = path.join(__dirname, '../', url);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: path.basename(filePath) });
    }
  }

  archive.finalize();
});

// 保存内容到资源库
router.post('/save', (req, res) => {
  const { title, content, cover_url, detail_urls } = req.body;
  const stmt = db.prepare(`
    INSERT INTO saved_contents (title, content, cover_url, detail_urls)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(title || '', content || '', cover_url || '', JSON.stringify(detail_urls || []));
  res.json({ success: true, data: { id: info.lastInsertRowid } });
});

// 获取已保存内容列表
router.get('/saved', (req, res) => {
  const items = db.prepare('SELECT * FROM saved_contents ORDER BY created_at DESC').all();
  const parsed = items.map((item) => ({
    ...item,
    detail_urls: (() => { try { return JSON.parse(item.detail_urls); } catch { return []; } })(),
  }));
  res.json({ success: true, data: parsed });
});

// 删除已保存内容
router.delete('/saved/:id', (req, res) => {
  db.prepare('DELETE FROM saved_contents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
