// ECG Generator v2 — точна відповідність медичному атласу
// Кольори: ЕКГ=зелений, АТ=червоний, SpO2=синій

export type RhythmType =
  | 'sinus'
  | 'afib'
  | 'av_block_1'
  | 'av_block_2_mobitz1'
  | 'av_block_2_mobitz2'
  | 'av_block_3'
  | 'vtach'
  | 'vfib'
  | 'asystole';

// Гаусова функція для зубців ЕКГ
const g = (x: number, mean: number, std: number, amp: number): number =>
  amp * Math.exp(-((x - mean) ** 2) / (2 * std ** 2));

const noise = (scale = 0.015) => (Math.random() - 0.5) * scale;

// ============================================================
// ЕКГ ГЕНЕРАТОРИ
// ============================================================

// 1. СИНУСОВИЙ РИТМ — класичний P-QRS-T
const sinusBeat = (phase: number): number => {
  let v = 0;
  v += g(phase, 0.10, 0.020, 0.18);   // P
  v += g(phase, 0.20, 0.007, -0.10);  // Q
  v += g(phase, 0.23, 0.010, 1.00);   // R
  v += g(phase, 0.27, 0.007, -0.18);  // S
  v += g(phase, 0.32, 0.012, 0.05);   // ST
  v += g(phase, 0.42, 0.038, 0.22);   // T
  return v + noise();
};

// 2. ФІБРИЛЯЦІЯ ПЕРЕДСЕРДЬ — нерегулярний QRS, немає P, дрібні хвилі базової лінії
const afibBeat = (phase: number, irregPhase: number): number => {
  let v = 0;
  // Дрібнохвильова фібриляція базової лінії (f-хвилі ~350/хв)
  v += Math.sin(irregPhase * 350 * Math.PI * 2) * 0.04;
  v += Math.sin(irregPhase * 410 * Math.PI * 2 + 1.3) * 0.025;
  // QRS без P
  v += g(phase, 0.23, 0.009, 0.90);   // R
  v += g(phase, 0.20, 0.007, -0.08);  // Q
  v += g(phase, 0.27, 0.007, -0.14);  // S
  v += g(phase, 0.42, 0.040, 0.14);   // T (знижений)
  return v + noise(0.02);
};

// 3. АВ-БЛОКАДА I СТУПЕНЯ — подовжений PR (>0.20 с)
const avBlock1Beat = (phase: number): number => {
  let v = 0;
  v += g(phase, 0.08, 0.020, 0.18);   // P (рання)
  // Подовжений PR — QRS зсунутий праворуч
  v += g(phase, 0.32, 0.007, -0.10);  // Q (пізній)
  v += g(phase, 0.35, 0.010, 1.00);   // R
  v += g(phase, 0.39, 0.007, -0.18);  // S
  v += g(phase, 0.44, 0.012, 0.05);   // ST
  v += g(phase, 0.54, 0.038, 0.22);   // T
  return v + noise();
};

// 4. АВ-БЛОКАДА II МОБІТЦ I (Венкебах) — PR наростає → DROP
// Цикл 4:3 — 3 провідних комплекси + 1 блокований P
const avBlock2Mobitz1Beat = (globalPhase: number, hr: number): number => {
  const rr = 60 / hr;
  // Цикл: 4 P-хвилі, але тільки 3 QRS
  const cycleLen = rr * 4; // тривалість одного циклу Венкебаха
  const posInCycle = globalPhase % cycleLen;
  const beatIdx = Math.floor(posInCycle / rr); // 0,1,2,3
  const phase = (posInCycle % rr) / rr;

  let v = 0;
  // P-хвиля завжди
  v += g(phase, 0.08, 0.020, 0.18);

  if (beatIdx < 3) {
    // PR наростає: 0.16, 0.24, 0.36 с → в одиницях фази
    const prDelays = [0.14, 0.22, 0.32];
    const pr = prDelays[Math.min(beatIdx, 2)];
    v += g(phase, pr + 0.12, 0.007, -0.10);
    v += g(phase, pr + 0.15, 0.010, 1.00);
    v += g(phase, pr + 0.19, 0.007, -0.18);
    v += g(phase, pr + 0.24, 0.012, 0.05);
    v += g(phase, pr + 0.34, 0.038, 0.22);
  }
  // beatIdx === 3 → тільки P, немає QRS (DROP)
  return v + noise();
};

// 5. АВ-БЛОКАДА II МОБІТЦ II — PR стабільний → DROP кожен 2-й
const avBlock2Mobitz2Beat = (globalPhase: number, hr: number): number => {
  const rr = 60 / hr;
  const cycleLen = rr * 2; // 2:1 блокада
  const posInCycle = globalPhase % cycleLen;
  const beatIdx = Math.floor(posInCycle / rr);
  const phase = (posInCycle % rr) / rr;

  let v = 0;
  // P завжди
  v += g(phase, 0.08, 0.020, 0.18);

  if (beatIdx === 0) {
    // Провідний комплекс — PR стабільний
    v += g(phase, 0.22, 0.007, -0.10);
    v += g(phase, 0.25, 0.010, 1.00);
    v += g(phase, 0.29, 0.007, -0.18);
    v += g(phase, 0.34, 0.012, 0.05);
    v += g(phase, 0.44, 0.038, 0.22);
  }
  // beatIdx === 1 → тільки P (блокований)
  return v + noise();
};

// 6. АВ-БЛОКАДА III (ПОВНА) — P і QRS повністю незалежні
// P: 75/хв, QRS: 35/хв (ідіовентрикулярний), QRS широкий
const avBlock3Beat = (t: number): number => {
  const pRate = 75, qrsRate = 35;
  const pPhase = (t * pRate / 60) % 1;
  const qrsPhase = (t * qrsRate / 60) % 1;

  let v = 0;
  // P-хвилі (незалежні, правильний ритм)
  v += g(pPhase, 0.1, 0.022, 0.15);
  // QRS — широкий, деформований (ідіовентрикулярний)
  v += g(qrsPhase, 0.25, 0.030, 0.90);  // R широкий
  v += g(qrsPhase, 0.18, 0.012, -0.12);
  v += g(qrsPhase, 0.38, 0.015, -0.20);
  v += g(qrsPhase, 0.55, 0.055, 0.25);  // T широкий
  return v + noise();
};

// 7. ШЛУНОЧКОВА ТАХІКАРДІЯ — широкі мономорфні QRS, 160/хв
const vtachBeat = (phase: number): number => {
  let v = 0;
  v += g(phase, 0.20, 0.045, 0.85);   // R широкий
  v += g(phase, 0.38, 0.055, -0.45);  // від'ємна частина
  v += g(phase, 0.58, 0.060, 0.28);   // T інвертований
  return v + noise(0.025);
};

// 8. ФІБРИЛЯЦІЯ ШЛУНОЧКІВ — хаотичні нерегулярні хвилі
const vfibBeat = (t: number, amplitude: number): number => {
  const a = Math.max(0.08, amplitude);
  return a * (
    Math.sin(t * 23.5) * 0.50 +
    Math.sin(t * 31.7 + 1.2) * 0.35 +
    Math.sin(t * 17.3 + 2.4) * 0.40 +
    Math.sin(t * 41.1 + 0.8) * 0.25 +
    Math.sin(t * 7.8 + 0.5) * 0.15 +
    noise(0.25)
  );
};

// ============================================================
// ГОЛОВНА ФУНКЦІЯ — генерація буфера ЕКГ
// ============================================================
export const generateECGBuffer = (
  rhythm: RhythmType,
  hr: number,
  durationSec: number,
  sampleRate = 250,
  vfibAmplitude = 1.0,
  timeOffset = 0,
): number[] => {
  const samples = Math.floor(durationSec * sampleRate);
  const buffer: number[] = [];

  for (let i = 0; i < samples; i++) {
    const t = timeOffset + i / sampleRate;
    let value = 0;

    switch (rhythm) {
      case 'sinus': {
        const rr = 60 / hr;
        value = sinusBeat((t % rr) / rr);
        break;
      }
      case 'afib': {
        // Нерегулярний RR ±20%
        const baseRR = 60 / hr;
        const irr = baseRR * (1 + 0.20 * Math.sin(t * 2.7 + 1.1) * Math.sin(t * 1.3));
        value = afibBeat((t % irr) / irr, t);
        break;
      }
      case 'av_block_1': {
        const rr = 60 / hr;
        value = avBlock1Beat((t % rr) / rr);
        break;
      }
      case 'av_block_2_mobitz1':
        value = avBlock2Mobitz1Beat(t, hr);
        break;
      case 'av_block_2_mobitz2':
        value = avBlock2Mobitz2Beat(t, hr);
        break;
      case 'av_block_3':
        value = avBlock3Beat(t);
        break;
      case 'vtach': {
        const rr = 60 / 160;
        value = vtachBeat((t % rr) / rr);
        break;
      }
      case 'vfib':
        value = vfibBeat(t, vfibAmplitude);
        break;
      case 'asystole':
        value = noise(0.02);
        break;
    }
    buffer.push(value);
  }
  return buffer;
};

// ============================================================
// АТ — артеріальний тиск (ЧЕРВОНА КРИВА)
// Форма: швидкий підйом систоли, дикротична вирізка, діастола
// ============================================================
export const generateABPBuffer = (
  hr: number,
  systolic: number,
  diastolic: number,
  durationSec: number,
  sampleRate = 250,
  rhythm: RhythmType = 'sinus',
  timeOffset = 0,
): number[] => {
  const samples = Math.floor(durationSec * sampleRate);
  const buffer: number[] = [];
  const mean = diastolic + (systolic - diastolic) / 3;

  for (let i = 0; i < samples; i++) {
    const t = timeOffset + i / sampleRate;

    if (rhythm === 'vfib' || rhythm === 'asystole') {
      // Пряма лінія на рівні ~діастоли, поступово падає
      buffer.push(diastolic * 0.25 + noise(2));
      continue;
    }

    const effectiveHR = rhythm === 'vtach' ? 160 : rhythm === 'av_block_3' ? 35 : hr;
    const rr = 60 / effectiveHR;

    let phase: number;
    // При Мобітц II — кожна друга хвиля АТ відсутня
    if (rhythm === 'av_block_2_mobitz2') {
      const cycleLen = rr * 2;
      const posInCycle = t % cycleLen;
      const beatIdx = Math.floor(posInCycle / rr);
      phase = (posInCycle % rr) / rr;
      if (beatIdx === 1) {
        // Блокований удар — мала хвиля АТ
        buffer.push(diastolic + g(phase, 0.2, 0.06, (systolic - diastolic) * 0.15) + noise(1));
        continue;
      }
    } else if (rhythm === 'av_block_2_mobitz1') {
      const cycleLen = rr * 4;
      const posInCycle = t % cycleLen;
      const beatIdx = Math.floor(posInCycle / rr);
      phase = (posInCycle % rr) / rr;
      if (beatIdx === 3) {
        // DROP — відсутня хвиля АТ
        buffer.push(diastolic + g(phase, 0.2, 0.06, (systolic - diastolic) * 0.10) + noise(1));
        continue;
      }
    } else {
      phase = (t % rr) / rr;
    }

    // Реалістична форма пульсової хвилі АТ:
    let v = diastolic;
    // Швидкий систолічний підйом
    v += g(phase, 0.18, 0.055, systolic - diastolic);
    // Дикротична вирізка
    v -= g(phase, 0.32, 0.018, (systolic - diastolic) * 0.12);
    // Дикротична хвиля
    v += g(phase, 0.40, 0.025, (systolic - diastolic) * 0.08);
    v += noise(1.5);

    buffer.push(Math.max(20, Math.min(250, v)));
  }
  return buffer;
};

// ============================================================
// SpO2 — плетизмограма (СИНЯ КРИВА)
// ============================================================
export const generateSpO2Buffer = (
  hr: number,
  spo2: number,
  durationSec: number,
  sampleRate = 250,
  rhythm: RhythmType = 'sinus',
  timeOffset = 0,
): number[] => {
  const samples = Math.floor(durationSec * sampleRate);
  const buffer: number[] = [];
  const amplitude = Math.max(0.1, (spo2 - 85) / 15);

  for (let i = 0; i < samples; i++) {
    const t = timeOffset + i / sampleRate;

    if (rhythm === 'vfib' || rhythm === 'asystole') {
      buffer.push(0.08 + noise(0.03));
      continue;
    }

    const effectiveHR = rhythm === 'vtach' ? 160 : rhythm === 'av_block_3' ? 35 : hr;
    const rr = 60 / effectiveHR;
    const phase = (t % rr) / rr;

    // М'яка синусоїдальна хвиля плетизмограми
    let v = 0.25;
    v += amplitude * 0.55 * g(phase, 0.28, 0.09, 1.0);
    v += amplitude * 0.08 * g(phase, 0.45, 0.04, 1.0); // дикротична хвиля
    v += noise(0.015);
    buffer.push(Math.max(0, Math.min(1, v)));
  }
  return buffer;
};

// ============================================================
// УТИЛІТИ
// ============================================================
export const getDisplayHR = (rhythm: RhythmType, baseHR: number): number | null => {
  switch (rhythm) {
    case 'vtach': return 160;
    case 'vfib': return null;
    case 'asystole': return 0;
    case 'av_block_3': return 35;
    case 'av_block_2_mobitz2': return Math.round(baseHR / 2);
    default: return baseHR;
  }
};

export const RHYTHM_LABELS: Record<RhythmType, string> = {
  sinus:               'Синусовий ритм',
  afib:                'Фібриляція передсердь',
  av_block_1:          'АВ-блокада I ст.',
  av_block_2_mobitz1:  'АВ-блокада II ст. (Мобітц I)',
  av_block_2_mobitz2:  'АВ-блокада II ст. (Мобітц II)',
  av_block_3:          'АВ-блокада III ст.',
  vtach:               'Шлуночкова тахікардія',
  vfib:                'Фібриляція шлуночків',
  asystole:            'Асистолія',
};

export const RHYTHM_SEVERITY: Record<RhythmType, 'stable' | 'warning' | 'critical'> = {
  sinus:               'stable',
  afib:                'warning',
  av_block_1:          'stable',
  av_block_2_mobitz1:  'warning',
  av_block_2_mobitz2:  'warning',
  av_block_3:          'critical',
  vtach:               'critical',
  vfib:                'critical',
  asystole:            'critical',
};
