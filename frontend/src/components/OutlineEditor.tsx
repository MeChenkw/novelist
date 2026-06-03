import { useState } from 'react';
import type { Novel } from '../types';

interface Props {
  novel: Novel;
  onSave: (novelTitle: string, volumes: { title: string; desc: string; chapters: { title: string; outline: string }[] }[]) => Promise<void>;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

export default function OutlineEditor({ novel, onSave, onConfirm, onBack }: Props) {
  // 初始是否为已确认状态
  const initiallyConfirmed = novel.status === 'confirmed' || novel.status === 'generating' || novel.status === 'done';

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

  return (
    <div className="max-w-4xl mx-auto">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 text-sm">
          ← 返回
        </button>
        <div className="flex gap-2">
          {/* 未确认时：保存 + 确认按钮 */}
          {!isConfirmed && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? '保存中...' : '💾 保存大纲'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || !isEditing}
                className={`px-5 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
                  isEditing
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {confirming ? '确认中...' : '✅ 确认大纲'}
              </button>
            </>
          )}
          {/* 已确认时：修改按钮 */}
          {isConfirmed && (
            <button
              onClick={handleModify}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ✏️ 修改大纲
            </button>
          )}
        </div>
      </div>

      {/* 小说名 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">小说名</label>
        <input
          type="text"
          value={novelTitle}
          onChange={(e) => setNovelTitle(e.target.value)}
          readOnly={!isEditing}
          className={`w-full px-3 py-2 border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isEditing
              ? 'border-gray-300 bg-white'
              : 'border-transparent bg-gray-50 text-gray-500 cursor-default'
          }`}
          placeholder="输入小说名..."
        />
      </div>

      {/* 分卷和章节 */}
      {volumes.map((vol, vi) => (
        <div key={vi} className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-gray-500">第 {vi + 1} 卷</span>
            </div>
            <input
              type="text"
              value={vol.title}
              onChange={(e) => updateVolume(vi, 'title', e.target.value)}
              readOnly={!isEditing}
              className={`w-full px-2 py-1 border rounded font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isEditing
                  ? 'border-gray-200'
                  : 'border-transparent bg-transparent cursor-default'
              }`}
              placeholder="卷名..."
            />
            <textarea
              value={vol.desc}
              onChange={(e) => updateVolume(vi, 'desc', e.target.value)}
              readOnly={!isEditing}
              className={`w-full mt-2 px-2 py-1 border rounded text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isEditing
                  ? 'border-gray-200'
                  : 'border-transparent bg-transparent cursor-default resize-none'
              }`}
              placeholder="卷简介..."
              rows={isEditing ? 2 : 1}
            />
          </div>
          <div className="divide-y divide-gray-100">
            {vol.chapters.map((ch, ci) => (
              <div key={ci} className="px-4 py-3 hover:bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">第 {ci + 1} 章 标题</label>
                    <input
                      type="text"
                      value={ch.title}
                      onChange={(e) => updateChapter(vi, ci, 'title', e.target.value)}
                      readOnly={!isEditing}
                      className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isEditing
                          ? 'border-gray-200'
                          : 'border-transparent bg-transparent cursor-default'
                      }`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">内容简介</label>
                    <input
                      type="text"
                      value={ch.outline}
                      onChange={(e) => updateChapter(vi, ci, 'outline', e.target.value)}
                      readOnly={!isEditing}
                      className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isEditing
                          ? 'border-gray-200'
                          : 'border-transparent bg-transparent cursor-default'
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
        <div className="text-xs text-gray-400 mt-4 text-center">
          你可以自由编辑小说名、卷名、卷简介、章标题和内容简介
        </div>
      )}
      {isConfirmed && !isEditing && (
        <div className="text-xs text-gray-400 mt-4 text-center">
          大纲已确认，只读模式。点击"✏️ 修改大纲"可重新编辑
        </div>
      )}
    </div>
  );
}
