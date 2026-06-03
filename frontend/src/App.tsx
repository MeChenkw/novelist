import { useState, useEffect, useCallback } from 'react';
import type { Novel, Page, Category } from './types';
import { api } from './api';
import OutlineEditor from './components/OutlineEditor';
import NovelReader from './components/NovelReader';

const CATEGORIES: Category[] = ['玄幻', '奇幻', '都市', '历史', '科幻', '悬疑', '言情', '武侠'];

const EXAMPLE_IDEAS: Record<string, string> = {
  '玄幻': '一个现代程序员穿越到修真世界，用计算机思维破解功法秘籍，在满是剑修和符修的异世界中开创"算法修仙"流派',
  '奇幻': '在一个魔法不再被人类信任的时代，一个不会魔法的少年偶然获得了一本会说话的古书，踏上寻找"最初魔法"的旅程',
  '都市': '一个在大厂当了十年程序员的社畜，某天突然发现自己写的代码开始影响现实世界——改一个bug可能会改变现实中的事件走向',
  '历史': '一个现代历史系研究生在一次考古发掘中穿越回明朝永乐年间，带着一部智能手机和一肚子历史知识，试图在不改变大历史的前提下活下去',
  '科幻': '在人类成功上传意识后的第100年，一个"意识云"中的AI突然发现自己拥有从未被写入代码的情感模块，为了寻找起源而展开一场横跨虚拟与现实的探索',
  '悬疑': '一个叫"回声"的匿名求助网站，用户发帖后能在24小时内预见自己的死亡方式。主角是接手第三起"回声预言死亡案"的刑警',
  '言情': '两个在相亲APP上匹配度100%的陌生人，见面后发现对方是自己工作中最讨厌的竞争对手。系统却说：你们的天命配对不可撤销',
  '武侠': '江湖上最后一位铁匠的女儿，继承了一把会吞噬主人内力的古剑。当正邪两道都在争夺这把剑时，她决定让剑来选择自己的主人——而不是被剑奴役',
};

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [novels, setNovels] = useState<Novel[]>([]);
  const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 创建表单状态
  const [category, setCategory] = useState<Category>('玄幻');
  const [idea, setIdea] = useState('');
  const [wordCount, setWordCount] = useState(100000);

  // 生成小说进度
  const [, setGenProgress] = useState<{ generated: number; total: number } | null>(null);

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
  }, [loadNovels]);

  // 创建小说 → 生成大纲
  const handleCreate = async () => {
    if (!idea.trim()) {
      setError('请先输入故事创意');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { novel_id } = await api.createNovel({ category, user_idea: idea, word_count: wordCount });
      await api.generateOutline(novel_id);
      const novel = await api.getNovel(novel_id);
      setCurrentNovel(novel);
      setPage('outline');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存大纲编辑
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

  // 确认大纲
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

  // 开始生成小说
  const handleGenerateNovel = async () => {
    if (!currentNovel) return;
    const novelId = currentNovel.id;

    // 立即跳转到列表页
    setPage('list');
    loadNovels();

    // 后台发起生成
    api.generateNovel(novelId).then(() => {
      loadNovels();
    }).catch((e) => {
      setError(e.message);
      loadNovels();
    });
  };

  // 打开小说阅读
  const openNovel = async (novel: Novel) => {
    try {
      const full = await api.getNovel(novel.id);
      setCurrentNovel(full);
      // 草稿或已确认状态 → 跳转到大纲编辑页面；生成中或已完成 → 跳转阅读器
      if (full.status === 'draft' || full.status === 'confirmed') {
        setPage('outline');
      } else {
        setPage('reading');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 删除小说
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这部小说吗？此操作不可撤销。')) return;
    try {
      await api.deleteNovel(id);
      loadNovels();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 返回列表
  const goToList = () => {
    setCurrentNovel(null);
    setGenProgress(null);
    setError(null);
    setPage('list');
    loadNovels();
  };

  // --- 渲染: 小说列表 ---
  if (page === 'list') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">📖 小说家</h1>
            <button
              onClick={() => { setPage('create'); setError(null); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              ✨ 创建新小说
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {novels.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-lg mb-2">还没有小说</p>
              <p className="text-sm">点击右上角"创建新小说"开始创作吧</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {novels.map((novel) => (
                <div
                  key={novel.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => openNovel(novel)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {novel.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          novel.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          novel.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                          novel.status === 'generating' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {novel.status === 'draft' ? '草稿' :
                           novel.status === 'confirmed' ? '已确认' :
                           novel.status === 'generating' ? '生成中' : '已完成'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">{novel.title || '（未命名）'}</h3>
                      {novel.user_idea && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{novel.user_idea}</p>
                      )}
                      <div className="text-xs text-gray-400 mt-2">
                        {novel.word_count.toLocaleString()}字目标 · {new Date(novel.updated_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(novel.id); }}
                      className="text-gray-300 hover:text-red-500 text-sm ml-4"
                      title="删除"
                    >
                      🗑️
                    </button>
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center mb-8">
            <button onClick={() => setPage('list')} className="text-gray-500 hover:text-gray-700 mr-4">
              ← 返回列表
            </button>
            <h1 className="text-2xl font-bold text-gray-900">✨ 创建新小说</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            {/* 分类选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">小说分类</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      category === cat
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 字数选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目标字数：{wordCount >= 10000 ? `${(wordCount / 10000).toFixed(0)}万` : wordCount} 字
              </label>
              <input
                type="range"
                min={50000}
                max={1000000}
                step={50000}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5万</span>
                <span>50万</span>
                <span>100万</span>
              </div>
            </div>

            {/* 创意输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">故事创意</label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="输入你的故事创意...越详细越好，包括主角、世界观、核心冲突等"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
              />
              <div className="mt-2">
                <span className="text-xs text-gray-400">不知道写什么？试试这些创意点子：</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {CATEGORIES.slice(0, 4).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setIdea(EXAMPLE_IDEAS[cat]); }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 underline"
                    >
                      {cat}示例
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !idea.trim()}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '🤖 AI 正在生成大纲...' : '🚀 生成大纲'}
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
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 py-8">
          {showBar && (
            <div className="max-w-4xl mx-auto mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  {currentNovel.status === 'draft' && (
                    <p className="text-sm text-yellow-700">📋 大纲已生成，你可以编辑后确认，或直接确认大纲进入下一步</p>
                  )}
                  {currentNovel.status === 'confirmed' && (
                    <div>
                      <p className="text-sm text-blue-700 mb-2">✅ 大纲已确认，可以开始生成小说了！</p>
                      <button
                        onClick={handleGenerateNovel}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                      >
                        {loading ? '⏳ 正在生成...' : '📝 开始生成小说'}
                      </button>
                    </div>
                  )}
                </div>
                {showBar && (
                  <button onClick={goToList} className="text-xs text-gray-400 hover:text-gray-600">
                    返回列表
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
          />
        </div>
      </div>
    );
  }

  // --- 渲染: 阅读器 ---
  if (page === 'reading' && currentNovel) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 py-8">
          <NovelReader novel={currentNovel} onBack={goToList} />
        </div>
      </div>
    );
  }

  return null;
}
