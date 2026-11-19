import test from 'node:test';
import assert from 'node:assert/strict';
import { localReadingSupported, downloadReadingLanguage, listenForReading } from './reading-recognizer.mjs';

const settled = () => new Promise(resolve => setImmediate(resolve));

function mockRecognition(t) {
  const keys = ['SpeechRecognition', 'webkitSpeechRecognition', 'isSecureContext'];
  const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const instances = [];
  const checks = [];
  const downloads = [];
  class SpeechRecognition {
    static async available(options) {
      checks.push(options);
      return 'available';
    }

    static async install(options) {
      downloads.push(options);
      return true;
    }

    processLocal = false;
    aborts = 0;

    get processLocally() { return this.processLocal; }
    set processLocally(value) { this.processLocal = value; }

    start() {
      instances.push(this);
      this.onstart();
    }

    abort() {
      this.aborts++;
      this.onend?.();
    }
  }
  globalThis.isSecureContext = true;
  globalThis.SpeechRecognition = SpeechRecognition;
  delete globalThis.webkitSpeechRecognition;
  return { instances, checks, downloads, SpeechRecognition };
}

test('listening requires local processing and a final result before returning words', async (t) => {
  const { instances, checks } = mockRecognition(t);
  const outcomes = [];
  assert.equal(localReadingSupported(), true);
  const cancel = listenForReading('en-US', {
    onListening: () => outcomes.push('listening'),
    onFinished: outcome => outcomes.push(outcome),
  });
  assert.deepEqual(outcomes, []);
  await settled();
  const [recognition] = instances;
  assert.deepEqual(checks, [{ langs: ['en-US'], processLocally: true }]);
  assert.equal(recognition.processLocally, true);
  assert.equal(recognition.lang, 'en-US');
  assert.equal(recognition.continuous, false);
  assert.equal(recognition.interimResults, false);
  assert.deepEqual(outcomes, ['listening']);
  const result = recognition.onresult;
  const alternatives = [{ transcript: ' bank ' }, { transcript: 'bunk' }, { transcript: '  ' }];
  result({ resultIndex: 0, results: [Object.assign(alternatives, { isFinal: false })] });
  assert.deepEqual(outcomes, ['listening']);
  result({ resultIndex: 0, results: [Object.assign(alternatives, { isFinal: true })] });
  result({ resultIndex: 0, results: [alternatives] });
  cancel();
  assert.deepEqual(outcomes, ['listening', { status: 'heard', transcripts: ['bank', 'bunk'] }]);
  assert.equal(recognition.aborts, 1);
});

test('download is separate from listening and always asks for on-device processing', async (t) => {
  const { instances, downloads, SpeechRecognition } = mockRecognition(t);
  SpeechRecognition.available = async () => 'downloadable';
  const outcomes = [];
  listenForReading('zh-CN', { onFinished: outcome => outcomes.push(outcome) });
  await settled();
  assert.deepEqual(outcomes, [{ status: 'downloadable' }]);
  assert.deepEqual(instances, []);
  assert.deepEqual(downloads, []);

  assert.equal(await downloadReadingLanguage('zh-CN'), true);
  assert.deepEqual(downloads, [{ langs: ['zh-CN'], processLocally: true }]);
  SpeechRecognition.install = async () => { throw new Error('download dismissed'); };
  assert.equal(await downloadReadingLanguage('zh-CN'), false);
});

test('older recognition and insecure pages cannot open a microphone', async (t) => {
  mockRecognition(t);
  class RemoteOnlyRecognition {
    static async available() { throw new Error('must not query remote recognition'); }
  }
  delete globalThis.SpeechRecognition;
  globalThis.webkitSpeechRecognition = RemoteOnlyRecognition;
  assert.equal(localReadingSupported(), false);
  const outcomes = [];
  listenForReading('en-US', { onFinished: outcome => outcomes.push(outcome) });
  assert.deepEqual(outcomes, []);
  await settled();
  assert.deepEqual(outcomes, [{ status: 'unavailable' }]);
  globalThis.isSecureContext = false;
  assert.equal(localReadingSupported(), false);
  assert.equal(await downloadReadingLanguage('en-US'), false);
});

test('silence, microphone denial and normal end cannot yield recognized words', async (t) => {
  const { instances } = mockRecognition(t);
  const outcomes = [];
  for (const fail of [recognition => recognition.onerror({ error: 'no-speech' }),
    recognition => recognition.onerror({ error: 'not-allowed' }), recognition => recognition.onend()]) {
    listenForReading('zh-CN', { onFinished: outcome => outcomes.push(outcome) });
    await settled();
    fail(instances.at(-1));
  }
  assert.deepEqual(outcomes, [{ status: 'silent' }, { status: 'denied' }, { status: 'silent' }]);
});

test('cancellation before readiness prevents mic access and after readiness discards late results', async (t) => {
  const { instances, SpeechRecognition } = mockRecognition(t);
  let resolveCheck;
  SpeechRecognition.available = () => new Promise(resolve => { resolveCheck = resolve; });
  const outcomes = [];
  const handlers = { onFinished: outcome => outcomes.push(outcome) };
  const cancelPending = listenForReading('en-US', handlers);
  await settled();
  cancelPending();
  resolveCheck('available');
  await settled();
  assert.deepEqual(instances, []);

  SpeechRecognition.available = async () => 'available';
  const cancel = listenForReading('en-US', handlers);
  await settled();
  const [recognition] = instances;
  const result = recognition.onresult;
  cancel();
  result({ resultIndex: 0, results: [Object.assign([{ transcript: 'bank' }], { isFinal: true })] });
  assert.deepEqual(outcomes, []);
  assert.equal(recognition.aborts, 1);
});
