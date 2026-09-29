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
    privacy: "Видео не покидает твой браузер.",
    loadingModel: "Загружаем модель распознавания…",
  },

  cameraErrors: {
    denied: "Доступ к камере запрещён. Нажми на значок камеры в адресной строке и разреши доступ.",
    notFound: "Камера не найдена. Подключи камеру и обнови страницу.",
    busy: "Камера занята другим приложением. Закрой его и обнови страницу.",
    insecure: "Камера работает только по HTTPS. Открой сайт по защищённой ссылке.",
    unknown: "Не удалось включить камеру. Обнови страницу и попробуй ещё раз.",
    modelFailed: "Не удалось загрузить модель распознавания. Проверь интернет и обнови страницу.",
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
  },

  levelMap: {
    title: "Карта уроков",
    lesson: (n: number) => `Урок ${n}`,
    bridge: "Мост",
    weakLetters: "Повтори слабые буквы",
  },

  lesson: {
    title: (id: string) => `Урок ${id}`,
    finish: "Завершить урок",
    exitHint: "Чтобы выйти, покажи открытую ладонь",
  },

  results: {
    title: "Итоги урока",
  },

  bridge: {
    title: "Мост",
    description: "Напиши слово жестами — оно превратится в текст и голос.",
  },

  record: {
    title: "Запись образцов",
  },

  handStatus: {
    noHand: "Руки не видно",
    tooFar: "Слишком далеко",
    tooClose: "Слишком близко",
    ok: "Вижу руку ✓",
  },

  gestureLegend: {
    cursor: "Указательный палец — курсор",
    pinch: "Щипок — нажать",
    thumbUp: "Палец вверх — ОК",
    openPalm: "Ладонь — назад",
  },

  // Hint texts by hintCode (filled in Phase 4–5). Wording is always "what to do".
  hints: {} as Record<string, string>,
} as const;
