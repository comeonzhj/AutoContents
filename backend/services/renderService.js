const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.join(__dirname, '../uploads/rendered');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Chrome/Chromium 路径：优先用环境变量，其次 macOS 默认，最后 Linux apt 路径
const CHROME_PATH =
  process.env.CHROME_PATH ||
  (() => {
    const fs = require('fs');
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/chromium',          // Debian/Ubuntu apt
      '/usr/bin/chromium-browser',  // 部分发行版
      '/usr/bin/google-chrome',     // Linux Chrome
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  })();

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',                  // 容器内必须
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',       // 避免共享内存不足崩溃
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-extensions',
      '--disable-background-networking',
    ],
  });
  browserInstance.on('disconnected', () => { browserInstance = null; });
  return browserInstance;
}

async function screenshotHTML(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // 等待字体加载（Google Fonts）
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buffer;
  } finally {
    await page.close();
  }
}

async function renderCover({ cover_word, cover_title, cover_description, cover_emoji, cover_title_color }, sessionId) {
  const titleColor = cover_title_color || '#06FFA5';
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1440px; overflow: hidden; background: #1E2028; }

    .cover { position: relative; width: 1080px; height: 1440px; background: #1E2028; overflow: hidden; }

    .cover_word {
      position: absolute; width: 700px; left: 90px; top: 140px;
      font-family: 'Noto Sans SC', sans-serif; font-weight: 900; color: #8E8E8E;
      white-space: nowrap; transform-origin: left center;
    }
    .cover_title {
      position: absolute; width: 900px; height: 600px; left: 90px; top: 330px;
      font-family: 'Noto Sans SC', sans-serif; font-weight: 900; color: ${escHtml(titleColor)};
      display: flex; align-items: center; justify-content: flex-start; overflow: hidden;
    }
    .cover_title span { display: block; width: 100%; line-height: 1.1; }
    .cover_description {
      position: absolute; width: 900px; height: 200px; left: 90px; top: 951px;
      font-family: 'Noto Sans SC', sans-serif; font-weight: 400; color: #FFFFFF;
      display: flex; align-items: center; justify-content: flex-start; overflow: hidden;
    }
    .cover_description span { display: block; width: 100%; line-height: 1.2; }
    .cover_emoji {
      position: absolute; width: 300px; height: 300px; left: 690px; top: 1097px;
      font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
      font-size: 240px; line-height: 300px; opacity: 0.5;
      display: flex; align-items: center; justify-content: center;
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover_word" id="coverWord">${escHtml(cover_word)}</div>
    <div class="cover_title" id="coverTitle"><span>${escHtml(cover_title)}</span></div>
    <div class="cover_description" id="coverDesc"><span>${escHtml(cover_description)}</span></div>
    <div class="cover_emoji">${escHtml(cover_emoji)}</div>
  </div>
  <script>
    function fitText(el, maxW, maxH, maxSize) {
      let size = maxSize;
      if (!maxH) {
        el.style.fontSize = size + 'px';
        while (el.scrollWidth > maxW && size > 10) { size--; el.style.fontSize = size + 'px'; }
      } else {
        const span = el.querySelector('span');
        span.style.fontSize = size + 'px';
        while ((span.scrollWidth > maxW || span.scrollHeight > maxH) && size > 10) {
          size--; span.style.fontSize = size + 'px';
        }
      }
    }
    fitText(document.getElementById('coverWord'), 700, null, 150);
    fitText(document.getElementById('coverTitle'), 900, 600, 150);
    fitText(document.getElementById('coverDesc'), 900, 200, 80);
  </script>
</body>
</html>`;

  const buffer = await screenshotHTML(html, 1080, 1440);
  const outPath = path.join(OUTPUT_DIR, `${sessionId}_cover.png`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

async function renderDetail(imagePath, sessionId, index, shadowColor) {
  const color = shadowColor || '#06FFA5';
  // 把图片转为 base64 内嵌（避免 file:// 协议跨域问题）
  const imgBase64 = fs.readFileSync(imagePath).toString('base64');
  const ext = path.extname(imagePath).slice(1).replace('jpg', 'jpeg');
  const imgSrc = `data:image/${ext};base64,${imgBase64}`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1440px; overflow: hidden; background: #1E2028;
           display: flex; align-items: center; justify-content: center; }
    .image-container {
      position: relative;
      box-shadow: 20px 20px 0px ${escHtml(color)};
      border-radius: 50px;
      overflow: hidden;
    }
    .image-container img {
      display: block; width: 100%; height: 100%;
      object-fit: contain; border-radius: 50px;
    }
  </style>
</head>
<body>
  <div class="image-container" id="imgContainer">
    <img src="${imgSrc}" id="img" />
  </div>
  <script>
    const img = document.getElementById('img');
    const container = document.getElementById('imgContainer');
    function adjust() {
      const maxW = 1080 - 80 * 2;
      const maxH = 1440 - 80 * 2;
      const iw = img.naturalWidth || 920;
      const ih = img.naturalHeight || 1280;
      const scale = Math.min(maxW / iw, maxH / ih, 1);
      container.style.width = (iw * scale) + 'px';
      container.style.height = (ih * scale) + 'px';
    }
    if (img.complete) adjust(); else img.onload = adjust;
  </script>
</body>
</html>`;

  const buffer = await screenshotHTML(html, 1080, 1440);
  const outPath = path.join(OUTPUT_DIR, `${sessionId}_detail_${index}.png`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 进程退出时关闭浏览器
process.on('exit', () => { if (browserInstance) browserInstance.close(); });

module.exports = { renderCover, renderDetail, OUTPUT_DIR };
