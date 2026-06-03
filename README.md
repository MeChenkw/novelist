# 小说家 (Novelist)

AI 驱动的小说大纲与内容生成工具。

## 快速启动

### 1. 配置 API Key

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key
```

### 2. 构建 & 启动

```bash
./start.sh
```

访问 http://localhost:5001

### 3. 开发模式（前后端分离）

**后端：**
```bash
cd backend
source venv/bin/activate
python app.py
```

**前端（热更新）：**
```bash
cd frontend
npm run dev
```

前端默认端口 5173，API 请求代理到 localhost:5001。

## 项目结构

```
novelist/
├── start.sh              # 一键启动脚本
├── backend/
│   ├── app.py            # Flask 后端 + API
│   ├── requirements.txt  # Python 依赖
│   ├── .env.example      # API Key 模板
│   └── static/           # 构建后的前端静态文件
├── frontend/
│   ├── src/
│   │   ├── App.tsx       # 主应用（多页面状态机）
│   │   ├── api.ts        # API 客户端
│   │   ├── types.ts      # TypeScript 类型
│   │   └── components/
│   │       ├── OutlineEditor.tsx  # 大纲编辑器
│   │       └── NovelReader.tsx    # 小说阅读器
│   └── ...
```

## 用户流程

1. 选择小说分类 → 输入创意 → 设定字数
2. 点击"生成大纲" → AI 生成小说名、分卷、各章大纲
3. 在线编辑修改大纲
4. 点击"确认大纲" → 锁定大纲
5. 点击"开始生成小说" → AI 按大纲逐章生成
6. 在线阅读或下载 TXT
