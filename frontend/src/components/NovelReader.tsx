import { useState } from 'react';
import type { Novel } from '../types';
import { t, getLocale } from '../i18n';

interface Props {
  novel: Novel;
  onBack: () => void;
}

export default function NovelReader({ novel, onBack }: Props) {
  const locale = getLocale();
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  const allChapters = novel.volumes.flatMap((v) =>
    v.chapters.map((c) => ({
      ...c,
      volumeTitle: v.title,
      volumeOrder: v.order,
    }))
  );

  const current = allChapters[currentChapterIdx];
  const hasContent = novel.status === 'done' || novel.status === 'generating';

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/novels/${novel.id}/download`);
      if (!res.ok) throw new Error(t('reader.no_content'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${novel.title || 'novel'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!current) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-[#808080]">
        <p>{t('reader.no_content')}</p>
        <button onClick={onBack} className="mt-4 text-[#0072f5] hover:underline">
          {t('reader.back')}
        </button>
      </div>
    );
  }

  const volLabel = (o: number, t: string) =>
    locale === 'en' ? `Volume ${o} ${t}` : `第${o}卷 ${t}`;

  const chLabel = (o: number, t: string) =>
    locale === 'en' ? `Ch.${o} ${t}` : `第${o}章 ${t}`;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-[#666] hover:text-[#171717] text-sm">
            {t('reader.back')}
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-[#808080] hover:text-[#666] text-sm"
          >
            {showSidebar ? t('reader.hide_toc') : t('reader.show_toc')}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#171717] truncate max-w-[300px]">
            {novel.title || t('reader.unnamed')}
          </h1>
          {hasContent && (
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333]"
            >
              {t('reader.download')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {showSidebar && (
          <div className="w-64 shrink-0 max-h-[80vh] overflow-y-auto bg-white vercel-border rounded-md p-3">
            {novel.volumes.map((vol) => (
              <div key={vol.id} className="mb-3">
                <div className="text-xs font-medium text-[#171717] mb-1 px-2 py-1 bg-[#f5f5f5] rounded">
                  {locale === 'en' ? `Vol.${vol.order} ${vol.title}` : `第${vol.order}卷 ${vol.title}`}
                </div>
                {vol.chapters.map((ch) => {
                  const globalIdx = allChapters.findIndex((ac) => ac.id === ch.id);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setCurrentChapterIdx(globalIdx)}
                      className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-100 ${
                        globalIdx === currentChapterIdx
                          ? 'bg-[#f5f5f5] text-[#171717] font-medium'
                          : ch.content
                          ? 'text-[#4d4d4d]'
                          : 'text-[#808080]'
                      }`}
                    >
                      <span className="text-xs opacity-60">{locale === 'en' ? `Ch.${ch.order} ` : `第${ch.order}章 `}</span>
                      {ch.title || t('reader.unnamed')}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="bg-white vercel-border rounded-xl p-6 md:p-10">
            <div className="text-center mb-6 pb-4 border-b border-[rgb(235,235,235)]">
              <div className="text-xs text-[#808080] mb-1">
                {volLabel(current.volumeOrder, current.volumeTitle)}
              </div>
              <h2 className="text-xl font-semibold text-[#171717]">
                {chLabel(current.order, current.title)}
              </h2>
            </div>

            <div className="prose prose-gray max-w-none min-h-[300px] leading-relaxed">
              {current.content ? (
                <div className="whitespace-pre-wrap text-base text-[#4d4d4d]">
                  {current.content}
                </div>
              ) : (
                <div className="text-center py-16 text-[#808080]">
                  {novel.status === 'draft' || novel.status === 'confirmed' ? (
                    <div>
                      <p className="mb-2">{t('reader.chapter_not_generated')}</p>
                      <p className="text-sm">{t('reader.chapter_not_generated_hint')}</p>
                    </div>
                  ) : novel.status === 'generating' ? (
                    <div>
                      <p className="mb-2">{t('reader.generating_hint')}</p>
                      <p className="text-sm">{t('reader.generating_hint2')}</p>
                    </div>
                  ) : (
                    <p>{t('reader.no_content2')}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setCurrentChapterIdx((i) => Math.max(0, i - 1))}
              disabled={currentChapterIdx === 0}
              className="px-4 py-2 text-sm vercel-border rounded-md hover:bg-[#fafafa] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('reader.prev')}
            </button>
            <span className="text-sm text-[#808080]">
              {currentChapterIdx + 1} / {allChapters.length} {t('reader.chapter')}
            </span>
            <button
              onClick={() => setCurrentChapterIdx((i) => Math.min(allChapters.length - 1, i + 1))}
              disabled={currentChapterIdx >= allChapters.length - 1}
              className="px-4 py-2 text-sm vercel-border rounded-md hover:bg-[#fafafa] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('reader.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
