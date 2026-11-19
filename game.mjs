import {
  createBattle, startBattle, stepBattle, openUpgrade, cancelUpgrade, confirmUpgrade,
  canUpgradeKind, serializeBattle, restoreBattle, bossPrepRemaining, requiredUpgradeCount,
  minimumUpgradePerKind, upgradeLimit,
  UPGRADES, LEVEL_ID,
} from './battle.mjs';
import { createScene } from './scene.mjs';
import { createAudio } from './audio.mjs';
import { createQuestion, createStudySession, serializeStudySession, restoreStudySession } from './study.mjs';
import { createStudyDesk } from './study-desk.mjs';
import {
  createProgressStore, recordStudy, recordResult, mapStageProgress, saveMapStage, setActiveMapStage, STORAGE_KEY,
} from './progress.mjs';
import { bindCaptainPanel } from './captain-panel.mjs';
import { buildCourses } from './course-map.mjs';
import { createMapUI } from './map-ui.mjs';

const byId = (id) => document.getElementById(id);
const field = byId('field');
const restartDialog = byId('restart-dialog');
const mapDialog = byId('course-map');
const scene = createScene(field);
const audio = createAudio();
const store = createProgressStore();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const armorBars = [...byId('armor').children];
const cards = [...document.querySelectorAll('[data-upgrade]')];
const levels = [...document.querySelectorAll('[data-level]')];
const stepSeconds = 1 / 60;
let battle = createBattle();
let lesson = createStudySession();
let paused = false;
let muted = false;
let previousFrame;
let timeBank = 0;
let saveAge = 0;
let runId;
let profile;
let packs = [{ id: 'kb3-u4', label: 'Unit 4 · 城市地点' }];
let loaded = false;
let saveBlocked = false;
let attackUntil = 0;
let pendingResult = null;
let courses = [];
let mapStage = null;
let launchAfterMap = false;
const studyEvents = [];
const pendingMapWords = new Set();

const enemyIntroductions = {
  2: '尸犬伏低后会冲刺',
  3: '拼合怪被击倒后会分裂',
};

const announcements = {
  wave: ({ wave = battle.wave }) => wave === 1 && mapStage?.story?.opening
    ? mapStage.story.opening : `第 ${wave} 波 · ${enemyIntroductions[wave] ?? '敌群接近'}`,
  ready: () => '电芯充满 · 点击亮卡改装',
  install: (event) => `已装配${UPGRADES[event.kind].name}`,
  breach: () => battle.armor ? `避难所被撞 · 护甲 −1 · 剩余 ${battle.armor} 格` : '避难所被撞 · 最后一格护甲耗尽',
  'boss-prep': () => '闸门巨兽逼近 · 答题改装为破甲充能',
  'boss-start': () => '铁闸已破 · 集中火力！',
  'boss-prep-fail': () => '破甲动力不足 · 货站失守',
  win: () => mapStage?.story?.victory ?? '战斗结束 · 避难所安全',
  lose: () => battle.lossReason === 'mission-preparation' ? '尚未完成全部改装 · 已练词已保存'
    : battle.lossReason === 'boss-preparation' ? '破甲动力不足 · 货站失守' : '战斗结束 · 避难所失守',
};

const stageViews = {
  ready: ['100 波耐久巡防', '守住最后的货站', '丧尸碰到避难所边线就扣一格护甲。攒满电芯，点卡答题装车。', '启动列车'],
  paused: ['巡防暂停', '列车待命', '继续后回到原来的战况。', '继续巡防'],
  won: ['撤离信号已收到', '守完了 100 波', '试试另一组车厢组合。', '再守一局'],
  lost: ['防线失守', '避难所护甲耗尽', '再试一次。卡片亮起后，答对一道题就能装上车厢。', '重新出车'],
};
let shownStage;

function setText(id, value) {
  const element = byId(id);
  if (element.textContent !== value) element.textContent = value;
}

function coveredWords(stage) {
  const { wordIds } = mapStageProgress(profile, stage.id);
  return stage.entries.filter(({ id }) => wordIds.includes(id) || (stage.id === mapStage?.id && pendingMapWords.has(id))).length;
}

function mapStageView() {
  if (!mapStage) return stageViews[battle.phase];
  const allWords = coveredWords(mapStage) === mapStage.entries.length;
  const required = requiredUpgradeCount(battle);
  const perKind = minimumUpgradePerKind(battle);
  const goal = perKind ? `，四种车厢各改装 ${perKind} 次` : required ? `，至少改装 ${required} 次才有破甲动力` : '';
  if (battle.phase === 'ready') return ['课程地图', mapStage.title,
    `完成 ${mapStage.entries.length} 个词并守住避难所${goal}。`, '开始出车'];
  if (battle.phase === 'won' && mapStage.story?.victory) return ['通车信号已发出', `${mapStage.title}点灯`,
    `${profile?.name ?? '新车长'}车长完成了 ${mapStage.entries.length} 个词。${mapStage.story.victory}`, '返回课程地图'];
  if (battle.phase === 'won') return ['巡防完成', allWords ? '本趟任务完成' : '货站已守住',
    allWords ? '回课程地图查看下一步。' : '还有词要补练，课程地图可以再出车。', '返回课程地图'];
  if (battle.phase === 'lost' && battle.lossReason === 'mission-preparation') return ['巡线验收', '改装尚未完成',
    `本局改装 ${battle.upgradeCount}/${required} 次。四种车厢各练 ${perKind} 个词，才能为接应列车通车。已完成的词会保留。`, '再试一次'];
  if (battle.phase === 'lost') return ['防线失守',
    battle.lossReason === 'boss-preparation' ? '破甲动力不足' : '避难所失守',
    battle.lossReason === 'boss-preparation' ? `这趟要完成 ${required} 次改装，才能击碎巨兽的铁闸。已完成的词会保留。`
      : '答过的词已经保存。再出车时先练还没完成的词。', '再试一次'];
  return undefined;
}

function syncView() {
  const running = battle.phase === 'running' && !paused && !restartDialog.open && !mapDialog.open;
  const cost = battle.cost;
  const required = requiredUpgradeCount(battle);
  const perKind = minimumUpgradePerKind(battle);
  const affordable = cost !== null && battle.stars >= cost;
  const stage = paused ? 'paused' : battle.phase;
  const view = saveBlocked && paused ? ['存档已更新', '巡防暂时停靠', '打开车长档案，重新选中当前车长。', '重新读取档案']
    : stage === 'paused' ? ['巡防暂停', `继续第 ${battle.wave} 波`,
      battle.phase === 'upgrade' ? '继续这一次答题。' : '继续后回到保存的战况。', '继续巡防']
      : mapStageView();
  byId('stage-overlay').hidden = !view;
  const viewKey = view?.join(' ');
  if (view && shownStage !== viewKey) {
    ['stage-eyebrow', 'stage-title', 'stage-copy', 'stage-action'].forEach((id, index) => {
      setText(id, view[index]);
    });
  }
  shownStage = viewKey;

  byId('stage-action').disabled = !loaded;
  byId('map-button').disabled = !loaded;
  byId('pause').disabled = battle.phase !== 'running';
  byId('restart').hidden = !isOngoing();
  byId('restart').disabled = saveBlocked;
  setText('pause', paused ? '继续' : '暂停');
  setText('wave', String(battle.wave));
  setText('wave-total', ` / ${battle.waveCount}`);
  byId('stage-goal').hidden = !mapStage;
  if (mapStage) {
    const count = coveredWords(mapStage);
    setText('stage-goal', `${mapStage.title} · 已完成 ${count}/${mapStage.entries.length} 词${
      required ? ` · 本局改装 ${Math.min(battle.upgradeCount, required)}/${required}` : ''}`);
  }
  const prep = bossPrepRemaining(battle);
  byId('boss-progress').hidden = prep <= 0;
  if (prep > 0) setText('boss-progress', `闸门巨兽蓄力 ${Math.ceil(prep)} 秒 · ${battle.upgradeCount >= required
    ? '破甲动力充足' : `还需答对 ${required - battle.upgradeCount} 题完成改装`}`);
  const remaining = Math.max(0, Math.ceil(battle.waveDuration - battle.waveTime));
  const ended = battle.phase === 'won' || battle.phase === 'lost';
  setText('time', ended ? '已结束' : battle.phase === 'ready' ? '—' :
    remaining ? `${remaining} 秒` : '清理剩余敌群');
  byId('armor').setAttribute('aria-label', `避难所护甲 ${battle.armor} 格`);
  armorBars.forEach((bar, index) => bar.classList.toggle('empty', index >= battle.armor));

  setText('stars', cost === null ? String(battle.stars) : `${battle.stars} / ${cost}`);
  const bar = byId('battery');
  bar.hidden = ended || cost === null;
  bar.max = cost ?? 1;
  bar.value = cost === null ? 1 : Math.min(battle.stars, cost);
  setText('card-guide', ended ? '本轮改装已结束。' : cost === null ? '所有车厢已满级。' :
    affordable ? (perKind ? `四种车厢各改装 ${perKind} 次。点亮卡答题。` : '电芯充满，点亮卡答题装车。')
      : '击退丧尸，列车会吸收掉落的星形电芯。');
  for (const card of cards) card.disabled = !running || !affordable || !canUpgradeKind(battle, card.dataset.upgrade);
  for (const level of levels) {
    const kind = level.dataset.level;
    const rank = battle.upgrades[kind];
    const text = perKind ? `${rank} / ${perKind}` : rank === upgradeLimit(battle, kind) ? '满级' : rank ? `Lv ${rank}` : '';
    if (level.textContent !== text) level.textContent = text;
  }
  const carTypes = [...new Set(battle.cars.map((car) => car.kind))];
  setText('formation', ['基础车头', ...carTypes.map((kind) =>
    `${UPGRADES[kind].name} Lv ${battle.upgrades[kind]}`)].join(' · '));
  setText('captain-name', profile?.name ?? '临时车长');
  setText('captain-pack', mapStage?.courseTitle ?? packFor(lesson?.packId ?? profile?.packId)?.label ?? '');
  const justHit = battle.elapsed < attackUntil;
  byId('armor').classList.toggle('under-attack', justHit);
  byId('radio').parentElement.classList.toggle('under-attack', justHit);

  audio.setThreat(battle.wave, battle.armor);
  audio.setMode(running ? 'running' : battle.phase === 'ready' ? 'idle' : ended ? 'ended' : 'paused');
}

function drainEvents() {
  const events = battle.events.splice(0);
  if (events.length) {
    audio.playEvents(events);
    for (const event of events) {
      if (event.type === 'breach') attackUntil = battle.elapsed + 0.8;
      const announcement = announcements[event.type];
      if (announcement) setText('radio', announcement(event));
    }
  }
  return events;
}

function frame(timestamp) {
  const realSeconds = previousFrame === undefined ? 0 : (timestamp - previousFrame) / 1000;
  const delta = Math.min(realSeconds, 0.08);
  previousFrame = timestamp;
  const active = !paused && !document.hidden && !restartDialog.open && !mapDialog.open;
  const running = battle.phase === 'running' && active;
  if (running) {
    timeBank += delta;
    while (timeBank >= stepSeconds && battle.phase === 'running') {
      stepBattle(battle, stepSeconds);
      timeBank -= stepSeconds;
    }
  }
  if (battle.phase === 'upgrade' && active) desk.tick(realSeconds);
  const events = drainEvents();
  const result = events.find(event => event.type === 'win' || event.type === 'lose');
  if (result && runId) pendingResult = { runId, won: result.type === 'win', wave: battle.wave };
  if (active && (isOngoing() || pendingResult)) saveAge += realSeconds;
  if (result || saveAge >= 3 || events.some(event => event.type === 'wave' || event.type === 'breach')) {
    saveRun();
  }
  syncView();
  scene.render(battle, running ? delta : 0, events, motion.matches);
  requestAnimationFrame(frame);
}

function refresh() {
  previousFrame = undefined;
  timeBank = 0;
  syncView();
}

function resumeAudio() {
  if (!muted) void audio.unlock();
}

function packFor(id) {
  return packs.find(pack => pack.id === id);
}

function findMapStage(id) {
  for (const course of courses) {
    const stage = course.stages.find(item => item.id === id);
    if (stage) return { ...stage, courseTitle: course.title };
  }
  return null;
}

function currentPack() {
  return mapStage ? { id: mapStage.packId, entries: mapStage.entries } : packFor(profile?.packId) ?? packs[0];
}

function currentCheckpoint(of) {
  return mapStage ? mapStageProgress(of, mapStage.id).run : of?.run;
}

function isOngoing() {
  return battle.phase === 'running' || battle.phase === 'upgrade';
}

function setSave(text, warning = false) {
  setText('save-status', text);
  byId('save-status').classList.toggle('save-warning', warning);
}

function setMuted(value) {
  muted = value;
  audio.setMuted(muted);
  byId('sound').setAttribute('aria-pressed', String(!muted));
  setText('sound', muted ? '声音关' : '声音开');
}

function saveRun(replacement) {
  saveAge = 0;
  if (!profile || saveBlocked) return false;
  if (!replacement && (!runId || (!isOngoing() && !pendingResult))) return false;
  try {
    profile = store.update(profile.id, draft => {
      const savedRun = currentCheckpoint(draft);
      if (!replacement && savedRun && savedRun.id !== runId) throw new Error('此档案有更新的战局，请重新打开档案。');
      for (const outcome of studyEvents) recordStudy(draft, outcome);
      const checkpoint = replacement ?? (pendingResult ? null : {
        id: runId, battle: serializeBattle(battle), lesson: serializeStudySession(lesson), desk: desk.snapshot(),
      });
      if (mapStage) {
        saveMapStage(draft, mapStage.id, { run: checkpoint, wordIds: pendingMapWords,
          won: pendingResult?.runId === savedRun?.id && pendingResult?.won === true });
      } else {
        if (pendingResult) recordResult(draft, pendingResult);
        if (checkpoint) {
          draft.run = checkpoint;
          draft.campaign.bestWave = Math.max(draft.campaign.bestWave, battle.wave);
        }
      }
      draft.muted = muted;
    }, { expectedRevision: profile.revision });
    pendingResult = null;
    studyEvents.length = 0;
    pendingMapWords.clear();
    setSave('本机已存');
    return true;
  } catch (error) {
    setSave(error.message, true);
    return false;
  }
}

function priorityWords() {
  return Object.entries(profile?.study ?? {}).filter(([, skills]) =>
    Object.values(skills).some(stat =>
      (stat.wrong || stat.assisted || stat.timeouts) && stat.correct - stat.assisted === 0))
    .map(([id]) => id);
}

function pendingQuestion() {
  const kind = battle.pendingUpgrade;
  return kind ? createQuestion(lesson, battle.upgradeCount, kind) : null;
}

function openStudy() {
  const question = pendingQuestion();
  if (question) desk.open(question, UPGRADES[battle.pendingUpgrade].name, battle.cost, muted);
}

const desk = createStudyDesk(() => {
  const wordId = mapStage ? pendingQuestion()?.targetId : null;
  if (confirmUpgrade(battle)) {
    if (wordId) pendingMapWords.add(wordId);
    saveRun();
  }
  resumeAudio();
  refresh();
}, (reason) => {
  cancelUpgrade(battle);
  if (reason === 'timeout') setText('radio', '答题时间到 · 星星已保留，可再点卡补修');
  saveRun();
  resumeAudio();
  refresh();
}, (outcome) => {
  if (!runId) return;
  const statuses = { incorrect: 'wrong', independent: 'correct', assisted: 'assisted', timeout: 'timeout', read: 'read' };
  studyEvents.push({ targetId: outcome.targetId, mode: outcome.mode,
    status: statuses[outcome.outcome], eventId: `${runId}:${outcome.eventId}` });
  if (!outcome.completesUpgrade && outcome.outcome !== 'timeout') saveRun();
});
const emptyDesk = desk.snapshot();

function useProfile(next) {
  profile = next;
  mapStage = findMapStage(profile?.map?.activeStageId);
  runId = undefined;
  pendingResult = null;
  studyEvents.length = 0;
  pendingMapWords.clear();
  saveAge = 0;
  saveBlocked = false;
  attackUntil = 0;
  desk.reset();
  battle = createBattle(0, mapStage?.levelId ?? LEVEL_ID);
  paused = false;
  const pack = currentPack();
  lesson = createStudySession(0, undefined, { packId: pack.id, entries: pack.entries });
  setMuted(profile?.muted ?? false);
  setText('radio', '电台待命');
  setSave(profile ? '本机已存' : '当前未建档', !profile);
  const checkpoint = currentCheckpoint(profile);
  if (checkpoint) {
    try {
      const restoredBattle = restoreBattle(checkpoint.battle);
      const priorPack = mapStage ? pack : packFor(checkpoint.lesson.packId);
      const restoredLesson = restoreStudySession(checkpoint.lesson, priorPack?.entries);
      if (restoredBattle.levelId !== battle.levelId || (mapStage && restoredLesson?.packId !== mapStage.packId) ||
          !restoredLesson || !desk.restore(checkpoint.desk)) throw new Error('本局题目存档无法恢复。');
      battle = restoredBattle;
      lesson = restoredLesson;
      runId = checkpoint.id;
      paused = true;
      setText('radio', '本局战况已恢复');
    } catch (error) {
      setSave(`${error.message} 可从头开始本关。`, true);
    }
  }
  refresh();
}

function currentProfile() {
  const registry = store.read();
  return registry.profiles.find(item => item.id === registry.activeId) ?? null;
}

function chooseStoredProfile() {
  useProfile(currentProfile() ?? store.create('车长'));
}

function restartRun() {
  if (!profile) return;
  if (isOngoing() && !saveRun()) throw new Error(byId('save-status').textContent);
  useProfile(store.update(profile.id, draft => {
    if (mapStage) saveMapStage(draft, mapStage.id, { run: null });
    else draft.run = null;
  },
    { expectedRevision: profile.revision }));
}

bindCaptainPanel({
  store, getProfile: () => profile, getPacks: () => packs,
  getRun: () => currentCheckpoint(profile),
  switchProfile: useProfile,
  updateProfile: (next) => { profile = next; setSave('本机已存'); refresh(); },
  onOpen() {
    if (isOngoing() && !saveBlocked) {
      paused = true;
      desk.suspend();
      saveRun();
      refresh();
    }
  },
  restart: restartRun,
});

function togglePause() {
  if (!isOngoing() || saveBlocked) return;
  paused = !paused;
  if (!paused) {
    resumeAudio();
    if (battle.phase === 'upgrade') openStudy();
  } else {
    saveRun();
  }
  refresh();
}

function startRun() {
  if (!profile) {
    try { chooseStoredProfile(); } catch (error) { setSave(error.message, true); }
  }
  const pack = currentPack();
  const round = !mapStage && profile ? profile.campaign.wins + profile.campaign.losses : 0;
  const completed = mapStage ? new Set(mapStageProgress(profile, mapStage.id).wordIds) : null;
  const priorityWordIds = completed ? pack.entries.filter(({ id }) => !completed.has(id)).map(({ id }) => id) : priorityWords();
  const nextLesson = createStudySession(round, undefined, { packId: pack.id, entries: pack.entries, priorityWordIds });
  const runBytes = crypto.getRandomValues(new Uint8Array(12));
  const nextBattle = createBattle(new DataView(runBytes.buffer).getUint32(0), mapStage?.levelId ?? LEVEL_ID);
  const nextId = `run_${Array.from(runBytes, n => n.toString(16).padStart(2, '0')).join('')}`;
  startBattle(nextBattle);
  const replacement = { id: nextId, battle: serializeBattle(nextBattle), lesson: serializeStudySession(nextLesson), desk: emptyDesk };
  if (!saveRun(replacement) && profile && isOngoing()) return;

  desk.reset();
  battle = nextBattle;
  lesson = nextLesson;
  attackUntil = 0;
  runId = nextId;
  paused = false;
  resumeAudio();
  refresh();
}

function routeStatuses() {
  const statuses = {};
  for (const course of courses) {
    let unlocked = true;
    for (const stage of course.stages) {
      const state = mapStageProgress(profile, stage.id);
      const covered = coveredWords(stage);
      const cleared = state.won && covered === stage.entries.length;
      statuses[stage.id] = { covered, cleared, unlocked, hasRun: Boolean(state.run) };
      unlocked = unlocked && cleared;
    }
  }
  return statuses;
}

function renderMap(message = '') {
  mapUI.render({ courses, statuses: routeStatuses(), activeStageId: mapStage?.id,
    hasEnduranceRun: Boolean(profile?.run), message });
}

function selectRoute(id) {
  try {
    if (!profile || saveBlocked) chooseStoredProfile();
    if (id !== null && !routeStatuses()[id]?.unlocked) throw new Error('先答完前一趟的词，并守住货站。');
    if (id !== (mapStage?.id ?? null)) {
      if ((isOngoing() || pendingResult) && !saveRun()) throw new Error(byId('save-status').textContent);
      useProfile(store.update(profile.id, draft => setActiveMapStage(draft, id), { expectedRevision: profile.revision }));
    }
    launchAfterMap = id !== null && (isOngoing() || !currentCheckpoint(profile));
    return true;
  } catch (error) {
    renderMap(error.message);
    return false;
  }
}

const mapUI = createMapUI({
  onOpen() {
    if (!loaded) return false;
    renderMap();
    return true;
  },
  onStage: selectRoute,
  onEndurance: () => selectRoute(null),
  onClose() {
    if (launchAfterMap) {
      launchAfterMap = false;
      if (!isOngoing()) startRun();
      else if (paused) togglePause();
    }
    refresh();
  },
});

byId('stage-action').addEventListener('click', () => {
  if (!loaded) return;
  if (saveBlocked) {
    try { chooseStoredProfile(); } catch (error) { setSave(error.message, true); }
  } else if (paused) {
    togglePause();
  } else if (mapStage && battle.phase === 'won') {
    mapUI.open();
  } else if (!isOngoing()) {
    startRun();
  }
});

byId('restart').addEventListener('click', () => {
  restartDialog.showModal();
  refresh();
});
restartDialog.addEventListener('close', refresh);
byId('restart-confirm').addEventListener('click', () => {
  restartDialog.close();
  startRun();
});

byId('sound').addEventListener('click', () => {
  setMuted(!muted);
  if (isOngoing()) saveRun();
  else if (profile && !saveBlocked) {
    try {
      profile = store.update(profile.id, draft => { draft.muted = muted; }, { expectedRevision: profile.revision });
    } catch (error) { setSave(error.message, true); }
  }
  if (battle.phase === 'running' && !paused) resumeAudio();
});

byId('pause').addEventListener('click', togglePause);

for (const card of cards) {
  card.addEventListener('click', () => {
    if (paused || battle.phase !== 'running') return;
    const id = card.dataset.upgrade;
    openUpgrade(battle, id);
    if (battle.phase !== 'upgrade') return;
    openStudy();
    saveRun();
    refresh();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (battle.phase === 'running') paused = true;
    desk.suspend();
    saveRun();
  }
  refresh();
});

window.addEventListener('pagehide', () => saveRun());
window.addEventListener('storage', (event) => {
  if ((event.key !== STORAGE_KEY && event.key !== null) || !profile) return;
  try {
    const latest = store.read().profiles.find(item => item.id === profile.id);
    if (latest?.revision === profile.revision) return;
    if (!isOngoing()) {
      useProfile(latest ?? currentProfile());
      return;
    }
    saveBlocked = true;
    paused = true;
    desk.reset();
    setSave('另一页面已更新这位车长。请重新读取档案。', true);
    refresh();
  } catch (error) {
    setSave(error.message, true);
  }
});

async function initialize() {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('./kb3-word-packs.json', { signal: controller.signal });
    if (!response.ok) throw new Error('词包读取失败');
    const catalog = await response.json();
    if (catalog.unitPacks?.length) {
      packs = catalog.unitPacks.map(pack => ({
        id: pack.id, label: `${pack.unit ? `Unit ${pack.unit}` : 'Hello!'} · ${pack.theme}`,
        entries: pack.entries,
      }));
    }
  } catch {
    // The built-in Unit 4 questions still work if the full catalog is unavailable.
  } finally {
    clearTimeout(deadline);
  }
  courses = buildCourses(packs);
  try { chooseStoredProfile(); } catch (error) { setSave(error.message, true); }
  loaded = true;
  refresh();
}

syncView();
requestAnimationFrame(frame);
void initialize();
