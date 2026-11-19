import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  checkAnswer, createQuestion, createStudySession, restoreStudySession,
  serializeStudySession, spellingSlots, STUDY_MODES,
} from './study.mjs';
import { createStudyDesk } from './study-desk.mjs';

test('each upgrade keeps the same target across all four exercises and reopening', () => {
  const session = createStudySession();
  const choices = Object.keys(STUDY_MODES).map(kind => createQuestion(session, 0, kind));
  assert.deepEqual(choices.map(question => question.mode), ['spell', 'repeat-en', 'translate', 'repeat-zh']);
  assert.equal(new Set(choices.map(question => question.targetId)).size, 1);
  assert.deepEqual(createQuestion(session, 0, 'rapid'), choices[0]);
  assert.notEqual(createQuestion(session, 1, 'rapid').targetId, choices[0].targetId);
  assert.notEqual(createQuestion(createStudySession(1), 0, 'rapid').targetId, choices[0].targetId);
});

test('spelling asks for the key chunk, normalizes valid typing, and rejects wrong letters', () => {
  const session = createStudySession();
  const shortWord = createQuestion(session, 0, 'rapid');
  assert.equal(shortWord.stem, 'b___');
  assert.equal(shortWord.seconds, 30);
  assert.equal(checkAnswer(shortWord, ' ＡＮＫ  '), true);
  assert.equal(checkAnswer(shortWord, 'bank'), true);
  assert.equal(checkAnswer(shortWord, 'and'), false);
  assert.equal(checkAnswer(shortWord, ''), false);

  const longWord = createQuestion(session, 1, 'rapid');
  assert.equal(longWord.stem, 'super______');
  assert.equal(longWord.seconds, 60);
  assert.equal(checkAnswer(longWord, 'market'), true);
  assert.equal(checkAnswer(longWord, 'marketing'), false);
});

test('Chinese translation accepts reviewed equivalents but rejects guesses and extra meanings', () => {
  const session = createStudySession();
  const question = createQuestion(session, 1, 'shock');
  assert.equal(question.seconds, 60);
  assert.equal(checkAnswer(question, '超市'), true);
  assert.equal(checkAnswer(question, '超级市场。'), true);
  assert.equal(checkAnswer(question, '市场'), false);
  assert.equal(checkAnswer(question, '超市或市场'), false);
  assert.equal(checkAnswer(question, 'market'), false);
});

test('震荡题接受常用译法和输入法标点，仍按一个完整词义判定', () => {
  const { unitPacks } = JSON.parse(readFileSync(new URL('./kb3-word-packs.json', import.meta.url), 'utf8'));
  const cases = [
    ['kb3-u4', 'swimming pool', ['泳池', '「游　泳　池」！', '游泳館', '“泳池.”'], ['池', '泳池或图书馆']],
    ['kb3-u4', 'sports centre', ['运动中心', '運動中心', '体育运动中心'], ['运动', '体育场']],
    ['kb3-u4', 'market', ['菜市场', '菜市', '市場。'], ['超市', '市场、超市']],
    ['kb3-u4', 'supermarket', ['超級市場', '“超 市”'], ['市场', '超市或市场']],
    ['kb3-u4', 'bank', ['銀 行！', '“银行”'], ['行', '存钱取钱']],
    ['kb3-hello', 'bike', ['单车', '腳踏車'], ['汽车']],
    ['kb3-u1', 'uncle', ['叔叔', '舅父'], ['阿姨']],
    ['kb3-u3', 'have a shower', ['洗澡', '洗淋浴'], ['洗手']],
    ['kb3-u5', 'temperature', ['体温', '温度'], ['体重']],
    ['kb3-u8', 'cloudy', ['多云', '多雲的'], ['晴天']],
  ];
  for (const [packId, word, accepted, rejected] of cases) {
    const pack = unitPacks.find(entry => entry.id === packId);
    const session = createStudySession(0, 0, { packId, entries: pack.entries });
    const question = session.words.map((_, index) => createQuestion(session, index, 'shock'))
      .find(candidate => candidate.en === word);
    for (const answer of accepted) assert.equal(checkAnswer(question, answer), true, `${word}: ${answer}`);
    for (const answer of rejected) assert.equal(checkAnswer(question, answer), false, `${word}: ${answer}`);
    assert.equal(checkAnswer(question, word), false, `${word}: 英文原词不作为中文译法`);
  }
  const spelling = createQuestion(createStudySession(), 0, 'rapid');
  assert.equal(checkAnswer(spelling, 'a n k'), false);
  assert.equal(checkAnswer(spelling, '「ank」'), false);
});

test('repeat cards require an objectively correct selection before reading', () => {
  const session = createStudySession();
  for (const [kind, response] of [['arc', 'bank'], ['armor', '银行']]) {
    const question = createQuestion(session, 0, kind);
    assert.equal(new Set(question.options).size, 3);
    assert.ok(question.options.includes(response));
    assert.equal(checkAnswer(question, response), true);
    assert.equal(checkAnswer(question, question.options.find(option => option !== response)), false);
    assert.equal(checkAnswer(question, '我读完了'), false);
  }
});

test('the correct choice can occupy every slot and its position is stable on reopening', () => {
  const positions = [0, 1, 2].map((offset) => {
    const session = createStudySession(0, offset);
    const question = createQuestion(session, 0, 'arc');
    assert.deepEqual(createQuestion(session, 0, 'arc').options, question.options);
    return question.options.indexOf(question.en);
  });
  assert.equal(new Set(positions).size, 3);
});

test('all six study words match the audited glossary and ship with local audio', () => {
  const words = JSON.parse(readFileSync(new URL('./kb3-word-packs.json', import.meta.url), 'utf8'))
    .unitPacks.find(pack => pack.id === 'kb3-u4').entries;
  const used = new Set();
  for (let round = 0; round < 3; round++) {
    const session = createStudySession(round);
    for (let upgrade = 0; upgrade < 2; upgrade++) {
      const question = createQuestion(session, upgrade, 'rapid');
      const matched = words.find(word => word.id === question.targetId);
      assert.ok(matched);
      assert.equal(question.en, matched.en);
      assert.equal(question.zh, matched.zhHint);
      assert.ok(readFileSync(new URL(question.audio, import.meta.url)).length > 1000);
      used.add(question.targetId);
    }
  }
  assert.equal(used.size, 6);
});

test('a focused book unit stays stable across a long run and can be restored', () => {
  const pack = JSON.parse(readFileSync(new URL('./kb3-word-packs.json', import.meta.url), 'utf8'))
    .unitPacks.find(candidate => candidate.id === 'kb3-u5');
  const priority = pack.entries[4].id;
  const session = createStudySession(3, 1, {
    packId: pack.id, entries: pack.entries, priorityWordIds: [priority],
  });
  const saved = JSON.parse(JSON.stringify(serializeStudySession(session)));
  assert.equal(createQuestion(session, 0, 'rapid').targetId, priority);
  const seen = new Set();
  const restored = restoreStudySession(saved, pack.entries);
  for (let offer = 0; offer < 100; offer++) {
    const question = createQuestion(session, offer, 'arc');
    seen.add(question.targetId);
    assert.deepEqual(createQuestion(restored, offer, 'arc'), question);
    assert.ok(readFileSync(new URL(question.audio, import.meta.url)).length > 1000);
  }
  assert.equal(seen.size, pack.entries.length);
  assert.equal(restoreStudySession({...saved, wordIds: ['bad-id']}, pack.entries), null);
});

test('one spelling slot is present for each missing letter and reflects typing', () => {
  const session = createStudySession();
  const short = createQuestion(session, 0, 'rapid');
  assert.deepEqual(spellingSlots(short), ['', '', '']);
  assert.deepEqual(spellingSlots(short, 'an'), ['a', 'n', '']);
  assert.deepEqual(spellingSlots(short, 'ＢＡＮＫ'), ['a', 'n', 'k']);
  assert.deepEqual(spellingSlots(createQuestion(session, 1, 'rapid'), 'mark'), ['m', 'a', 'r', 'k', '', '']);
});

function mockStudyDocument() {
  class Element {
    constructor() {
      this.children = [];
      this.handlers = new Map();
      this.attributes = new Map();
      this.classList = { toggle() {} };
      this.value = '';
      this.textContent = '';
      this.disabled = false;
    }
    addEventListener(type, action) { this.handlers.set(type, action); }
    emit(type) { this.handlers.get(type)?.({ preventDefault() {} }); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    querySelector() { return this.children.map(row => row.children[0]).find(input => input.checked); }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const nodes = new Map();
  return {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, new Element());
      return nodes.get(id);
    },
    createElement: () => new Element(),
    createTextNode: text => text,
  };
}

test('震荡题输入英文原词不会装车，提交常用中文译法后可以装车', () => {
  const original = globalThis.document;
  const doc = mockStudyDocument();
  const get = id => doc.getElementById(id);
  globalThis.document = doc;
  try {
    const { unitPacks } = JSON.parse(readFileSync(new URL('./kb3-word-packs.json', import.meta.url), 'utf8'));
    const pack = unitPacks.find(candidate => candidate.id === 'kb3-u4');
    const session = createStudySession(0, 0, { packId: pack.id, entries: pack.entries });
    const offer = session.words.findIndex(word => word.en === 'swimming pool');
    const question = createQuestion(session, offer, 'shock');
    const events = [];
    const desk = createStudyDesk(() => events.push('installed'), () => {}, outcome => events.push(outcome));
    assert.deepEqual(question.answers, ['游泳池']);
    desk.open(question, '震荡', 4, true);
    assert.equal(get('study-instructions').textContent, '听英文，写中文意思。');
    assert.equal(get('study-input-label').textContent, '中文意思（用汉字填写）');
    assert.equal(get('study-source-label').hidden, false);
    get('study-input').value = 'swimming pool';
    get('study-form').emit('submit');
    assert.match(get('study-feedback').textContent, /切换中文输入法/);
    assert.deepEqual(events, []);
    assert.equal(get('workbench').open, true);
    get('study-input').value = '泳池';
    get('study-form').emit('submit');
    assert.equal(events.at(-2).completesUpgrade, true);
    assert.equal(events.at(-1), 'installed');
    assert.equal(get('workbench').open, false);
  } finally {
    globalThis.document = original;
  }
});

test('the desk restores the timer and per-letter blanks, retains grading, and saves no typed text', () => {
  const original = globalThis.document;
  const doc = mockStudyDocument();
  const get = id => doc.getElementById(id);
  globalThis.document = doc;
  try {
    const events = [];
    const question = createQuestion(createStudySession(), 0, 'rapid');
    const desk = createStudyDesk(() => events.push('complete'), () => {}, result => events.push(result));
    desk.open(question, '速射', 4, true);
    assert.equal(get('study-prompt').children.filter(node => node.className === 'study-letter').length, 3);
    get('study-input').value = 'wrong-draft';
    get('study-input').emit('input');
    get('study-form').emit('submit');
    assert.equal(events[0].outcome, 'incorrect');
    assert.equal(events[0].completesUpgrade, false);
    desk.tick(7.5);
    const snapshot = JSON.parse(JSON.stringify(desk.snapshot()));
    assert.ok(!JSON.stringify(snapshot).includes('wrong-draft'));
    desk.reset();
    desk.restore(snapshot);
    desk.open(question, '速射', 4, true);
    assert.equal(get('study-time').textContent, '23 秒');
    assert.equal(get('study-input').value, '');
    get('study-input').value = 'ank';
    get('study-form').emit('submit');
    assert.equal(events[1].outcome, 'assisted');
    assert.equal(events[1].completesUpgrade, true);
    assert.notEqual(events[0].eventId, events[1].eventId);
    assert.equal(events[2], 'complete');
  } finally {
    globalThis.document = original;
  }
});

test('a restored reading step offers an explicit typed alternative if on-device speech is unavailable', () => {
  const original = globalThis.document;
  const doc = mockStudyDocument();
  const get = id => doc.getElementById(id);
  globalThis.document = doc;
  try {
    const events = [];
    const question = createQuestion(createStudySession(), 0, 'armor');
    const desk = createStudyDesk(() => events.push('complete'), () => events.push('return'), result => events.push(result));
    desk.open(question, '装甲', 4, true);
    get('study-form').emit('submit');
    assert.deepEqual(events, []);
    get('study-options').children.find(row => row.children[0].value === question.zh).children[0].checked = true;
    get('study-form').emit('submit');
    assert.equal(events[0].completesUpgrade, false);
    const snapshot = JSON.parse(JSON.stringify(desk.snapshot()));
    desk.reset();
    desk.restore(snapshot);
    desk.open(question, '装甲', 4, true);
    assert.equal(get('study-input').hidden, true);
    assert.equal(get('study-prompt').textContent, question.zh);
    assert.equal(get('study-type-instead').hidden, false);
    get('study-type-instead').emit('click');
    assert.equal(get('study-submit').textContent, '提交答案');
    assert.equal(get('study-prompt').textContent, question.en);
    assert.equal(get('study-input').hidden, false);
    desk.tick(1.2);
    get('study-form').emit('submit');
    get('study-input').value = '图书馆';
    get('study-form').emit('submit');
    assert.equal(events.length, 1);
    assert.equal(get('workbench').open, true);
    get('study-input').value = '银行';
    get('study-form').emit('submit');
    assert.deepEqual(events.slice(1), ['complete']);

    desk.restore({version: 1, attempts: [{...snapshot.attempts[0], targetId: 'other'}]});
    desk.open(question, '装甲', 4, true);
    assert.equal(get('study-submit').textContent, '提交答案');
    desk.tick(60);
    assert.equal(events[2].outcome, 'timeout');
    assert.equal(events[3], 'return');
  } finally {
    globalThis.document = original;
  }
});

test('a downloadable language pack preserves the reading task and waits for an intentional microphone start', async () => {
  const previous = { document: globalThis.document, SpeechRecognition: globalThis.SpeechRecognition,
    isSecureContext: globalThis.isSecureContext };
  const doc = mockStudyDocument();
  const get = id => doc.getElementById(id);
  const events = [];
  let ready = false;
  let finishDownload;
  let recording;
  class SpeechRecognition {
    static async available() { return ready ? 'available' : 'downloadable'; }
    static install() {
      return new Promise(resolve => { finishDownload = resolve; });
    }
    get processLocally() { return this.local; }
    set processLocally(value) { this.local = value; }
    start() { recording = this; this.onstart?.(); }
    abort() {}
  }
  Object.assign(globalThis, { document: doc, SpeechRecognition, isSecureContext: true });
  try {
    const desk = createStudyDesk(() => events.push('complete'), () => {}, outcome => events.push(outcome));
    const question = createQuestion(createStudySession(), 0, 'arc');
    desk.open(question, '电弧', 4, true);
    get('study-options').children.find(row => row.children[0].value === question.en).children[0].checked = true;
    get('study-form').emit('submit');
    get('study-form').emit('submit');
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(get('study-download-voice').hidden, false);
    assert.equal(get('study-input').hidden, true);
    assert.equal(get('study-prompt').textContent, question.en);
    assert.equal(get('study-submit').hidden, true);
    assert.equal(finishDownload, undefined);
    assert.equal(recording, undefined);
    const left = desk.snapshot().attempts[0].left;
    get('study-download-voice').emit('click');
    desk.tick(4);
    assert.equal(get('study-time').textContent, '准备语音');
    assert.equal(get('study-type-instead').hidden, false);
    assert.equal(desk.snapshot().attempts[0].left, left);
    assert.equal(get('study-input').hidden, true);
    assert.equal(get('study-prompt').textContent, question.en);
    ready = true;
    finishDownload(true);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(get('study-submit').hidden, false);
    assert.equal(get('study-submit').textContent, '开始跟读');
    assert.equal(get('study-input').hidden, true);
    assert.equal(recording, undefined);
    assert.equal(events.length, 1);
    desk.tick(1);
    assert.equal(desk.snapshot().attempts[0].left, left - 1);
    get('study-form').emit('submit');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(recording.processLocally, true);
    assert.equal(recording.lang, 'en-US');
    assert.equal(events.length, 1);
    const alternatives = [{ transcript: 'Bank.' }];
    alternatives.isFinal = true;
    recording.onresult?.({ resultIndex: 0, results: [alternatives] });
    assert.equal(events[1].outcome, 'read');
    assert.equal(events[1].completesUpgrade, true);
    assert.equal(events[2], 'complete');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('a correct choice cannot install the carriage until the microphone returns the target word', async () => {
  const previous = { document: globalThis.document, SpeechRecognition: globalThis.SpeechRecognition,
    isSecureContext: globalThis.isSecureContext };
  const doc = mockStudyDocument();
  const get = id => doc.getElementById(id);
  let recording;
  class SpeechRecognition {
    static async available() { return 'available'; }
    get processLocally() { return this.local; }
    set processLocally(value) { this.local = value; }
    start() { recording = this; this.onstart?.(); }
    abort() {}
  }
  Object.assign(globalThis, { document: doc, SpeechRecognition, isSecureContext: true });
  try {
    const events = [];
    const desk = createStudyDesk(() => events.push('complete'), () => {}, outcome => events.push(outcome));
    const question = createQuestion(createStudySession(), 0, 'arc');
    desk.open(question, '电弧', 4, true);
    get('study-options').children.find(row => row.children[0].value === question.en).children[0].checked = true;
    get('study-form').emit('submit');
    desk.tick(1.2);
    assert.equal(get('study-submit').textContent, '开始跟读');
    assert.equal(recording, undefined);
    const startRecording = async () => {
      get('study-form').emit('submit');
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(recording.processLocally, true);
      assert.equal(recording.lang, 'en-US');
      assert.equal(get('study-listen').disabled, true);
      get('study-form').emit('submit');
      assert.equal(events.length, 1);
    };
    const heard = transcript => {
      const alternatives = [{ transcript }];
      alternatives.isFinal = true;
      recording.onresult?.({ resultIndex: 0, results: [alternatives] });
    };
    await startRecording();
    recording.onerror?.({ error: 'no-speech' });
    assert.equal(events.length, 1);
    assert.equal(get('workbench').open, true);
    await startRecording();
    heard('library');
    assert.equal(events.length, 1);
    await startRecording();
    heard('Bank.');
    assert.equal(events[1].outcome, 'read');
    assert.equal(events[1].completesUpgrade, true);
    assert.equal(events[2], 'complete');
    assert.equal(get('workbench').open, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
