import { checkAnswer, checkReadingAnswer, readingFallbackQuestion, spellingSlots } from './study.mjs';
import { downloadReadingLanguage, listenForReading, localReadingSupported } from './reading-recognizer.mjs';

const VOICE_SETUP_WAIT = 30;

const directions = {
  spell: '听一遍英文，补上空着的字母。',
  'repeat-en': '听英文，选出听到的词，再跟读一次。',
  translate: '听英文，写中文意思。',
  'repeat-zh': '听英文，选对中文意思，再跟读中文。',
};

function hasReadingStep(mode) {
  return mode === 'repeat-en' || mode === 'repeat-zh';
}

function questionSignature(question) {
  return JSON.stringify([question.en, question.zh, question.answers, question.options, question.seconds]);
}

function savedAttempt(value) {
  if (!value || typeof value.id !== 'string' || typeof value.targetId !== 'string' ||
      typeof value.signature !== 'string' || !Object.prototype.hasOwnProperty.call(directions, value.mode) ||
      !Number.isFinite(value.left) || value.left < 0 || value.left > 60 ||
      !Number.isFinite(value.repeatDelay) || value.repeatDelay < 0 || value.repeatDelay > 1.2 ||
      !Number.isSafeInteger(value.sequence) || value.sequence < 0 ||
      typeof value.fallback !== 'boolean' || typeof value.introduced !== 'boolean' ||
      typeof value.hadError !== 'boolean' || typeof value.usedHint !== 'boolean') return null;
  const { id, targetId, mode, signature, left, repeatDelay, sequence, fallback, introduced, hadError, usedHint, objective } = value;
  if (objective !== null && (!hasReadingStep(mode) || sequence === 0 ||
      !['independent', 'assisted'].includes(objective))) return null;
  if (objective === null && repeatDelay !== 0) return null;
  return { id, targetId, mode, signature, left, repeatDelay, sequence, fallback, introduced, hadError, usedHint, objective };
}

export function createStudyDesk(onComplete, onReturn, onOutcome = () => {}) {
  const get = (id) => document.getElementById(id);
  const dialog = get('workbench');
  const form = get('study-form');
  const field = get('study-input');
  const options = get('study-options');
  const label = get('study-input-label');
  const submit = get('study-submit');
  const hint = get('study-hint');
  const downloadVoice = get('study-download-voice');
  const typeInstead = get('study-type-instead');
  const listen = get('study-listen');
  const prompt = get('study-prompt');
  const feedback = get('study-feedback');
  const clock = get('study-time');
  const attempts = new Map();
  const restored = new Map();
  let attempt;
  let voice;
  let cancelReading;
  let composing = false;
  let letters = [];

  function displayFeedback(text, error = false) {
    feedback.textContent = text;
    feedback.classList.toggle('error', error);
    feedback.hidden = !text;
  }

  function showPrompt() {
    const question = attempt.written ?? attempt.question;
    const fallback = attempt.fallback || Boolean(attempt.written);
    const repeat = attempt.repeat && !attempt.written;
    get('study-source-label').hidden = question.mode !== 'translate' || !fallback;
    const chinese = repeat ? question.mode === 'repeat-zh' : fallback && question.mode === 'repeat-en';
    prompt.lang = chinese ? 'zh-CN' : 'en';
    const spelling = question.mode === 'spell';
    prompt.classList.toggle('study-spelling', spelling);
    if (spelling) {
      const given = value => {
        const element = document.createElement('span');
        element.className = 'study-given';
        element.textContent = value;
        element.setAttribute('aria-hidden', 'true');
        return element;
      };
      letters = spellingSlots(question).map(() => {
        const slot = document.createElement('span');
        slot.className = 'study-letter';
        slot.setAttribute('aria-hidden', 'true');
        return slot;
      });
      prompt.replaceChildren(given(question.prefix), ...letters, given(question.suffix));
      prompt.setAttribute('aria-label', `${question.prefix}，空 ${question.blankCount} 个字母，${question.suffix}`);
      prompt.hidden = false;
      updateSlots();
      return;
    }
    letters = [];
    prompt.removeAttribute('aria-label');
    prompt.textContent = repeat ? (question.mode === 'repeat-zh' ? question.zh : question.en) :
      fallback ? (question.mode === 'repeat-en' ? question.zh : question.en) : '';
    prompt.hidden = !prompt.textContent;
  }

  function updateSlots() {
    if (!attempt || !letters.length) return;
    spellingSlots(attempt.written ?? attempt.question, field.value).forEach((letter, index) => {
      letters[index].textContent = letter;
      letters[index].classList.toggle('is-filled', Boolean(letter));
    });
  }

  function updateClock() {
    const seconds = Math.ceil(attempt.left);
    const value = attempt.download ? '准备语音' : attempt.waiting ? '听示范' : `${seconds} 秒`;
    if (clock.textContent !== value) clock.textContent = value;
    clock.classList.toggle('urgent', !attempt.waiting && !attempt.download && seconds <= 10);
    const busy = attempt.reading === 'opening' || attempt.reading === 'listening';
    submit.disabled = Boolean(attempt.waiting) || attempt.repeatDelay > 0 || busy;
    listen.disabled = busy;
  }

  function stopVoice() {
    if (voice) {
      voice.onended = null;
      voice.onerror = null;
      voice.pause();
      voice = undefined;
    }
    if (globalThis.speechSynthesis?.speaking || globalThis.speechSynthesis?.pending) {
      globalThis.speechSynthesis.cancel();
    }
  }

  function settleCue(succeeded) {
    if (!attempt) return;
    attempt.waiting = 0;
    if (!succeeded && !attempt.repeat) {
      attempt.fallback = true;
      showPrompt();
    }
    updateClock();
  }

  function playCue(first = false) {
    stopVoice();
    const { question } = attempt;
    const repeat = attempt.repeat && !attempt.written;
    if (repeat && question.mode === 'repeat-zh') {
      const chineseVoice = globalThis.speechSynthesis?.getVoices().find(candidate =>
        candidate.localService && candidate.lang.toLowerCase().replace('_', '-') === 'zh-cn');
      if (chineseVoice && typeof SpeechSynthesisUtterance === 'function') {
        const cue = new SpeechSynthesisUtterance(question.zh);
        cue.lang = 'zh-CN';
        cue.rate = 0.8;
        cue.voice = chineseVoice;
        speechSynthesis.speak(cue);
      } else {
        displayFeedback('这台设备暂无中文示范音，可以照屏幕朗读。');
      }
      return;
    }
    if (!question.audio) {
      settleCue(false);
      return;
    }
    const clip = new Audio(question.audio);
    voice = clip;
    if (first) attempt.waiting = 4;
    clip.onended = () => { if (voice === clip) settleCue(true); };
    clip.onerror = () => { if (voice === clip) settleCue(false); };
    void clip.play().catch(() => { if (voice === clip) settleCue(false); });
    updateClock();
  }

  function updateForm() {
    const { question, repeat, written, reading } = attempt;
    const exercise = written ?? question;
    const speaking = repeat && !written;
    const chinese = exercise.mode === 'translate';
    const spelling = exercise.mode === 'spell';
    const instructions = get('study-instructions');
    instructions.classList.toggle('translate-task', chinese);
    label.classList.toggle('translate-task', chinese);
    if (written) {
      instructions.textContent = chinese ? '本题改为输入。看英文，填写中文意思。' : '本题改为输入。补上英文单词缺少的字母。';
    } else if (speaking) {
      const language = question.mode === 'repeat-zh' ? '中文' : '英文';
      const voiceInstructions = {
        downloadable: `先准备本机语音包，再跟读屏幕上的${language}。`,
        downloading: '正在准备本机语音包，答题倒计时已暂停。',
        denied: '麦克风暂不可用。允许浏览器使用麦克风后，可以重试。',
        unavailable: '此浏览器暂时无法使用本机语音识别。你可以改做输入题。',
      };
      instructions.textContent = voiceInstructions[reading] ?? `选对了。点「开始跟读」，再读出屏幕上的${language}。`;
    } else {
      instructions.textContent = spelling ? `${directions.spell} 中文意思是「${question.zh}」。` : directions[question.mode];
    }
    listen.textContent = speaking && question.mode === 'repeat-zh' ? '播放中文' : '播放英文';
    field.hidden = speaking || exercise.options.length > 0;
    field.lang = chinese ? 'zh-CN' : 'en';
    field.placeholder = chinese ? '请输入汉字' : exercise.placeholder || '输入答案';
    label.textContent = spelling ? `填写 ${exercise.blankCount} 个字母` : '中文意思（用汉字填写）';
    label.hidden = field.hidden;
    options.hidden = repeat || question.options.length === 0;
    hint.hidden = repeat;
    const needsModel = reading === 'downloadable' || reading === 'downloading';
    downloadVoice.hidden = !needsModel;
    downloadVoice.disabled = reading === 'downloading';
    downloadVoice.textContent = downloadVoice.disabled ? '正在准备语音包…' : '下载本机语音包';
    typeInstead.hidden = !canTypeInstead(reading);
    typeInstead.classList.toggle('primary', reading === 'unavailable');
    submit.hidden = needsModel || reading === 'unavailable';
    submit.textContent = speaking
      ? ({ opening: '正在开启麦克风…', listening: '正在听…', denied: '重试麦克风' }[reading] ?? '开始跟读')
      : '提交答案';
    showPrompt();
    updateClock();
  }

  function setReadingMode(mode) {
    attempt.reading = mode;
    attempt.written = mode === 'typing' ? readingFallbackQuestion(attempt.question) : null;
    attempt.download = null;
    field.value = '';
  }

  function canTypeInstead(mode) {
    return ['downloadable', 'downloading', 'denied', 'unavailable'].includes(mode);
  }

  function readingLanguage() {
    return attempt.question.mode === 'repeat-zh' ? 'zh-CN' : 'en-US';
  }

  function stopReading() {
    cancelReading?.();
    cancelReading = undefined;
  }

  function startReading() {
    if (attempt.reading !== 'ready' && attempt.reading !== 'denied') return;
    stopVoice();
    const current = attempt;
    current.reading = 'opening';
    updateForm();
    displayFeedback('麦克风开启后，请读出屏幕上的词。');
    cancelReading = listenForReading(readingLanguage(), {
      onListening() {
        if (attempt !== current) return;
        current.reading = 'listening';
        updateForm();
        displayFeedback('正在听，请读一遍。');
      },
      onFinished({ status, transcripts }) {
        if (attempt !== current) return;
        cancelReading = undefined;
        if (status === 'heard' && transcripts.some(text => checkReadingAnswer(current.question, text))) {
          report('read', true);
          close('complete');
          return;
        }
        if (status === 'heard' || status === 'silent') {
          current.reading = 'ready';
          displayFeedback(status === 'silent' ? '还没听到声音。点「开始跟读」再试一次。' :
            '没听清屏幕上的词。点「开始跟读」再读一次。', true);
        } else {
          setReadingMode(status);
          displayFeedback('');
        }
        updateForm();
      },
    });
  }

  function fillOptions(question) {
    const entries = question.options.map((answer) => {
      const row = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'option';
      radio.value = answer;
      radio.checked = attempt.response === answer;
      if (question.mode === 'repeat-en') row.lang = 'en';
      row.append(radio, document.createTextNode(answer));
      return row;
    });
    options.replaceChildren(...entries);
  }

  function close(reason) {
    if (!attempt) return;
    const finished = reason === 'complete';
    if (finished) {
      attempts.clear();
      restored.clear();
    } else if (reason === 'cancel' && !attempt.repeat) {
      attempt.response = attempt.question.options.length ?
        options.querySelector('input:checked')?.value ?? '' : field.value;
    }
    stopReading();
    stopVoice();
    attempt = undefined;
    composing = false;
    dialog.close();
    if (finished) onComplete();
    else onReturn(reason);
  }

  function report(outcome, completesUpgrade = false) {
    const { question } = attempt;
    attempt.sequence++;
    onOutcome({
      eventId: `${question.id}:${attempt.sequence}`,
      targetId: question.targetId,
      mode: question.mode,
      outcome,
      completesUpgrade,
    });
  }

  function reset() {
    attempts.clear();
    restored.clear();
    stopReading();
    stopVoice();
    attempt = undefined;
    letters = [];
    composing = false;
    if (dialog.open) dialog.close();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!attempt || composing || submit.disabled) return;
    const { question } = attempt;
    if (attempt.repeat) {
      if (!attempt.written) {
        startReading();
      } else if (checkAnswer(attempt.written, field.value)) {
        close('complete');
      } else {
        displayFeedback(field.value.trim() ? '还不对，星星还在。再试一次。' : '请先填写答案。', true);
      }
      return;
    }
    attempt.response = question.options.length ?
      options.querySelector('input:checked')?.value ?? '' : field.value;
    if (!attempt.response.trim()) {
      displayFeedback('先输入或选择答案。', true);
      return;
    }
    if (question.mode === 'translate' && !/\p{Script=Han}/u.test(attempt.response)) {
      displayFeedback('这题要填中文意思。请切换中文输入法，选字后再提交。', true);
      return;
    }
    if (!checkAnswer(question, attempt.response)) {
      attempt.hadError = true;
      displayFeedback(question.mode === 'translate'
        ? '这个写法还不匹配本题。星星还在，可以看提示再试一次。'
        : '还不对，星星还在。可以看提示再试一次。', true);
      report('incorrect');
      return;
    }
    const outcome = attempt.hadError || attempt.usedHint || (attempt.fallback && question.mode !== 'spell') ?
      'assisted' : 'independent';
    if (hasReadingStep(question.mode)) {
      attempt.repeat = true;
      attempt.objective = outcome;
      attempt.left = Math.max(attempt.left, 15);
      setReadingMode(localReadingSupported() ? 'ready' : 'unavailable');
      updateForm();
      displayFeedback('');
      report(outcome);
      if (attempt.autoCue) playCue();
    } else {
      report(outcome, true);
      close('complete');
    }
  });

  field.addEventListener('compositionstart', () => { composing = true; });
  field.addEventListener('compositionend', () => { composing = false; });
  field.addEventListener('input', updateSlots);
  prompt.addEventListener('click', () => {
    if ((attempt?.written ?? attempt?.question)?.mode === 'spell') field.focus();
  });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
  });
  listen.addEventListener('click', () => { if (attempt && !listen.disabled) playCue(); });
  typeInstead.addEventListener('click', () => {
    if (!attempt || !canTypeInstead(attempt.reading)) return;
    setReadingMode('typing');
    displayFeedback('');
    updateForm();
    field.focus?.();
  });
  downloadVoice.addEventListener('click', async () => {
    if (attempt?.reading !== 'downloadable') return;
    const current = attempt;
    const download = { left: VOICE_SETUP_WAIT };
    current.reading = 'downloading';
    current.download = download;
    displayFeedback('');
    updateForm();
    const ready = await downloadReadingLanguage(readingLanguage());
    if (attempt !== current || current.download !== download) return;
    setReadingMode(ready ? 'ready' : 'downloadable');
    displayFeedback(ready ? '语音包已就绪，可以开始跟读。' : '语音包暂时没准备好。可以重试，或改做输入题。', !ready);
    updateForm();
  });
  hint.addEventListener('click', () => {
    if (!attempt) return;
    attempt.usedHint = true;
    if (!attempt.repeat && attempt.question.mode !== 'spell') attempt.fallback = true;
    showPrompt();
    displayFeedback(attempt.question.hint);
  });
  get('cancel-upgrade').addEventListener('click', () => close('cancel'));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close('cancel');
  });

  return {
    open(question, name, cost, muted) {
      attempt = attempts.get(question.id);
      if (!attempt) {
        let fromSave = restored.get(question.id);
        restored.delete(question.id);
        if (fromSave?.targetId !== question.targetId || fromSave?.mode !== question.mode ||
            fromSave?.signature !== questionSignature(question) || fromSave?.left > question.seconds) fromSave = null;
        attempt = {
          question, left: fromSave?.left ?? question.seconds, waiting: 0, response: '',
          fallback: fromSave?.fallback ?? muted,
          repeat: Boolean(fromSave?.objective), objective: fromSave?.objective ?? null,
          repeatDelay: fromSave?.repeatDelay ?? 0, introduced: fromSave?.introduced ?? false,
          hadError: fromSave?.hadError ?? false, usedHint: fromSave?.usedHint ?? false,
          sequence: fromSave?.sequence ?? 0,
        };
        attempts.set(question.id, attempt);
      }
      if (attempt.left <= 0) {
        attempt.left = question.seconds;
        attempt.introduced = attempt.repeat;
        attempt.response = '';
      }
      attempt.autoCue = !muted;
      attempt.fallback ||= muted;
      get('workbench-title').textContent = `${name} · ${cost} 星`;
      field.value = attempt.response;
      if (attempt.repeat) setReadingMode(localReadingSupported() ? 'ready' : 'unavailable');
      fillOptions(question);
      updateForm();
      displayFeedback('');
      dialog.showModal();
      if (!attempt.introduced) {
        attempt.introduced = true;
        if (!muted) playCue(true);
      }
    },
    tick(seconds) {
      if (!attempt) return;
      if (attempt.download) {
        attempt.download.left -= seconds;
        if (attempt.download.left <= 0) {
          setReadingMode('downloadable');
          displayFeedback('语音包还在准备。可以重试，或改做输入题。');
          updateForm();
        }
        return;
      }
      if (attempt.waiting) {
        attempt.waiting = Math.max(0, attempt.waiting - seconds);
        if (!attempt.waiting) {
          stopVoice();
          settleCue(false);
        }
        return;
      }
      attempt.left = Math.max(0, attempt.left - seconds);
      attempt.repeatDelay = Math.max(0, attempt.repeatDelay - seconds);
      if (attempt.left <= 0) {
        report('timeout');
        close('timeout');
      }
      else updateClock();
    },
    suspend() {
      if (!attempt) return;
      if (cancelReading) {
        stopReading();
        attempt.reading = 'ready';
        updateForm();
        displayFeedback('麦克风已关闭。回到这里可以再次跟读。');
      }
      stopVoice();
      if (attempt.waiting) settleCue(false);
    },
    reset,
    snapshot() {
      const entries = [...restored.values()];
      for (const state of attempts.values()) {
        const { id, targetId, mode } = state.question;
        const { left, repeatDelay, sequence, introduced, hadError, usedHint, objective } = state;
        entries.push({
          id, targetId, mode, left, repeatDelay, sequence, introduced, hadError, usedHint, objective,
          signature: questionSignature(state.question),
          fallback: state.fallback || Boolean(state.waiting),
        });
      }
      return { version: 1, attempts: entries };
    },
    restore(snapshot) {
      reset();
      if (snapshot?.version !== 1 || !Array.isArray(snapshot.attempts) || snapshot.attempts.length > 4) return false;
      for (const entry of snapshot.attempts.slice(0, 4)) {
        const accepted = savedAttempt(entry);
        if (accepted) restored.set(accepted.id, accepted);
      }
      return true;
    },
  };
}
