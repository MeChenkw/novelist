import { useState } from 'react';
import type { Novel } from '../types';

interface Props {
  novel: Novel;
  onBack: () => void;
}

export default function NovelReader({ novel, onBack }: Props) {
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  // 扁平化所有章节
  const allChapters = novel.volumes.flatMap((v) =>
    v.chapters.map((c) => ({
      ...c,
      volumeTitle: v.title,
      volumeOrder: v.order,
    }))
  );

  const current = allChapters[currentChapterIdx];
  const hasContent = novel.status === 'done' || novel.status === 'generating';

  // 下载完整小说
  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/novels/${novel.id}/download`);
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${novel.title || '小说'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!current) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-gray-400">
        <p>没有找到章节内容</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 返回
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            {showSidebar ? '📖 隐藏目录' : '📖 显示目录'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-[300px]">
            {novel.title || '未命名'}
          </h1>
          {hasContent && (
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              📥 下载 TXT
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* 侧栏目录 */}
        {showSidebar && (
          <div className="w-64 shrink-0 max-h-[80vh] overflow-y-auto bg-white border border-gray-200 rounded-lg p-3">
            {novel.volumes.map((vol) => (
              <div key={vol.id} className="mb-3">
                <div className="text-xs font-bold text-indigo-600 mb-1 px-2 py-1 bg-indigo-50 rounded">
                  第{vol.order}卷 {vol.title}
                </div>
                {vol.chapters.map((ch) => {
                  const globalIdx = allChapters.findIndex((ac) => ac.id === ch.id);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setCurrentChapterIdx(globalIdx)}
                      className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-100 ${
                        globalIdx === currentChapterIdx
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : ch.content
                          ? 'text-gray-700'
                          : 'text-gray-400'
                      }`}
                    >
                      <span className="text-xs opacity-60">第{ch.order}章 </span>
                      {ch.title || '未命名'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* 正文区 */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-10">
            {/* 章节标题 */}
            <div className="text-center mb-6 pb-4 border-b border-gray-100">
              <div className="text-xs text-gray-400 mb-1">
                第{current.volumeOrder}卷 {current.volumeTitle}
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                第{current.order}章 {current.title}
              </h2>
            </div>

            {/* 正文内容 */}
            <div className="prose prose-gray max-w-none min-h-[300px] leading-relaxed">
              {current.content ? (
                <div className="whitespace-pre-wrap text-base text-gray-700">
                  {current.content}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  {novel.status === 'draft' || novel.status === 'confirmed' ? (
                    <div>
                      <p className="mb-2">📝 本章尚未生成</p>
                      <p className="text-sm">请先确认大纲，然后点击"开始生成小说"</p>
                    </div>
                  ) : novel.status === 'generating' ? (
                    <div>
                      <p className="mb-2">⏳ 正在生成中...</p>
                      <p className="text-sm">请稍后刷新查看</p>
                    </div>
                  ) : (
                    <p>暂无内容</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 翻页导航 */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setCurrentChapterIdx((i) => Math.max(0, i - 1))}
              disabled={currentChapterIdx === 0}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← 上一章
            </button>
            <span className="text-sm text-gray-400">
              第 {currentChapterIdx + 1} / {allChapters.length} 章
            </span>
            <button
              onClick={() => setCurrentChapterIdx((i) => Math.min(allChapters.length - 1, i + 1))}
              disabled={currentChapterIdx >= allChapters.length - 1}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              下一章 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
