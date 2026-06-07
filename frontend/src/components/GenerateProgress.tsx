import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { t } from '../i18n';

interface Props {
  novelId: number;
  onDone: () => void;
  onResume: () => void;
  resuming?: boolean;
}

export default function GenerateProgress({ novelId, onDone, onResume, resuming }: Props) {
  const [progress, setProgress] = useState<{ generated: number; total: number; status: string } | null>(null);
  const [staleCount, setStaleCount] = useState(0);
  const [lastGenerated, setLastGenerated] = useState(-1);

  // 用 useCallback 稳定引用
  const checkProgress = useCallback(async () => {
    try {
      const p: { generated: number; total: number; status: string } = await api.getProgress(novelId);
      setProgress(p);

      // 检测进度是否卡住（连续 3 次轮询 generated 没变）
      if (p.generated === lastGenerated) {
        setStaleCount((c) => c + 1);
      } else {
        setStaleCount(0);
        setLastGenerated(p.generated);
      }

      if (p.status === 'done') {
        onDone();
        return 'done';
      }

      if (p.status === 'generating' && staleCount >= 3) {
        // 卡住了，停止轮询，显示"继续生成"按钮
        return 'stale';
      }

      return 'polling';
    } catch {
      return 'polling';
    }
  }, [novelId, onDone, lastGenerated, staleCount]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;
      const result = await checkProgress();
      if (cancelled || result === 'done' || result === 'stale') return;
      timer = setTimeout(poll, 3000);
    };

    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [checkProgress]);

  if (resuming) {
    // 正在重新发起生成
    return (
      <div className="text-sm text-orange-700">
        <p>{t('outline.generating_hint')}</p>
        <p className="text-xs mt-1 text-orange-500">{t('outline.generating_resume_loading')}</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-sm text-orange-700">
        <p>{t('outline.generating_hint')}</p>
        <p className="text-xs mt-1 text-orange-500">{t('loading')}</p>
      </div>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.generated / progress.total) * 100) : 0;
  const isStale = staleCount >= 3 && progress.status === 'generating';

  return (
    <div>
      <p className="text-sm text-orange-700 mb-2">
        {isStale ? t('outline.generating_stale_hint') : t('outline.generating_hint')}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs bg-orange-200 rounded-full h-2.5">
          <div
            className="bg-orange-500 h-2.5 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-orange-600">
          {progress.generated}/{progress.total}
        </span>
        {isStale && (
          <button
            onClick={onResume}
            disabled={resuming}
            className="px-3 py-1 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {t('outline.generating_resume')}
          </button>
        )}
      </div>
    </div>
  );
}
