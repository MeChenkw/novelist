export interface Chapter {
  id: number;
  volume_id: number;
  order: number;
  title: string;
  outline: string;
  content: string | null;
}

export interface Volume {
  id: number;
  novel_id: number;
  order: number;
  title: string;
  description: string;
  chapters: Chapter[];
}

export interface Novel {
  id: number;
  title: string;
  category: string;
  user_idea: string;
  word_count: number;
  status: 'draft' | 'confirmed' | 'generating' | 'done';
  created_at: string;
  updated_at: string;
  volumes: Volume[];
}

export interface OutlineData {
  novel_title: string;
  volumes: {
    title: string;
    desc: string;
    chapters: { title: string; outline: string }[];
  }[];
}

export type Page = 'create' | 'outline' | 'reading' | 'list';
export type Category =
  | '玄幻'
  | '奇幻'
  | '都市'
  | '历史'
  | '科幻'
  | '悬疑'
  | '言情'
  | '武侠';
