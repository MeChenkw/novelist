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

def generate_outline(category: str, idea: str, word_count: int) -> dict:
    """
    调用 DeepSeek AI 生成小说大纲。
    返回 JSON: { novel_title, volumes: [{ title, desc, chapters: [{ title, outline }] }] }
    """
    system_prompt = (
        "你是一个专业小说大纲策划师。根据用户提供的小说分类、创意和字数目标，"
        "生成小说名、分卷 (3-6卷) 和各卷章节大纲 (每卷5-12章)。"
        "每个章节包含标题和50字左右的内容简介。以JSON格式返回。"
        "JSON格式: {\"novel_title\": \"小说名\", \"volumes\": [{\"title\": \"卷名\", \"desc\": \"卷简介\", \"chapters\": [{\"title\": \"章标题\", \"outline\": \"章内容简介\"}]}]}"
    )

    user_prompt = (
        f"小说分类：{category}\n"
        f"用户创意：{idea}\n"
        f"字数目标：{word_count}字\n"
        "请生成完整的小说大纲，严格按照JSON格式返回。"
    )

    client = create_ai_client()
    response = client.chat.completions.create(
        model='deepseek-chat',
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


def generate_chapter(novel_id: int, volume_id: int, chapter_id: int) -> str:
    """
    调用 DeepSeek AI 生成指定章节的完整内容。
    读取该章节的 outline，以及前面所有已写完章节的 title+前200字content。
    返回生成的章节正文（约 2000-5000 字）。
    """
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

    client = create_ai_client()
    response = client.chat.completions.create(
        model='deepseek-chat',
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

    try:
        result = generate_outline(novel.category, novel.user_idea, novel.word_count)
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

    generated_count = total_chapters - len(empty_chapters)

    for ch in empty_chapters:
        try:
            content = generate_chapter(novel_id, ch.volume_id, ch.id)
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
