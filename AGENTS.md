# AGENTS.md — 小说家项目规范和陷阱记录

## 通用开发规范

### 1. 代码修改安全规则

#### 不要对整个文件做 git checkout 回滚
`git checkout -- <file>` 会把整个文件恢复到上次 commit 的状态。
如果文件中有多次增量修改（如 `app.py` 包含了模型设置、创意引导、中断状态等多个独立功能），回滚会丢失所有后续改动。

**正确的做法：**
- 如果某段代码有缩进/语法错误，只手动修复那几行
- 使用 `patch` 工具做精确替换
- 如果必须回滚，只从 git 历史中复制需要的代码块

#### 修改一个功能时检查是否影响其他功能
修改 `app.py` 后端代码时，修改后检查所有 API 路由是否完整。
前端修改的任一文件后，检查构建是否通过。

### 2. 启动自检
后端启动时自动验证所有关键 API 路由已注册，缺了会在 stderr 输出警告：
```
[WARN] 缺少 API 路由: /api/providers
```

### 3. 修改流程
1. 确认需求
2. 设计方案让用户确认
3. 修改代码
4. 构建验证
5. 部署测试

## 后端规范 (backend/app.py)

### 启动入口
```python
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # 启动自检：验证所有必需的 API 路由已注册
        required_routes = [...]  # 核心路由列表
        registered = {r.rule for r in app.url_map.iter_rules()}
        for route in required_routes:
            if route not in registered:
                sys.stderr.write(f'[WARN] 缺少 API 路由: {route}\n')
        # 检查启动时是否有异常中断的小说
        unfinished = Novel.query.filter(Novel.status == 'generating').all()
        for n in unfinished:
            if total > 0 and done < total:
                n.status = 'interrupted'
        db.session.commit()
    # 清理系统代理环境变量（WSL 下 Windows no_proxy 含 IPv6 地址导致 httpx 报错）
    for key in ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy'):
        os.environ.pop(key, None)
    app.run(...)
```

### 小说状态
共有 5 种状态：`draft` `confirmed` `generating` `interrupted` `done`

- `interrupted` 表示生成过程中被中断（API 调用出错或后端重启）
- `generate_novel` 中 `novel.status not in ('confirmed', 'generating', 'interrupted')` 时拒绝生成
- 生成出错时设 `novel.status = 'interrupted'`
- 启动时自动检测 `generating` 但未完成的 → 转 `interrupted`

### API 路由清单
- `GET /api/providers` — 模型提供商列表
- `POST /api/test-api` — 测试 API 配置
- `POST /api/suggest-options` — AI 推荐创意选项
- `POST /api/novels` — 创建小说
- `POST /api/novels/<id>/generate-outline` — 生成大纲
- `GET /api/novels/<id>` — 获取小说详情
- `PUT /api/novels/<id>/confirm` — 确认大纲
- `PUT /api/novels/<id>/outline` — 更新大纲
- `POST /api/novels/<id>/generate` — 生成小说
- `GET /api/novels/<id>/progress` — 获取生成进度
- `GET /api/novels/<id>/download` — 下载 TXT
- `GET /api/novels` — 列出小说
- `DELETE /api/novels/<id>` — 删除小说
- `GET /api/novels/<id>/chapters/<chapter_id>` — 获取单章

## 前端规范 (frontend/src/)

### 小说状态跳转逻辑
从小说列表点击卡片时：

| 状态 | 跳转页面 |
|------|---------|
| `draft`（无大纲） | → 创建页面 |
| `draft`（有大纲） | → 大纲编辑页 |
| `confirmed` | → 大纲编辑页 |
| `generating` | → 阅读器 |
| `interrupted` | → 大纲编辑页（只读，显示继续生成按钮） |
| `done` | → 阅读器 |

### "继续生成"按钮行为
- 列表卡片上点击：立即设状态为 `generating` → 跳阅读器 → 后台生成
- 大纲页编辑器点击：立即设状态为 `generating` → 跳阅读器 → 后台生成

### 大纲编辑页按钮逻辑
- `interrupted` 状态：只显示"▶️ 继续生成"，不显示"修改"
- `confirmed` 状态：显示"✏️ 修改"和"📝 生成小说"
- `draft` 状态：显示"💾 保存大纲"和"✅ 确认大纲"
- 编辑模式（`isEditing=true`）下："继续生成"按钮隐藏

### 国际化
所有用户可见文本通过 `t()` 函数，不允许硬编码。
语言定义在 `i18n.ts` 中的 `zh` 和 `en` 两个 Record。
