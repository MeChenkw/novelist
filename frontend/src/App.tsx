import { useState, useEffect, useCallback, useRef } from 'react';
import type { Novel, Category } from './types';
import type { Page } from './types';
import { api } from './api';
import OutlineEditor from './components/OutlineEditor';
import NovelReader from './components/NovelReader';
import ModelSettings, { loadAiConfig } from './components/ModelSettings';
import IdeaEnhancer from './components/IdeaEnhancer';
import type { IdeaEnhancerHandle } from './components/IdeaEnhancer';
import { getLocale, setLocale, t, type Locale } from './i18n';

// 扩展 Page 类型以包含 settings
type AppPage = Page | 'settings';

const CATEGORIES: Category[] = ['玄幻', '奇幻', '都市', '历史', '科幻', '悬疑', '言情', '武侠'];

// 获取页面可用的 AI 配置（含 locale）
function getAiConfig() {
  const saved = loadAiConfig();
  const cfg: Record<string, string> = {
    api_key: saved?.api_key || '',
    base_url: saved?.base_url || '',
    model: saved?.model || '',
    locale: getLocale(),
  };
  return cfg;
}

export default function App() {
  const [page, setPage] = useState<AppPage>('list');
  const [novels, setNovels] = useState<Novel[]>([]);
  const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  // 创建表单状态
  const [category, setCategory] = useState<Category>('玄幻');
  const [idea, setIdea] = useState('');
  const [wordCount, setWordCount] = useState(100000);

  // 生成小说进度
  const [, setGenProgress] = useState<{ generated: number; total: number } | null>(null);

  // 从草稿进入创建页时，记录草稿 ID 以便更新而不是新建
  const [draftNovelId, setDraftNovelId] = useState<number | null>(null);

  // IdeaEnhancer ref
  const enhancerRef = useRef<IdeaEnhancerHandle>(null);

  // 检查是否已配模型
  const hasModelConfig = !!loadAiConfig();

  // 语言切换
  const switchLocale = (l: Locale) => {
    setLocale(l);
    setLocaleState(l);
    // 强制刷新页面以确保所有 i18n 文字生效
    window.location.reload();
  };

  // 加载小说列表
  const loadNovels = useCallback(async () => {
    try {
      const list = await api.listNovels();
      setNovels(list);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadNovels();
    // 轮询刷新列表（每 5 秒），确保生成完成等状态变化及时更新
    const interval = setInterval(() => {
      loadNovels();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadNovels]);

  const handleCreate = async () => {
    if (!idea.trim()) {
      setError(t('app.need_idea'));
      return;
    }
    if (!hasModelConfig) {
      setError(t('app.no_api'));
      return;
    }
    setLoading(true);
    setError(null);
    let novelId: number | null = null;
    try {
      // 如果有草稿 ID，则更新草稿信息后再生成大纲，否则新建
      if (draftNovelId) {
        novelId = draftNovelId;
        // 先更新草稿的分类、创意、字数（通过 PUT outline 实现，先清空旧大纲）
        await api.updateOutline(novelId, { novel_title: '', volumes: [] });
        // 再重新生成大纲
        await api.generateOutline(novelId, getAiConfig());
        setDraftNovelId(null);
      } else {
        const result = await api.createNovel({ category, user_idea: idea, word_count: wordCount });
        novelId = result.novel_id;
        await api.generateOutline(novelId, getAiConfig());
      }
      const novel = await api.getNovel(novelId);
      setCurrentNovel(novel);
      setPage('outline');
    } catch (e: any) {
      setError(e.message);
      // 如果新建小说但生成大纲失败，删除它
      if (novelId && !draftNovelId) api.deleteNovel(novelId).catch(() => {});
    } finally {
      setLoading(false);
      loadNovels();
    }
  };

  // 创意提交——如果创意不全则引导补充，齐全则直接生成大纲
  const handleSubmitIdea = async () => {
    if (!idea.trim()) {
      setError(t('app.need_idea'));
      return;
    }
    if (!hasModelConfig) {
      setError(t('app.no_api'));
      return;
    }

    // 检查创意是否齐全
    if (enhancerRef.current?.isMissing()) {
      // 创意不全，启动引导
      enhancerRef.current?.startEnhance();
      return;
    }

    // 创意齐全，直接生成大纲
    await handleCreate();
  };

  // 引导完成后的回调：submitDirectly=true 直接生成，false 仅确认创意
  const handleEnhancerComplete = (submitDirectly: boolean) => {
    if (submitDirectly) {
      handleCreate();
    }
  };

  const handleSaveOutline = async (novelTitle: string, volumes: { title: string; desc: string; chapters: { title: string; outline: string }[] }[]) => {
    if (!currentNovel) return;
    try {
      const updated = await api.updateOutline(currentNovel.id, { novel_title: novelTitle, volumes });
      setCurrentNovel(updated);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const handleConfirmOutline = async () => {
    if (!currentNovel) return;
    try {
      await api.confirmOutline(currentNovel.id);
      setCurrentNovel((prev) => prev ? { ...prev, status: 'confirmed' } : null);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleGenerateNovel = async () => {
    if (!currentNovel) return;
    const novelId = currentNovel.id;
    const aiConfig = getAiConfig();

    // 立即更新状态为生成中
    setCurrentNovel((prev) => prev ? { ...prev, status: 'generating' } : null);

    // 跳转到阅读器，后台生成
    setPage('reading');
    loadNovels();

    api.generateNovel(novelId, aiConfig).then(() => {
      loadNovels();
    }).catch((e) => {
      setError(e.message);
      loadNovels();
    });
  };

  const openNovel = async (novel: Novel) => {
    try {
      const full = await api.getNovel(novel.id);
      setCurrentNovel(full);
      // 草稿且没有大纲 → 跳转到创建页面，保留之前录入的信息
      if (full.status === 'draft' && (!full.title || full.volumes.length === 0)) {
        setCategory(full.category as Category);
        setIdea(full.user_idea);
        setWordCount(full.word_count);
        setCurrentNovel(null);
        setDraftNovelId(full.id);
        setPage('create');
      } else if (full.status === 'draft' || full.status === 'confirmed' || full.status === 'interrupted') {
        setPage('outline');
      } else if (full.status === 'generating') {
        setPage('reading');
      } else {
        setPage('reading');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('app.delete_confirm'))) return;
    try {
      await api.deleteNovel(id);
      loadNovels();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const goToList = () => {
    setCurrentNovel(null);
    setGenProgress(null);
    setError(null);
    setDraftNovelId(null);
    setPage('list');
    loadNovels();
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: t('status.draft'),
      confirmed: t('status.confirmed'),
      generating: t('status.generating'),
      done: t('status.done'),
      interrupted: t('status.interrupted'),
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'vercel-badge-draft',
      confirmed: 'vercel-badge-confirmed',
      generating: 'vercel-badge-generating',
      done: 'vercel-badge-done',
      interrupted: 'bg-[#fff7ed] text-[#92400e]',
    };
    return map[s] || '';
  };

  // --- 渲染: 模型设置 ---
  if (page === 'settings') {
    return <ModelSettings onBack={goToList} />;
  }

  // --- 渲染: 小说列表 ---
  if (page === 'list') {
    return (
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">{t('app.title')}</h1>
            <div className="flex items-center gap-2">
              {/* 语言切换 */}
              <select
                value={locale}
                onChange={(e) => switchLocale(e.target.value as Locale)}
                className="text-xs vercel-border rounded px-2 py-1"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>

              {!hasModelConfig && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full animate-pulse">
                  {t('app.unconfigured')}
                </span>
              )}
              <button
                onClick={() => setPage('settings')}
                className="px-3 py-2 text-sm vercel-border rounded-md hover:bg-[#fafafa]"
                title="模型设置"
              >
                {t('app.settings')}
              </button>
              <button
                onClick={() => { setCategory('玄幻'); setIdea(''); setWordCount(100000); setDraftNovelId(null); setError(null); setPage('create'); }}
                className="px-4 py-2 bg-[#171717] text-white rounded-md hover:bg-[#333] text-sm"
              >
                {t('app.create')}
              </button>
            </div>
          </div>

          {!hasModelConfig && (
            <div className="mb-4 p-4 bg-[#fffbeb] vercel-border rounded-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚙️</span>
                <div>
                  <p className="text-sm font-medium text-yellow-800">{t('app.first_time')}</p>
                  <p className="text-xs text-[#92400e] mt-1">{t('app.first_time_hint')}</p>
                </div>
                <button
                  onClick={() => setPage('settings')}
                  className="ml-auto px-4 py-1.5 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333]"
                >
                  {t('app.go_config')}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 vercel-border rounded-lg text-sm">
              {error}
            </div>
          )}

          {novels.length === 0 ? (
            <div className="text-center py-20 text-[#808080]">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-lg mb-2">{t('app.no_novels')}</p>
              <p className="text-sm">{t('app.no_novels_hint')}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {novels.map((novel) => (
                <div
                  key={novel.id}
                  className="bg-white vercel-card rounded-xl p-4 hover:vercel-border-raised transition-shadow cursor-pointer"
                  onClick={() => openNovel(novel)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-[#f5f5f5] text-[#171717] px-2 py-0.5 rounded-full">
                          {locale === 'en' ? t(`cat.${novel.category}`) : novel.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(novel.status)}`}>
                          {statusLabel(novel.status)}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-[#171717]">{novel.title || `(${t('reader.unnamed')})`}</h3>
                      {novel.user_idea && (
                        <p className="text-sm text-[#666666] mt-1 line-clamp-2">{novel.user_idea}</p>
                      )}
                      <div className="text-xs text-[#808080] mt-2">
                        {novel.word_count.toLocaleString()} {t('create.word_count_hint')} · {new Date(novel.updated_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-CN')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {novel.status === 'interrupted' && (
                        <button
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            try {
                              // 立即更新列表状态为"生成中"
                              setNovels((prev) => prev.map((n) => n.id === novel.id ? { ...n, status: 'generating' } : n));
                              const full = await api.getNovel(novel.id);
                              setCurrentNovel(full);
                              setPage('reading');
                              api.generateNovel(full.id, getAiConfig()).finally(() => loadNovels());
                            } catch {}
                          }}
                          className="px-2 py-0.5 text-xs bg-[#171717] text-white rounded-md hover:bg-[#333]"
                        >
                          {t('outline.generating_resume')}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(novel.id); }}
                        className="text-[#808080] hover:text-[#ef4444] text-sm ml-auto"
                        title={t('delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 渲染: 创建页面 ---
  if (page === 'create') {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center mb-8">
            <button onClick={() => setPage('list')} className="text-[#666] hover:text-[#171717] mr-4 text-sm">
              {t('app.back')}
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">{t('create.title')}</h1>
          </div>

          {!hasModelConfig && (
            <div className="mb-4 p-3 bg-[#fffbeb] vercel-border rounded-md text-sm text-[#92400e]">
              {t('app.configure_first')}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 vercel-border rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-white vercel-card rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#4d4d4d] mb-2">{t('create.category')}</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      category === cat
                        ? 'bg-[#171717] text-white'
                        : 'bg-white text-[#666] vercel-border'
                    }`}
                  >
                    {locale === 'en' ? t(`cat.${cat}`) : cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                {t('create.word_count')}：{wordCount >= 10000 ? `${(wordCount / 10000).toFixed(0)}万` : wordCount} {t('create.word_count_hint')}
              </label>
              <input
                type="range"
                min={50000}
                max={5000000}
                step={50000}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#808080] mt-1">
                <span>5万</span>
                <span>250万</span>
                <span>500万</span>
              </div>
            </div>

            <IdeaEnhancer ref={enhancerRef} value={idea} onChange={setIdea} category={category} onComplete={handleEnhancerComplete} />

            <button
              onClick={handleSubmitIdea}
              disabled={loading || !idea.trim() || !hasModelConfig}
              className="w-full py-3 bg-[#171717] text-white rounded-md font-medium hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('app.generating') : `🚀 ${t('create.submit_idea')}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 渲染: 大纲编辑 ---
  if (page === 'outline' && currentNovel) {
    const showBar = currentNovel.status !== 'done';

    return (
      <div className="min-h-screen">
        <div className="px-4 py-8">
          {showBar && (
            <div className={`max-w-5xl mx-auto mb-6 vercel-border rounded-md p-4 ${
              currentNovel.status === 'draft' ? 'bg-[#fffbeb]' :
              currentNovel.status === 'confirmed' ? 'bg-[#eff6ff]' :
              'bg-[#fff7ed]'
            }`}>
              <div className="flex items-center justify-between">
              <div>
                {currentNovel.status === 'draft' && (
                  <p className="text-sm text-[#92400e]">{t('outline.draft_hint')}</p>
                )}
                {currentNovel.status === 'confirmed' && (
                  <p className="text-sm text-[#1d4ed8]">{t('outline.confirmed_hint')}</p>
                )}
                {(currentNovel.status === 'generating') && (
                  <p className="text-sm text-[#92400e]">{t('outline.generating_hint')}</p>
                )}
                {(currentNovel.status === 'interrupted') && (
                  <p className="text-sm text-[#92400e]">{t('outline.generating_hint')}</p>
                )}
              </div>
              {showBar && (
                <button onClick={goToList} className="text-xs text-[#808080] hover:text-[#666]">
                  {t('app.back')}
                </button>
              )}
              </div>
            </div>
          )}

          <OutlineEditor
            novel={currentNovel}
            onSave={handleSaveOutline}
            onConfirm={handleConfirmOutline}
            onBack={goToList}
            onGenerate={handleGenerateNovel}
            generating={loading}
          />
        </div>
      </div>
    );
  }

  // --- 渲染: 阅读器 ---
  if (page === 'reading' && currentNovel) {
    return (
      <div className="min-h-screen">
        <div className="px-4 py-8">
          <NovelReader
            novel={currentNovel}
            onBack={goToList}
          />
        </div>
      </div>
    );
  }

  return null;
}
