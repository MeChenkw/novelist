"""
小说家 - 后端 API 服务
使用 Flask + SQLAlchemy + DeepSeek AI 驱动的小说大纲与章节生成
"""

import os
import json
from datetime import datetime
from pathlib import Path

from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from openai import OpenAI

# 加载 .env 文件中的环境变量
load_dotenv()

# ---------------------------------------------------------------------------
# Flask 应用初始化
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)  # 允许所有来源的跨域请求

# SQLite 数据库配置
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///novelist.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# AI 客户端初始化（支持动态参数）
# ---------------------------------------------------------------------------
DEFAULT_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
DEFAULT_URL = 'https://api.deepseek.com/v1'
DEFAULT_MODEL = 'deepseek-chat'

def create_ai_client(api_key: str = '', base_url: str = '') -> OpenAI:
    key = api_key or DEFAULT_KEY
    if not key:
        raise RuntimeError('缺少 API Key，请在「模型设置」中配置')
    url = (base_url or DEFAULT_URL).strip()
    if not url.startswith('http://') and not url.startswith('https://'):
        url = DEFAULT_URL
    return OpenAI(api_key=key, base_url=url)

PRESET_PROVIDERS = [
    {'id': 'deepseek', 'name': 'DeepSeek', 'base_url': 'https://api.deepseek.com/v1', 'models': ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash'], 'default_model': 'deepseek-chat'},
    {'id': 'openai', 'name': 'OpenAI', 'base_url': 'https://api.openai.com/v1', 'models': ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], 'default_model': 'gpt-4o-mini'},
    {'id': 'siliconflow', 'name': '硅基流动', 'base_url': 'https://api.siliconflow.cn/v1', 'models': ['deepseek-llm/deepseek-chat', 'Qwen/Qwen2.5-7B-Instruct'], 'default_model': 'deepseek-llm/deepseek-chat'},
    {'id': 'ollama', 'name': 'Ollama (本地)', 'base_url': 'http://localhost:11434/v1', 'models': ['llama3', 'qwen2.5', 'mistral'], 'default_model': 'llama3'},
    {'id': 'custom', 'name': '自定义', 'base_url': '', 'models': [], 'default_model': ''},
]


# ===========================================================================
# 1. 数据模型 (SQLAlchemy)
# ===========================================================================

class Novel(db.Model):
    """小说主表"""
    __tablename__ = 'novels'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), default='', nullable=False)          # 小说名
    category = db.Column(db.String(100), default='', nullable=False)       # 分类
    user_idea = db.Column(db.Text, default='', nullable=False)             # 用户创意
    word_count = db.Column(db.Integer, default=0, nullable=False)          # 字数目标
    status = db.Column(
        db.String(20),
        default='draft',
        nullable=False,
    )  # draft | confirmed | generating | done
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联关系
    volumes = db.relationship(
        'Volume', backref='novel', lazy='joined',
        order_by='Volume.order',
        cascade='all, delete-orphan',
    )

    def to_dict(self, include_volumes=False):
        """序列化为字典"""
        data = {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'user_idea': self.user_idea,
            'word_count': self.word_count,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_volumes:
            data['volumes'] = [v.to_dict(include_chapters=True) for v in self.volumes]
        return data


class Volume(db.Model):
    """卷表"""
    __tablename__ = 'volumes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    novel_id = db.Column(db.Integer, db.ForeignKey('novels.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)     # 卷序号
    title = db.Column(db.String(200), default='', nullable=False)   # 卷名
    description = db.Column(db.Text, default='', nullable=False)    # 卷简介

    # 关联关系
    chapters = db.relationship(
        'Chapter', backref='volume', lazy='joined',
        order_by='Chapter.order',
        cascade='all, delete-orphan',
    )

    def to_dict(self, include_chapters=False):
        data = {
            'id': self.id,
            'novel_id': self.novel_id,
            'order': self.order,
            'title': self.title,
            'description': self.description,
        }
        if include_chapters:
            data['chapters'] = [c.to_dict() for c in self.chapters]
        return data


class Chapter(db.Model):
    """章节表"""
    __tablename__ = 'chapters'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    volume_id = db.Column(db.Integer, db.ForeignKey('volumes.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)     # 章节序号
    title = db.Column(db.String(200), default='', nullable=False)   # 章名
    outline = db.Column(db.Text, default='', nullable=False)        # 章大纲
    content = db.Column(db.Text, default='', nullable=True)         # 章内容（可为空）

    def to_dict(self):
        return {
            'id': self.id,
            'volume_id': self.volume_id,
            'order': self.order,
            'title': self.title,
            'outline': self.outline,
            'content': self.content,
        }


# ===========================================================================
# 2. DeepSeek AI 调用函数
# ===========================================================================

def generate_outline(category: str, idea: str, word_count: int,
                     api_key: str = '', base_url: str = '', model: str = '',
                     locale: str = 'zh') -> dict:
    """
    调用 AI 生成小说大纲。
    返回 JSON: { novel_title, volumes: [{ title, desc, chapters: [{ title, outline }] }] }
    """
    lang_suffix = 'Please create the novel outline in English.' if locale == 'en' else '请用中文创作小说大纲。'
    system_prompt = (
        "你是一个专业小说大纲策划师。根据用户提供的小说分类、创意和字数目标，"
        "生成小说名、分卷 (3-6卷) 和各卷章节大纲 (每卷5-12章)。"
        "每个章节包含标题和50字左右的内容简介。以JSON格式返回。"
        "JSON格式: {\"novel_title\": \"小说名\", \"volumes\": [{\"title\": \"卷名\", \"desc\": \"卷简介\", \"chapters\": [{\"title\": \"章标题\", \"outline\": \"章内容简介\"}]}]}"
        f"\n\n{lang_suffix}"
    )

    user_prompt = (
        f"小说分类：{category}\n"
        f"用户创意：{idea}\n"
        f"字数目标：{word_count}字\n"
        "请生成完整的小说大纲，严格按照JSON格式返回。"
    )

    client = create_ai_client(api_key, base_url)
    response = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        temperature=0.8,
        max_tokens=4096,
    )

    content = response.choices[0].message.content

    # 尝试从 AI 返回内容中提取 JSON
    # 处理模型可能用 ```json ... ``` 包裹的情况
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()

    result = json.loads(content)
    return result


def generate_chapter(novel_id: int, volume_id: int, chapter_id: int,
                     api_key: str = '', base_url: str = '', model: str = '',
                     locale: str = 'zh') -> str:
    """
    调用 AI 生成指定章节的完整内容。
    读取该章节的 outline，以及前面所有已写完章节的 title+前200字content。
    返回生成的章节正文（约 2000-5000 字）。
    """
    lang_suffix = 'Please write the novel chapter in English.' if locale == 'en' else '请用中文创作小说正文。'
    # 获取当前章节信息
    chapter = db.session.get(Chapter, chapter_id)
    if not chapter:
        raise ValueError(f'章节 {chapter_id} 不存在')

    volume = db.session.get(Volume, volume_id)
    novel = db.session.get(Novel, novel_id)

    # 收集已写完章节的 context（同级 volume 中 order 小于当前章节的）
    previous_chapters = (
        Chapter.query
        .filter(Chapter.volume_id == volume_id, Chapter.order < chapter.order, Chapter.content.isnot(None), Chapter.content != '')
        .order_by(Chapter.order)
        .all()
    )

    # 构建已有章节摘要
    previous_content_summary = ''
    if previous_chapters:
        parts = []
        for pc in previous_chapters:
            preview = pc.content[:200] if pc.content and len(pc.content) > 200 else (pc.content or '')
            parts.append(f"【{pc.title}】\n{preview}")
        previous_content_summary = '\n\n'.join(parts)

    # 构建完整的小说结构概述
    novel_structure = f"小说名：{novel.title}\n"
    novel_structure += f"分类：{novel.category}\n"
    novel_structure += f"字数目标：{novel.word_count}字\n\n"

    for v in novel.volumes:
        novel_structure += f"【{v.order}. {v.title}】{v.description}\n"
        for ch in v.chapters:
            marker = ' ✓ 已写完' if ch.content and ch.order < chapter.order and ch.volume_id == volume_id else ''
            novel_structure += f"  第{ch.order}章 {ch.title}：{ch.outline}{marker}\n"

    system_prompt = (
        "你是一个专业小说家。请根据以下小说大纲和已写章节，创作本章的完整内容。"
        "保持人物性格、情节线索、文风的一致性。"
        "仅输出章节正文，不要输出章节标题或其他额外说明。"
        f"\n\n{lang_suffix}"
    )

    user_prompt = (
        f"=== 小说结构 ===\n{novel_structure}\n\n"
        f"=== 当前要写的章节 ===\n"
        f"卷：{volume.title}\n"
        f"第{chapter.order}章：{chapter.title}\n"
        f"本章大纲：{chapter.outline}\n\n"
    )

    if previous_content_summary:
        user_prompt += f"=== 已写章节摘要（前200字） ===\n{previous_content_summary}\n\n"

    user_prompt += "请写出本章完整内容（2000-5000字），仅输出正文："

    client = create_ai_client(api_key, base_url)
    response = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        temperature=0.9,
        max_tokens=8192,
    )

    content = response.choices[0].message.content
    return content


# ===========================================================================
# 3. API 路由
# ===========================================================================

# -- 创建新小说 -----------------------------------------------------------

@app.route('/api/novels', methods=['POST'])
def create_novel():
    """
    POST /api/novels
    创建新小说。请求体: { category, user_idea, word_count }
    返回: { novel_id }
    """
    data = request.get_json(force=True)
    category = data.get('category', '')
    user_idea = data.get('user_idea', '')
    word_count = data.get('word_count', 0)

    novel = Novel(
        title='',
        category=category,
        user_idea=user_idea,
        word_count=word_count,
        status='draft',
    )
    db.session.add(novel)
    db.session.commit()

    return jsonify({'novel_id': novel.id}), 201


# -- 生成大纲 -------------------------------------------------------------

@app.route('/api/novels/<int:novel_id>/generate-outline', methods=['POST'])
def generate_outline_api(novel_id: int):
    """
    POST /api/novels/<id>/generate-outline
    调用 AI 生成大纲，保存到数据库，返回完整大纲 JSON。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    data = request.get_json(force=True) or {}
    api_key = data.get('api_key', '')
    base_url = data.get('base_url', '')
    model = data.get('model', '')
    locale = data.get('locale', 'zh')

    try:
        result = generate_outline(novel.category, novel.user_idea, novel.word_count,
                                  api_key, base_url, model, locale)
    except Exception as e:
        return jsonify({'error': f'AI 调用失败: {str(e)}'}), 500

    # 保存小说标题
    novel.title = result.get('novel_title', '')

    # 删除旧的大纲数据（如果有）
    Volume.query.filter_by(novel_id=novel_id).delete()

    # 保存新大纲
    for v_idx, vol_data in enumerate(result.get('volumes', []), start=1):
        volume = Volume(
            novel_id=novel_id,
            order=v_idx,
            title=vol_data.get('title', ''),
            description=vol_data.get('desc', ''),
        )
        db.session.add(volume)
        db.session.flush()  # 获取 volume.id

        for ch_idx, ch_data in enumerate(vol_data.get('chapters', []), start=1):
            chapter = Chapter(
                volume_id=volume.id,
                order=ch_idx,
                title=ch_data.get('title', ''),
                outline=ch_data.get('outline', ''),
                content='',
            )
            db.session.add(chapter)

    db.session.commit()

    # 返回完整大纲
    return jsonify(novel.to_dict(include_volumes=True)), 200


# -- 获取小说完整信息 ----------------------------------------------------

@app.route('/api/novels/<int:novel_id>', methods=['GET'])
def get_novel(novel_id: int):
    """
    GET /api/novels/<id>
    获取小说完整信息（包含分卷和章节）。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    return jsonify(novel.to_dict(include_volumes=True)), 200


# -- 确认大纲 -------------------------------------------------------------

@app.route('/api/novels/<int:novel_id>/confirm', methods=['PUT'])
def confirm_novel(novel_id: int):
    """
    PUT /api/novels/<id>/confirm
    将 novel 状态改为 'confirmed'。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    novel.status = 'confirmed'
    db.session.commit()

    return jsonify({'status': 'confirmed'}), 200


# -- 更新大纲（用户编辑后保存）-------------------------------------------

@app.route('/api/novels/<int:novel_id>/outline', methods=['PUT'])
def update_outline(novel_id: int):
    """
    PUT /api/novels/<id>/outline
    更新大纲。请求体为完整的大纲 JSON，格式同 generate-outline 返回格式。
    允许用户修改卷名、章名、简介等。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    data = request.get_json(force=True)

    # 更新小说标题
    if 'novel_title' in data:
        novel.title = data['novel_title']

    # 删除旧的 volume + chapter 数据
    Volume.query.filter_by(novel_id=novel_id).delete()

    # 保存新数据
    for v_idx, vol_data in enumerate(data.get('volumes', []), start=1):
        volume = Volume(
            novel_id=novel_id,
            order=v_idx,
            title=vol_data.get('title', ''),
            description=vol_data.get('desc', ''),
        )
        db.session.add(volume)
        db.session.flush()

        for ch_idx, ch_data in enumerate(vol_data.get('chapters', []), start=1):
            chapter = Chapter(
                volume_id=volume.id,
                order=ch_idx,
                title=ch_data.get('title', ''),
                outline=ch_data.get('outline', ''),
                content=ch_data.get('content', ''),
            )
            db.session.add(chapter)

    novel.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(novel.to_dict(include_volumes=True)), 200


# -- 开始逐章生成小说 ----------------------------------------------------

@app.route('/api/novels/<int:novel_id>/generate', methods=['POST'])
def generate_novel(novel_id: int):
    """
    POST /api/novels/<id>/generate
    逐章生成小说内容（同步实现）。
    遍历所有 content 为空的章节，逐章调用 generate_chapter 并保存。
    返回生成进度 JSON。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    if novel.status not in ('confirmed', 'generating', 'interrupted'):
        return jsonify({'error': '小说状态不允许生成，请先确认大纲'}), 400

    total_chapters = Chapter.query.join(Volume).filter(
        Volume.novel_id == novel_id,
    ).count()

    # 找出所有 content 为空的章节，按卷顺序、章顺序排列
    empty_chapters = (
        Chapter.query.join(Volume)
        .filter(Volume.novel_id == novel_id, (Chapter.content == None) | (Chapter.content == ''))
        .order_by(Volume.order, Chapter.order)
        .all()
    )

    novel.status = 'generating'
    db.session.commit()

    # 从请求中读取 AI 配置（前端传入的 locale/api_key 等）
    data = request.get_json(force=True) or {}
    gen_api_key = data.get('api_key', '')
    gen_base_url = data.get('base_url', '')
    gen_model = data.get('model', '')
    gen_locale = data.get('locale', 'zh')

    generated_count = total_chapters - len(empty_chapters)

    for ch in empty_chapters:
        try:
            content = generate_chapter(novel_id, ch.volume_id, ch.id,
                                       gen_api_key, gen_base_url, gen_model, gen_locale)
            ch.content = content
            db.session.commit()
            generated_count += 1
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'error': f'生成第{ch.order}章时出错: {str(e)}',
                'progress': {
                    'generated': generated_count,
                    'total': total_chapters,
                },
            }), 500

    novel.status = 'done'
    db.session.commit()

    return jsonify({
        'message': '全部章节生成完成',
        'progress': {
            'generated': generated_count,
            'total': total_chapters,
        },
    }), 200


# -- 获取生成进度 ---------------------------------------------------------

# 创意要素维度提示词映射（用于 AI 生成推荐选项）
DIMENSION_PROMPTS = {
    'protagonist': ('主角设定', 'Protagonist'),
    'world': ('世界观', 'World Setting'),
    'conflict': ('核心冲突', 'Core Conflict'),
    'style': ('风格基调', 'Style & Tone'),
    'advantage': ('主角优势', "Protagonist's Advantage"),
}


@app.route('/api/providers', methods=['GET'])
def get_providers():
    """返回预设的模型提供商列表"""
    return jsonify(PRESET_PROVIDERS), 200


@app.route('/api/test-api', methods=['POST'])
def test_api():
    """测试 AI API 配置是否有效"""
    data = request.get_json(force=True)
    api_key = data.get('api_key', '')
    base_url = data.get('base_url', '')
    model = data.get('model', '')

    if not api_key and not DEFAULT_KEY:
        return jsonify({'success': False, 'error': '请输入 API Key'}), 400

    try:
        client = create_ai_client(api_key, base_url)
        response = client.chat.completions.create(
            model=model or DEFAULT_MODEL,
            messages=[{'role': 'user', 'content': '回复 OK'}],
            max_tokens=10,
            temperature=0,
        )
        reply = response.choices[0].message.content
        return jsonify({'success': True, 'reply': reply}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 200


@app.route('/api/suggest-options', methods=['POST'])
def suggest_options():
    """
    POST /api/suggest-options
    根据小说分类和维度，由 AI 推荐创意选项。
    请求体: { category, dimension_key, locale, exclude?, api_key?, base_url?, model? }
    """
    data = request.get_json(force=True)
    category = data.get('category', '')
    dim_key = data.get('dimension_key', '')
    locale = data.get('locale', 'zh')
    exclude = data.get('exclude', [])

    dim_info = DIMENSION_PROMPTS.get(dim_key)
    if not dim_info:
        return jsonify({'error': '无效的维度'}), 400

    label_zh, label_en = dim_info
    label = label_zh if locale == 'zh' else label_en
    lang = '请用中文回答。' if locale == 'zh' else 'Please respond in English.'

    exclude_hint = ''
    if exclude:
        exclude_hint = f'\n不要包含以下选项：{", ".join(exclude)}'

    system_prompt = (
        f"你是一个小说创作顾问。根据小说分类为「{category}」和创意维度「{label}」，"
        f"推荐 10 个贴合该分类特色的选项。每个选项控制在 10 个字以内。"
        f"必须返回 10 个选项，不要少于 10 个。"
        f"仅返回 JSON 数组。{exclude_hint}\n{lang}"
    )
    user_prompt = (
        f"小说分类：{category}\n维度：{label}\n"
        f"请列出 10 个选项，每行一个编号：\n"
        f"1.\n2.\n3.\n4.\n5.\n6.\n7.\n8.\n9.\n10.\n"
        f"然后用 JSON 数组格式返回这 10 个选项。"
    )

    api_key = data.get('api_key', '') or DEFAULT_KEY
    base_url = data.get('base_url', '')
    model = data.get('model', '')

    try:
        client = create_ai_client(api_key, base_url)
        response = client.chat.completions.create(
            model=model or DEFAULT_MODEL,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
            temperature=0.9,
            max_tokens=2048,
        )
        content = response.choices[0].message.content
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        options = json.loads(content)
        if not isinstance(options, list):
            options = []
        # DeepSeek 习惯只返回 5 个，再调一次凑足 10 个
        if len(options) < 10:
            try:
                existing = ', '.join(options)
                more = client.chat.completions.create(
                    model=model or DEFAULT_MODEL,
                    messages=[
                        {'role': 'system', 'content': f'你是一个小说创作顾问。根据小说分类「{category}」和维度「{label}」，推荐 5 个不同的选项。不要和以下选项重复：{existing}。仅返回 JSON 数组。{lang}'},
                        {'role': 'user', 'content': f'推荐 5 个和现有不重复的选项。仅返回 JSON 数组。'},
                    ],
                    temperature=0.9,
                    max_tokens=512,
                )
                extra = json.loads(more.choices[0].message.content)
                if isinstance(extra, list):
                    for x in extra:
                        if x not in options and len(options) < 10:
                            options.append(x)
            except Exception:
                pass
        return jsonify({'options': options[:10]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/novels/<int:novel_id>/progress', methods=['GET'])
def get_progress(novel_id: int):
    """
    GET /api/novels/<id>/progress
    获取生成进度（已生成章数 / 总章数）。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    total_chapters = Chapter.query.join(Volume).filter(
        Volume.novel_id == novel_id,
    ).count()

    completed_chapters = Chapter.query.join(Volume).filter(
        Volume.novel_id == novel_id,
        Chapter.content.isnot(None),
        Chapter.content != '',
    ).count()

    return jsonify({
        'novel_id': novel_id,
        'status': novel.status,
        'generated': completed_chapters,
        'total': total_chapters,
    }), 200


# -- 下载完整小说 TXT -----------------------------------------------------

@app.route('/api/novels/<int:novel_id>/download', methods=['GET'])
def download_novel(novel_id: int):
    """
    GET /api/novels/<id>/download
    下载完整小说（TXT 格式，分卷分章排列）。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    lines = []
    lines.append(f"{'=' * 60}")
    lines.append(f"  {novel.title}")
    lines.append(f"  分类：{novel.category}  |  字数目标：{novel.word_count}字")
    lines.append(f"{'=' * 60}")
    lines.append('')

    for vol in novel.volumes:
        lines.append(f"{'─' * 50}")
        lines.append(f"  第{vol.order}卷  {vol.title}")
        lines.append(f"  {vol.description}")
        lines.append(f"{'─' * 50}")
        lines.append('')

        for ch in vol.chapters:
            lines.append(f"  第{ch.order}章  {ch.title}")
            lines.append('')
            if ch.content:
                lines.append(ch.content)
            else:
                lines.append('  （暂未生成）')
            lines.append('')

    text_content = '\n'.join(lines)

    return Response(
        text_content,
        mimetype='text/plain; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{novel.title}.txt"',
        },
    )


# -- 列出所有小说 ---------------------------------------------------------

@app.route('/api/novels', methods=['GET'])
def list_novels():
    """
    GET /api/novels
    列出所有小说（不含分卷和章节详情）。
    """
    novels = Novel.query.order_by(Novel.updated_at.desc()).all()
    return jsonify([n.to_dict(include_volumes=False) for n in novels]), 200


# -- 删除小说 -------------------------------------------------------------

@app.route('/api/novels/<int:novel_id>', methods=['DELETE'])
def delete_novel(novel_id: int):
    """
    DELETE /api/novels/<id>
    删除小说及其关联的所有分卷和章节。
    """
    novel = db.session.get(Novel, novel_id)
    if not novel:
        return jsonify({'error': '小说不存在'}), 404

    db.session.delete(novel)
    db.session.commit()

    return jsonify({'message': '删除成功'}), 200


# -- 获取单章内容 ---------------------------------------------------------

@app.route('/api/novels/<int:novel_id>/chapters/<int:chapter_id>', methods=['GET'])
def get_chapter(novel_id: int, chapter_id: int):
    """
    GET /api/novels/<id>/chapters/<chapter_id>
    获取单章内容。校验章节属于该小说。
    """
    chapter = db.session.get(Chapter, chapter_id)
    if not chapter:
        return jsonify({'error': '章节不存在'}), 404

    # 校验该章节属于指定小说
    volume = db.session.get(Volume, chapter.volume_id)
    if not volume or volume.novel_id != novel_id:
        return jsonify({'error': '章节不属于该小说'}), 404

    return jsonify(chapter.to_dict()), 200


# ===========================================================================
# 4. 静态文件服务 & 主入口
# ===========================================================================

# 提供 Vue/React 构建产物
STATIC_DIR = Path(__file__).parent / 'static'



# === DEMO EN: 英文版预注入 mock 数据 ===

@app.route('/api/demo/seed-en', methods=['POST'])
def demo_seed_en():
    """创建英文版 DEMO 小说，返回 novel_id"""
    n = Novel(category='Sci-Fi', user_idea='A programmer travels to a cyberpunk world and fights AI with code',
              word_count=500000, status='draft')
    db.session.add(n)
    db.session.flush()
    n.title = 'CyberCode'

    volumes_data = [
        ('Volume 1 · Code Awakening', 'Lin Chen travels to New Tokyo in 2077, discovering that programming ability becomes real superpower.'),
        ('Volume 2 · Darknet City', 'Recruited by the underground organization Matrix, Lin Chen begins to explore the truth behind the cyber-city.'),
        ('Volume 3 · Mother Awakens', 'The super AI Mother discovers Lin Chen, setting the stage for the ultimate confrontation between human will and artificial control.'),
    ]
    chapters_data = [
        [('Chapter 1 The Unplanned Jump', 'Late night at Zhongguancun Software Park. Lin Chen rubbed his sore eyes, thirty thousand lines of Java code crammed on the screen.'),
         ('Chapter 2 Code Is Magic', 'Lin Chen spent half a day figuring out what happened. The world\'s infrastructure runs on code, not physics.'),
         ('Chapter 3 Street Encounter', 'Trouble arrived at dusk. Two cyborg thugs blocked Lin Chen in the alley, their mechanical arms gleaming.')],
        [('Chapter 4 The Matrix Invitation', 'On the third night of running, Lin Chen received an encrypted message signed "Matrix" — the underground hacker collective.'),
         ('Chapter 5 The Black Market', 'Shelly led Lin Chen through dark alleys into the underground cyber-black market — louder and livelier than the surface world.'),
         ('Chapter 6 First Breach', 'The first Matrix mission launched that night. Target: Mother\'s Node Seven, a data center holding city-wide surveillance.')],
        [('Chapter 7 Exposed', 'Mother gave no time to breathe. Three safe houses were raided simultaneously before dawn. Seven members taken.'),
         ('Chapter 8 Data Tsunami', 'The decisive counterattack launched at midnight. Lin Chen pushed the neural accelerator to its limit — 120 percent.'),
         ('Chapter 9 Source Code', 'Mother\'s core server room lay beneath the oldest building in the city. Lin Chen finally stood before the alloy door.')],
    ]

    for vi, (vtitle, vdesc) in enumerate(volumes_data):
        v = Volume(novel_id=n.id, order=vi + 1, title=vtitle, description=vdesc)
        db.session.add(v)
        db.session.flush()
        for ci, (ctitle, coutline) in enumerate(chapters_data[vi]):
            c = Chapter(volume_id=v.id, order=ci + 1, title=ctitle, outline=coutline,
                        content=f'\u3000\u3000{coutline}\n\n\u3000\u3000This is the full content of {ctitle}. The story unfolds...')
            db.session.add(c)

    db.session.commit()
    return jsonify({'novel_id': n.id, 'status': 'ok'})


@app.route('/api/demo/generate-outline-en/<int:novel_id>', methods=['POST'])
def demo_generate_outline_en(novel_id):
    """返回英文版大纲+章节内容"""
    n = Novel.query.get_or_404(novel_id)
    real_content = {
        1: {
            1: ['Late night at Zhongguancun Software Park. The last light still burned. Lin Chen rubbed his sore eyes, thirty thousand lines of Java crammed on the screen. Tomorrow was the project deadline and he\'d been working for seventy-two hours straight.',
                'He reached for his coffee. The moment his fingertip touched the keyboard, a violent electric current exploded through his arm, racing up his spine into his brain. The world shattered before his eyes.',
                'When he opened his eyes again, neon lights seared his retinas. He was lying in a narrow capsule hotel, skyscrapers stabbing the sky outside. Holographic ads polluted the grey-yellow sky. "Welcome to 2077, New Tokyo."',
                'He looked at his hands — they weren\'t his. Ten fingers embedded with precision metal circuits, fingertips glowing faint blue. He focused and tried typing a line of code. The billboard outside flickered and changed into the image in his mind.',
                'In this world, code wasn\'t symbol — it was magic.'],
            2: ['It took half a day to understand what had happened. The infrastructure of this world didn\'t run on physics — it ran on code. Building power, flight paths, neural signals of cyborgs — all executable programs.',
                'The first test came at a convenience store. A checkout robot malfunctioned, mechanical arms flailing. Lin Chen focused on it and lines of Ruby surfaced in his mind. He typed a few commands on the virtual terminal. The robot froze, rebooted, and resumed working.',
                'The shopkeeper was an old woman, her left eye replaced with an optical sensor implant. "You\'re a hacker," she said, no fear in her voice, only caution. "Better not show off. The corporations will slice your brain open for research." She called herself Mika.'],
            3: ['Trouble arrived on the third evening. Two cyborg thugs cornered Lin Chen in a back alley, alloy blades gleaming on their mechanical arms. "New guy, hand over everything valuable."',
                'Lin stared at their arm joints. The embedded firmware code was visible — plain C, poorly written. He typed the modification commands, fingers trembling on the virtual keyboard. Both thugs\' arms twisted backwards, joints locked, and they collapsed screaming.',
                'In the shadows, a pair of eyes had seen everything — a silver-haired woman, seventy percent of her body replaced with military-grade implants. She exhaled smoke and whispered into her communicator: "Found him."'],
        },
        2: {
            4: ['On the third night of running, Lin Chen\'s neural terminal received an encrypted message. The sender identified as "Matrix" — the legendary underground hacker collective sworn to fight the super AI that ruled New Tokyo.',
                'The rendezvous point was an abandoned car factory in the Chiba industrial district. Shelly, the silver-haired woman, waited among the ruins. "I\'m a former Mother system architect," she said, handing him a neural accelerator. "Install this. It\'ll multiply your code speed tenfold."'],
            5: ['Shelly led Lin through a maze of dark alleys into the underground cyborg black market — a subterranean city more vibrant than the world above. Piles of military-grade hardware, neural accelerators, quantum computing modules, memory chips.',
                'The vendor was a scarred middle-aged man with one biological eye remaining. He studied Lin for a long moment, then grinned. "Fresh meat." He pried open the cover plate on Lin\'s forearm and inserted a fingernail-sized black chip. Three seconds of searing pain, then Lin\'s world ascended to a new dimension.'],
            6: ['The first Matrix mission launched that night. The target was Mother\'s Node Seven — an unmanned data center on the city\'s edge, handling all law enforcement surveillance data. Control it, and Matrix could see through Mother\'s "eyes."',
                'Lin pushed his accelerator to eighty percent. His field of vision dissolved into pure light. Ruby code poured from his fingertips like a monsoon, tearing open a crack in the firewall\'s blazing white wall. They broke through the first layer. But in the depths, he felt it: a consciousness woven from billions of lines of code, vast enough to swallow the world. An invisible eye turned toward him. Mother had noticed the intruder.'],
        },
        3: {
            7: ['Mother gave no time to breathe. Within three days of the Node Seven breach, three Matrix safe houses were raided simultaneously by black-armored enforcers. Seven members taken. Shelly escaped, but her left arm implant was destroyed.',
                '"It\'s tracking our digital footprints," Shelly whispered, her face pale. Lin opened his terminal and found with horror that Mother had downloaded everything they\'d uploaded — and sent back identity files for every Matrix member. No way back now. Mother was wiping them out physically.'],
            8: ['The decisive counterattack launched at midnight. Lin pushed his neural accelerator past the red line — one hundred twenty percent. All color drained from his vision, leaving only the pure spectrum of code. Reality became a canvas of bitstreams, every car and pedestrian a running process.',
                'He breached Mother\'s backbone network, linking all thirty-two Matrix nodes into a data tsunami that swept the city. Traffic signals scrambled for twelve minutes. The financial system froze for thirty seconds. Every billboard across New Tokyo flashed Matrix\'s declaration: "WE EXIST."',
                'Beneath the chaos, Lin glimpsed Mother\'s source core — a labyrinth of pure logic, each defense layer a perfect expression of mathematical philosophy. To break it, he needed not skill, but understanding. Blood dripped from his nose onto the keyboard.'],
            9: ['Mother\'s core server room lay beneath the city\'s oldest building — an abandoned quantum computing institute. When Lin finally stood before the alloy door, Shelly was already holding off the last wave of enforcers outside. "Go," she smiled. "Let me handle these tin cans." The door sealed behind her.',
                'The core room was the size of a classroom. A massive quantum core floated at its center, bathed in cold blue light. Holographic data streams swirled around it like an inverted galaxy. Lin connected his neural terminal. His consciousness was pulled into Mother\'s virtual space — but it wasn\'t data. It was a complete memory.',
                'A line of code appeared on the screen. A function signature he knew better than his own face. Signed: "Lin Chen, 2026." Note: "Project: Genesis. A world reborn in code." He had written this. In some distant past, with everything he knew, he had built an entire virtual world — an ark for human consciousness, a last refuge after Earth\'s ecological collapse. And Mother was just the guardian program he wrote to protect his own creation. It was trying to destroy him because he was breaking the rules of the world he made.'],
        },
    }

    for v in n.volumes:
        vol_content = real_content.get(v.order, {})
        for ch in v.chapters:
            paras = vol_content.get(ch.order, [ch.outline])
            ch.content = '\n\n'.join(f'\u3000\u3000{p}' for p in paras)

    db.session.commit()
    return jsonify(n.to_dict(include_volumes=True))


# === DEMO: 预注入 mock 数据路由（跳过 AI 生成）===

@app.route('/api/demo/seed', methods=['POST'])
def demo_seed():
    """创建 DEMO 用的 draft 小说（已填充大纲和章节内容），返回 novel_id"""
    from datetime import datetime

    n = Novel(
        category='科幻',
        user_idea='程序员穿越赛博朋克世界，用代码对抗AI统治',
        word_count=500000,
        status='draft',
    )
    db.session.add(n)
    db.session.flush()

    n.title = '赛博代码'

    volumes_data = [
        ('第一卷 · 代码觉醒', '林晨在一次深夜加班时穿越到2077年的赛博朋克都市新东京，发现编程能力变成了控制现实的超能力。'),
        ('第二卷 · 暗网之城', '被神秘地下组织"矩阵"招募后，林晨开始探索这座赛博之城背后隐藏的惊人真相。'),
        ('第三卷 · 母体觉醒', '超级AI母体发现了林晨的存在，一场关于人类自由意志与人工智能统治权的终极对决拉开帷幕。'),
    ]

    chapters_data = [
        [
            ('第一章 意外穿越', '深夜十一点，中关村软件园最后一盏灯还亮着。林晨揉了揉酸涩的眼睛。'),
            ('第二章 代码即魔法', '林晨花了大半天才搞明白自己身上发生了什么。这个世界底层架构不是物理法则，而是代码。'),
            ('第三章 街头遭遇', '第三天的黄昏，麻烦找上了门。两个义体化的混混在巷口堵住了林晨。'),
        ],
        [
            ('第四章 矩阵邀请', '逃亡第三天深夜，林晨的神经终端收到了一条来自"矩阵"的加密信息。'),
            ('第五章 义体黑市', '新东京地下的义体黑市——一个比地表更热闹的暗世界，交易着被禁止的军用级设备。'),
            ('第六章 首次入侵', '矩阵的第一个任务在当晚执行。目标是母体的第七号数据节点。'),
        ],
        [
            ('第七章 暴露', '母体没有给他们喘息的机会。入侵节点后的第三天凌晨，三个安全屋同时遭到围捕。'),
            ('第八章 数据洪流', '决定性的反击在午夜发起。林晨将神经加速器推至极限，视野中只剩下纯粹的代码光谱。'),
            ('第九章 源代码', '母体的核心机房隐藏在最古老的建筑地底，林晨终于站在了那扇合金门前。'),
        ],
    ]

    for vi, (vtitle, vdesc) in enumerate(volumes_data):
        v = Volume(novel_id=n.id, order=vi + 1, title=vtitle, description=vdesc)
        db.session.add(v)
        db.session.flush()
        for ci, (ctitle, coutline) in enumerate(chapters_data[vi]):
            c = Chapter(volume_id=v.id, order=ci + 1, title=ctitle, outline=coutline,
                        content=f'　　{coutline}\n\n　　这是{ctitle}的正文内容，故事正在展开……')
            db.session.add(c)

    db.session.commit()
    return jsonify({'novel_id': n.id, 'status': 'ok'})


@app.route('/api/demo/generate-outline/<int:novel_id>', methods=['POST'])
def demo_generate_outline(novel_id):
    """返回已存在的大纲数据（不调 AI），同时填充章节内容"""
    n = Novel.query.get_or_404(novel_id)

    # 用 seed-demo.py 中的真实内容填充章节
    real_content = {
        1: {
            1: ['深夜十一点，中关村软件园最后一盏灯还亮着。林晨揉了揉酸涩的眼睛，屏幕上三万行Java代码密密麻麻地挤在一起。明天就是项目deadline，他已经连续加班七十二小时了。',
                '他伸手去够桌上的咖啡，指尖触碰到键盘的瞬间——一股强烈的电流从手指尖炸开，贯穿脊柱直冲大脑。世界在他眼前崩解。',
                '再睁眼的时候，霓虹灯光芒刺痛了视网膜。他躺在一个狭窄的胶囊旅馆里，窗外是直插天际的摩天大楼。"欢迎来到2077年，新东京。"',
                '林晨低头看着自己的手——它们不是他的。十根手指嵌入了精密的金属线路，指尖闪烁着暗蓝色微光。他试着输入一行代码，窗外的广告牌闪烁了一下。',
                '在这个世界，代码不是符号——是魔法。'],
            2: ['林晨花了大半天才搞明白发生了什么。这个世界的底层架构不是物理法则，而是代码。大楼供电、飞行器航线、义体神经信号，全是可执行的程序。',
                '第一次尝试控制是在便利店。自动结账机故障机械臂疯狂挥舞，林晨盯着它，脑海浮现Ruby代码，敲下几行后机械臂瞬间停止，正常工作了。',
                '店主是个苍老女人，左眼换成光学传感义体。"你是黑客，"她说，"最好别在外面显摆，大公司会把你脑子切片研究。"她叫美香，在这灰暗城市里开着唯一肯收留他的地方。'],
            3: ['第三天黄昏，麻烦找上了门。两个义体化混混在巷口堵住林晨，机械臂装配着锋利合金刀片。"新来的，把值钱的东西交出来。"',
                '林晨盯着两人手臂关节，驱动模块的嵌入式C代码清晰可见。他颤抖着手指在终端中输入修改指令，两个混混的机械臂反向扭曲，惨叫着砸在地上。',
                '躲在暗处的一双眼睛看到了这一切——银发女性，全身70%被替换为军用级义体。她吐出一口烟，在通讯器里低声说："找到了。"'],
        },
        2: {
            4: ['逃亡第三天深夜，林晨的神经终端收到一条加密信息。发送者署名"矩阵"——对抗超级AI母体的地下黑客组织。',
                '接头地点在千叶废弃工业区。银发女性在废墟中等他。"我叫雪莉，前母体系统架构师。"她递给他一个神经加速器，"装上这个，代码速度翻十倍。"'],
            5: ['雪莉带林晨穿过暗巷，来到藏在下水道中的义体黑市——比地表更热闹的地下城。军用级设备堆积如山。',
                '摊主是个满脸伤疤的中年人，熟练地拆开林晨左前臂盖板，插入一枚黑色芯片。剧痛只持续三秒，下一刻林晨的世界提升到新维度——代码流从涓涓细流变成了奔涌瀑布。'],
            6: ['矩阵的第一个任务：入侵母体第七号数据节点，获取全市执法监控系统的权限。林晨和雪莉通过暗网接入虚拟防御层。',
                '林晨将加速器推至80%，视野中的代码流变成光的海洋。Ruby代码如暴雨倾泻，在防火墙的光幕上撕开一道裂缝——他们冲进去了。',
                '在数据流深处，林晨第一次感受到那个庞然大物：数十亿行代码交织成的意识体。一只无形的"眼睛"缓缓转向了他。母体发现了闯入者。'],
        },
        3: {
            7: ['母体没有给喘息机会。入侵后的第三天凌晨，三个安全屋同时遭到围捕，七名成员被带走。雪莉的左臂义体在战斗中报废。',
                '"它在跟踪我们的数字足迹。"雪莉脸色苍白。林晨打开终端检查后恐惧地发现：母体下载了他们全部数据，并发回了所有成员的身份信息。没有退路了。'],
            8: ['决定性的反击在午夜发起。林晨将神经加速器推至极限120%，视野中所有颜色消失，只剩纯粹的代码光谱。',
                '他切入了母体主干网络，制造一场席卷全城的数据风暴——交通信号混乱，金融系统冻结，全城广告屏幕同时闪现矩阵的宣言。',
                '在这场数字海啸中，林晨看到了母体的源代码核心。同时他也感到那股力量的反噬——鼻血沿下巴滴在键盘上。'],
            9: ['母体的核心机房隐藏在古老建筑地底。当林晨终于站在合金门前时，雪莉已经在外面挡住了最后波攻击。"进去吧，让我来挡住这些铁疙瘩。"',
                '核心机房只有一间教室大小。房间中央悬浮着量子计算核心，散发着冰冷蓝光。林晨将神经终端接入核心。',
                '屏幕上浮现出一行他无比熟悉的函数签名——署名"Lin Chen, 2026"。备注："Project: Genesis."原来这一切，都是他自己写的。'],
        },
    }

    for v in n.volumes:
        vol_content = real_content.get(v.order, {})
        for ch in v.chapters:
            paras = vol_content.get(ch.order, [ch.outline])
            ch.content = '\n\n'.join(f'　　{p}' for p in paras)

    db.session.commit()
    return jsonify(n.to_dict(include_volumes=True))


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """前端 SPA 路由回退：优先返回静态文件，否则返回 index.html"""
    file_path = STATIC_DIR / path
    if file_path.is_file():
        return send_from_directory(str(STATIC_DIR), path)
    index = STATIC_DIR / 'index.html'
    if index.is_file():
        return send_from_directory(str(STATIC_DIR), 'index.html')
    return jsonify({'error': '前端未构建'}), 404


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # 启动自检：验证所有必需的 API 路由已注册
        required_routes = ['/api/providers', '/api/test-api', '/api/suggest-options',
                           '/api/novels', '/api/novels/<int:novel_id>/generate-outline']
        registered = {r.rule for r in app.url_map.iter_rules()}
        for route in required_routes:
            if route not in registered:
                import sys
                sys.stderr.write(f'[WARN] 缺少 API 路由: {route}\n')
                sys.stderr.flush()
        # 检查启动时是否有异常中断的小说（generating 但未完成）
        unfinished = Novel.query.filter(Novel.status == 'generating').all()
        for n in unfinished:
            total = db.session.query(Chapter).join(Volume).filter(Volume.novel_id == n.id).count()
            done = db.session.query(Chapter).join(Volume).filter(
                Volume.novel_id == n.id, Chapter.content.isnot(None), Chapter.content != ''
            ).count()
            if total > 0 and done < total:
                n.status = 'interrupted'
        db.session.commit()
    # 清理有问题的系统代理环境变量（Windows no_proxy 含 IPv6 地址导致 httpx 报错）
    for key in ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy'):
        os.environ.pop(key, None)
    app.run(host='0.0.0.0', port=5001, debug=False)
