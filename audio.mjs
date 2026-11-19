const MASTER_VOLUME = 0.66;
const MUSIC_VOLUME = 0.33;
const BASS_LINE = [40, 40, 47, 40, 41, 40, 43, 40, 38, 38, 45, 38, 39, 38, 42, 38];
const SIGNAL = [64, 0, 65, 0, 71, 67, 0, 65, 62, 0, 63, 0, 69, 68, 0, 63];

const CUE_INTERVAL = {
  shot: 0.075,
  rapid: 0.075,
  arc: 0.1,
  hit: 0.085,
  kill: 0.09,
  star: 0.11,
  breach: 0.2,
  blast: 0.22,
  chill: 0.28,
  wave: 0.4,
  ready: 0.3,
  install: 0.3,
  win: 0.4,
  lose: 0.4,
};

const frequencyOf = (note) => 440 * 2 ** ((note - 69) / 12);

export function createAudio() {
  let context;
  let master;
  let music;
  let noiseBuffer;
  let musicTimer;
  let step = 0;
  let nextBeat = 0;
  let mode = 'idle';
  let muted = false;
  let wave = 1;
  let armor = 3;
  const lastCue = new Map();

  function prepare(AudioContext) {
    context = new AudioContext();

    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(context.destination);

    music = context.createGain();
    music.gain.value = 0;
    music.connect(master);

    noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.24), context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let seed = 71;
    for (let i = 0; i < samples.length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    context.onstatechange = syncPlayback;
  }

  function envelope(level, duration, time, channel) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + Math.min(0.012, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    gain.connect(channel);
    return gain;
  }

  function tone(shape, frequency, duration, level, time, end = frequency, channel = master) {
    const oscillator = context.createOscillator();
    const gain = envelope(level, duration, time, channel);
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
    oscillator.connect(gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  function noise(cutoff, duration, level, time, channel = master) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = envelope(level, duration, time, channel);
    source.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    source.connect(filter);
    filter.connect(gain);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(time);
    source.stop(time + duration);
  }

  function scheduleBeat() {
    const now = context.currentTime;
    if (nextBeat < now) nextBeat = now + 0.018;
    if (nextBeat > now + 0.1) return;

    const beat = step % BASS_LINE.length;
    const pitch = frequencyOf(BASS_LINE[beat]);
    tone('triangle', pitch, 0.16, 0.19, nextBeat, pitch, music);

    if (beat % 4 === 0 || beat === 7 || beat === 15) {
      tone('sine', 132, 0.15, 0.29, nextBeat, 43, music);
    } else if (beat % 4 === 2) {
      noise(1050, 0.11, 0.21, nextBeat, music);
      tone('triangle', 207, 0.08, 0.10, nextBeat, 90, music);
    }
    if (beat % 2 === 1 || wave === 3) noise(4900, 0.043, 0.07, nextBeat, music);

    if (SIGNAL[beat] && (beat % 4 === 0 || wave > 1 || armor === 1)) {
      const upper = frequencyOf(SIGNAL[beat]);
      tone('square', upper, armor === 1 ? 0.16 : 0.105, 0.071, nextBeat, upper, music);
    }

    step += 1;
    nextBeat += 0.243 - (wave - 1) * 0.011 - (armor === 1 ? 0.015 : 0);
  }

  function syncPlayback() {
    if (!context) return;
    const available = context.state === 'running';
    const playing = available && mode === 'running' && !muted;
    if (available) {
      music.gain.setTargetAtTime(playing ? MUSIC_VOLUME : 0, context.currentTime, playing ? 0.035 : 0.012);
    }

    if (!playing && musicTimer !== undefined) {
      clearInterval(musicTimer);
      musicTimer = undefined;
    } else if (playing && musicTimer === undefined) {
      nextBeat = context.currentTime + 0.025;
      scheduleBeat();
      musicTimer = setInterval(scheduleBeat, 42);
    }
  }

  function hit(time, heavy = false) {
    noise(heavy ? 510 : 890, heavy ? 0.18 : 0.08, heavy ? 0.23 : 0.13, time);
    tone('triangle', heavy ? 174 : 240, heavy ? 0.23 : 0.1, heavy ? 0.26 : 0.13, time, heavy ? 48 : 97);
  }

  function phrase(notes, time, spacing, duration, level, shape = 'triangle') {
    notes.forEach((note, index) => tone(shape, frequencyOf(note), duration, level, time + spacing * index));
  }

  const cues = {
    shot(time) {
      noise(2800, 0.048, 0.095, time);
      tone('triangle', 215, 0.085, 0.13, time, 77);
    },
    rapid(time) {
      noise(3700, 0.047, 0.13, time);
      tone('square', 378, 0.075, 0.10, time, 139);
    },
    arc(time) {
      noise(4700, 0.09, 0.14, time);
      tone('sawtooth', 670, 0.14, 0.14, time, 183);
      tone('triangle', 860, 0.09, 0.10, time + 0.055, 370);
    },
    hit(time) { hit(time); },
    kill(time) { hit(time, true); },
    star(time) { phrase([76, 83], time, 0.045, 0.1, 0.11); },
    ready(time) { phrase([64, 71, 76], time, 0.085, 0.15, 0.12, 'square'); },
    install(time) {
      hit(time, true);
      phrase([52, 59, 64, 71], time + 0.04, 0.06, 0.16, 0.16);
    },
    breach(time) {
      hit(time, true);
      tone('sawtooth', 271, 0.28, 0.17, time, 83);
    },
    blast(time) { hit(time, true); },
    chill(time) {
      noise(2650, 0.18, 0.12, time);
      tone('triangle', 740, 0.18, 0.12, time, 410);
      tone('sine', 1090, 0.19, 0.10, time + 0.035, 810);
    },
    wave(time) { phrase([47, 47, 50], time, 0.085, 0.16, 0.13, 'square'); },
    win(time) { phrase([52, 56, 59, 64, 68], time, 0.105, 0.34, 0.19); },
    lose(time) { phrase([55, 51, 47, 40], time, 0.13, 0.32, 0.19); },
  };

  return {
    async unlock() {
      const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        if (!context) prepare(AudioContext);
        if (context.state !== 'running') await context.resume();
        syncPlayback();
        return context.state === 'running';
      } catch {
        return false;
      }
    },
    setMuted(value) {
      if (muted === value) return;
      muted = value;
      if (context) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, context.currentTime, 0.018);
      syncPlayback();
    },
    setMode(value) {
      if (mode === value) return;
      mode = value;
      if (mode === 'idle' || mode === 'ended') {
        step = 0;
        lastCue.clear();
      }
      syncPlayback();
    },
    setThreat(waveNumber, armorNumber) {
      wave = Math.min(3, Math.max(1, waveNumber));
      armor = armorNumber;
    },
    playEvents(events) {
      if (muted || context?.state !== 'running' || mode === 'idle') return;
      const time = context.currentTime;
      for (const event of events) {
        if (event.type === 'shot' && event.kind === 'armor') continue;
        const key = event.type === 'shot' && (event.kind === 'rapid' || event.kind === 'arc') ? event.kind : event.type;
        const allowed = mode === 'running' || (mode === 'paused' && key === 'install') ||
          (mode === 'ended' && (key === 'win' || key === 'lose'));
        if (!allowed || !Object.prototype.hasOwnProperty.call(cues, key)) continue;
        if (time - (lastCue.get(key) ?? -Infinity) < CUE_INTERVAL[key]) continue;
        lastCue.set(key, time);
        cues[key](time + 0.005);
      }
    },
  };
}
