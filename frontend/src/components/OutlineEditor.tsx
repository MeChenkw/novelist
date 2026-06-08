import { useState } from 'react';
import type { Novel } from '../types';
import { t, getLocale } from '../i18n';

interface Props {
  novel: Novel;
  onSave: (novelTitle: string, volumes: { title: string; desc: string; chapters: { title: string; outline: string }[] }[]) => Promise<void>;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  onGenerate?: () => void;
  generating?: boolean;
}

export default function OutlineEditor({ novel, onSave, onConfirm, onBack, onGenerate, generating }: Props) {
  const locale = getLocale();
  const initiallyConfirmed = novel.status === 'confirmed' || novel.status === 'generating' || novel.status === 'done' || novel.status === 'interrupted';

  const [novelTitle, setNovelTitle] = useState(novel.title);
  const [volumes, setVolumes] = useState(
    novel.volumes.map((v) => ({
      title: v.title,
      desc: v.description,
      chapters: v.chapters.map((c) => ({ title: c.title, outline: c.outline })),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isEditing, setIsEditing] = useState(!initiallyConfirmed);
  const [isConfirmed, setIsConfirmed] = useState(initiallyConfirmed);

  const updateVolume = (vi: number, field: 'title' | 'desc', value: string) => {
    setVolumes((prev) => {
      const next = [...prev];
      next[vi] = { ...next[vi], [field]: value };
      return next;
    });
  };

  const updateChapter = (vi: number, ci: number, field: 'title' | 'outline', value: string) => {
    setVolumes((prev) => {
      const next = [...prev];
      const chapters = [...next[vi].chapters];
      chapters[ci] = { ...chapters[ci], [field]: value };
      next[vi] = { ...next[vi], chapters };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(novelTitle, volumes);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      setIsConfirmed(true);
      setIsEditing(false);
    } finally {
      setConfirming(false);
    }
  };

  const handleModify = () => {
    setIsEditing(true);
    setIsConfirmed(false);
  };

  const volLabel = locale === 'en' ? (n: number) => `Volume ${n}` : (n: number) => `第 ${n} 卷`;
  const chLabel = locale === 'en' ? (n: number) => `Ch. ${n}` : (n: number) => `第 ${n} 章`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-[#666] hover:text-[#171717] text-sm">
          {t('app.back')}
        </button>
        <div className="flex gap-2">
          {!isConfirmed && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm vercel-border rounded-md hover:bg-[#fafafa] disabled:opacity-50"
              >
                {saving ? t('outline.saving') : t('outline.save')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || !isEditing}
                className={`px-5 py-2 text-sm rounded-md text-white disabled:opacity-50 ${
                  isEditing
                    ? 'bg-[#171717] hover:bg-[#333]'
                    : 'bg-[#808080] cursor-not-allowed'
                }`}
              >
                {confirming ? t('outline.confirming') : t('outline.confirm')}
              </button>
            </>
          )}
          {isConfirmed && (novel.status as string) !== 'interrupted' && (
            <>
              <button
                onClick={handleModify}
                className="px-4 py-2 text-sm vercel-border rounded-md hover:bg-[#fafafa]"
              >
                {t('outline.modify')}
              </button>
              {(novel.status as string) === 'confirmed' && onGenerate && (
                <button
                  onClick={onGenerate}
                  disabled={generating}
                  className="px-4 py-2 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333] disabled:opacity-50"
                >
                  {generating ? t('outline.generating') : t('outline.generate')}
                </button>
              )}
            </>
          )}
          {(novel.status as string) === 'interrupted' && onGenerate && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333] disabled:opacity-50"
            >
              {generating ? t('outline.generating_resume_loading') : t('outline.generating_resume')}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[#4d4d4d] mb-1">{t('outline.novel_title')}</label>
        <input
          type="text"
          value={novelTitle}
          onChange={(e) => setNovelTitle(e.target.value)}
          readOnly={!isEditing}
          className={`w-full px-3 py-2 vercel-border rounded-md text-lg font-semibold focus:outline-2 focus:outline-[var(--color-focus)] ${
            isEditing
              ? 'bg-white'
              : 'border-transparent bg-[#fafafa] text-[#666] cursor-default'
          }`}
          placeholder={t('outline.novel_title_placeholder')}
        />
      </div>

      {volumes.map((vol, vi) => (
        <div key={vi} className="mb-8 vercel-border rounded-xl overflow-hidden">
          <div className="bg-[#fafafa] px-4 py-3 border-b border-[rgb(235,235,235)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-[#666]">{volLabel(vi + 1)}</span>
            </div>
            <input
              type="text"
              value={vol.title}
              onChange={(e) => updateVolume(vi, 'title', e.target.value)}
              readOnly={!isEditing}
              className={`w-full px-2 py-1 vercel-border rounded-md font-medium text-[#171717] focus:outline-2 focus:outline-[var(--color-focus)] ${
                isEditing ? '' : 'border-transparent bg-transparent cursor-default'
              }`}
              placeholder={locale === 'en' ? 'Volume title...' : '卷名...'}
            />
            <textarea
              value={vol.desc}
              onChange={(e) => updateVolume(vi, 'desc', e.target.value)}
              readOnly={!isEditing}
              className={`w-full mt-2 px-2 py-1 vercel-border rounded-md text-sm text-[#666] focus:outline-2 focus:outline-[var(--color-focus)] ${
                isEditing ? '' : 'border-transparent bg-transparent cursor-default resize-none'
              }`}
              placeholder={locale === 'en' ? 'Volume description...' : '卷简介...'}
              rows={isEditing ? 2 : 1}
            />
          </div>
          <div className="divide-y divide-[rgb(235,235,235)]">
            {vol.chapters.map((ch, ci) => (
              <div key={ci} className="px-4 py-3 hover:bg-[#fafafa]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#808080] mb-1">{chLabel(ci + 1)} {t('outline.chapter_title')}</label>
                    <input
                      type="text"
                      value={ch.title}
                      onChange={(e) => updateChapter(vi, ci, 'title', e.target.value)}
                      readOnly={!isEditing}
                      className={`w-full px-2 py-1 vercel-border rounded-md text-sm focus:outline-2 focus:outline-[var(--color-focus)] ${
                        isEditing ? '' : 'border-transparent bg-transparent cursor-default'
                      }`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#808080] mb-1">{t('outline.chapter_outline')}</label>
                    <input
                      type="text"
                      value={ch.outline}
                      onChange={(e) => updateChapter(vi, ci, 'outline', e.target.value)}
                      readOnly={!isEditing}
                      className={`w-full px-2 py-1 vercel-border rounded-md text-sm focus:outline-2 focus:outline-[var(--color-focus)] ${
                        isEditing ? '' : 'border-transparent bg-transparent cursor-default'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {isEditing && (
        <div className="text-xs text-[#808080] mt-4 text-center">{t('outline.hint_editing')}</div>
      )}
      {isConfirmed && !isEditing && (
        <div className="text-xs text-[#808080] mt-4 text-center">{t('outline.hint_readonly')}</div>
      )}
    </div>
  );
}
