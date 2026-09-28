export type Point = { x: number; y: number; z?: number };
export type Candidate = { id: string; score: number };
export type Correction = {
  kind: 'height' | 'finger' | 'rotation' | 'movement' | 'hold';
  hand?: 'primary' | 'secondary';
  message: string;
  jointIds: number[];
  arrow?: { from: Point; to: Point; label: string };
};
export type RecognitionFrame = {
  id: string;
  timestamp: number;
  status: 'idle' | 'tracking' | 'almost' | 'recognized' | 'uncertain';
  landmarks: Point[];
  secondaryLandmarks?: Point[];
  candidates: Candidate[];
  corrections: Correction[];
  holdProgress: number;
  eventId?: string;
  source: 'demo' | 'camera';
};
export type DictionaryEntry = {
  id: string;
  phrase: string;
  gloss: string;
  category: string;
  note: string;
  verified: boolean;
  reference?: string;
};

// These are UI fixtures, not a trained or verified sign-language dictionary.
export const demoDictionary: DictionaryEntry[] = [
  {
    id: 'hello',
    phrase: 'Здравствуйте',
    gloss: 'ПРИВЕТ',
    category: 'Знакомство',
    note: 'Начать разговор и привлечь внимание собеседника.',
    verified: false,
  },
  {
    id: 'help',
    phrase: 'Мне нужна помощь',
    gloss: 'ПОМОЩЬ',
    category: 'Просьбы',
    note: 'Попросить собеседника помочь.',
    verified: false,
  },
  {
    id: 'thanks',
    phrase: 'Спасибо',
    gloss: 'СПАСИБО',
    category: 'Общение',
    note: 'Поблагодарить за ответ или поддержку.',
    verified: false,
  },
  {
    id: 'yes',
    phrase: 'Да',
    gloss: 'ДА',
    category: 'Ответы',
    note: 'Коротко ответить утвердительно.',
    verified: false,
  },
  {
    id: 'no',
    phrase: 'Нет',
    gloss: 'НЕТ',
    category: 'Ответы',
    note: 'Коротко ответить отрицательно.',
    verified: false,
  },
];
export const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;
export const demoLandmarks: Point[] = [
  { x: 0.51, y: 0.78 },
  { x: 0.44, y: 0.66 },
  { x: 0.36, y: 0.59 },
  { x: 0.29, y: 0.53 },
  { x: 0.23, y: 0.48 },
  { x: 0.42, y: 0.5 },
  { x: 0.4, y: 0.38 },
  { x: 0.39, y: 0.28 },
  { x: 0.38, y: 0.18 },
  { x: 0.51, y: 0.47 },
  { x: 0.51, y: 0.33 },
  { x: 0.51, y: 0.22 },
  { x: 0.51, y: 0.12 },
  { x: 0.6, y: 0.49 },
  { x: 0.62, y: 0.37 },
  { x: 0.63, y: 0.27 },
  { x: 0.64, y: 0.19 },
  { x: 0.67, y: 0.54 },
  { x: 0.72, y: 0.45 },
  { x: 0.74, y: 0.38 },
  { x: 0.76, y: 0.31 },
];
export const idleFrame: RecognitionFrame = {
  id: 'idle',
  timestamp: 0,
  status: 'idle',
  landmarks: [],
  candidates: [],
  corrections: [],
  holdProgress: 0,
  source: 'camera',
};

export function credibleCandidate(candidates: Candidate[], dictionary: DictionaryEntry[]) {
  const allowed = new Set(dictionary.map((entry) => entry.id));
  const unique = new Map<string, Candidate>();
  for (const item of candidates) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 1
    )
      continue;
    if (item.score > (unique.get(item.id)?.score ?? -1)) unique.set(item.id, item);
  }
  const ranked = [...unique.values()].sort((a, b) => b.score - a.score);
  const first = ranked[0];
  if (
    !first ||
    !allowed.has(first.id) ||
    first.score < 0.65 ||
    (ranked[1] && first.score - ranked[1].score < 0.12)
  )
    return null;
  return first;
}

/** Frontend boundary: reject ambiguous output, corrections without a credible target,
 * and unverified entries in the camera pipeline. Demo fixtures are always explicit. */
export function guardFrame(frame: RecognitionFrame, dictionary: DictionaryEntry[]) {
  const validPoint = (point: Point) =>
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1 &&
    (point.z === undefined || Number.isFinite(point.z));
  const validHand = (points: Point[]) =>
    Array.isArray(points) && points.length === 21 && points.every(validPoint);
  const validLandmarks =
    validHand(frame.landmarks) &&
    (!frame.secondaryLandmarks?.length || validHand(frame.secondaryLandmarks));
  const cleanCorrections = (Array.isArray(frame.corrections) ? frame.corrections : []).filter(
    (item) =>
      item &&
      ['height', 'finger', 'rotation', 'movement', 'hold'].includes(item.kind) &&
      typeof item.message === 'string' &&
      item.message.trim() &&
      Array.isArray(item.jointIds) &&
      item.jointIds.every((id) => Number.isInteger(id) && id >= 0 && id <= 20) &&
      (item.hand !== 'secondary' || Boolean(frame.secondaryLandmarks?.length)) &&
      (!item.arrow ||
        (validPoint(item.arrow.from) &&
          validPoint(item.arrow.to) &&
          typeof item.arrow.label === 'string')),
  );
  const normalized = {
    ...frame,
    landmarks: validLandmarks ? frame.landmarks : [],
    secondaryLandmarks: validLandmarks ? frame.secondaryLandmarks : undefined,
    candidates: Array.isArray(frame.candidates) ? frame.candidates : [],
    corrections: frame.status === 'almost' && validLandmarks ? cleanCorrections : [],
    holdProgress: Number.isFinite(frame.holdProgress)
      ? Math.min(1, Math.max(0, frame.holdProgress))
      : 0,
    eventId: typeof frame.eventId === 'string' && frame.eventId.trim() ? frame.eventId : undefined,
  };
  const candidate = credibleCandidate(normalized.candidates, dictionary);
  const entry = dictionary.find((item) => item.id === candidate?.id);
  const usable =
    validLandmarks &&
    candidate &&
    (frame.source === 'demo' || (frame.source === 'camera' && entry?.verified));
  if (
    ['almost', 'recognized'].includes(frame.status) &&
    (!usable || (frame.status === 'almost' && !normalized.corrections.length))
  ) {
    return {
      ...normalized,
      status: 'uncertain' as const,
      corrections: [],
      eventId: undefined,
      holdProgress: 0,
    };
  }
  if (frame.status === 'recognized' && (normalized.holdProgress < 1 || !normalized.eventId)) {
    return { ...normalized, status: 'tracking' as const, eventId: undefined };
  }
  return { ...normalized, eventId: frame.status === 'recognized' ? normalized.eventId : undefined };
}

export function makeDemoFrame(
  id: string,
  status: 'almost' | 'recognized' | 'uncertain',
  kind: Correction['kind'] = 'height',
): RecognitionFrame {
  const correctionMap: Record<Correction['kind'], Correction> = {
    height: {
      kind: 'height',
      message: 'Почти. Подними ладонь к отметке и удерживай положение 0,5 с.',
      jointIds: [0, 5, 9, 13, 17],
      arrow: { from: { x: 0.51, y: 0.7 }, to: { x: 0.51, y: 0.44 }, label: 'Подними ладонь' },
    },
    finger: {
      kind: 'finger',
      message: 'Почти. Выпрями указательный палец до отмеченного положения.',
      jointIds: [6, 7, 8],
      arrow: { from: { x: 0.38, y: 0.35 }, to: { x: 0.38, y: 0.18 }, label: 'Выпрями палец' },
    },
    rotation: {
      kind: 'rotation',
      message: 'Почти. Поверни ладонь к камере по направлению стрелки.',
      jointIds: [5, 9, 13, 17],
      arrow: { from: { x: 0.65, y: 0.55 }, to: { x: 0.42, y: 0.49 }, label: 'Поверни ладонь' },
    },
    movement: {
      kind: 'movement',
      message: 'Почти. Продолжи движение вправо по отмеченной траектории.',
      jointIds: [0, 9],
      arrow: { from: { x: 0.51, y: 0.55 }, to: { x: 0.77, y: 0.55 }, label: 'Продолжи вправо' },
    },
    hold: {
      kind: 'hold',
      message: 'Положение похоже на образец. Удерживай жест неподвижно ещё 0,5 с.',
      jointIds: [],
    },
  };
  let landmarks = demoLandmarks.map((point) => ({ ...point }));
  if (status === 'almost' && kind === 'height')
    landmarks = landmarks.map((point) => ({ ...point, y: Math.min(0.96, point.y + 0.12) }));
  if (status === 'almost' && kind === 'finger') landmarks[8] = { x: 0.4, y: 0.4 };
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    status,
    landmarks,
    candidates:
      status === 'uncertain'
        ? [
            { id, score: 0.56 },
            { id: id === 'hello' ? 'help' : 'hello', score: 0.53 },
          ]
        : [
            { id, score: status === 'recognized' ? 0.97 : 0.82 },
            { id: id === 'hello' ? 'help' : 'hello', score: 0.35 },
          ],
    corrections: status === 'almost' ? [correctionMap[kind]] : [],
    holdProgress: status === 'recognized' ? 1 : 0.3,
    eventId: status === 'recognized' ? crypto.randomUUID() : undefined,
    source: 'demo',
  };
}

export type Message = {
  id: string;
  text: string;
  role: 'user' | 'partner';
  source: 'demo' | 'manual' | 'camera' | 'caption';
  at: number;
};
export type Preferences = {
  speak: boolean;
  language: 'ru-RU' | 'en-US';
  voice: string;
  mirror: boolean;
  motion: boolean;
  saveDialog: boolean;
  captionsConsent: boolean;
};
export const preferencesDefault: Preferences = {
  speak: false,
  language: 'ru-RU',
  voice: '',
  mirror: true,
  motion: true,
  saveDialog: false,
  captionsConsent: false,
};
export const STORAGE_KEY = 'signbridge.frontend.v1';
export function loadPreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw || '{}');
    return {
      speak: value.speak === true,
      language: value.language === 'en-US' ? 'en-US' : 'ru-RU',
      voice: typeof value.voice === 'string' ? value.voice : '',
      mirror: value.mirror !== false,
      motion: value.motion !== false,
      saveDialog: value.saveDialog === true,
      captionsConsent: value.captionsConsent === true,
    };
  } catch {
    return { ...preferencesDefault };
  }
}
