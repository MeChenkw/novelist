import type { Novel } from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `请求失败 (${res.status})`);
  }
  return res.json();
}

export interface AiConfig {
  api_key?: string;
  base_url?: string;
  model?: string;
}

export interface Provider {
  id: string;
  name: string;
  base_url: string;
  models: string[];
  need_api_key?: boolean;
}

export const api = {
  // 获取模型提供商列表
  getProviders: () => request<Provider[]>('/providers'),

  // 测试 API 配置
  testApi: (config: AiConfig) =>
    request<{ success: boolean; error?: string; reply?: string }>('/test-api', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  // 创建新小说
  createNovel: (data: { category: string; user_idea: string; word_count: number }) =>
    request<{ novel_id: number }>('/novels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 生成大纲（携带 AI 配置）
  generateOutline: (novelId: number, aiConfig?: AiConfig) =>
    request<Novel>(`/novels/${novelId}/generate-outline`, {
      method: 'POST',
      body: JSON.stringify(aiConfig || {}),
    }),

  // 获取小说
  getNovel: (novelId: number) => request<Novel>(`/novels/${novelId}`),

  // 更新大纲
  updateOutline: (novelId: number, data: {
    novel_title: string;
    volumes: { title: string; desc: string; chapters: { title: string; outline: string }[] }[];
  }) =>
    request<Novel>(`/novels/${novelId}/outline`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // 确认大纲
  confirmOutline: (novelId: number) =>
    request<{ status: string }>(`/novels/${novelId}/confirm`, { method: 'PUT' }),

  // 生成小说（携带 AI 配置）
  generateNovel: (novelId: number, aiConfig?: AiConfig) =>
    request<{ message: string; progress: { generated: number; total: number } }>(
      `/novels/${novelId}/generate`,
      { method: 'POST', body: JSON.stringify(aiConfig || {}) }
    ),

  // 获取进度
  getProgress: (novelId: number) =>
    request<{ generated: number; total: number; status: string }>(`/novels/${novelId}/progress`),

  // 列出小说
  listNovels: () => request<Novel[]>('/novels'),

  // 删除小说
  deleteNovel: (novelId: number) =>
    request<{ message: string }>(`/novels/${novelId}`, { method: 'DELETE' }),

  // 获取章节内容
  getChapter: (novelId: number, chapterId: number) =>
    request<{ id: number; title: string; content: string | null }>(
      `/novels/${novelId}/chapters/${chapterId}`
    ),

  // AI 推荐创意选项
  suggestOptions: (data: { category: string; dimension_key: string; locale?: string; exclude?: string[] }) =>
    request<{ options: string[] }>('/suggest-options', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
