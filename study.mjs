export const STUDY_MODES = Object.freeze({
  rapid: { mode: 'spell', label: '补全英文拼写' },
  arc: { mode: 'repeat-en', label: '听辨并跟读英文' },
  shock: { mode: 'translate', label: '听英文写中文' },
  armor: { mode: 'repeat-zh', label: '听英文读中文' },
});

// Curated cues for the first Unit 4 words. Other words use the chosen unit's entries.
const WORDS = [
  {
    slug: 'bank', en: 'bank', zh: '银行', alternatives: ['銀行'],
    prefix: 'b', chunk: 'ank', suffix: '',
    spellingHint: '第一个空填 a，最后一个空填 k。再听听中间的字母。', meaningHint: '可以存钱、取钱的地方。',
  },
  {
    slug: 'supermarket', en: 'supermarket', zh: '超市', alternatives: ['超级市场', '超級市場'],
    prefix: 'super', chunk: 'market', suffix: '',
    spellingHint: 'super 后面补上「市场」的英文。', meaningHint: '可以在这里一次买到蔬菜、面包和日用品。',
  },
  {
    slug: 'bus-station', en: 'bus station', zh: '公共汽车站', alternatives: ['公交车站', '公交站', '公共汽車站', '巴士站', '公共汽车车站'],
    prefix: 'bus ', chunk: 'station', suffix: '',
    spellingHint: '先看到 bus，再补上「车站」的英文。', meaningHint: '人们在这里等公共汽车。',
  },
  {
    slug: 'cinema', en: 'cinema', zh: '电影院', alternatives: ['影院', '電影院', '影劇院'],
    prefix: 'ci', chunk: 'ne', suffix: 'ma',
    spellingHint: '两个空里，第一个填 n。再听听后面的元音。', meaningHint: '人们买票进去看电影。',
  },
  {
    slug: 'library', en: 'library', zh: '图书馆', alternatives: ['圖書館'],
    prefix: 'li', chunk: 'bra', suffix: 'ry',
    spellingHint: '中间缺三个字母，从 b 开始。听清完整的词再补。', meaningHint: '在这里可以借书和安静地看书。',
  },
  {
    slug: 'market', en: 'market', zh: '市场', alternatives: ['市場', '集市'],
    prefix: 'mar', chunk: 'ket', suffix: '',
    spellingHint: '后面缺三个字母，从 k 开始。再听听结尾。', meaningHint: '有许多摊位，大家来这里买菜、买东西。',
  },
];

const DEFAULT_PACK = 'kb3-u4';
const firstWords = WORDS.map(word => Object.freeze({ ...word, id: `${DEFAULT_PACK}-${word.slug}` }));

export function isStudyAudioPath(path) {
  return typeof path === 'string' && /^\.\/assets\/study\/[a-z0-9-]+\.m4a$/.test(path);
}

// Only used for free-text Chinese answers. Keep the question and its saved signature stable.
const TRANSLATION_ALIASES = new Map(Object.entries({
  'kb3-hello-comic': ['漫画书', '漫畫', '漫畫書'],
  'kb3-hello-computer': ['计算机', '電子計算機', '計算機', '電腦'],
  'kb3-hello-bike': ['单车', '腳踏車', '脚踏车', '自行車', '單車'],
  'kb3-hello-kite': ['風箏'],
  'kb3-hello-doll': ['娃娃', '玩偶', '洋娃娃', '布娃娃'],
  'kb3-hello-robot': ['機器人'],
  'kb3-hello-playground': ['儿童游乐场', '兒童遊樂場', '操場'],
  'kb3-u1-aunt': ['阿姨', '姨姨', '姑姑', '姑母', '姨母', '婶婶', '嬸嬸'],
  'kb3-u1-daughter': ['女兒'],
  'kb3-u1-granddaughter': ['孫女', '外孫女'],
  'kb3-u1-grandson': ['孫子', '外孫'],
  'kb3-u1-grandparents': ['爷爷奶奶', '祖父和祖母', '外公外婆', '爺爺奶奶'],
  'kb3-u1-son': ['兒子'],
  'kb3-u1-uncle': ['叔叔', '叔父', '伯伯', '伯父', '舅父', '姑丈', '姨丈'],
  'kb3-u1-quiet': ['安静', '安靜', '安靜的'],
  'kb3-u2-lift': ['升降机', '升降機', '電梯'],
  'kb3-u2-balcony': ['陽台', '陽臺', '阳臺'],
  'kb3-u2-flat': ['公寓房', '一套公寓'],
  'kb3-u2-village': ['村子', '村落', '鄉村', '乡村', '村莊'],
  'kb3-u2-upstairs': ['楼上', '上楼', '樓上', '上樓'],
  'kb3-u2-downstairs': ['楼下', '下楼', '樓下', '下樓'],
  'kb3-u3-get-dressed': ['穿衣服', '穿衣', '穿上衣服', '穿戴整齐'],
  'kb3-u3-get-undressed': ['脱衣服', '脱衣', '脱掉衣服', '脫衣服'],
  'kb3-u3-get-up': ['从床上起来', '從床上起來'],
  'kb3-u3-go-to-bed': ['上床', '去睡觉', '上床睡覺', '就寝', '就寢'],
  'kb3-u3-have-a-shower': ['洗澡', '冲澡', '沖澡', '洗淋浴'],
  'kb3-u3-wake-up': ['睡醒', '醒', '醒來'],
  'kb3-u3-take-off': ['脱掉', '脫掉', '脫下', '摘下'],
  'kb3-u4-bus-station': ['汽车站', '汽車站', '公共巴士站', '公車站'],
  'kb3-u4-market': ['菜市场', '菜市', '菜場', '菜场', '菜市場'],
  'kb3-u4-sports-centre': ['运动中心', '體育中心', '運動中心', '体育运动中心', '體育運動中心'],
  'kb3-u4-swimming-pool': ['泳池', '游泳馆', '游泳館', '遊泳池'],
  'kb3-u5-temperature': ['体温', '温度', '體溫', '溫度'],
  'kb3-u5-cold': ['冷', '寒冷的'],
  'kb3-u5-headache': ['头疼', '頭疼', '頭痛'],
  'kb3-u5-toothache': ['牙疼', '牙齿疼', '牙齿痛', '牙齒痛'],
  'kb3-u5-stomach-ache': ['胃疼', '肚子疼', '腹痛'],
  'kb3-u5-doctor': ['大夫', '医师', '醫生', '醫師'],
  'kb3-u5-hospital': ['醫院'],
  'kb3-u6-grass': ['小草', '青草'],
  'kb3-u6-leaf': ['树叶', '樹葉', '葉子'],
  'kb3-u6-plant': ['植株'],
  'kb3-u6-river': ['河', '江河', '江'],
  'kb3-u6-lake': ['湖泊'],
  'kb3-u6-forest': ['树林', '樹林'],
  'kb3-u7-whale': ['鲸鱼', '鯨魚', '鯨'],
  'kb3-u7-panda': ['大熊猫', '熊貓', '大熊貓'],
  'kb3-u7-lion': ['獅子'],
  'kb3-u7-shark': ['鯊魚'],
  'kb3-u8-windy': ['有风', '多风的', '刮风的', '刮风', '有風的'],
  'kb3-u8-wet': ['湿', '湿润', '湿润的', '潮湿', '濕的', '潮濕'],
  'kb3-u8-sunny': ['晴天', '晴', '晴朗', '有阳光的', '阳光明媚的'],
  'kb3-u8-cloudy': ['多云', '多雲', '多雲的'],
  'kb3-u8-snow': ['下雪', '白雪'],
}));

function validUnit(packId, entries) {
  return typeof packId === 'string' && (Array.isArray(entries)
    ? /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(packId)
    : /^kb3-(?:hello|u[1-8])$/.test(packId));
}

function fromEntry(entry, packId) {
  if (!entry || typeof entry.id !== 'string' ||
      typeof entry.en !== 'string' || typeof entry.zhHint !== 'string' || !entry.zhHint.trim()) return null;
  const audio = entry.audio;
  if (audio !== undefined && !isStudyAudioPath(audio)) return null;
  const slug = entry.id.startsWith(`${packId}-`) ? entry.id.slice(packId.length + 1) : audio ? entry.id : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const curated = firstWords.find(word => word.id === entry.id && word.en === entry.en && word.zh === entry.zhHint);
  if (curated) return audio ? Object.freeze({ ...curated, audio }) : curated;

  const tail = entry.en.match(/([a-z]+)([^a-z]*)$/i);
  if (!tail) return null;
  const tailLength = tail[1].length;
  const blankCount = Math.min(4, Math.ceil(tailLength / 2));
  const start = tail.index + tailLength - blankCount;
  const end = start + blankCount;
  const meanings = entry.zhHint.split(/[；;、]/u).map(meaning => meaning.trim()).filter(Boolean);
  return Object.freeze({
    id: entry.id, slug, en: entry.en, zh: meanings[0], alternatives: meanings.slice(1),
    ...(audio ? { audio } : {}),
    prefix: entry.en.slice(0, start), chunk: entry.en.slice(start, end), suffix: entry.en.slice(end),
    spellingHint: `空格从 ${entry.en[start].toUpperCase()} 开始。再听一遍，补上这一段。`,
    meaningHint: `再听一遍，想想这个词在本单元里的中文意思。`,
  });
}

function unitWords(packId, entries) {
  if (!Array.isArray(entries)) return packId === DEFAULT_PACK ? firstWords : [];
  const words = entries.map(entry => fromEntry(entry, packId)).filter(Boolean);
  if (packId !== DEFAULT_PACK) return words;
  const curated = firstWords.map(word => words.find(entry => entry.id === word.id)).filter(Boolean);
  return [...curated, ...words.filter(word => !curated.includes(word))];
}

export function createStudySession(roundIndex = 0, optionOffset = Math.floor(Math.random() * 3), {
  packId = DEFAULT_PACK, entries, priorityWordIds = [],
} = {}) {
  const index = Number.isSafeInteger(roundIndex) && roundIndex >= 0 ? roundIndex : 0;
  const offset = Number.isSafeInteger(optionOffset) && optionOffset >= 0 && optionOffset < 3 ? optionOffset : 0;
  const unit = validUnit(packId, entries) ? packId : DEFAULT_PACK;
  const words = unitWords(unit, entries);
  if (!words.length) throw new RangeError('本单元没有可用的词条');
  const shift = index * 2 % words.length;
  const rotated = [...words.slice(shift), ...words.slice(0, shift)];
  const priority = [...new Set(priorityWordIds)].map(id => rotated.find(word => word.id === id)).filter(Boolean);
  const ordered = [...priority, ...rotated.filter(word => !priority.includes(word))];
  return Object.freeze({ roundIndex: index, optionOffset: offset, packId: unit, words: Object.freeze(ordered) });
}

export function serializeStudySession(session) {
  return {
    roundIndex: session.roundIndex,
    optionOffset: session.optionOffset,
    packId: session.packId,
    wordIds: session.words.map(word => word.id),
  };
}

export function restoreStudySession(saved, entries) {
  if (!saved || !validUnit(saved.packId, entries) ||
      !Number.isSafeInteger(saved.roundIndex) || saved.roundIndex < 0 ||
      !Number.isSafeInteger(saved.optionOffset) || saved.optionOffset < 0 || saved.optionOffset >= 3 ||
      !Array.isArray(saved.wordIds) || new Set(saved.wordIds).size !== saved.wordIds.length) return null;
  const trusted = unitWords(saved.packId, entries);
  if (!trusted.length || saved.wordIds.length !== trusted.length) return null;
  const words = saved.wordIds.map(id => trusted.find(word => word.id === id));
  if (words.some(word => !word)) return null;
  return Object.freeze({
    roundIndex: saved.roundIndex, optionOffset: saved.optionOffset, packId: saved.packId, words: Object.freeze(words),
  });
}

function answerFields(word, mode) {
  const { en, zh, prefix, chunk, suffix } = word;
  const spell = mode === 'spell';
  const answers = spell ? [chunk, en] : mode === 'repeat-en' ? [en] :
    mode === 'translate' ? [zh, ...word.alternatives] : [zh];
  return {
    stem: spell ? `${prefix}${'_'.repeat(chunk.length)}${suffix}` : '',
    prefix: spell ? prefix : '',
    suffix: spell ? suffix : '',
    blankCount: spell ? chunk.length : 0,
    hint: spell ? word.spellingHint : word.meaningHint,
    placeholder: spell ? '输入空缺的字母' : mode === 'translate' ? '输入听到单词的中文意思' : '',
    answers: Object.freeze(answers),
  };
}

export function createQuestion(session, upgradeIndex, kind) {
  const mode = STUDY_MODES[kind]?.mode;
  if (!mode || !Number.isSafeInteger(upgradeIndex) || upgradeIndex < 0) {
    throw new RangeError('Unknown study exercise');
  }
  const wordIndex = upgradeIndex % session.words.length;
  const word = session.words[wordIndex];
  const { en, zh, slug, chunk } = word;
  const shortExercise = (mode === 'spell' && chunk.length <= 3) || mode === 'repeat-en';
  const fallbackMode = mode === 'repeat-en' ? 'spell' : mode === 'repeat-zh' ? 'translate' : null;
  const options = [];
  if (fallbackMode) {
    const language = mode === 'repeat-en' ? 'en' : 'zh';
    const offset = (wordIndex + session.optionOffset + Math.floor(upgradeIndex / session.words.length)) % 3;
    const pool = session.words.map((_, index) => session.words[(wordIndex + index + 2) % session.words.length]);
    for (const candidate of [...pool, ...firstWords]) {
      const answer = candidate[language];
      if (normalize(answer) === normalize(word[language]) || options.includes(answer)) continue;
      options.push(answer);
      if (options.length === 2) break;
    }
    options.splice(offset, 0, word[language]);
  }
  return Object.freeze({
    id: `round-${session.roundIndex}-upgrade-${upgradeIndex}-${kind}`,
    targetId: word.id,
    mode,
    en,
    zh,
    seconds: shortExercise ? 30 : 60,
    audio: word.audio ?? `./assets/study/${slug}.m4a`,
    options: Object.freeze(options),
    ...answerFields(word, mode),
    ...(fallbackMode ? { readingFallback: Object.freeze({ mode: fallbackMode, ...answerFields(word, fallbackMode) }) } : {}),
  });
}

export function readingFallbackQuestion(question) {
  const { readingFallback, ...source } = question;
  return readingFallback ? Object.freeze({ ...source, ...readingFallback, options: Object.freeze([]) }) : null;
}

function normalize(value) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ').replace(/[。!?！.]+$/u, '').trim();
}

function normalizeTranslation(value) {
  return normalize(value).replace(/[\s\u200b\u2060]+/gu, '')
    .replace(/^[.。!?,、;:"'‘’“”「」『』]+|[.。!?,、;:"'‘’“”「」『』]+$/gu, '');
}

function normalizeSpokenEnglish(value) {
  return normalize(value).replace(/[‐‑–—-]/gu, ' ').replace(/\s+/gu, ' ').trim().replace(/\bcenter\b/gu, 'centre');
}

export function checkReadingAnswer(question, response) {
  if (typeof response !== 'string') return false;
  if (question.mode === 'repeat-zh') {
    return checkAnswer(readingFallbackQuestion(question), response);
  }
  return question.mode === 'repeat-en' && normalizeSpokenEnglish(response) === normalizeSpokenEnglish(question.en);
}

export function spellingSlots(question, response = '') {
  const normalized = normalize(response);
  const text = normalized === normalize(question.en) ? question.answers[0] : normalized;
  return Array.from({ length: question.blankCount }, (_, index) => text[index] ?? '');
}

export function checkAnswer(question, response) {
  if (typeof response !== 'string') return false;
  if (question.mode === 'translate') {
    const answer = normalizeTranslation(response);
    const aliases = TRANSLATION_ALIASES.get(question.targetId) ?? [];
    return answer.length > 0 && [...question.answers, ...aliases]
      .some(expected => normalizeTranslation(expected) === answer);
  }
  const answer = normalize(response);
  return answer.length > 0 && question.answers.some(expected => normalize(expected) === answer);
}
