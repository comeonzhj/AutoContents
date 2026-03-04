# ────────────────────────────────────────────
# Stage 1: 构建前端
# ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install --omit=dev --prefer-offline
COPY frontend/ ./
ENV REACT_APP_API_URL=/api
RUN npm run build

# ────────────────────────────────────────────
# Stage 2: 生产镜像
# ────────────────────────────────────────────
FROM node:20-slim

# 安装 Chromium 和中文字体（Emoji 通过项目内 .ttf 提供，不依赖系统 Emoji 字体）
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    curl \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev --prefer-offline

COPY backend/ ./
COPY fonts/ ../fonts/
COPY --from=frontend-builder /frontend/build ./frontend/build

RUN mkdir -p data uploads/images uploads/rendered uploads/emoji_cache

EXPOSE 3710

CMD ["node", "index.js"]
