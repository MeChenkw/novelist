import { useState, useEffect } from 'react';
import { api, type Provider } from '../api';
import { t, getLocale } from '../i18n';

interface Props {
  onBack: () => void;
}

const STORAGE_KEY = 'novelist_ai_config';

export interface SavedAiConfig {
  providerId: string;
  api_key: string;
  base_url: string;
  model: string;
}

const QUICK_OPTIONS = [
  { labelKey: 'Ollama 本地', labelEn: 'Ollama (Local)', providerId: 'ollama', model: 'llama3' },
  { labelKey: 'DeepSeek', providerId: 'deepseek', model: 'deepseek-chat' },
  { labelKey: '硅基流动', labelEn: 'SiliconFlow', providerId: 'siliconflow', model: 'deepseek-ai/DeepSeek-V3' },
];

export function loadAiConfig(): SavedAiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ModelSettings({ onBack }: Props) {
  const locale = getLocale();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [model, setModel] = useState('deepseek-chat');
  const [customModels, setCustomModels] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const saved = loadAiConfig();
    if (saved) {
      setProviderId(saved.providerId);
      setApiKey(saved.api_key);
      setBaseUrl(saved.base_url);
      setModel(saved.model);
    }
    api.getProviders().then(setProviders).catch(() => {});
  }, []);

  const currentProvider = providers.find((p) => p.id === providerId);

  const handleProviderChange = (pid: string) => {
    setProviderId(pid);
    setTestResult(null);
    const p = providers.find((x) => x.id === pid);
    if (p && p.id !== 'custom') {
      setBaseUrl(p.base_url);
      if (p.models.length > 0) setModel(p.models[0]);
      if (p.need_api_key === false) setApiKey('');
    }
  };

  const handleQuickSelect = (opt: typeof QUICK_OPTIONS[0]) => {
    setProviderId(opt.providerId);
    const p = providers.find((x) => x.id === opt.providerId);
    if (p) {
      setBaseUrl(p.base_url);
      setModel(opt.model);
      if (p.need_api_key === false) setApiKey('');
    }
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testApi({
        api_key: apiKey,
        base_url: baseUrl,
        model: model || undefined,
      });
      setTestResult({
        ok: res.success,
        msg: res.success
          ? `${t('settings.test_success')} ${res.reply}`
          : `${t('settings.test_fail')} ${res.error}`,
      });
    } catch (e: any) {
      setTestResult({ ok: false, msg: `${t('settings.test_fail')} ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const config: SavedAiConfig = { providerId, api_key: apiKey, base_url: baseUrl, model };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    onBack();
  };

  const currentModels = currentProvider?.id === 'custom'
    ? customModels.split(',').map((s) => s.trim()).filter(Boolean)
    : (currentProvider?.models || []);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="text-[#666] hover:text-[#4d4d4d] mr-4 text-sm">
            {t('app.back')}
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        </div>

        {/* 快速选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#666] mb-2">{t('settings.quick')}</label>
          <div className="flex flex-wrap gap-2">
            {QUICK_OPTIONS.map((opt) => (
              <button
                key={opt.providerId + opt.model}
                onClick={() => handleQuickSelect(opt)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  providerId === opt.providerId && model === opt.model
                    ? 'bg-[#171717] text-white vercel-border'
                    : 'bg-white text-[#666] vercel-border hover:border-[#0072f5]'
                }`}
              >
                {locale === 'en' && opt.labelEn ? opt.labelEn : opt.labelKey}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white vercel-card rounded-xl p-6 space-y-5">
          {/* 提供商选择 */}
          <div>
            <label className="block text-sm font-medium text-[#4d4d4d] mb-2">{t('settings.provider')}</label>
            <select
              value={providerId}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 vercel-border rounded-md text-sm focus:outline-2 focus:outline-[var(--color-focus)]"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* API Key */}
          {currentProvider?.need_api_key !== false && (
            <div>
              <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
                {t('settings.api_key')}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={locale === 'en' ? 'Enter your API Key...' : 'sk-...'}
                className="w-full px-3 py-2 vercel-border rounded-md text-sm font-mono focus:outline-2 focus:outline-[var(--color-focus)]"
              />
              <p className="text-xs text-[#808080] mt-1">
                {currentProvider?.id === 'ollama'
                  ? t('settings.api_key_hint_ollama')
                  : t('settings.api_key_hint')}
              </p>
            </div>
          )}

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-[#4d4d4d] mb-1">
              {t('settings.base_url')}
              {currentProvider?.id === 'custom' && <span className="text-red-500"> *</span>}
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="w-full px-3 py-2 vercel-border rounded-md text-sm font-mono focus:outline-2 focus:outline-[var(--color-focus)]"
            />
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium text-[#4d4d4d] mb-1">{t('settings.model_name')}</label>
            {currentProvider?.id === 'custom' ? (
              <input
                type="text"
                value={customModels}
                onChange={(e) => {
                  setCustomModels(e.target.value);
                  setModel(e.target.value.split(',')[0]?.trim() || '');
                }}
                placeholder={t('settings.custom_model')}
                className="w-full px-3 py-2 vercel-border rounded-md text-sm font-mono focus:outline-2 focus:outline-[var(--color-focus)]"
              />
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 vercel-border rounded-md text-sm focus:outline-2 focus:outline-[var(--color-focus)]"
              >
                {currentModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 text-sm vercel-border rounded-md hover:bg-[#fafafa] disabled:opacity-50"
            >
              {testing ? t('settings.testing') : t('settings.test')}
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333]"
            >
              {t('settings.save')}
            </button>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`p-3 rounded-md text-sm ${
              testResult.ok ? 'bg-[#ecfdf5] text-[#047857] vercel-border' :
              'bg-red-50 text-red-700 vercel-border'
            }`}>
              {testResult.msg}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-[#808080] text-center">
          {t('settings.privacy')}
        </div>
      </div>
    </div>
  );
}
