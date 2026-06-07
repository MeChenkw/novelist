// 国际化模块
// localStorage key
const LOCALE_KEY = 'novelist_locale';

export type Locale = 'zh' | 'en';

// 获取/设置 locale
export function getLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v === 'zh' || v === 'en') return v;
  } catch {}
  return 'zh';
}

export function setLocale(l: Locale) {
  localStorage.setItem(LOCALE_KEY, l);
}

// 翻译字典
const zh: Record<string, string> = {
  'app.title': '📖 小说家',
  'app.subtitle': 'AI 创作助手',
  'app.unconfigured': '未配置',
  'app.first_time': '首次使用？请先配置模型',
  'app.first_time_hint': '点击右上角 ⚙️ 按钮，选择模型提供商并填入 API Key（支持 DeepSeek / Ollama 本地 / OpenAI 等）',
  'app.go_config': '去配置',
  'app.create': '✨ 创建新小说',
  'app.no_novels': '还没有小说',
  'app.no_novels_hint': '点击右上角"创建新小说"开始创作吧',
  'app.back': '← 返回',
  'app.configure_first': '⚠️ 请先配置模型（点击右上角 ⚙️），否则无法生成内容',
  'app.generate_outline': '🚀 生成大纲',
  'app.generating': '🤖 AI 正在生成大纲...',
  'app.no_idea': '不知道写什么？试试这些创意点子：',
  'app.no_api': '请先在模型设置中配置 API',
  'app.need_idea': '请先输入故事创意',
  'app.settings': '⚙️',
  'app.delete_confirm': '确定要删除这部小说吗？此操作不可撤销。',

  // 状态标签
  'status.draft': '草稿',
  'status.confirmed': '已确认',
  'status.generating': '生成中',
  'status.done': '已完成',
  'status.interrupted': '生成中断',

  // 分类
  'cat.玄幻': '玄幻',
  'cat.奇幻': '奇幻',
  'cat.都市': '都市',
  'cat.历史': '历史',
  'cat.科幻': '科幻',
  'cat.悬疑': '悬疑',
  'cat.言情': '言情',
  'cat.武侠': '武侠',

  // 创建页面
  'create.title': '✨ 创建新小说',
  'create.category': '小说分类',
  'create.word_count': '目标字数',
  'create.word_count_hint': '字',
  'create.idea': '故事创意',
  'create.idea_placeholder': '输入你的故事创意...越详细越好，包括主角、世界观、核心冲突等',
  'create.slider_min': '5万',
  'create.slider_mid': '50万',
  'create.slider_max': '100万',

  // 大纲编辑
  'outline.save': '💾 保存大纲',
  'outline.saving': '保存中...',
  'outline.confirm': '✅ 确认大纲',
  'outline.confirming': '确认中...',
  'outline.modify': '✏️ 修改大纲',
  'outline.novel_title': '小说名',
  'outline.novel_title_placeholder': '输入小说名...',
  'outline.volume': '卷',
  'outline.chapter_title': '标题',
  'outline.chapter_outline': '内容简介',
  'outline.hint_editing': '你可以自由编辑小说名、卷名、卷简介、章标题和内容简介',
  'outline.hint_readonly': '大纲已确认，只读模式。点击"✏️ 修改大纲"可重新编辑',
  'outline.draft_hint': '📋 大纲已生成，你可以编辑后确认，或直接确认大纲进入下一步',
  'outline.confirmed_hint': '✅ 大纲已确认，可以开始生成小说了！',
  'outline.generate': '📝 开始生成小说',
  'outline.generating': '⏳ 正在生成...',
  'outline.generating_hint': '⏳ 上次生成被中断，可以继续生成',
  'outline.generating_stale_hint': '⏳ 生成进度已停止，可以继续生成',
  'outline.generating_resume': '▶️ 继续生成',
  'outline.generating_resume_loading': '⏳ 正在继续...',

  // 阅读器
  'reader.back': '← 返回',
  'reader.hide_toc': '📖 隐藏目录',
  'reader.show_toc': '📖 显示目录',
  'reader.download': '📥 下载 TXT',
  'reader.unnamed': '未命名',
  'reader.no_content': '没有找到章节内容',
  'reader.chapter_not_generated': '📝 本章尚未生成',
  'reader.chapter_not_generated_hint': '请先确认大纲，然后点击"开始生成小说"',
  'reader.generating_hint': '⏳ 正在生成中...',
  'reader.generating_hint2': '请稍后刷新查看',
  'reader.no_content2': '暂无内容',
  'reader.prev': '← 上一章',
  'reader.next': '下一章 →',
  'reader.chapter': '章',

  // 模型设置
  'settings.title': '⚙️ 模型设置',
  'settings.quick': '快速选择',
  'settings.provider': '模型提供商',
  'settings.api_key': 'API Key',
  'settings.api_key_hint_ollama': 'Ollama 本地模型不需要 API Key',
  'settings.api_key_hint': '输入你的 API Key，仅保存在你浏览器本地 localStorage',
  'settings.base_url': 'API 地址',
  'settings.model_name': '模型名称',
  'settings.custom_model': '输入模型名，多个用逗号分隔',
  'settings.test': '🔍 测试连接',
  'settings.testing': '⏳ 测试中...',
  'settings.save': '💾 保存配置',
  'settings.privacy': '配置信息仅保存在你浏览器的 localStorage 中，不会上传到任何服务器',
  'settings.no_key': '请输入 API Key',
  'settings.test_success': '✅ 连接成功！回复:',
  'settings.test_fail': '❌',
  'settings.$name': '',

  // AI prompt 语言后缀
  'ai.lang': '请用中文回答。',
  'ai.lang_outline': '请用中文创作小说大纲。',
  'ai.lang_chapter': '请用中文创作小说正文。',

  // 通用
  'loading': '加载中...',
  'save': '保存',
  'cancel': '取消',
  'delete': '删除',
  'confirm': '确认',
};

const en: Record<string, string> = {
  'app.title': '📖 Novelist',
  'app.subtitle': 'AI Writing Assistant',
  'app.unconfigured': 'Not set',
  'app.first_time': 'First time? Configure your AI model first',
  'app.first_time_hint': 'Click the ⚙️ button in the top right to select a provider and enter your API Key（supports DeepSeek / Ollama / OpenAI etc.）',
  'app.go_config': 'Configure',
  'app.create': '✨ New Novel',
  'app.no_novels': 'No novels yet',
  'app.no_novels_hint': 'Click "New Novel" in the top right to start writing',
  'app.back': '← Back',
  'app.configure_first': '⚠️ Please configure your AI model first (click ⚙️ in top right)',
  'app.generate_outline': '🚀 Generate Outline',
  'app.generating': '🤖 AI is generating outline...',
  'app.no_idea': 'Need inspiration? Try these ideas:',
  'app.no_api': 'Please configure your API in the settings first',
  'app.need_idea': 'Please enter your story idea first',
  'app.settings': '⚙️',
  'app.delete_confirm': 'Are you sure you want to delete this novel? This action cannot be undone.',

  'status.draft': 'Draft',
  'status.confirmed': 'Confirmed',
  'status.generating': 'Generating',
  'status.done': 'Completed',
  'status.interrupted': 'Interrupted',

  'cat.玄幻': 'Xianxia',
  'cat.奇幻': 'Fantasy',
  'cat.都市': 'Urban',
  'cat.历史': 'Historical',
  'cat.科幻': 'Sci-Fi',
  'cat.悬疑': 'Mystery',
  'cat.言情': 'Romance',
  'cat.武侠': 'Wuxia',

  'create.title': '✨ Create Novel',
  'create.category': 'Category',
  'create.word_count': 'Target Word Count',
  'create.word_count_hint': 'words',
  'create.idea': 'Story Idea',
  'create.idea_placeholder': 'Describe your story idea... the more detail the better, including protagonist, world, and core conflict',
  'create.slider_min': '50K',
  'create.slider_mid': '500K',
  'create.slider_max': '1M',

  'outline.save': '💾 Save',
  'outline.saving': 'Saving...',
  'outline.confirm': '✅ Confirm',
  'outline.confirming': 'Confirming...',
  'outline.modify': '✏️ Edit',
  'outline.novel_title': 'Novel Title',
  'outline.novel_title_placeholder': 'Enter novel title...',
  'outline.volume': 'Volume',
  'outline.chapter_title': 'Title',
  'outline.chapter_outline': 'Summary',
  'outline.hint_editing': 'You can freely edit the novel title, volume names, descriptions, chapter titles, and summaries',
  'outline.hint_readonly': 'Outline confirmed, read-only mode. Click "✏️ Edit" to make changes',
  'outline.draft_hint': '📋 Outline generated. You can edit and confirm it, or confirm directly',
  'outline.confirmed_hint': '✅ Outline confirmed. Ready to generate the novel!',
  'outline.generate': '📝 Generate Novel',
  'outline.generating': '⏳ Generating...',
  'outline.generating_hint': '⏳ Previous generation was interrupted, you can resume',
  'outline.generating_stale_hint': '⏳ Generation progress has stopped, you can resume',
  'outline.generating_resume': '▶️ Resume',
  'outline.generating_resume_loading': '⏳ Resuming...',

  'reader.back': '← Back',
  'reader.hide_toc': '📖 Hide TOC',
  'reader.show_toc': '📖 Show TOC',
  'reader.download': '📥 Download TXT',
  'reader.unnamed': 'Untitled',
  'reader.no_content': 'No content found',
  'reader.chapter_not_generated': '📝 Chapter not generated yet',
  'reader.chapter_not_generated_hint': 'Please confirm the outline first, then click "Generate Novel"',
  'reader.generating_hint': '⏳ Generating...',
  'reader.generating_hint2': 'Please refresh later',
  'reader.no_content2': 'No content',
  'reader.prev': '← Previous',
  'reader.next': 'Next →',
  'reader.chapter': 'Ch.',

  'settings.title': '⚙️ Model Settings',
  'settings.quick': 'Quick Select',
  'settings.provider': 'Provider',
  'settings.api_key': 'API Key',
  'settings.api_key_hint_ollama': 'Ollama local models don\'t need an API Key',
  'settings.api_key_hint': 'Enter your API Key. It is stored in your browser\'s localStorage only',
  'settings.base_url': 'API URL',
  'settings.model_name': 'Model Name',
  'settings.custom_model': 'Enter model name, separate multiple with commas',
  'settings.test': '🔍 Test Connection',
  'settings.testing': '⏳ Testing...',
  'settings.save': '💾 Save',
  'settings.privacy': 'Configuration is stored in your browser\'s localStorage only, never uploaded to any server',
  'settings.no_key': 'Please enter an API Key',
  'settings.test_success': '✅ Connected! Reply:',
  'settings.test_fail': '❌',

  'ai.lang': 'Please respond in English.',
  'ai.lang_outline': 'Please create the novel outline in English.',
  'ai.lang_chapter': 'Please write the novel chapter in English.',
};

const dicts: Record<Locale, Record<string, string>> = { zh, en };

export function t(key: string): string {
  const locale = getLocale();
  return dicts[locale][key] ?? dicts['zh'][key] ?? key;
}
