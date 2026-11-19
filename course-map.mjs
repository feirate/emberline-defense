import formalCourses from './data/formal-courses.generated.mjs';

const COURSE_DEFINITIONS = [
  {
    id: 'kb3-city',
    title: 'KB3 · 城市地点',
    subtitle: '剑桥国际少儿英语 · Unit 4',
    station: '避难货站',
    packId: 'kb3-u4',
    routes: [
      { id: 'kb3-city-1', title: '城市巡线', levelId: 'map-patrol', words: [
        ['bank', '银行'], ['supermarket', '超市'], ['bus station', '公共汽车站'], ['cinema', '电影院'],
      ] },
      { id: 'kb3-city-2', title: '货站决战', levelId: 'map-boss', words: [
        ['library', '图书馆'], ['market', '市场'], ['sports centre', '体育中心'], ['swimming pool', '游泳池'],
      ] },
    ],
  },
  {
    id: 'yle-starters-animals',
    title: 'YLE Starters · 动物',
    subtitle: '剑桥少儿英语 · Pre A1',
    station: '动物保护区',
    packId: 'yle-starters-animals',
    routes: [
      { id: 'yle-starters-animals-1', title: '保护区巡线', levelId: 'map-patrol', words: [
        ['cat', '猫；貓'], ['dog', '狗；犬'], ['duck', '鸭子；鸭；鴨子'], ['fish', '鱼；魚'],
      ] },
      { id: 'yle-starters-animals-2', title: '保护区决战', levelId: 'map-boss', words: [
        ['horse', '马；馬'], ['frog', '青蛙；蛙'], ['tiger', '老虎；虎'], ['zebra', '斑马；斑馬'],
      ] },
    ],
  },
];

export function buildCourses(packs = []) {
  const sourceEntries = new Map(packs.flatMap(pack => (pack.entries ?? []).map(entry => [entry.id, entry])));
  const previewCourses = COURSE_DEFINITIONS.map(({ id, packId, routes, ...course }) => ({
    id,
    ...course,
    stages: routes.map(({ words, ...route }) => ({
      ...route,
      packId,
      entries: words.map(([en, zhHint]) => {
        const wordId = `${packId}-${en.replaceAll(' ', '-')}`;
        return sourceEntries.get(wordId) ?? { id: wordId, en, zhHint };
      }),
    })),
  }));
  return [...formalCourses, ...previewCourses];
}
