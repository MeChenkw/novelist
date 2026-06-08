# =============================================
# 阶段 1: 构建前端
# =============================================
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# =============================================
# 阶段 2: Python 运行环境
# =============================================
FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（SQLite 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/app.py .
COPY backend/.env.example .env.example

# 复制前端构建产物
COPY --from=frontend-builder /frontend/dist ./static

# 创建数据目录（持久化挂载点）
RUN mkdir -p /app/instance

# 暴露端口
EXPOSE 5001

# 环境变量
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# 启动命令
CMD ["python", "app.py"]
