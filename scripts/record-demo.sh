#!/bin/bash
# 从 WSL 触发 Windows 端的 Playwright DEMO 录制
# 用法: bash scripts/record-demo.sh
#
# 原理: 将脚本复制到 Windows 可访问路径，用 PowerShell + Node.js 执行

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/demo-recorder.js"
DST="/mnt/c/Users/Public/demo-recorder.js"
OUT_DIR="/mnt/c/Users/Public/novelist-docs"

echo "=== 小说家 DEMO 录制 ==="
echo ""

# 复制脚本到 Windows 路径
cp "$SRC" "$DST"
mkdir -p "$OUT_DIR"

echo "[触发] Windows 端运行 Playwright..."
powershell.exe -NoProfile -Command "node C:\\Users\\Public\\demo-recorder.js"

# 复制 GIF 回项目
if [ -f "$OUT_DIR/demo.gif" ]; then
    PROJECT_DOCS="$(dirname "$SCRIPT_DIR")/docs"
    mkdir -p "$PROJECT_DOCS"
    cp "$OUT_DIR/demo.gif" "$PROJECT_DOCS/demo.gif"
    echo ""
    echo "✅ GIF 已生成: $PROJECT_DOCS/demo.gif"
elif [ -f "$OUT_DIR/demo.mp4" ]; then
    PROJECT_DOCS="$(dirname "$SCRIPT_DIR")/docs"
    mkdir -p "$PROJECT_DOCS"
    cp "$OUT_DIR/demo.mp4" "$PROJECT_DOCS/demo.mp4"
    echo ""
    echo "✅ 视频已生成: $PROJECT_DOCS/demo.mp4"
    echo "  (ffmpeg 不可用，保留原始视频)"
else
    echo ""
    echo "❌ 未找到输出文件"
fi
