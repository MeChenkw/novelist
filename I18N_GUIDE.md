# 国际化规范 (i18n Guide)

## 核心原则

**所有面向用户的文本都必须通过 `t()` 函数调用，不能有硬编码文本。**

## 使用方式

```tsx
import { t, getLocale } from '../i18n';

// 基本用法
t('app.title')           // → "📖 小说家" (zh) 或 "📖 Novelist" (en)

// 动态值拼接
`${t('create.word_count')}：${wordCount} ${t('create.word_count_hint')}`

// 条件判断语言
const locale = getLocale();
locale === 'en' ? 'Volume' : '卷'
```

## 添加新文本

### 在 `src/i18n.ts` 中添加

1. 在 `zh` 字典中添加中文 key-value
2. 在 `en` 字典中添加同 key 的英文

### key 命名规范

```
<模块>.<具体含义>
```

| 模块 | 前缀 | 示例 |
|------|------|------|
| 通用 | `app.` | `app.title`, `app.back` |
| 状态 | `status.` | `status.draft`, `status.done` |
| 分类 | `cat.` | `cat.玄幻`, `cat.玄幻`(zh值保持中文) |
| 创建页 | `create.` | `create.title`, `create.category` |
| 大纲编辑 | `outline.` | `outline.save`, `outline.confirm` |
| 阅读器 | `reader.` | `reader.back`, `reader.download` |
| 设置 | `settings.` | `settings.title`, `settings.api_key` |
| AI prompt | `ai.` | `ai.lang`, `ai.lang_chapter` |

## 生命周期

```
用户切换语言
  → switchLocale(l) 调用
    → setLocale(l) 写入 localStorage
    → window.location.reload() 强制刷新页面
      → 所有组件重新挂载
        → t(key) 读取 getLocale() 获取当前语言
        → 返回对应字典值
```

## 特殊情况处理

### 数字/卷标格式差异
```tsx
const volLabel = (o: number, t: string) =>
  locale === 'en' ? `Volume ${o} ${t}` : `第${o}卷 ${t}`;
```

### 分类名称
- 中文分类：保持中文字符 `cat.玄幻: '玄幻'`
- 英文分类：用英文映射 `cat.玄幻: 'Xianxia'`

### 动态提示（如错误消息）
- 直接用 `t()` 包裹
- 不要用 `t()` + 字符串拼接，用模板字符串

## 检查清单

开发新功能时检查：
- [ ] 所有按钮文字用 `t()`
- [ ] 所有提示/标签文字用 `t()`
- [ ] 占位符文字用 `t()` 或 locale 条件判断
- [ ] 日期格式化用 `toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-CN')`
- [ ] 创建页面示例创意用双语对象
