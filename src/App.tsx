import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  ExternalLink,
  Flame,
  Focus,
  GraduationCap,
  Hand,
  Heart,
  Lightbulb,
  LockKeyhole,
  Menu,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WandSparkles,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { courses, referenceUrl, type Letter } from './data';
import { Brand, HandSign, Mascot, Modal, ProgressBar } from './components';
import { usePage, useProgress, type Page } from './hooks';
import { completeSession, dayKey, streak, type SessionRecord } from './state';
import { Alphabet } from './features/Alphabet';
import { ProgressPage } from './features/ProgressPage';
import { SettingsPage } from './features/SettingsPage';
import { Lesson } from './features/Lesson';
import type { LessonConfig } from './features/Lesson';

const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'learn', label: 'Обучение', icon: GraduationCap },
  { id: 'alphabet', label: 'Алфавит', icon: BookOpen },
  { id: 'progress', label: 'Мой прогресс', icon: TrendingUp },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
];
const courseIcons: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  book: BookOpen,
  hand: Hand,
  compass: Compass,
  focus: Focus,
  wand: WandSparkles,
};

function App() {
  const { progress, setProgress, unavailable } = useProgress();
  const { page, navigate } = usePage();
  const [lesson, setLesson] = useState<LessonConfig | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [help, setHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const closeLetter = useCallback(() => setLetter(null), []);
  const closeHelp = useCallback(() => setHelp(false), []);
  const closeLesson = useCallback(() => setLesson(null), []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.motion = progress.preferences.reducedMotion
      ? 'reduced'
      : 'full';
  }, [progress.preferences.reducedMotion]);
  const totalXP = progress.mastered.length * 10;
  const activeDays = streak(progress.history);
  const todayCount = progress.history
    .filter((item) => item.date === dayKey())
    .reduce((sum, item) => sum + item.letters.length, 0);
  const currentCourse =
    courses.find((course) => !progress.completedCourses.includes(course.id)) || courses[0];
  const startLesson = (config: LessonConfig) => {
    setLetter(null);
    setLesson(config);
    setMenuOpen(false);
  };
  const choosePage = (next: Page) => {
    navigate(next);
    setMenuOpen(false);
  };
  const onComplete = (record: SessionRecord) =>
    setProgress((current) => completeSession(current, record));

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        К содержимому
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Закрыть навигацию"
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <button
          className="brand-button"
          aria-label="Gesturingo — обучение"
          onClick={() => choosePage('learn')}
        >
          <Brand />
        </button>
        <div className="sidebar-label">ВАШЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => choosePage(item.id)}
            >
              <item.icon size={21} strokeWidth={1.8} />
              <span>{item.label}</span>
              {page === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-message">
            <span className="tiny-sparkle">
              <Sparkles size={17} />
            </span>
            <strong>
              Всё начинается
              <br />с одного жеста.
            </strong>
            <p>Я рядом на каждом шаге.</p>
            <Mascot />
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} /> Как это работает <ChevronRight size={15} />
          </button>
          <div className="sidebar-footer">
            Сделано с заботой <Heart size={12} />
          </div>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Моё пространство <ChevronRight size={13} />
              <strong>{navigation.find((item) => item.id === page)?.label}</strong>
            </span>
            <div className="mobile-brand">
              <Brand compact />
            </div>
          </div>
          <div className="topbar-stats">
            <span className="top-stat streak-stat" title="Дни занятий подряд">
              <Flame size={20} fill="currentColor" />
              <strong>{activeDays}</strong>
              <span>дней</span>
            </span>
            <span className="top-stat xp-stat" title="10 XP за каждую новую букву в демо">
              <Zap size={19} fill="currentColor" />
              <strong>{totalXP}</strong>
              <span>XP</span>
            </span>
            <span className="language-badge">
              <span>🇺🇸</span> ASL
            </span>
            <button
              className="avatar"
              aria-label="Открыть настройки профиля"
              onClick={() => choosePage('settings')}
            >
              {progress.preferences.name ? (
                progress.preferences.name.slice(0, 1).toUpperCase()
              ) : (
                <Hand size={18} />
              )}
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={`main-content page-${page}`}>
          {unavailable && (
            <div className="storage-warning" role="status">
              Браузер не позволяет сохранить прогресс. В этой сессии всё работает, но результаты
              могут пропасть после закрытия страницы.
            </div>
          )}
          {page === 'learn' && (
            <div className="dashboard-layout">
              <div className="dashboard-main">
                <div className="greeting">
                  <span className="eyebrow">
                    <span className="status-dot" /> ЖЕСТ ЗА ЖЕСТОМ
                  </span>
                  <span className="greeting-name">
                    {progress.preferences.name
                      ? `Привет, ${progress.preferences.name}!`
                      : 'Рады видеть вас здесь'}{' '}
                    <span>✦</span>
                  </span>
                </div>
                <section className="hero-card">
                  <div className="hero-copy">
                    <span className="hero-tag">
                      <Sparkles size={13} /> НОВЫЙ СПОСОБ ОБЩАТЬСЯ
                    </span>
                    <h1>
                      Маленький жест.
                      <br />
                      <span>Большие возможности.</span>
                    </h1>
                    <p>
                      Откройте для себя азбуку ASL.
                      <br />В своём темпе, по одной букве за раз.
                    </p>
                    <button
                      className="button primary hero-button"
                      onClick={() => startLesson(currentCourse)}
                    >
                      {progress.completedCourses.length
                        ? 'Продолжить обучение'
                        : 'Начать первый урок'}{' '}
                      <ArrowRight size={18} />
                    </button>
                    <span className="hero-note">
                      <Clock3 size={13} /> Всего 3 минуты для первого шага
                    </span>
                  </div>
                  <div className="hero-art">
                    <span className="hero-circle" />
                    <span className="hero-star one">✦</span>
                    <span className="hero-star two">✧</span>
                    <span className="hero-bubble">
                      <Hand size={15} /> Привет!
                    </span>
                    <Mascot />
                    <span className="hero-letter l">L</span>
                    <span className="hero-letter v">V</span>
                    <span className="hero-letter y">Y</span>
                  </div>
                </section>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">ОДИН ШАГ ЗА ДРУГИМ</span>
                    <h2>Ваш путь обучения</h2>
                  </div>
                  <span className="section-counter">
                    {progress.completedCourses.length} / {courses.length} уроков
                  </span>
                </div>
                <div className="course-grid">
                  {courses.map((course, index) => {
                    const done = progress.completedCourses.includes(course.id);
                    const unlocked =
                      index === 0 || progress.completedCourses.includes(courses[index - 1].id);
                    const Icon = courseIcons[course.icon];
                    return (
                      <article
                        key={course.id}
                        className={`course-card ${course.color} ${!unlocked ? 'locked' : ''}`}
                      >
                        <div className="course-top">
                          <span className="course-icon">
                            <Icon size={23} strokeWidth={1.7} />
                          </span>
                          <span className={`course-state ${done ? 'done' : ''}`}>
                            {done ? (
                              <>
                                <Check size={13} /> ПРОЙДЕНО
                              </>
                            ) : !unlocked ? (
                              <>
                                <LockKeyhole size={12} /> СЛЕДУЮЩИЙ ШАГ
                              </>
                            ) : (
                              course.tag
                            )}
                          </span>
                        </div>
                        <h3>{course.title}</h3>
                        <p>{course.description}</p>
                        <div className="course-letters">
                          {course.letters.map((id) => (
                            <span key={id}>{id}</span>
                          ))}
                        </div>
                        <div className="course-bottom">
                          <span>
                            <Clock3 size={13} /> {course.duration}
                          </span>
                          <button
                            disabled={!unlocked}
                            aria-label={`${done ? 'Повторить' : 'Начать'} урок «${course.title}»`}
                            onClick={() => startLesson(course)}
                          >
                            {done ? (
                              <RotateCcw size={15} />
                            ) : unlocked ? (
                              <ArrowRight size={18} />
                            ) : (
                              <LockKeyhole size={14} />
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="demo-inline">
                  <span className="demo-dot" />
                  <div>
                    <strong>Сейчас доступна интерактивная демоверсия</strong>
                    <span>
                      Попробуйте уроки и обратную связь. Проверка жестов подключится позже.
                    </span>
                  </div>
                  <button onClick={() => setHelp(true)} aria-label="Подробнее о демоверсии">
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              <aside className="dashboard-aside">
                <section className="daily-card">
                  <div className="card-heading">
                    <span className="widget-icon">
                      <Target size={19} />
                    </span>
                    <h3>Маленькая цель на день</h3>
                  </div>
                  <p>Регулярность важнее скорости.</p>
                  <div className="goal-line">
                    <strong>
                      {Math.min(todayCount, progress.preferences.goal)}{' '}
                      <span>/ {progress.preferences.goal}</span>
                    </strong>
                    <span>упражнений</span>
                  </div>
                  <ProgressBar
                    value={(todayCount / progress.preferences.goal) * 100}
                    label="Дневная цель"
                  />
                  <div className="week-row">
                    {weekDates().map((date, index) => {
                      const active = progress.history.some((item) => item.date === dayKey(date));
                      const today = dayKey(date) === dayKey();
                      return (
                        <div
                          key={index}
                          className={`week-day ${active ? 'completed' : ''} ${today ? 'today' : ''}`}
                        >
                          <span>{['П', 'В', 'С', 'Ч', 'П', 'С', 'В'][index]}</span>
                          <span className="day-circle">
                            {active ? <Check size={13} /> : today ? <span /> : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="goal-footer">
                    {todayCount >= progress.preferences.goal ? (
                      <>
                        <CheckCheck size={15} /> Цель на сегодня выполнена!
                      </>
                    ) : (
                      <>
                        <Flame size={15} /> Пара минут — и вы на шаг ближе
                      </>
                    )}
                  </div>
                </section>
                <section className="tip-card">
                  <span className="tip-icon">
                    <Lightbulb size={24} strokeWidth={1.6} />
                  </span>
                  <span className="eyebrow">ПОДСКАЗКА ДНЯ</span>
                  <h3>
                    Пусть рука
                    <br />
                    чувствует себя
                    <br />
                    свободно.
                  </h3>
                  <p>
                    Не спешите и не напрягайте кисть. Небольшая пауза поможет запомнить положение
                    пальцев.
                  </p>
                  <div className="tip-bottom">
                    <span>Вы справитесь</span>
                    <span>✦</span>
                  </div>
                </section>
                <section className="alphabet-preview">
                  <div className="alphabet-preview-letters">
                    <span>A</span>
                    <span>B</span>
                    <span>C</span>
                    <span>…</span>
                  </div>
                  <h3>Вся азбука под рукой</h3>
                  <p>26 букв. Образцы, объяснения и практика.</p>
                  <button onClick={() => choosePage('alphabet')}>
                    Открыть алфавит <ArrowRight size={16} />
                  </button>
                </section>
                <span className="privacy-note">
                  <ShieldCheck size={15} /> Видеозапись не сохраняется
                </span>
              </aside>
            </div>
          )}
          {page === 'alphabet' && <Alphabet progress={progress} onSelect={setLetter} />}
          {page === 'progress' && (
            <ProgressPage progress={progress} onStart={() => startLesson(currentCourse)} />
          )}
          {page === 'settings' && (
            <SettingsPage progress={progress} setProgress={setProgress} notify={setToast} />
          )}
        </main>
        <footer className="page-footer">
          <span>Маленькие шаги. Новые возможности.</span>
          <span>
            Gesturingo · ASL alphabet <span className="footer-dot">•</span>{' '}
            <button onClick={() => setHelp(true)}>О проекте</button>
          </span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Мобильная навигация">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? 'active' : ''}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => choosePage(item.id)}
          >
            <item.icon size={21} />
            <span>{item.id === 'progress' ? 'Прогресс' : item.label}</span>
          </button>
        ))}
      </nav>
      {letter && (
        <Modal title={`Буква ${letter.id}`} onClose={closeLetter} className="letter-modal">
          <div className="letter-modal-visual">
            <span className="eyebrow">АМЕРИКАНСКАЯ ДАКТИЛЬНАЯ АЗБУКА</span>
            <HandSign letter={letter.id} left={progress.preferences.hand === 'left'} />
            <span className="letter-modal-label">{letter.id}</span>
          </div>
          <div className="letter-modal-copy">
            <span className={`pill ${letter.dynamic ? 'purple' : 'green'}`}>
              {letter.dynamic ? 'Буква с движением' : 'Статическая буква'}
            </span>
            <h2>{letter.title}</h2>
            <p>{letter.instruction}</p>
            <div className="small-tip">
              <Lightbulb size={20} />
              <span>{letter.tip}</span>
            </div>
            <a className="source-link" href={referenceUrl} target="_blank" rel="noreferrer">
              Учебный источник ASL University <ExternalLink size={14} />
            </a>
            <button
              className="button primary"
              onClick={() =>
                startLesson({
                  id: `practice-${letter.id}`,
                  title: `Практика буквы ${letter.id}`,
                  letters: [letter.id],
                })
              }
            >
              Практиковать {letter.id} <ArrowRight size={17} />
            </button>
            <span className="small-muted">Интерактивная демонстрация без распознавания</span>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="Как работает Gesturingo" onClose={closeHelp} className="help-modal">
          <span className="pill green">
            <Sparkles size={13} /> ЗНАКОМСТВО
          </span>
          <h2>
            Жест за жестом.
            <br />В вашем темпе.
          </h2>
          <p>
            Gesturingo помогает познакомиться с дактильной азбукой ASL — положениями и движениями
            руки для букв A–Z.
          </p>
          <div className="help-steps">
            {[
              [BookOpen, 'Посмотрите', 'Изучите букву и короткое объяснение.'],
              [Hand, 'Повторите', 'Потренируйтесь перед камерой или без неё.'],
              [CheckCheck, 'Попробуйте ещё', 'Посмотрите подсказку и пройдите задание.'],
            ].map(([Icon, title, description]) => {
              const Component = Icon as LucideIcon;
              return (
                <div key={String(title)}>
                  <span>
                    <Component size={21} />
                  </span>
                  <div>
                    <strong>{String(title)}</strong>
                    <p>{String(description)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="help-demo">
            <strong>Что работает сейчас</strong>
            <p>
              Уроки, каталог, камера, настройки и локальный демо-прогресс. Результат упражнения
              выбирается кнопками. Распознавание и автоматическая диагностика пока не подключены.
            </p>
          </div>
          <p className="small-muted">
            Это знакомство с азбукой, а не полный курс ASL. Иллюстрации помогают познакомиться с
            формой; для исполнения сверяйтесь с учебным источником. Буквы J и Z включают движение.
          </p>
          <a className="source-link" href={referenceUrl} target="_blank" rel="noreferrer">
            Материалы ASL University <ExternalLink size={14} />
          </a>
          <button className="button primary" onClick={closeHelp}>
            Всё понятно <Check size={17} />
          </button>
        </Modal>
      )}
      {lesson && (
        <Lesson
          key={`${lesson.id}`}
          config={lesson}
          preferences={progress.preferences}
          mastered={progress.mastered}
          onClose={closeLesson}
          onComplete={onComplete}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}

function weekDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return date;
  });
}

export default App;
