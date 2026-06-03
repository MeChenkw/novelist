#!/bin/bash
# 小说家 - 一键启动脚本
# 用法: ./start.sh [dev]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "================================"
echo "   📖 小说家 - AI 创作助手"
echo "================================"

# 检查 API Key
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo ""
  echo "⚠️  请先配置 DeepSeek API Key:"
  echo "   cp backend/.env.example backend/.env"
  echo "   然后编辑 backend/.env 填入你的 DEEPSEEK_API_KEY"
  echo ""
  exit 1
fi

# 启动模式
if [ "$1" = "dev" ]; then
  # 开发模式：前后端分离
  echo ""
  echo "[开发模式] 启动后端 (端口 5001)..."
  cd "$BACKEND_DIR"
  source venv/bin/activate
  python app.py &
  BACKEND_PID=$!

  echo "[开发模式] 启动前端 (端口 5173)..."
  cd "$FRONTEND_DIR"
  npm run dev &
  FRONTEND_PID=$!

  echo ""
  echo "  后端: http://localhost:5001"
  echo "  前端: http://localhost:5173"
  echo ""
  echo "按 Ctrl+C 停止所有服务"

  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
  wait
else
  # 生产模式：后端 serve 前端构建产物
  echo ""
  echo "[生产模式] 构建前端..."
  cd "$FRONTEND_DIR"
  npm run build

  echo ""
  echo "[生产模式] 部署前端到后端..."
  rm -rf "$BACKEND_DIR/static"
  cp -r "$FRONTEND_DIR/dist" "$BACKEND_DIR/static"

  echo ""
  echo "[生产模式] 启动后端 (端口 5001)..."
  cd "$BACKEND_DIR"
  source venv/bin/activate
  echo ""
  echo "  ✨ 访问: http://localhost:5001"
  echo ""
  python app.py
fi
