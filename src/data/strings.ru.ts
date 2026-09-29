// All UI texts live here (groundwork for a Kazakh translation later).

export const strings = {
  app: {
    name: "Gesturingo",
    tagline: "Учись жестам и говори жестами",
  },

  common: {
    back: "Назад",
    next: "Дальше",
    skip: "Пропустить",
    toMap: "На карту",
    retry: "Повторить",
    wip: "Экран в разработке",
  },

  welcome: {
    title: "Gesturingo",
    description:
      "Научись управлять приложением руками за 30 секунд, а потом — показывать буквы русской дактильной азбуки. Камера подскажет, что поправить.",
    enableCamera: "Включить камеру",
    start: "Начать",
    gateText: "Чтобы продолжить, включи камеру.",
    privacy: "Видео не покидает твой браузер.",
    requesting: "Разреши доступ к камере в окне браузера…",
    loadingModel: "Загружаем модель распознавания…",
    tryAgain: "Попробовать снова",
  },

  cameraErrors: {
    denied:
      "Доступ к камере запрещён. Нажми на значок камеры в адресной строке, разреши доступ и нажми «Попробовать снова».",
    notFound: "Камера не найдена. Подключи камеру и нажми «Попробовать снова».",
    busy: "Камера занята другим приложением. Закрой его и нажми «Попробовать снова».",
    insecure: "Камера работает только по HTTPS. Открой сайт по защищённой ссылке.",
    unknown: "Не удалось включить камеру. Нажми «Попробовать снова» или обнови страницу.",
    modelFailed: "Не удалось загрузить модель распознавания. Проверь интернет и нажми «Попробовать снова».",
  },

  debug: {
    fps: "FPS",
    delegate: "Делегат",
    hand: "Рука",
    score: "Уверенность",
    palmSize: "Размер ладони",
    palmFacing: "Ладонь",
    thumbPosition: "Большой палец",
    pinch: "Щипок",
    speed: "Скорость запястья",
    pose: "Поза",
    dwell: "Задержка",
    letter: "Буква",
    rules: "Правила",
    knnOff: "нет образцов / не участвует",
    none: "—",
  },

  hand: {
    Left: "левая",
    Right: "правая",
  },

  fingers: {
    thumb: "Большой",
    index: "Указательный",
    middle: "Средний",
    ring: "Безымянный",
    pinky: "Мизинец",
  },

  fingerStates: {
    straight: "прямой",
    half: "полусогнут",
    bent: "согнут",
  },

  palmFacing: {
    camera: "к камере",
    side: "боком",
    away: "от камеры",
  },

  thumbPosition: {
    acrossPalm: "поперёк ладони",
    side: "в сторону",
    up: "вверх",
  },

  tutorial: {
    title: "Учимся управлять руками",
    steps: [
      "Наведи указательный палец на кружок",
      "Сделай щипок, чтобы нажать",
      "Покажи большой палец вверх",
      "Покажи открытую ладонь",
    ],
    done: "Готово! Теперь ты управляешь руками",
    doneText: "Покажи большой палец вверх или нажми кнопку, чтобы перейти к урокам.",
    stepOf: (n: number, total: number) => `Шаг ${n} из ${total}`,
    success: "Отлично!",
    press: "Нажми",
    toLessons: "К урокам",
    targetsLeft: (n: number) => `Осталось кружков: ${n}`,
  },

  levelMap: {
    title: "Карта уроков",
    lesson: (n: number) => `Урок ${n}`,
    lessonLetters: (letters: readonly string[]) => letters.join(" · "),
    bridge: "Мост",
    weakLetters: "Повтори слабые буквы",
    hint: "Наведи курсор на урок и сделай щипок. Большой палец вверх — начать первый урок.",
  },

  lesson: {
    title: (n: number) => `Урок ${n}`,
    letterOf: (i: number, n: number) => `Буква ${i} из ${n}`,
    show: (letter: string) => `Покажи букву «${letter}»`,
    howTo: "Как показать",
    hold: "Держи — засчитаю через секунду",
    exitHint: "Выйти — открытая ладонь 1,5 с",
    unverified: "Форма-заглушка: ещё не сверена с официальной таблицей",
    skipLetter: "Пропустить букву",
    notFound: "Такого урока нет",
    done: "Отлично!",
    starsLabel: (n: number) => `Звёзд: ${n} из 3`,
    fingerRule: (finger: string, state: string) => `${finger} — ${state}`,
    palmRule: (value: string) => `Ладонь ${value}`,
    thumbRule: (value: string) => `Большой палец ${value}`,
    tipsTouchRule: (a: string, b: string) => `Кончики: ${a} и ${b} касаются`,
    tipsApartRule: (a: string, b: string) => `Кончики: ${a} и ${b} врозь`,
    ruleOk: "выполнено",
    ruleFail: "поправь",
    ruleUnknown: "не видно",
  },

  results: {
    title: "Итоги урока",
    noResult: "Сначала пройди урок — здесь появятся итоги.",
    accuracy: "Точность",
    hints: "Подсказок",
    xp: "Опыт",
    stars: "Звёзды",
    letters: "Буквы урока",
    topErrors: "Частые ошибки",
    noErrors: "Ни одной подсказки — отлично!",
    skipped: "пропущена",
    next: "Дальше",
    timesShown: (n: number) => `×${n}`,
  },

  bridge: {
    title: "Мост",
    description: "Напиши слово жестами — оно превратится в текст и голос.",
  },

  record: {
    title: "Запись образцов",
    intro: "Служебная страница: образцы для kNN и эталоны для призрачной руки.",
    letter: "Буква",
    signer: "Кто показывает",
    signerPlaceholder: "S01",
    frameCount: "Кадров",
    start: "Записать",
    cancel: "Отмена",
    getReady: "Приготовься",
    recording: (n: number, total: number) => `Запись… ${n}/${total}`,
    showHand: "Покажи руку в кадре",
    preview: "Превью",
    frameOf: (i: number, n: number) => `Кадр ${i} из ${n}`,
    handedness: (hand: string) => `Рука: ${hand}`,
    downloadSamples: "Скачать образцы (JSON)",
    saveReference: "Сохранить эталон",
    again: "Записать заново",
    referenceHint: "Эталон — выбранный кадр. По умолчанию — самый типичный.",
  },

  handStatus: {
    noHand: "Руки не видно",
    tooFar: "Слишком далеко",
    tooClose: "Слишком близко",
    ok: "Вижу руку ✓",
  },

  gestureLegend: {
    title: "Жесты управления",
    cursor: "Указательный палец — курсор",
    pinch: "Щипок или задержка 1 с — нажать",
    thumbUp: "Палец вверх — ОК",
    openPalm: "Ладонь 1,5 с — назад",
    unavailable: "сейчас выключено",
  },

  poses: {
    ok: "ОК",
    back: "Назад",
  },

  confusion: {
    looksLike: (letter: string, advice: string | null) =>
      advice ? `Похоже на «${letter}» — ${advice}` : `Похоже на «${letter}»`,
  },

  ghost: {
    legend: "Призрачная рука — образец. Зелёный палец — как в образце, красный — поправь.",
  },

  // Hint texts by hintCode. Wording is always «что сделать», never «что не так» (CLAUDE.md §9.2).
  hints: {
    // Frame
    "frame.noHand": "Подними руку перед камерой",
    "frame.tooFar": "Рука слишком далеко — подойди ближе",
    "frame.tooClose": "Рука слишком близко — отодвинь её от камеры",
    "frame.partlyOut": "Покажи руку целиком — она выходит за край кадра",
    // Fingers
    "finger.straighten.thumb": "Выпрями большой палец",
    "finger.straighten.index": "Выпрями указательный палец",
    "finger.straighten.middle": "Выпрями средний палец",
    "finger.straighten.ring": "Выпрями безымянный палец",
    "finger.straighten.pinky": "Выпрями мизинец",
    // Control gestures
    "cursor.moveToTarget": "Веди пальцем к кружку — курсор повторяет движение руки",
    "pinch.closer": "Щипок не засчитан — соедини кончики пальцев ближе",
    "pinch.aim": "Сначала наведи курсор на кружок, потом сделай щипок",
    "pinch.useDwell": "Не выходит щипок? Задержи курсор на кружке 1 секунду",
    "thumb.foldOthers": "Сожми остальные пальцы в кулак",
    "thumb.pointUp": "Поверни кисть — большой палец должен смотреть вверх",
    "palm.faceCamera": "Поверни ладонь к камере",
    "pose.holdStill": "Держи руку неподвижно",
    // Letter shapes
    "finger.bend.thumb": "Согни большой палец",
    "finger.bend.index": "Согни указательный палец",
    "finger.bend.middle": "Согни средний палец",
    "finger.bend.ring": "Согни безымянный палец",
    "finger.bend.pinky": "Согни мизинец",
    "finger.round.thumb": "Согни большой палец наполовину",
    "finger.round.index": "Согни указательный палец наполовину — округло",
    "finger.round.middle": "Согни средний палец наполовину — округло",
    "finger.round.ring": "Согни безымянный палец наполовину — округло",
    "finger.round.pinky": "Согни мизинец наполовину — округло",
    "thumb.pressToPalm": "Прижми большой палец к ладони",
    "thumb.moveAside": "Отведи большой палец в сторону",
    "thumb.raise": "Подними большой палец вверх",
    "palm.turnSide": "Поверни ладонь боком к камере",
    "palm.turnAway": "Поверни руку тыльной стороной к камере",
    "tips.touch.thumb-index": "Соедини кончики большого и указательного пальцев",
    "tips.touch.thumb-middle": "Соедини кончики большого и среднего пальцев",
    "tips.touch.thumb-ring": "Соедини кончики большого и безымянного пальцев",
    "tips.touch.thumb-pinky": "Соедини кончики большого пальца и мизинца",
    "tips.touch.index-middle": "Прижми указательный и средний пальцы друг к другу",
    "tips.apart.thumb-index": "Разведи большой и указательный пальцы",
    "tips.apart.index-middle": "Разведи указательный и средний пальцы",
    // Letter confusion / ghost hand
    "ghost.match": "Сверь пальцы с призрачной рукой — красные поправь",
    "confusion.looksLike": "Получилась похожая буква",
  } as Record<string, string>,
} as const;
