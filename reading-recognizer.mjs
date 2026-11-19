function localRecognition() {
  if (globalThis.isSecureContext === false) return undefined;
  return [globalThis.SpeechRecognition, globalThis.webkitSpeechRecognition].find(Recognition =>
    typeof Recognition === 'function' && Recognition.prototype && 'processLocally' in Recognition.prototype &&
    typeof Recognition.available === 'function');
}

function localOptions(lang) {
  return { langs: [lang], processLocally: true };
}

export function localReadingSupported() {
  return Boolean(localRecognition());
}

export async function downloadReadingLanguage(lang) {
  const Recognition = localRecognition();
  if (typeof Recognition?.install !== 'function') return false;
  try {
    return (await Recognition.install(localOptions(lang))) === true;
  } catch {
    return false;
  }
}

function recognitionError(code) {
  if (code === 'not-allowed' || code === 'NotAllowedError' || code === 'SecurityError') return 'denied';
  return code === 'no-speech' || code === 'aborted' ? 'silent' : 'unavailable';
}

export function listenForReading(lang, { onListening, onFinished }) {
  let active = true;
  let recognition;

  function cancel() {
    active = false;
    if (!recognition) return;
    const current = recognition;
    recognition = undefined;
    current.onstart = null;
    current.onresult = null;
    current.onnomatch = null;
    current.onerror = null;
    current.onend = null;
    try { current.abort(); } catch { /* The browser may have already closed the microphone. */ }
  }

  function finish(outcome) {
    if (!active) return;
    cancel();
    onFinished(outcome);
  }

  function handleResult(event) {
    if (!active) return;
    const result = event.results[event.resultIndex ?? 0];
    if (!result?.isFinal) return;
    const transcripts = [...new Set(Array.from(result, alternative => alternative.transcript.trim()).filter(Boolean))];
    finish(transcripts.length ? { status: 'heard', transcripts } : { status: 'silent' });
  }

  async function start() {
    if (!active) return;
    const Recognition = localRecognition();
    if (!Recognition) {
      finish({ status: 'unavailable' });
      return;
    }
    try {
      const availability = await Recognition.available(localOptions(lang));
      if (!active) return;
      if (availability !== 'available') {
        const needsDownload = availability === 'downloadable' || availability === 'downloading';
        finish({ status: needsDownload && typeof Recognition.install === 'function' ? 'downloadable' : 'unavailable' });
        return;
      }
      recognition = new Recognition();
      recognition.processLocally = true;
      if (recognition.processLocally !== true) {
        finish({ status: 'unavailable' });
        return;
      }
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.onstart = () => { if (active) onListening?.(); };
      recognition.onresult = handleResult;
      recognition.onnomatch = () => finish({ status: 'silent' });
      recognition.onerror = event => finish({ status: recognitionError(event.error) });
      recognition.onend = () => finish({ status: 'silent' });
      recognition.start();
    } catch (error) {
      finish({ status: recognitionError(error?.name) });
    }
  }

  void Promise.resolve().then(start);
  return cancel;
}
