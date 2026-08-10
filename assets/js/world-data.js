const scoreDengMin = -30;
const scoreDengMax = 30;
const scoreJinMin = -3;
const scoreJinMax = 3;
const GOD_GROUPS = [
    { path: '生命', className: 'path-life', gods: ['诞育', '繁荣', '死亡'] },
    { path: '存在', className: 'path-exist', gods: ['记忆', '时间'] },
    { path: '文明', className: 'path-civil', gods: ['秩序', '真理', '战争'] },
    { path: '虚无', className: 'path-void', gods: ['欺诈', '命运'] },
    { path: '混沌', className: 'path-chaos', gods: ['混乱', '沉默', '痴愚'] },
    { path: '沉沦', className: 'path-fall', gods: ['污堕', '腐朽', '湮灭'] }
];
const GOD_ALIASES = {};
const GOD_PRAYERS = {
    诞育: '感孕生命，行育自然',
    繁荣: '万物滋生，亦繁亦荣',
    死亡: '灵魂安眠，生命终焉',
    记忆: '昔我长铭，流光拓影',
    时间: '时光如隙，我亦如风',
    秩序: '文明火起，秩序长存',
    真理: '洞窥本质，行见真理',
    战争: '何以求存，唯血与火',
    欺诈: '不辨真伪，勿论虚实',
    命运: '命若繁星，望而不及',
    混乱: '虚构规律，寰宇笑谈',
    痴愚: '生命皆痴，文明皆愚',
    污堕: '解开枷锁，直面心欲',
    腐朽: '众生应腐，万物将朽',
    湮灭: '于无中生，于寂中灭',
    沉默: '万物归寂，寰宇无音'
};
const GOD_ICONS = {
    诞育: '芽',
    繁荣: '穗',
    死亡: '眠',
    记忆: '页',
    时间: '沙',
    秩序: '衡',
    真理: '典',
    战争: '矛',
    欺诈: '面',
    命运: '骰',
    混乱: '涡',
    痴愚: '眸',
    污堕: '溺',
    腐朽: '朽',
    湮灭: '烬',
    沉默: '默'
};
const PROFESSION_GROUPS = [
    { path: '文明', god: '秩序', careers: { 战士: '秩序骑士', 法师: '元素法官', 牧师: '公正官', 刺客: '行刑官', 猎人: '搜查官', 歌者: '律者' } },
    { path: '文明', god: '真理', careers: { 战士: '格斗专家', 法师: '博识学者', 牧师: '外科医生', 刺客: '暗杀博士', 猎人: '陷阱大师', 歌者: '博闻诗人' } },
    { path: '文明', god: '战争', careers: { 战士: '陷阵勇士', 法师: '炼狱主教', 牧师: '督战官', 刺客: '隙光铁刺', 猎人: '鹰眼斥候', 歌者: '风暴之嗓' } },
    { path: '混沌', god: '混乱', careers: { 战士: '异血同袍', 法师: '灾祸之源', 牧师: '理智蚀者', 刺客: '折光扰影', 猎人: '渔夫', 歌者: '失律琴师' } },
    { path: '混沌', god: '痴愚', careers: { 战士: '坚壁战士', 法师: '幕后戏师', 牧师: '祛愚专家', 刺客: '解构之眼', 猎人: '猎愚人', 歌者: '独奏家' } },
    { path: '混沌', god: '沉默', careers: { 战士: '苦行僧', 法师: '默剧大师', 牧师: '守夜人', 刺客: '傀儡师', 猎人: '变色龙', 歌者: '囚徒' } },
    { path: '生命', god: '诞育', careers: { 战士: '酋长', 法师: '生命贤者', 牧师: '子嗣牧师', 刺客: '借诞之婴', 猎人: '创生猎人', 歌者: '唱夜之喉' } },
    { path: '生命', god: '繁荣', careers: { 战士: '德鲁伊', 法师: '木精灵', 牧师: '园丁', 刺客: '荆棘之冠', 猎人: '美食家', 歌者: '万籁谐音' } },
    { path: '生命', god: '死亡', careers: { 战士: '剔骨工', 法师: '死灵法师', 牧师: '守墓人', 刺客: '死亡编织者', 猎人: '猩红猎手', 歌者: '撞钟人' } },
    { path: '沉沦', god: '污堕', careers: { 战士: '尖啸伯爵', 法师: '欲望主宰', 牧师: '悲悯领主', 刺客: '恶孽', 猎人: '感官追猎者', 歌者: '塞王' } },
    { path: '沉沦', god: '腐朽', careers: { 战士: '木乃伊', 法师: '瘟疫枢机', 牧师: '凋零祭司', 刺客: '疮痍之目', 猎人: '黄昏猎人', 歌者: '腐烂颂唱者' } },
    { path: '沉沦', god: '湮灭', careers: { 战士: '清道夫', 法师: '烬灭者', 牧师: '焚化工', 刺客: '寂灭使徒', 猎人: '终焉行者', 歌者: '毁灭宣告' } },
    { path: '存在', god: '时间', careers: { 战士: '指针骑士', 法师: '时间行者', 牧师: '遗忘医生', 刺客: '另日刺客', 猎人: '驯风游侠', 歌者: '吟游诗人' } },
    { path: '存在', god: '记忆', careers: { 战士: '镜中人', 法师: '回忆旅者', 牧师: '见证者', 刺客: '旧日追猎者', 猎人: '窥梦游侠', 歌者: '史学家' } },
    { path: '虚无', god: '命运', careers: { 战士: '今日勇者', 法师: '编剧', 牧师: '织命师', 刺客: '窃命之贼', 猎人: '终末之笔', 歌者: '预言家' } },
    { path: '虚无', god: '欺诈', careers: { 战士: '杂技演员', 法师: '诡术大师', 牧师: '小丑', 刺客: '受害者', 猎人: '驯兽师', 歌者: '魔术师' } }
];
const PROFESSIONS = PROFESSION_GROUPS.flatMap(group =>
    Object.entries(group.careers).map(([className, name]) => ({
        name,
        className,
        god: group.god,
        path: group.path
    }))
);
const PROFESSION_ALIASES = {
    博士学者: '博识学者',
    折光诡影: '折光扰影',
    坚壁骑士: '坚壁战士',
    偃偶师: '傀儡师',
    子嗣牧: '子嗣牧师',
    生灵吟者: '唱夜之喉',
    不朽乐章: '万籁谐音',
    疮瘢之目: '疮痍之目',
    环卫工: '清道夫',
    炬灭者: '烬灭者',
    毁灭宣誓: '毁灭宣告',
    痴梦游侠: '窥梦游侠',
    驭兽师: '驯兽师'
};
const PROFESSION_NAMES = new Set(PROFESSIONS.map(item => item.name));
const CLASS_HEALTH_RULES = {
    战士: { baseHp: 120 },
    刺客: { baseHp: 80 },
    法师: { baseHp: 80 },
    猎人: { baseHp: 80 },
    牧师: { baseHp: 105 },
    歌者: { baseHp: 100 }
};
const CLASS_HEALTH_TABLE = [
    { score: 1000, 战士: 120, 牧师: 105, 歌者: 100, 法师: 80, 刺客: 80, 猎人: 80 },
    { score: 1100, 战士: 126, 牧师: 110, 歌者: 105, 法师: 84, 刺客: 84, 猎人: 84 },
    { score: 1200, 战士: 132, 牧师: 115, 歌者: 110, 法师: 88, 刺客: 88, 猎人: 88 },
    { score: 1300, 战士: 138, 牧师: 120, 歌者: 115, 法师: 92, 刺客: 92, 猎人: 92 },
    { score: 1400, 战士: 150, 牧师: 130, 歌者: 125, 法师: 100, 刺客: 100, 猎人: 100 },
    { score: 1500, 战士: 162, 牧师: 140, 歌者: 135, 法师: 108, 刺客: 108, 猎人: 108 },
    { score: 1600, 战士: 174, 牧师: 150, 歌者: 145, 法师: 116, 刺客: 116, 猎人: 116 },
    { score: 1700, 战士: 186, 牧师: 160, 歌者: 155, 法师: 124, 刺客: 124, 猎人: 124 },
    { score: 1800, 战士: 198, 牧师: 180, 歌者: 175, 法师: 132, 刺客: 132, 猎人: 132 },
    { score: 1900, 战士: 222, 牧师: 200, 歌者: 195, 法师: 148, 刺客: 148, 猎人: 148 },
    { score: 2000, 战士: 246, 牧师: 220, 歌者: 215, 法师: 164, 刺客: 164, 猎人: 164 },
    { score: 2100, 战士: 270, 牧师: 240, 歌者: 235, 法师: 180, 刺客: 180, 猎人: 180 },
    { score: 2200, 战士: 294, 牧师: 260, 歌者: 255, 法师: 196, 刺客: 196, 猎人: 196 },
    { score: 2300, 战士: 318, 牧师: 280, 歌者: 275, 法师: 212, 刺客: 212, 猎人: 212 },
    { score: 2400, 战士: 342, 牧师: 300, 歌者: 295, 法师: 228, 刺客: 228, 猎人: 228 }
];
const SCORE_RESISTANCE_SKINS = [
    { minScore: 2200, name: '抗性皮肤++', description: '获得抵抗一次硬控，冷却 2 回合。' },
    { minScore: 1800, name: '抗性皮肤+', description: '获得抵抗一次硬控，冷却 3 回合。' },
    { minScore: 1400, name: '抗性皮肤', description: '获得抵抗一次硬控，冷却 4 回合。' }
];
const SCORE_RESISTANCE_NOTE = '抗性皮肤为被动，会自动获得；冷却是指抵抗控制后，下次再获得的回合。';
const CLASS_HEALTH_SCORE_MIN = CLASS_HEALTH_TABLE[0].score;
const CLASS_HEALTH_SCORE_MAX = CLASS_HEALTH_TABLE[CLASS_HEALTH_TABLE.length - 1].score;
const CLASS_HEALTH_SCORE_STEP = 100;
const CLASS_HEALTH_BY_SCORE = Object.fromEntries(
    CLASS_HEALTH_TABLE.map(row => [row.score, row])
);
const CLASS_HEALTH_SCORE_LABEL = `${CLASS_HEALTH_SCORE_MIN}-${CLASS_HEALTH_SCORE_MAX}`;
const getHealthScoreBand = (score) => Math.max(
    CLASS_HEALTH_SCORE_MIN,
    Math.min(CLASS_HEALTH_SCORE_MAX, Math.floor(Number(score || CLASS_HEALTH_SCORE_MIN) / CLASS_HEALTH_SCORE_STEP) * CLASS_HEALTH_SCORE_STEP)
);
const getHealthTableValue = (className, score) => {
    const band = getHealthScoreBand(score);
    return {
        band,
        hp: Number(CLASS_HEALTH_BY_SCORE[band]?.[className] || 0),
        isClampedHigh: Number(score || 0) > CLASS_HEALTH_SCORE_MAX
    };
};
const getScoreResistanceSkin = (score) => {
    const cleanScore = Number(score || 0);
    return SCORE_RESISTANCE_SKINS.find(item => cleanScore >= item.minScore) || null;
};
const CLASS_TRAITS = {
    战士: '高血量前排。适合承伤、贴身压制和保护队友；血量按登神分档位表提升。',
    刺客: '高爆发游击。适合绕后、收割和制造单点威胁；身板较脆，需要依靠先手与位移。',
    法师: '远程术式输出。适合范围压制、控制与规则型技能；血量较低，怕被近身集火。',
    猎人: '追踪与远程压制。适合标记目标、陷阱、风筝和稳定补刀；血量较低，但战术距离更灵活。',
    牧师: '治疗与守护核心。适合续航、净化、救援和团队保护；分数档成长后血量能明显抬升。',
    歌者: '节奏与群体支援。适合增益、削弱、士气操控和回合节奏干预；血量中等，依赖站位与时机。'
};
const PROSPERITY_HEALTH_BONUS = {
    战士: 24,
    牧师: 20,
    歌者: 18,
    刺客: 16,
    猎人: 16,
    法师: 16
};
const FAITH_TRAITS = {
    诞育: '攻击或治疗会使目标怀孕，同时最多存在两个婴儿。【怀孕】：2 轮后分娩，受到 10 伤害，然后诞下一个 0 攻 1 血的婴儿。',
    繁荣: '生命值提高：战士 +24，牧师 +20，歌者 +18，刺客/猎人/法师 +16。',
    死亡: '每局一次，积攒 7 具尸体后可以复活，复活后为 1 血，先手 +1，无法行动一轮；尸体可积攒 15 具，但无法带入下轮试炼。',
    污堕: '可以与其他人共赴沉沦，强制自己与一个目标无法行动一回合，CD 5 回合。',
    腐朽: '可以燃烧自己 15 血，对指定目标造成 25 伤害，CD 5 回合。',
    湮灭: '开局获得一次湮灭，湮灭人或物后获得加成，仅一次。战士：+15 血；法/刺/猎/歌：首次单体攻击 +15 伤；牧师：治疗最终 +5。',
    秩序: '开局时自己获得律令:守序，每回合不主动攻击+1层守序，每层提升2点减伤（初始有2层），守序上限为4层，违规后移除减伤并获得惩罚。',
    真理: '解析：每次进行攻击或治疗获得 1 层，每层提升 2 点攻击或 2 点治疗加成，最多 3 层。',
    战争: '每局一次，击败一个玩家后获得永久攻击 +12。',
    混乱: '使一个目标进入混乱一回合，CD 6 回合。混乱后所有行动随机取目标。',
    痴愚: '每次攻击会对一个目标附带一次愚昧效果，使其攻击 -2，最多 4 层。',
    沉默: '指定一个目标获得一回合沉默，CD 5 回合。',
    记忆: '可以记录一个自己的 C 级天赋，使其在下回合再次发动，一局一次。',
    时间: '每经过四回合后，获得一个额外行动回合；第 5、10、15 回合获得。',
    欺诈: '对指定目标宣告一个是否事件，秘密给出答案，对方回答后若不同则造成30伤害，冷却4回合。',
    命运: '可以在自己丢出骰子时，再丢一个骰子，并选择是否替换它，一局 2 次。'
};
const GOD_SKINS = {
    欺诈: {
        primary: '#d7a95f',
        secondary: '#7b4fc8',
        glow: 'rgba(215,169,95,0.22)',
        dark: 'rgba(39,25,61,0.78)',
        palette: '暗紫 / 暖鎏金',
        motif: '假面弯月',
        pattern: '谎言弯月、假面剪影',
        particle: '金色碎面具',
        oracle: '不辨真伪，勿论虚实。',
        entryTitle: '进入愚戏',
        entryHint: '你即将踏入欺诈之神的谎言切片。',
        confirmText: '戴上面具',
        cancelText: '暂不入局'
    },
    命运: {
        primary: '#91a7ff',
        secondary: '#8a5cff',
        glow: 'rgba(138,92,255,0.22)',
        dark: 'rgba(28,24,68,0.78)',
        palette: '冷紫 / 星轨蓝',
        motif: '星轨骰面',
        pattern: '星盘、命运轨迹、环形刻度',
        particle: '紫色骰子光点',
        oracle: '命若繁星，望而不及。',
        entryTitle: '骰定命运',
        entryHint: '命运之神已记录你的入局。',
        confirmText: '掷骰入局',
        cancelText: '等待下一次星轨'
    },
    记忆: {
        primary: '#9ec9dc',
        secondary: '#d8dde7',
        glow: 'rgba(158,201,220,0.20)',
        dark: 'rgba(22,38,52,0.78)',
        palette: '雾蓝 / 银白',
        motif: '残页流光',
        pattern: '书页折痕、记忆碎片、流光残影',
        particle: '透明书页碎片',
        oracle: '昔我长铭，流光拓影。',
        entryTitle: '读取残页',
        entryHint: '记忆之神将为你展开一段残留记录。',
        confirmText: '敬献记忆',
        cancelText: '封存残页'
    },
    时间: {
        primary: '#9bc9ef',
        secondary: '#cfd8e8',
        glow: 'rgba(155,201,239,0.18)',
        dark: 'rgba(18,38,58,0.78)',
        palette: '冰蓝 / 冷银',
        motif: '沙漏裂隙',
        pattern: '沙粒轨迹、时间裂隙、流动线',
        particle: '细沙光点',
        oracle: '时光如隙，我亦如风。',
        entryTitle: '时间回溯',
        entryHint: '沙漏开始倒转，试炼即将重置。',
        confirmText: '踏入时间裂隙',
        cancelText: '等待钟鸣结束'
    },
    诞育: {
        primary: '#81c487',
        secondary: '#d8ad64',
        glow: 'rgba(129,196,135,0.20)',
        dark: 'rgba(24,53,37,0.78)',
        palette: '苔青 / 琥珀',
        motif: '嫩芽花苞',
        pattern: '藤蔓、生命环、花苞纹理',
        particle: '淡绿叶片',
        oracle: '感孕生命，行育自然。',
        entryTitle: '进入诞育试炼',
        entryHint: '诞育之神将观察你对生命的选择。',
        confirmText: '接受生命试炼',
        cancelText: '离开繁衍祭坛'
    },
    繁荣: {
        primary: '#9ccd65',
        secondary: '#e1c36d',
        glow: 'rgba(156,205,101,0.18)',
        dark: 'rgba(38,56,28,0.78)',
        palette: '嫩草绿 / 浅金',
        motif: '麦穗生长',
        pattern: '生长螺旋、农田纹理、果实纹样',
        particle: '叶片与金色碎光',
        oracle: '万物滋生，亦繁亦荣。',
        entryTitle: '丰收祭典',
        entryHint: '繁荣之神将记录你的生长轨迹。',
        confirmText: '播种试炼',
        cancelText: '离开神殿'
    },
    死亡: {
        primary: '#d76565',
        secondary: '#9ea1ad',
        glow: 'rgba(215,101,101,0.18)',
        dark: 'rgba(42,31,35,0.82)',
        palette: '暗灰 / 猩红',
        motif: '安息骨纹',
        pattern: '骨纹、安息之眼、死亡裂隙',
        particle: '骨屑与暗红微光',
        oracle: '灵魂安眠，生命终焉。',
        entryTitle: '终焉之门',
        entryHint: '死亡之神已看见你的结局。',
        confirmText: '踏入终焉',
        cancelText: '暂缓死亡'
    },
    污堕: {
        primary: '#c65a88',
        secondary: '#4a2d3a',
        glow: 'rgba(198,90,136,0.20)',
        dark: 'rgba(49,22,38,0.82)',
        palette: '暗玫红 / 浊黑',
        motif: '沉溺触环',
        pattern: '沉溺环、黏液纹路、缠绕触须',
        particle: '玫红雾状浊气',
        oracle: '解开枷锁，直面心欲。',
        entryTitle: '进入沉溺环',
        entryHint: '污堕之神将观察你的欲望边界。',
        confirmText: '沉溺入局',
        cancelText: '保持清醒'
    },
    腐朽: {
        primary: '#a58a57',
        secondary: '#707268',
        glow: 'rgba(165,138,87,0.17)',
        dark: 'rgba(47,42,31,0.82)',
        palette: '土黄褐 / 暗灰',
        motif: '枯木断面',
        pattern: '枯木断面、碎屑裂纹、腐化纹理',
        particle: '腐烂碎屑',
        oracle: '众生应腐，万物将朽。',
        entryTitle: '腐朽降临',
        entryHint: '腐朽之神将记录你的衰败过程。',
        confirmText: '踏入腐朽殿堂',
        cancelText: '保留最后完整之物'
    },
    湮灭: {
        primary: '#b8bcc8',
        secondary: '#555b65',
        glow: 'rgba(184,188,200,0.14)',
        dark: 'rgba(9,10,13,0.90)',
        palette: '深墨黑 / 冷灰',
        motif: '吞噬黑洞',
        pattern: '黑洞、消散星尘、空白裂隙',
        particle: '黑雾与碎星',
        oracle: '于无中生，于寂中灭。',
        entryTitle: '进入湮灭裂隙',
        entryHint: '湮灭之神将抹去你的存在痕迹。',
        confirmText: '坠入虚无',
        cancelText: '保留存在'
    },
    秩序: {
        primary: '#c07855',
        secondary: '#8a5c3a',
        glow: 'rgba(192,120,85,0.18)',
        dark: 'rgba(55,31,27,0.78)',
        palette: '赭红 / 暗铜',
        motif: '天平刻度',
        pattern: '刻度、石碑、规整线框',
        particle: '刻度光斑',
        oracle: '文明火起，秩序长存。',
        entryTitle: '秩序审判',
        entryHint: '秩序之神将校准你的行为边界。',
        confirmText: '接受审判',
        cancelText: '退出法庭'
    },
    真理: {
        primary: '#dce5e8',
        secondary: '#b48d63',
        glow: 'rgba(220,229,232,0.14)',
        dark: 'rgba(35,39,43,0.78)',
        palette: '银白 / 冷铜',
        motif: '法典符眼',
        pattern: '书页、符文眼、知识纹路',
        particle: '书页碎片',
        oracle: '洞窥本质，行见真理。',
        entryTitle: '翻开法典',
        entryHint: '真理之神将展示被隐藏的答案。',
        confirmText: '阅读真相',
        cancelText: '合上书页'
    },
    战争: {
        primary: '#e0644e',
        secondary: '#5e4c45',
        glow: 'rgba(224,100,78,0.20)',
        dark: 'rgba(57,26,23,0.82)',
        palette: '熔岩红 / 黑铁',
        motif: '矛盾战痕',
        pattern: '战痕、裂纹、破碎金属',
        particle: '火星碎屑',
        oracle: '何以求存，唯血与火。',
        entryTitle: '战争启幕',
        entryHint: '战争之神将记录你的牺牲与胜利。',
        confirmText: '踏入战场',
        cancelText: '撤出战火'
    },
    混乱: {
        primary: '#c9b967',
        secondary: '#d48b55',
        glow: 'rgba(201,185,103,0.18)',
        dark: 'rgba(55,49,31,0.78)',
        palette: '雾黄 / 橘灰',
        motif: '扭曲漩涡',
        pattern: '无序线条、漩涡、碎光',
        particle: '无序碎光',
        oracle: '虚构规律，寰宇笑谈。',
        entryTitle: '法则崩坏',
        entryHint: '混乱之神将撕碎你认知中的规律。',
        confirmText: '坠入混乱',
        cancelText: '逃回秩序'
    },
    痴愚: {
        primary: '#d2c785',
        secondary: '#9e9aa4',
        glow: 'rgba(210,199,133,0.16)',
        dark: 'rgba(46,45,38,0.78)',
        palette: '灰白 / 暗黄',
        motif: '空洞斜眸',
        pattern: '歪折线、荒诞符号、空洞眼纹',
        particle: '细碎灰雾',
        oracle: '生命皆痴，文明皆愚。',
        entryTitle: '愚者入场',
        entryHint: '痴愚之神已看见你的自以为是。',
        confirmText: '扮演愚者',
        cancelText: '假装清醒'
    },
    沉默: {
        primary: '#aebbc8',
        secondary: '#758897',
        glow: 'rgba(174,187,200,0.14)',
        dark: 'rgba(25,34,42,0.80)',
        palette: '淡灰蓝 / 冷雾',
        motif: '静音波纹',
        pattern: '静音波纹、无声裂隙、灰雾',
        particle: '无声尘粒',
        oracle: '万物归寂，寰宇无音。',
        entryTitle: '进入无声圣殿',
        entryHint: '沉默之神将保留你的沉默。',
        confirmText: '噤声入局',
        cancelText: '打破沉默'
    }
};
const SIGIL_STROKE = 'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const GOD_SIGILS = {
    诞育: {
        key: 'birth',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 18V10" ${SIGIL_STROKE}/><path d="M12 10c-3.4-.5-5-2.2-5.4-5.1 3 .2 5 1.7 5.4 5.1Z" ${SIGIL_STROKE}/><path d="M12 10c3.2-.4 4.9-2 5.3-4.8-2.9.1-4.8 1.6-5.3 4.8Z" ${SIGIL_STROKE}/><path d="M8.3 18h7.4" ${SIGIL_STROKE}/></svg>`
    },
    繁荣: {
        key: 'prosperity',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 18V6" ${SIGIL_STROKE}/><path d="M12 8c2.9 1.4 4.4 3.4 4.7 6.4" ${SIGIL_STROKE}/><path d="M12 8c-2.9 1.4-4.4 3.4-4.7 6.4" ${SIGIL_STROKE}/><path d="M9 8.1l-1.4 1.7M15 8.1l1.4 1.7M9.1 12.3l-1.7 1.2M14.9 12.3l1.7 1.2" ${SIGIL_STROKE}/></svg>`
    },
    死亡: {
        key: 'death',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M8.4 9.2c.9-2 2.2-3 3.6-3s2.7 1 3.6 3c.8 1.8.6 3.7-.6 5.1-.8 1-1.8 1.5-3 1.5s-2.2-.5-3-1.5c-1.2-1.4-1.4-3.3-.6-5.1Z" ${SIGIL_STROKE}/><path d="M10 10.4h.1M14 10.4h.1M10.4 15.8v2.1M12 15.9V18M13.6 15.8v2.1" ${SIGIL_STROKE}/><path d="M8.2 18.2h7.6" ${SIGIL_STROKE}/></svg>`
    },
    记忆: {
        key: 'memory',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M8 6.5h6.2l2 2.1v8.9H8z" ${SIGIL_STROKE}/><path d="M14.2 6.6v2.5h2.2M10 11h4.7M10 13.6h4.2M10 16.1h3" ${SIGIL_STROKE}/><path d="M7 18.2c2.6-1.1 7.5-1.1 10 0" ${SIGIL_STROKE}/></svg>`
    },
    时间: {
        key: 'time',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M8.4 6.5h7.2M8.4 17.5h7.2M9.2 6.6c0 3 2.8 3.7 2.8 5.4s-2.8 2.4-2.8 5.4M14.8 6.6c0 3-2.8 3.7-2.8 5.4s2.8 2.4 2.8 5.4" ${SIGIL_STROKE}/><path d="M12 8.7h.1M12 15.3h.1M10.6 14.2h2.8" ${SIGIL_STROKE}/></svg>`
    },
    秩序: {
        key: 'order',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 5.8v12.4M8.2 8h7.6M7 10.1l-2 4.5h4zM17 10.1l-2 4.5h4zM9 18.2h6" ${SIGIL_STROKE}/><path d="M12 5.8l1.5 2.2h-3z" ${SIGIL_STROKE}/></svg>`
    },
    真理: {
        key: 'truth',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M7.8 6.6h8.4v10.8H7.8z" ${SIGIL_STROKE}/><path d="M9.7 10.4c1.2-1 3.4-1 4.6 0-1.2 1.6-3.4 1.6-4.6 0Z" ${SIGIL_STROKE}/><circle cx="12" cy="10.4" r="1.05" fill="currentColor"/><path d="M9.8 14.4h4.4" ${SIGIL_STROKE}/></svg>`
    },
    战争: {
        key: 'war',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M7.2 17.2 17.1 7.3M16.2 6.3l2.4-.9-.9 2.4M16.8 17.2 6.9 7.3M7.8 6.3l-2.4-.9.9 2.4" ${SIGIL_STROKE}/><path d="M9.7 14.7 8 16.4M14.3 14.7l1.7 1.7" ${SIGIL_STROKE}/></svg>`
    },
    欺诈: {
        key: 'trickery',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M7.1 9.4c1.4-1.9 3-2.9 4.9-2.9 1.8 0 3.5 1 4.9 2.9-.2 4.1-2 6.8-4.9 6.8s-4.7-2.7-4.9-6.8Z" ${SIGIL_STROKE}/><path d="M12 6.6v9.4M9.1 10.8c.9-.8 1.8-.8 2.6 0M12.3 10.8c.9-.8 1.8-.8 2.6 0" ${SIGIL_STROKE}/><path d="M9.8 14.1c1 .8 3.4.8 4.4 0" ${SIGIL_STROKE}/><path d="M6.1 7.2c1.2-.1 2.1.2 2.8.9M17.9 7.2c-1.2-.1-2.1.2-2.8.9" ${SIGIL_STROKE}/></svg>`
    },
    命运: {
        key: 'fate',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 5.9 17.3 9v6L12 18.1 6.7 15V9z" ${SIGIL_STROKE}/><path d="M6.9 9 12 12l5.1-3M12 12v6" ${SIGIL_STROKE}/><circle cx="10.1" cy="9.7" r=".65" fill="currentColor"/><circle cx="13.9" cy="14.3" r=".65" fill="currentColor"/><path d="M8.1 6.9c2.8-2.1 6-2 8 .2" ${SIGIL_STROKE}/></svg>`
    },
    混乱: {
        key: 'chaos',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 6.7c3.1.7 4.5 3 3.4 5.3-.8 1.6-2.8 1.8-3.9.8-.9-.9-.5-2.6.7-3.1" ${SIGIL_STROKE}/><path d="M12 17.3c-3.1-.7-4.5-3-3.4-5.3.8-1.6 2.8-1.8 3.9-.8.9.9.5 2.6-.7 3.1" ${SIGIL_STROKE}/><path d="M6.8 12h2M15.2 12h2" ${SIGIL_STROKE}/></svg>`
    },
    痴愚: {
        key: 'folly',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M7.4 12.2c1.3-2.3 3-3.5 5.1-3.3 1.8.2 3.2 1.4 4.1 3.3-1.2 2.2-2.8 3.2-4.9 3-1.8-.2-3.2-1.2-4.3-3Z" ${SIGIL_STROKE}/><path d="M12 10.2v3.3M10.5 16.6l3-1.6M13.4 7.3l-2.7 1.6" ${SIGIL_STROKE}/></svg>`
    },
    污堕: {
        key: 'defilement',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 6.5c2.2 2.4 3.3 4.3 3.3 5.9 0 2-1.4 3.5-3.3 3.5s-3.3-1.5-3.3-3.5c0-1.6 1.1-3.5 3.3-5.9Z" ${SIGIL_STROKE}/><path d="M8.1 16.7c-1.7-1-2.4-2.4-2.1-4.2M15.9 16.7c1.7-1 2.4-2.4 2.1-4.2M9.6 18.2c1.6.7 3.2.7 4.8 0" ${SIGIL_STROKE}/></svg>`
    },
    腐朽: {
        key: 'decay',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M12 6.4v11.2M8.4 17.6h7.2M9.5 6.9h5l-.9 3.2h-3.2z" ${SIGIL_STROKE}/><path d="M10.4 10.5 8 12.9M13.6 10.5l2.4 2.4M9.6 14.4h4.8" ${SIGIL_STROKE}/><path d="M7.3 8.1 6 6.7M16.7 8.1 18 6.7" ${SIGIL_STROKE}/></svg>`
    },
    湮灭: {
        key: 'annihilation',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><circle cx="12" cy="12" r="3.3" ${SIGIL_STROKE}/><path d="M7 12c2.6-4.2 7.4-4.2 10 0M7 12c2.6 4.2 7.4 4.2 10 0" ${SIGIL_STROKE}/><path d="M5.9 7.5h.1M18.1 16.5h.1M17.7 6.7l-1.2 1.2M7.5 16.1l-1.2 1.2" ${SIGIL_STROKE}/></svg>`
    },
    沉默: {
        key: 'silence',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M8.1 12.2c1.3-.9 2.6-.9 3.9 0 1.3-.9 2.6-.9 3.9 0" ${SIGIL_STROKE}/><path d="M8 15h8M6.7 8.4c1.8-1.6 3.4-2 4.8-1.2M17.3 8.4c-1.8-1.6-3.4-2-4.8-1.2" ${SIGIL_STROKE}/><path d="M12 6.7v10.6" ${SIGIL_STROKE}/></svg>`
    }
};
const PATH_META = {
    生命: { sigil: '✦', emblem: '芽印', tone: '苔青 / 腐木暗绿 / 浅琥珀柔光', edict: '感孕生命，行育自然；万物滋生，亦繁亦荣；灵魂安眠，生命终焉' },
    沉沦: { sigil: '◒', emblem: '◒', tone: '深墨黑 / 暗灰浊雾', edict: '解开枷锁，直面心欲；众生应腐，万物将朽；于无中生，于寂中灭' },
    文明: { sigil: '▣', emblem: '▣', tone: '赭红 / 暗铜 / 岩浆橙', edict: '文明火起，秩序长存；洞窥本质，行见真理；何以求存，唯血与火' },
    混沌: { sigil: '✺', emblem: '✺', tone: '灰黄雾霭 / 破碎黑纹', edict: '虚构规律，寰宇笑谈；万物归寂，寰宇无音；生命皆痴，文明皆愚' },
    存在: { sigil: '◇', emblem: '流痕', tone: '冷银灰 / 雾蓝 / 暗紫流光', edict: '昔我长铭，流光拓影；时光如隙，我亦如风' },
    虚无: { sigil: '◈', emblem: '虚印', tone: '暗鎏金 / 螺旋迷纹紫 / 小丑灰', edict: '不辨真伪，勿论虚实；命若繁星，望而不及' }
};
const ERA_TIMELINE = [
    { path: '生命', order: '第一时代', title: '生命纪元', prophecy: '万物滋生，生死往复', rift: '藤蔓初生' },
    { path: '沉沦', order: '第二时代', title: '沉沦纪元', prophecy: '纵情腐朽，归于湮灭', rift: '腐化裂隙' },
    { path: '文明', order: '第三时代', title: '文明纪元', prophecy: '铸规持理，战火兴邦', rift: '战争断碑' },
    { path: '混沌', order: '第四时代', title: '混沌纪元', prophecy: '虚构规律，寰宇皆愚', rift: '混沌漩涡' },
    { path: '存在', order: '第五时代', title: '存在纪元', prophecy: '流光拓影，时序不息', rift: '时光沙漏' },
    { path: '虚无', order: '第六时代', title: '虚无纪元 · 现世', prophecy: '假面垂落，骰定万命', rift: '虚空星轨' }
];
const VOID_CHRONICLES = [
    '时间退散，欺诈来袭；命运骰子仍在裂隙中转动。',
    '不辨真伪，勿论虚实。每一条证言都会成为愚戏的一枚筹码。',
    '命若繁星，望而不及。当前现世仍由假面与星轨共同注视。',
    '虚无纪元降临，所有试炼切片都在等待下一位入局信徒。'
];
const ERA_CHRONICLE_LIBRARY = {
    生命: [
        { lead: '感孕生命，行育自然。', note: '藤蔓沿着试炼档案缓慢生长，生与死在同一页上互相校订。' },
        { lead: '万物滋生，亦繁亦荣。', note: '每一次通关登记都是一枚新芽，每一次失败也会回到泥土。' },
        { lead: '灵魂安眠，生命终焉。', note: '生命纪元并不拒绝死亡，它只要求终点也留下可被后来者读取的纹理。' }
    ],
    沉沦: [
        { lead: '解开枷锁，直面心欲。', note: '玫红浊气贴着边缘游走，心欲与枷锁同时在试炼记录里发酵。' },
        { lead: '众生应腐，万物将朽。', note: '沉沦纪元的证言不会立刻消失，它们先变暗，再变成更顽固的污痕。' },
        { lead: '于无中生，于寂中灭。', note: '每个被抹去的名字都会在空白处留下轮廓，等待下一位入局者看见。' }
    ],
    文明: [
        { lead: '文明火起，秩序长存。', note: '石碑、兵器与刻度线垂在两侧，所有试炼都被纳入可审阅的秩序。' },
        { lead: '洞窥本质，行见真理。', note: '文明纪元把证言装订成法典，也把每一次争执铸成新的规则。' },
        { lead: '何以求存，唯血与火。', note: '战火没有离开档案馆，只是被压成一枚枚静默的红铜印。' }
    ],
    混沌: [
        { lead: '虚构规律，寰宇笑谈。', note: '边缘漩涡缓慢扭曲，所有稳定排序都只是暂时同意的幻觉。' },
        { lead: '生命皆痴，文明皆愚。', note: '混沌纪元把严肃判词折成笑话，再把笑话重新钉回试炼墙。' },
        { lead: '无序碎光正在漂移。', note: '你看见的每一条路径都可能反过来读取你。' }
    ],
    存在: [
        { lead: '昔我长铭，流光拓影。', note: '书页与沙漏在边缘翻动，记忆不是过去，而是仍在发光的证据。' },
        { lead: '时光如隙，我亦如风。', note: '存在纪元把试炼切成可回看的片段，让每一次选择都留下时间纹。' },
        { lead: '记忆不会静止。', note: '它只是在不同信徒的证言之间换一种速度继续流动。' }
    ],
    虚无: [
        { lead: '命若繁星，望而不及。', note: '当前现世仍由假面与星轨共同注视。' },
        { lead: '欺诈假面垂落。', note: '命运骰子于裂隙之中永不停歇转动。' },
        { lead: '不辨真伪，勿论虚实。', note: '此为虚无纪元的愚戏法则。' },
        { lead: '时间退散，欺诈来袭。', note: '每一条证言都会成为愚戏的一枚筹码。' }
    ]
};
const ATMOSPHERE_CYCLE = ERA_TIMELINE.flatMap(era => {
    const group = GOD_GROUPS.find(item => item.path === era.path);
    return (group?.gods || []).map(god => ({ path: era.path, god }));
});
const GOD_TALENT_POOL_NAMES = {
    诞育: '繁衍孕育池',
    繁荣: '丰收繁荣池',
    死亡: '终焉骨冢池',
    污堕: '沉溺污堕池',
    腐朽: '凋零腐朽池',
    湮灭: '虚空湮灭池',
    秩序: '秩序审判池',
    真理: '真理典籍池',
    战争: '战火征战池',
    混乱: '无序混沌池',
    痴愚: '痴愚幻视池',
    沉默: '寂静无声池',
    时间: '时序沙漏池',
    记忆: '残页记忆池',
    欺诈: '假面愚戏池',
    命运: '星轨骰运池'
};
const GOD_EMPTY_TEXT = {
    items: {
        诞育: '暂无收纳新生器物，静待生命萌芽。',
        繁荣: '未收录丰收器物，尚待耕耘试炼。',
        死亡: '尚无终焉器物留存，灵魂暂得安宁。',
        污堕: '沉溺环中空空，尚未收纳欲望器物。',
        腐朽: '凋零架上暂空，腐朽尚未结成遗物。',
        湮灭: '无器物可供湮灭，一切尚存。',
        秩序: '审判台空置，无承载规则的器物。',
        真理: '典籍架空白，无藏纳真相的器物。',
        战争: '战台空置，无征战兵器留存。',
        混乱: '漩涡之内空荡，无承载无序的器物。',
        痴愚: '幻视台空置，无承载虚妄错觉的器物。',
        沉默: '寂默殿中空空，无承载缄默的器物。',
        时间: '时序台空置，无承载时光的器物。',
        记忆: '忆册架空白，无留存过往的器物。',
        欺诈: '假面台空置，无编织谎言的器物。',
        命运: '星轨台空置，无承载宿命的器物。'
    },
    talents: {
        诞育: '新生环尚未萌芽，天赋之种仍在沉睡。',
        繁荣: '丰收架尚未垂穗，天赋枝蔓仍待抽生。',
        死亡: '安息匣中无魂火，尚未封存任何天赋。',
        污堕: '沉溺环中空空，尚未收纳任何欲望器物。',
        腐朽: '凋零瘢痕尚未成形，天赋仍未腐化入册。',
        湮灭: '虚空槽位静默，无天赋可供吞没。',
        秩序: '审判格尚未落印，无规则天赋归档。',
        真理: '典籍页仍为空白，尚无真理天赋显形。',
        战争: '战痕台未鸣，尚无征伐天赋入列。',
        混乱: '漩涡尚未吐出异象，无序天赋仍未显现。',
        痴愚: '幻视台空置，无承载虚妄错觉的天赋。',
        沉默: '寂默槽位无声，尚未封存缄默天赋。',
        时间: '沙漏未落下天赋之砂，时序槽仍空。',
        记忆: '忆册架空白，尚无残页天赋归档。',
        欺诈: '假面未启，无谎言天赋悬挂于此。',
        命运: '星轨未掷，无命定天赋落入骰面。'
    },
    scoreMessages: {
        default: '尚无结算信封。待审核员封存分数后，加分细则会在此显现。'
    },
    notices: {
        default: '尚无新证言叩门。下一位信徒入局后，此处会亮起楼主提醒。'
    },
    equipped: {
        default: '携带环暂空，请从天赋仓库择一枚天赋嵌入。'
    },
    warehouse: {
        default: '仓库格尚空，新抽得的天赋会优先封入此位。'
    },
    drawLogs: {
        default: '抽取记录尚未刻入池底。'
    },
    clear: {
        default: '尚未登记通关。踏入试炼后，这里会形成你的履迹录。'
    },
    authored: {
        default: '尚未构筑试炼切片；构筑完成后会进入筑戏人记录。'
    }
};
const GOD_FAITH_TITLES = {
    诞育: ['萌芽受印者', '生命执枝人', '诞育环主'],
    繁荣: ['初穗收录者', '丰饶执枝人', '繁荣园主'],
    死亡: ['安眠见证者', '终焉守墓人', '死亡钟主'],
    记忆: ['残页拾取者', '流光誊录人', '记忆册主'],
    时间: ['沙粒观测者', '时序执针人', '时间钟主'],
    秩序: ['刻度受审者', '规训执衡人', '秩序庭主'],
    真理: ['典页求索者', '真相执笔人', '真理法主'],
    战争: ['战痕见习者', '烽火执旗人', '战争席主'],
    欺诈: ['假面试戴者', '谎言执戏人', '欺诈幕主'],
    命运: ['星轨旁观者', '骰面执命人', '命运盘主'],
    混乱: ['异序旁观者', '无序执涡人', '混乱核主'],
    痴愚: ['幻视旁观者', '虚妄执眸人', '痴愚剧主'],
    沉默: ['无声旁观者', '寂默守夜人', '沉默殿主'],
    污堕: ['沉溺观者', '欲望执持人', '沉沦宴主'],
    腐朽: ['凋零旁观者', '腐痕执杖人', '腐朽冢主'],
    湮灭: ['空隙旁观者', '虚无执烬人', '湮灭核主']
};
const PROFILE_CHRONICLE_LINES = {
    诞育: ['新芽沿档案缝隙生长。', '每一次入局都像胎动，被生命纪元重新计数。', '枝蔓不会询问胜败，只记录你是否仍在生长。'],
    繁荣: ['丰收纹在仓库边缘亮起。', '你的每一枚记录都可能结成下一轮果实。', '繁荣并非安逸，而是不断扩张的试炼根系。'],
    死亡: ['钟声在履迹录深处回荡。', '已结束的试炼没有消失，只是换成安静的骨纹。', '死亡替你保管终点，也替后来者标出边界。'],
    记忆: ['残页正在重新排序。', '你留下的证言会先成为回声，再成为别人可读的路标。', '记忆不要求真实无缺，只要求痕迹仍可被追索。'],
    时间: ['沙漏将本页翻慢了一息。', '旧选择并未远去，它们只是排在下一次刷新之前。', '时间把你的履历切成可回看的光片。'],
    秩序: ['刻度线校准了你的档案边框。', '每一场试炼都等待被归档、审阅、裁定。', '秩序让混杂记录拥有可被复核的骨架。'],
    真理: ['典页在你的名字下展开。', '所有分数与证言都会走向同一个问题：它是否成立。', '真理不负责温柔，只负责剥开遮蔽。'],
    战争: ['红铜战痕压住了档案角。', '你的履历不是收藏品，而是一列仍可点燃的战线。', '战争把每一次通关都改写成战果。'],
    欺诈: ['假面在头像框后轻轻偏转。', '这里保存的不只是你，也是你允许他人看到的你。', '欺诈替档案留一条缝，让谎言和真实都能呼吸。'],
    命运: ['骰面停在尚未宣告的一格。', '你的分数不是结论，只是星轨暂时给出的坐标。', '命运喜欢迟到，因为它要等所有选择先入场。'],
    混乱: ['漩涡把观测条轻轻扭歪。', '任何稳定排序都只是暂时同意的幻觉。', '混乱不拆毁档案，它让档案学会变形。'],
    痴愚: ['空洞斜眸注视着你的携带槽。', '越认真封存的记录，越可能在下一刻露出笑意。', '痴愚替你保存那些自以为清醒的瞬间。'],
    沉默: ['无声波纹压低了所有提醒。', '没有证言并不代表空白，也可能是沉默正在归档。', '沉默让档案停止解释，只留下可被凝视的形状。'],
    污堕: ['玫红浊气贴着信封边缘游走。', '欲望不是污点，它是记录开始发热的位置。', '污堕会替你保存每一次沉溺前的犹豫。'],
    腐朽: ['枯木断面在卡片底层浮现。', '旧记录没有坏掉，它们只是开始发酵。', '腐朽把过时的胜利变成更顽固的纹理。'],
    湮灭: ['黑洞剪影吞下了一段空白。', '被删除的并非不存在，它只是不再替你解释。', '湮灭让档案学会留下空位。']
};
const LOADING_ORACLES = ['不辨真伪，勿论虚实', '昔我长铭，流光拓影', '时光如隙，我亦如风', '感孕生命，行育自然', '凡骨入局，诸神设戏'];
const DIFFICULTY_OPTIONS = [
    { value: '新手', label: '新手本' },
    { value: '低', label: '低难' },
    { value: '中', label: '中难' },
    { value: '高', label: '高难' }
];
const CLEAR_FEEDBACK_OPTIONS = ['机制清楚', '剧情好', '氛围强', '有挑战', '偏难', '想再跑', '需要修订'];
const LEGACY_DIFFICULTY_MAP = { 凡尘: '新手', 觉醒: '低', 超凡: '中', 神话: '高', 愚者: '高' };
const DEFAULT_ASCENSION_SCORE = 1000;
const DEFAULT_AUDIENCE_SCORE = 0;
const LEADERBOARD_PAGE_SIZE = 12;
const ARCHIVE_PAGE_SIZE = 5;
const VISUAL_EFFECTS_STORAGE_KEY = 'visual_effects_enabled_v1';
