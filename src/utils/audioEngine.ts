// Audio Engine — звукові сигнали монітора (Web Audio API)

let audioCtx: AudioContext | null = null;
let alarmOscillator: OscillatorNode | null = null;
let alarmGain: GainNode | null = null;
let isMuted = false;

const getAudioContext = (): AudioContext => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

// Одиночний біп монітора (при кожному QRS)
export const playBeep = (frequency: number = 880, duration: number = 0.08, volume: number = 0.3) => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration + 0.01);
  } catch (e) {
    // Ігноруємо помилки AudioContext
  }
};

// Біп при нормальному синусовому ритмі — зелений тон
export const playNormalBeep = () => playBeep(880, 0.08, 0.25);

// Біп при ФП — нижчий, нерегулярний
export const playAfibBeep = () => playBeep(660, 0.06, 0.2);

// Тривожний сигнал — при критичних станах (ФШ, асистолія, ШТ)
export const startAlarm = (type: 'critical' | 'warning' = 'critical') => {
  if (isMuted) return;
  stopAlarm();

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    alarmOscillator = ctx.createOscillator();
    alarmGain = ctx.createGain();

    alarmOscillator.connect(alarmGain);
    alarmGain.connect(ctx.destination);

    if (type === 'critical') {
      // Переривчастий високочастотний сигнал (ФШ/асистолія)
      alarmOscillator.frequency.setValueAtTime(1200, ctx.currentTime);
      alarmOscillator.type = 'square';
      alarmGain.gain.setValueAtTime(0.4, ctx.currentTime);

      // Переривчастість через LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(3, ctx.currentTime); // 3 Hz = 3 переривання/сек
      lfoGain.gain.setValueAtTime(0.4, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(alarmGain.gain);
      lfo.start();
    } else {
      // Попереджувальний сигнал (жовтий)
      alarmOscillator.frequency.setValueAtTime(800, ctx.currentTime);
      alarmOscillator.type = 'sine';
      alarmGain.gain.setValueAtTime(0.2, ctx.currentTime);
    }

    alarmOscillator.start();
  } catch (e) {
    // Ігноруємо
  }
};

export const stopAlarm = () => {
  try {
    alarmOscillator?.stop();
    alarmOscillator?.disconnect();
    alarmGain?.disconnect();
  } catch (e) {
    // Вже зупинено
  }
  alarmOscillator = null;
  alarmGain = null;
};

// Звук дефібрилятора (заряд + розряд)
export const playDefibrillatorShock = (onComplete?: () => void) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    // Фаза заряду (1.5 сек наростаючий тон)
    const chargeOsc = ctx.createOscillator();
    const chargeGain = ctx.createGain();
    chargeOsc.connect(chargeGain);
    chargeGain.connect(ctx.destination);
    chargeOsc.type = 'sawtooth';
    chargeOsc.frequency.setValueAtTime(200, ctx.currentTime);
    chargeOsc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 1.5);
    chargeGain.gain.setValueAtTime(0.1, ctx.currentTime);
    chargeGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1.5);
    chargeGain.gain.setValueAtTime(0, ctx.currentTime + 1.5);
    chargeOsc.start(ctx.currentTime);
    chargeOsc.stop(ctx.currentTime + 1.6);

    // Розряд (короткий потужний удар)
    const shockOsc = ctx.createOscillator();
    const shockGain = ctx.createGain();
    shockOsc.connect(shockGain);
    shockGain.connect(ctx.destination);
    shockOsc.type = 'square';
    shockOsc.frequency.setValueAtTime(60, ctx.currentTime + 1.6);
    shockGain.gain.setValueAtTime(0.8, ctx.currentTime + 1.6);
    shockGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.9);
    shockOsc.start(ctx.currentTime + 1.6);
    shockOsc.stop(ctx.currentTime + 2.0);

    if (onComplete) {
      setTimeout(onComplete, 2000);
    }
  } catch (e) {
    if (onComplete) setTimeout(onComplete, 2000);
  }
};

// Звук СЛР (компресії)
export const playCPRBeep = () => playBeep(440, 0.05, 0.15);

export const setMuted = (mute: boolean) => {
  isMuted = mute;
  if (mute) stopAlarm();
};

export const getMuted = () => isMuted;

export const resumeAudioContext = () => {
  try {
    audioCtx?.resume();
  } catch (e) {}
};
