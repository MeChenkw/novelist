import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { api } from '../api';
import { t, getLocale } from '../i18n';
import { FALLBACK_EN } from '../constants/FALLBACK_EN';

// 创意要素维度
interface IdeaDimension {
  key: string;
  labelKey: string;
  labelEn: string;
  questionKey: string;
  questionEn: string;
}

const DIMENSIONS: IdeaDimension[] = [
  { key: 'protagonist', labelKey: '主角设定', labelEn: 'Protagonist',
    questionKey: '主角是什么身份和性格？', questionEn: "What is the protagonist's identity and personality?" },
  { key: 'world', labelKey: '世界观', labelEn: 'World Setting',
    questionKey: '故事发生在什么世界？', questionEn: 'What world does the story take place in?' },
  { key: 'conflict', labelKey: '核心冲突', labelEn: 'Core Conflict',
    questionKey: '故事的主要矛盾是什么？', questionEn: 'What is the main conflict?' },
  { key: 'style', labelKey: '风格基调', labelEn: 'Style & Tone',
    questionKey: '你希望是什么风格？', questionEn: 'What style do you prefer?' },
  { key: 'advantage', labelKey: '主角优势', labelEn: "Protagonist's Advantage",
    questionKey: '主角有什么独特优势？', questionEn: 'What unique advantage does the protagonist have?' },
];

// 预置选项（兜底用，每个分类×维度10个）
const FALLBACK_OPTIONS: Record<string, Record<string, string[]>> = {
  '玄幻': {
    protagonist: ['穿越者/重生者', '普通少年得到奇遇', '天才/特殊体质者', '修行者/门派弟子', '废柴逆袭型', '隐世强者归来', '被选中的命运之子', '流浪的孤儿', '家族落魄子弟', '逃婚出走的少主'],
    world: ['仙侠修真世界', '异界大陆', '东方玄幻大陆', '神魔争霸世界', '星辰宇宙', '九天仙域', '蛮荒古界', '轮回秘境', '万界战场', '混沌虚空'],
    conflict: ['正邪势力的对决', '权力的争夺与阴谋', '成长与自我突破', '守护重要的人或物', '天道法则的对抗', '万族争霸的浩劫', '逆天改命的抗争', '宗门之间的恩怨', '远古秘藏的争夺', '跨界入侵的危机'],
    style: ['热血冒险', '史诗宏大', '轻快爽文', '轻松幽默', '黑暗深沉', '霸道强势', '悬疑诡秘', '唯美深情', '燃情悲壮', '慢热细腻'],
    advantage: ['稀有宝物/系统', '特殊体质/血脉', '前世记忆/重生', '过人智慧/谋略', '逆天悟性/天赋', '远古传承/功法', '神器/法宝', '空间/时间能力', '炼丹/炼器天赋', '契约神兽/灵宠'],
  },
  '奇幻': {
    protagonist: ['异世界转生者', '普通冒险者', '魔法学徒/法师', '贵族/王室后裔', '召唤师/契约者', '被诅咒的流浪者', '屠龙者后裔', '精灵/矮人血脉', '流浪佣兵', '失忆的神秘人'],
    world: ['西方魔法世界', '剑与魔法大陆', '多元宇宙', '神话传说世界', '蒸汽与魔法并存', '精灵森林与龙域', '海底亚特兰蒂斯', '天空浮岛', '地下世界/深渊', '梦境与现实交界'],
    conflict: ['魔王与勇者的对决', '种族战争与和平', '封印与解除封印', '魔法文明的存亡', '命运预言的反抗', '神权的争夺', '远古巨龙的苏醒', '魔法与科技的对抗', '王位的继承之战', '异界入侵的威胁'],
    style: ['史诗冒险', '浪漫奇幻', '黑暗哥特', '轻快童话', '宏大战争', '神秘探索', '幽默诙谐', '悲伤苍凉', '热血激昂', '温馨治愈'],
    advantage: ['魔法天赋', '神器/传承', '异界知识', '契约生物/伙伴', '特殊血统', '灵魂之力', '元素亲和', '预言/占星能力', '变身/变形能力', '古老语言/符文知识'],
  },
  '都市': {
    protagonist: ['普通上班族', '重返青春的重生者', '天才学生', '隐藏身份的强者', '创业奋斗者', '神秘归来的退役者', '低调的富二代', '自由职业者/网红', '刑警/侦探', '医生/律师'],
    world: ['现代都市', '校园生活', '商业职场', '超自然都市', '娱乐圈/体育圈', '地下社会/黑道', '国际大都市', '小城镇生活', '豪门世家', '医院/警局'],
    conflict: ['职场竞争与商战', '爱情与现实的抉择', '阶层跨越的斗争', '正义与邪恶的较量', '家庭与理想的矛盾', '黑帮势力的渗透', '都市怪谈的解谜', '财富与权力的争夺', '友情与背叛的考验', '过去阴影的纠缠'],
    style: ['轻松甜宠', '现实写实', '爽文逆袭', '悬疑紧张', '热血励志', '幽默搞笑', '都市言情', '职场商战', '暗黑风格', '温馨日常'],
    advantage: ['重生记忆/预知', '超凡能力/系统', '过人商业头脑', '高超专业技能', '深厚人脉背景', '格斗/军事技能', '医术/毒术', '黑客/技术能力', '超强洞察力', '语言/外交天赋'],
  },
  '历史': {
    protagonist: ['穿越到古代的现代人', '历史名臣/将领', '皇室成员/皇子', '普通百姓逆袭', '改革家/谋士', '少年将军', '隐世奇人', '流落民间的皇子', '科举入仕的书生', '游历四方的侠客'],
    world: ['三国群雄时代', '大唐盛世', '明清风云', '秦汉争霸', '架空历史王朝', '春秋战国', '宋辽金夏', '南北朝', '元明之际', '五代十国'],
    conflict: ['王朝更替的战争', '权臣与皇权的博弈', '外敌入侵的抵御', '历史变革的推动', '民生与制度的改良', '宫廷内部的权力斗争', '边疆战事的烽烟', '新旧思想的碰撞', '天灾人祸下的生存', '外交与和亲的抉择'],
    style: ['权谋智斗', '热血争霸', '轻松种田', '厚重写实', '幽默搞笑', '正剧史诗', '悬疑探案', '宫廷言情', '民间传奇', '军事策略'],
    advantage: ['现代知识/科技', '历史预知', '过人谋略与智慧', '军事才能', '政治手腕', '经济头脑', '特殊人脉关系', '超凡武力', '医术/技艺', '文化知识底蕴'],
  },
  '科幻': {
    protagonist: ['宇航员/星舰船长', '基因改造者', '末世幸存者', '人工智能觉醒者', '科学家/工程师', '虚拟世界玩家', '外星混血', '时间旅行者', '超级士兵', '反叛军领袖'],
    world: ['星际宇宙', '赛博朋克世界', '末日废土', '虚拟现实/游戏', '人工智能未来', '平行宇宙', '深海城市', '太空殖民地', '基因改造时代', '纳米科技世界'],
    conflict: ['人类与外星文明的对抗', '科技伦理的抉择', '末世生存与重建', '人与机器的界限', '资源争夺与战争', '时间线紊乱的修复', '虚拟与现实的混淆', '基因改造的争议', '星际殖民的冲突', '超级AI的失控'],
    style: ['硬核科技', '废土悲凉', '赛博朋克黑暗', '太空史诗', '悬疑惊悚', '冷峻写实', '哲学思辨', '冒险动作', '末世希望', '反乌托邦'],
    advantage: ['尖端科技/机甲', '基因进化/超能力', '末世生存经验', '人工智能助手', '特殊知识储备', '时间操控能力', '黑客/网络能力', '生物改造/义体', '太空战斗经验', '数据分析/预判能力'],
  },
  '悬疑': {
    protagonist: ['侦探/刑警', '法医/犯罪心理学家', '普通人身陷谜案', '灵异能力者', '记者/调查者', '退休警探重出江湖', '被冤枉的逃犯', '神秘组织前成员', '心理咨询师', '历史学者/考古学家'],
    world: ['现代都市暗面', '封闭空间(孤岛/庄园)', '异度空间/灵异世界', '警察/侦探局', '古墓/遗迹', '废弃医院/学校', '深山古村', '地下密室', '精神世界的迷宫', '网络暗网'],
    conflict: ['连环案件的追凶', '真相与谎言的博弈', '超自然现象的解谜', '正义与黑暗的较量', '时间紧迫的危机', '失忆与身份之谜', '密室杀人的破解', '古老诅咒的调查', '平行时空的交叉', '心理扭曲的博弈'],
    style: ['阴森诡异', '烧脑推理', '紧张惊悚', '冷峻写实', '灵异恐怖', '心理悬疑', '社会派推理', '本格推理', '幽闭恐惧', '反转再反转'],
    advantage: ['敏锐洞察力', '逻辑推理天赋', '特殊感知能力', '专业刑侦知识', '丰富的案件经验', '法医/医学知识', '心理学分析能力', '超强的记忆力', '伪装/潜入能力', '网络追踪技术'],
  },
  '言情': {
    protagonist: ['独立坚强的女主', '温柔深情的男主', '重生归来的女主', '豪门继承人', '平凡但温暖的主角', '高冷学霸/总裁', '阳光开朗的运动系', '娱乐圈明星', '古风世家千金', '职场精英女性'],
    world: ['现代都市', '校园青春', '古代宫廷/世家', '职场商界', '娱乐圈背景', '民国风云', '仙侠世界', '异国他乡', '小城镇/乡村', '竞技体育圈'],
    conflict: ['爱情与身份的阻碍', '误会与错过的纠葛', '家族利益的对抗', '事业与爱情的平衡', '时间距离的考验', '第三者的介入', '阶级差异的鸿沟', '记忆丢失与找回', '青梅竹马还是天降', '破镜重圆的纠葛'],
    style: ['甜蜜温馨', '虐恋情深', '轻松搞笑', '浪漫唯美', '现实虐心', '暗恋成真', '先婚后爱', '欢喜冤家', '深情守护', '破镜重圆'],
    advantage: ['重生预知/系统', '过人才华与能力', '善良坚韧的性格', '财富地位背景', '独特魅力与气质', '高超厨艺/才艺', '商业头脑', '治愈他人的能力', '坚强独立的意志', '出众的外貌'],
  },
  '武侠': {
    protagonist: ['少年侠客初入江湖', '隐世高手重出江湖', '门派弟子', '复仇者/浪子', '武学奇才', '江湖郎中/游医', '朝廷密探', '魔教少主', '丐帮弟子', '世家传人'],
    world: ['江湖武林世界', '门派林立的中原', '朝廷与江湖交织', '乱世侠客行', '秘境与古墓探索', '大漠边关', '江南水乡', '京城皇都', '海外孤岛', '地下暗河/密道'],
    conflict: ['正派与魔教的斗争', '武林盟主的争夺', '血海深仇的报复', '江湖与朝廷的冲突', '武学秘籍的争夺', '宝藏图引发的纷争', '门派存亡的危机', '保家卫国的抉择', '师门恩怨的纠葛', '武道巅峰的追求'],
    style: ['侠骨柔情', '快意恩仇', '热血豪迈', '悲壮苍凉', '幽默诙谐', '悬疑探案', '权谋江湖', '浪漫江湖', '写实硬派', '写意水墨'],
    advantage: ['绝世武学传承', '稀有神兵利器', '过人武学天赋', '深厚内力修为', '武林秘宝/藏宝图', '轻功/暗器绝技', '医术/毒术', '易容/潜行之术', '阵法/奇门遁甲', '音律/诗词造诣'],
  },
};

// 分析创意文本中已包含哪些维度
function analyzeIdea(idea: string): Set<string> {
  const covered = new Set<string>();

  if (/^主角设定：/m.test(idea) || /^Protagonist:/m.test(idea)) covered.add('protagonist');
  if (/^世界观：/m.test(idea) || /^World:/m.test(idea)) covered.add('world');
  if (/^核心冲突：/m.test(idea) || /^Core Conflict:/m.test(idea)) covered.add('conflict');
  if (/^风格：/m.test(idea) || /^Style:/m.test(idea)) covered.add('style');
  if (/^主角优势：/m.test(idea) || /^Advantage:/m.test(idea)) covered.add('advantage');

  if (covered.size < 5) {
    const zhPatterns: Record<string, RegExp[]> = {
      protagonist: [/主角/i, /少年/i, /少女/i, /学生/i, /程序员/i, /将军/i, /穿越/i, /重生/i, /大学生/i],
      world: [/世界/i, /大陆/i, /宇宙/i, /时代/i, /都市/i, /校园/i, /王朝/i],
      conflict: [/战争/i, /争夺/i, /对抗/i, /危机/i, /阴谋/i, /复仇/i, /守护/i],
      style: [/喜剧/i, /悬疑/i, /热血/i, /轻松/i, /黑暗/i, /治愈/i, /史诗/i],
      advantage: [/能力/i, /金手指/i, /系统/i, /天赋/i, /知识/i, /技能/i, /法宝/i],
    };
    const enPatterns: Record<string, RegExp[]> = {
      protagonist: [/protagonist/i, /hero/i, /heroine/i, /transmigrat/i, /reborn/i, /student/i, /wander/i, /apprentice/i, /disciple/i],
      world: [/world/i, /kingdom/i, /dynasty/i, /continent/i, /galaxy/i, /realm/i, /dimension/i, /universe/i, /empire/i, /era/i],
      conflict: [/war/i, /conflict/i, /struggle/i, /battle/i, /revenge/i, /conspiracy/i, /invasion/i, /crisis/i, /rebellion/i, /fight/i],
      style: [/romance/i, /adventure/i, /thriller/i, /mystery/i, /comedy/i, /drama/i, /suspense/i, /fantasy/i, /epic/i, /gritty/i],
      advantage: [/power/i, /ability/i, /skill/i, /knowledge/i, /talent/i, /magic/i, /system/i, /inheritance/i, /weapon/i, /bloodline/i],
    };
    const patterns = getLocale() === 'en' ? enPatterns : zhPatterns;
    for (const [dim, regexps] of Object.entries(patterns)) {
      if (covered.has(dim)) continue;
      for (const re of regexps) {
        if (re.test(idea)) { covered.add(dim); break; }
      }
    }
  }
  return covered;
}

function composeIdea(original: string, supplements: Record<string, string>): string {
  const locale = getLocale();
  const parts: string[] = [original.trim()];
  if (supplements.protagonist) parts.push(locale === 'en' ? `Protagonist: ${supplements.protagonist}` : `主角设定：${supplements.protagonist}`);
  if (supplements.world) parts.push(locale === 'en' ? `World: ${supplements.world}` : `世界观：${supplements.world}`);
  if (supplements.conflict) parts.push(locale === 'en' ? `Core Conflict: ${supplements.conflict}` : `核心冲突：${supplements.conflict}`);
  if (supplements.style) parts.push(locale === 'en' ? `Style: ${supplements.style}` : `风格：${supplements.style}`);
  if (supplements.advantage) parts.push(locale === 'en' ? `Advantage: ${supplements.advantage}` : `主角优势：${supplements.advantage}`);
  return parts.join('\n');
}

export interface IdeaEnhancerHandle {
  startEnhance: () => void;
  isMissing: () => boolean;
  missingCount: () => number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  category: string;
  onComplete?: (submitDirectly: boolean) => void;
}

const IdeaEnhancer = forwardRef<IdeaEnhancerHandle, Props>(({ value, onChange, category, onComplete }: Props, ref) => {
  const locale = getLocale();
  const [showEnhancer, setShowEnhancer] = useState(false);
  const [currentDimIndex, setCurrentDimIndex] = useState(0);
  const [supplements, setSupplements] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState('');
  const [finished, setFinished] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 记录每个维度的选中项，用于切换后恢复
  const [dimSelections, setDimSelections] = useState<Record<string, string>>({});

  // AI 刷新状态
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  const covered = analyzeIdea(value);
  const missingDims = DIMENSIONS.filter((d) => !covered.has(d.key));
  const dim = missingDims[currentDimIndex];
  const isFirst = currentDimIndex === 0;
  const isLast = currentDimIndex === missingDims.length - 1;

  // 预置选项（按 locale 选择中/英文数据集）
  const catOptions = locale === 'en'
    ? (FALLBACK_EN[category] || FALLBACK_EN['玄幻'])
    : (FALLBACK_OPTIONS[category] || FALLBACK_OPTIONS['玄幻']);
  const currentOptions = dim ? (catOptions[dim.key] || []) : [];
  // 调试：确保每个维度都有独立的选项（仅在需要时启用）
  // const _debug = dim ? `${category}.${dim.key} = ${currentOptions.length} options` : '';

  useImperativeHandle(ref, () => ({
    startEnhance: () => {
      if (missingDims.length === 0) { onComplete?.(true); return; }
      setShowEnhancer(true);
      setCurrentDimIndex(0);
      setSupplements({});
      setDimSelections({});
      setFinished(false);
      setInputText('');
      setRefreshError(false);
    },
    isMissing: () => missingDims.length > 0,
    missingCount: () => missingDims.length,
  }));

  // 关闭弹窗，不做任何修改
  const handleClose = useCallback(() => {
    setShowEnhancer(false);
    setCurrentDimIndex(0);
  }, []);

  const finalize = useCallback((extra: Record<string, string>) => {
    const updated = composeIdea(value, { ...supplements, ...extra });
    onChange(updated);
    setFinished(true);
    setShowEnhancer(false);
    setShowConfirmDialog(true);
  }, [value, supplements, onChange]);

  const handleSelectOption = useCallback((opt: string) => {
    if (!dim) return;
    // 更新当前维度的选中项
    const newSel = { ...dimSelections, [dim.key]: opt };
    setDimSelections(newSel);
    const nextSupp = { ...supplements, [dim.key]: opt };
    setSupplements(nextSupp);
    if (!isLast) {
      setCurrentDimIndex((i) => i + 1);
    } else {
      finalize(nextSupp);
    }
  }, [dim, dimSelections, supplements, isLast, finalize]);

  const handleCustomSubmit = useCallback(() => {
    if (!inputText.trim()) return;
    handleSelectOption(inputText.trim());
    setInputText('');
  }, [inputText, handleSelectOption]);

  const handlePrev = useCallback(() => {
    if (!isFirst) {
      setCurrentDimIndex((i) => i - 1);
    }
  }, [isFirst]);

  const handleNext = useCallback(() => {
    if (!isLast) {
      setCurrentDimIndex((i) => i + 1);
    } else {
      // 最后一个维度点下一项 = 跳过所有剩余并完成
      setShowEnhancer(false);
      finalize(supplements);
      setCurrentDimIndex(0);
    }
  }, [isLast, finalize, supplements]);

  // 换一批：调用 AI 获取新选项
  const handleRefresh = useCallback(async () => {
    if (!dim) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      let aiCfg: Record<string, string> = {};
      try {
        const raw = localStorage.getItem('novelist_ai_config');
        if (raw) {
          const cfg = JSON.parse(raw);
          aiCfg = { api_key: cfg.api_key, base_url: cfg.base_url, model: cfg.model };
        }
      } catch {}
      const res = await api.suggestOptions({
        category,
        dimension_key: dim.key,
        locale: getLocale(),
        ...aiCfg,
      });
      if (res.options && res.options.length > 0) {
        // 用 AI 选项替换当前维度的预置选项（按维度 key 存储，不影响其他维度）
        setAiOptionsByDim((prev) => ({ ...prev, [dim.key]: res.options.slice(0, 10) }));
      }
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }, [dim, category]);

  // 当前维度的显示选项：如果有 AI 临时选项则用 AI 的，否则用预置
  const [aiOptionsByDim, setAiOptionsByDim] = useState<Record<string, string[]>>({});
  const displayOptions = dim ? (aiOptionsByDim[dim.key] || currentOptions) : currentOptions;

  // 维度切换时清除 AI 临时选项，回到预置（未使用，保留以备后续扩展）
  // const _handleDimChange = useCallback((newIdx: number) => {
  //   setCurrentDimIndex(newIdx);
  //   setAiTemporaryOptions(null);
  //   setRefreshError(false);
  //   setInputText('');
  // }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-[#4d4d4d] mb-1">{t('create.idea')}</label>
      <textarea
        value={value}
        onChange={(e) => { onChange(e.target.value); setFinished(false); }}
        placeholder={t('create.idea_placeholder')}
        className="w-full px-3 py-2 vercel-border rounded-md focus:outline-2 focus:outline-[var(--color-focus)] min-h-[100px]"
      />

      {finished && !showEnhancer && !showConfirmDialog && (
        <div className="mt-2 p-3 bg-[#ecfdf5] vercel-border rounded-md">
          <p className="text-sm text-[#047857]">
            {locale === 'en' ? '✅ Idea enriched! Review it below, then click "Submit" to generate the outline.' : '✅ 创意已完善！你可以查看修改，然后再次点击"创意提交"生成大纲。'}
          </p>
        </div>
      )}

      {/* 维度引导弹窗 */}
      {showEnhancer && dim && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] flex items-center justify-center z-50">
          <div className="bg-white shadow-[var(--shadow-modal)] rounded-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 flex-1">
                {missingDims.map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < currentDimIndex ? 'bg-[#0072f5]' : i === currentDimIndex ? 'bg-[#171717]' : 'bg-[#e5e7eb]'}`} />
                ))}
              </div>
              <button
                onClick={handleClose}
                className="ml-4 text-[#808080] hover:text-[#171717] text-lg leading-none"
                title={locale === 'en' ? 'Close' : '关闭'}
              >
                ✕
              </button>
            </div>
            <h3 className="text-lg font-semibold text-[#171717] mb-1">
              {locale === 'en' ? dim.labelEn : dim.labelKey}
            </h3>
            <p className="text-sm text-[#666] mb-4">
              {locale === 'en' ? dim.questionEn : dim.questionKey}
            </p>

            {/* 推荐选项 */}
            <div className="mb-2">
              {displayOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {displayOptions.map((opt) => {
                    const isSelected = dimSelections[dim.key] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => handleSelectOption(opt)}
                        className={`px-3 py-1.5 text-sm border rounded-md transition-colors ${
                          isSelected
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'border-[#e5e7eb] bg-[#fafafa] text-[#171717] hover:bg-[#f5f5f5]'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#808080]">
                  {locale === 'en' ? 'No suggestions available. Type your own below.' : '暂无可推荐选项，请手动输入。'}
                </p>
              )}
            </div>

            {/* 换一批 */}
            {displayOptions.length > 0 && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-xs text-[#0072f5] hover:text-[#005bb5] mb-3 disabled:opacity-50"
              >
                {refreshing ? (locale === 'en' ? '⏳ Refreshing...' : '⏳ 加载中...') : (locale === 'en' ? '🔄 Refresh suggestions' : '🔄 换一批')}
              </button>
            )}
            {/* AI 刷新失败提示 */}
            {refreshError && (
              <p className="text-xs text-red-500 mb-3">
                {locale === 'en' ? 'Refresh failed, using default suggestions.' : '刷新失败，使用默认推荐。'}
              </p>
            )}

            {/* 自定义输入 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                placeholder={locale === 'en' ? 'Or type your own...' : '或手动输入...'}
                className="flex-1 px-3 py-2 vercel-border rounded-md text-sm focus:outline-2 focus:outline-[var(--color-focus)]"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!inputText.trim()}
                className="px-3 py-2 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333] disabled:opacity-50"
              >
                {locale === 'en' ? 'Confirm' : '确定'}
              </button>
            </div>

            {/* 导航按钮 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex gap-2">
                {!isFirst && (
                  <button
                    onClick={handlePrev}
                    className="px-3 py-1.5 text-xs bg-[#171717] text-white rounded-md hover:bg-[#333]"
                  >
                    {locale === 'en' ? '← Previous' : '← 上一项'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {!isLast && (
                  <button
                    onClick={handleNext}
                    className="px-3 py-1.5 text-xs bg-[#171717] text-white rounded-md hover:bg-[#333]"
                  >
                    {locale === 'en' ? 'Next →' : '下一项 →'}
                  </button>
                )}
                {isLast && (
                  <button
                    onClick={() => { setShowEnhancer(false); finalize(supplements); }}
                    className="px-3 py-1.5 text-xs bg-[#171717] text-white rounded-md hover:bg-[#333]"
                  >
                    {locale === 'en' ? 'Done ✓' : '完成 ✓'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 创意确认弹窗 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] flex items-center justify-center z-50">
          <div className="bg-white shadow-[var(--shadow-modal)] rounded-xl max-w-md w-full mx-4 p-6 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="text-lg font-semibold text-[#171717] mb-2">
              {locale === 'en' ? 'Idea Enriched!' : '创意已完善！'}
            </h3>
            <p className="text-sm text-[#666] mb-6">
              {locale === 'en'
                ? 'Your story idea has been enriched with more details. You can review and edit it, or submit directly to generate the outline.'
                : '你的故事创意已被补充更多细节。你可以查看编辑，或直接提交生成大纲。'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setShowConfirmDialog(false); setFinished(false); onComplete?.(false); }}
                className="px-5 py-2 text-sm vercel-border rounded-md hover:bg-gray-50"
              >
                {locale === 'en' ? '📝 Review Idea' : '📝 创意确认'}
              </button>
              <button
                onClick={() => { setShowConfirmDialog(false); setFinished(false); onComplete?.(true); }}
                className="px-5 py-2 text-sm bg-[#171717] text-white rounded-md hover:bg-[#333]"
              >
                {locale === 'en' ? '🚀 Submit Directly' : '🚀 直接提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

IdeaEnhancer.displayName = 'IdeaEnhancer';
export default IdeaEnhancer;
