import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Camera,
  CameraOff,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Hand,
  Lightbulb,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Modal } from '../shared/Modal';
import { useCamera } from './camera';
import { useRecognitionAdapter, type RecognitionAdapter } from './adapter';
import { useCaptions, useVoice } from './speech';
import { Skeleton } from './Skeleton';
import {
  credibleCandidate,
  demoDictionary,
  guardFrame,
  idleFrame,
  loadPreferences,
  makeDemoFrame,
  STORAGE_KEY,
  type Correction,
  type DictionaryEntry,
  type Message,
  type Preferences,
  type RecognitionFrame,
} from './model';

type Page = 'conversation' | 'dictionary' | 'session' | 'settings';
const navigation = [
  { id: 'conversation', label: 'Общение', icon: MessageCircle },
  { id: 'dictionary', label: 'Словарь жестов', icon: BookOpen },
  { id: 'session', label: 'Моя сессия', icon: Activity },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
] as const;
const DIALOG_KEY = 'signbridge.dialog.v1';
const timeLabel = (at: number) =>
  new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
function initialPreferences() {
  try {
    return loadPreferences(localStorage.getItem(STORAGE_KEY));
  } catch {
    return loadPreferences(null);
  }
}
function initialMessages() {
  try {
    if (!initialPreferences().saveDialog) return [];
    const parsed = JSON.parse(localStorage.getItem(DIALOG_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item: Message) =>
              item &&
              typeof item.id === 'string' &&
              typeof item.text === 'string' &&
              Number.isFinite(item.at) &&
              ['user', 'partner'].includes(item.role) &&
              ['demo', 'manual', 'camera', 'caption'].includes(item.source),
          )
          .slice(-100)
      : [];
  } catch {
    return [];
  }
}
export function SignBridgeApp({
  dictionary = demoDictionary,
  adapter,
}: {
  dictionary?: DictionaryEntry[];
  adapter?: RecognitionAdapter;
}) {
  const [page, setPage] = useState<Page>(() => {
    const hash = location.hash.slice(1);
    return navigation.some((item) => item.id === hash) ? (hash as Page) : 'conversation';
  });
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sessionStats, setSessionStats] = useState({ user: 0, partner: 0, demo: 0 });
  const [mode, setMode] = useState<'idle' | 'demo' | 'camera'>('idle');
  const [frame, setFrame] = useState<RecognitionFrame>(idleFrame);
  const [selected, setSelected] = useState(dictionary[0]?.id || '');
  const [correctionKind, setCorrectionKind] = useState<Correction['kind']>('height');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [videoAspect, setVideoAspect] = useState(4 / 3);
  const [seconds, setSeconds] = useState(0);
  const [corrections, setCorrections] = useState(0);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [calibration, setCalibration] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [framingReady, setFramingReady] = useState(false);
  const [finish, setFinish] = useState(false);
  const [clear, setClear] = useState(false);
  const [captionsPermission, setCaptionsPermission] = useState(false);
  const [detail, setDetail] = useState<DictionaryEntry | null>(null);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [partnerText, setPartnerText] = useState('');
  const [userText, setUserText] = useState('');
  const camera = useCamera();
  const voice = useVoice();
  const consumed = useRef(new Set<string>());
  const dialogBottom = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const addMessage = useCallback(
    (text: string, role: Message['role'], source: Message['source']) => {
      const clean = text.trim().slice(0, 500);
      if (!clean) return;
      setSessionStats((current) => ({
        ...current,
        [role]: current[role] + 1,
        demo: current.demo + (source === 'demo' ? 1 : 0),
      }));
      setMessages((current) =>
        [...current, { id: crypto.randomUUID(), text: clean, role, source, at: Date.now() }].slice(
          -100,
        ),
      );
    },
    [],
  );
  const captions = useCaptions((text) => addMessage(text, 'partner', 'caption'));
  const candidate = credibleCandidate(frame.candidates, dictionary);
  const activeEntry = dictionary.find((entry) => entry.id === candidate?.id);
  const demoCount = sessionStats.demo;
  const userCount = sessionStats.user;
  const closeHelp = useCallback(() => setHelp(false), []);
  const closeCalibration = useCallback(() => setCalibration(false), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      if (preferences.saveDialog) localStorage.setItem(DIALOG_KEY, JSON.stringify(messages));
      else localStorage.removeItem(DIALOG_KEY);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [preferences, messages]);
  useEffect(() => {
    document.documentElement.dataset.motion = preferences.motion ? 'full' : 'reduced';
  }, [preferences.motion]);
  useEffect(() => {
    if (!menu) return;
    const saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector('button')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
        sidebar.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [],
      );
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = saved;
      document.removeEventListener('keydown', listener);
      menuButton.current?.focus();
    };
  }, [menu]);
  useEffect(() => {
    const read = () => {
      const hash = location.hash.slice(1);
      if (navigation.some((item) => item.id === hash)) setPage(hash as Page);
    };
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (mode === 'idle' || (mode === 'camera' && camera.status !== 'on')) return;
    const timer = setInterval(() => {
      if (!document.hidden) setSeconds((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, camera.status]);
  useEffect(() => {
    dialogBottom.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: preferences.motion ? 'smooth' : 'instant',
    });
  }, [messages, captions.interim, preferences.motion]);
  const navigate = (next: Page) => {
    location.hash = next;
    setPage(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const say = (text: string) => {
    if (captions.status === 'listening' || captions.status === 'starting') {
      captions.stop();
      setNotice('Субтитры приостановлены на время озвучивания.');
    }
    voice.speak(text, preferences);
  };
  const receiveFrame = (incoming: RecognitionFrame) => {
    const guarded = guardFrame(incoming, dictionary);
    setFrame(guarded);
    if (
      guarded.status !== 'recognized' ||
      !guarded.eventId ||
      consumed.current.has(guarded.eventId)
    )
      return;
    const winner = credibleCandidate(guarded.candidates, dictionary);
    const entry = dictionary.find((item) => item.id === winner?.id);
    if (!entry) return;
    consumed.current.add(guarded.eventId);
    addMessage(entry.phrase, 'user', guarded.source);
    if (preferences.speak) say(entry.phrase);
  };
  const recognition = useRecognitionAdapter(
    adapter,
    mode === 'camera' && camera.status === 'on' && page === 'conversation',
    camera.video,
    dictionary,
    receiveFrame,
  );
  useEffect(() => {
    if (page === 'conversation') return;
    camera.stop();
    captions.stop();
    voice.cancel();
    setMode('idle');
    setFrame(idleFrame);
  }, [page, camera.stop, captions.stop, voice.cancel]);
  useEffect(() => {
    if (mode === 'camera' && (camera.status !== 'on' || recognition.error)) setFrame(idleFrame);
  }, [mode, camera.status, recognition.error]);
  const enterDemo = () => {
    camera.stop();
    setMode('demo');
    setFrame({ ...idleFrame, source: 'demo' });
    consumed.current.clear();
  };
  const enterCamera = () => {
    setMode('camera');
    setFrame(idleFrame);
    void camera.start(facing);
  };
  const pause = () => {
    camera.stop();
    captions.stop();
    voice.cancel();
    setMode('idle');
    setFrame(idleFrame);
  };
  const showError = () => {
    setMode('demo');
    receiveFrame(makeDemoFrame(selected, 'almost', correctionKind));
  };
  const fixGesture = () => {
    if (frame.status === 'almost') setCorrections((value) => value + 1);
    receiveFrame(makeDemoFrame(selected, 'recognized'));
  };
  const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPreferences((current) => ({ ...current, [key]: value }));
  const toggleCaptions = () => {
    if (captions.status === 'listening' || captions.status === 'starting') {
      captions.stop();
      return;
    }
    if (!preferences.captionsConsent) {
      setCaptionsPermission(true);
      return;
    }
    voice.cancel();
    captions.start(preferences.language);
  };
  const exportDialog = () => {
    const body = messages
      .map(
        (item) =>
          `${timeLabel(item.at)} · ${item.role === 'user' ? 'Вы' : 'Собеседник'}${item.source === 'demo' ? ' (демо)' : ''}: ${item.text}`,
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'signbridge-dialog.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="sb-app">
      <a
        className="sb-skip"
        href="#sb-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('sb-content')?.focus();
        }}
      >
        К содержимому
      </a>
      {menu && (
        <button
          className="sb-nav-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenu(false)}
        />
      )}
      <aside ref={sidebar} className={`sb-sidebar ${menu ? 'open' : ''}`}>
        <button
          className="sb-brand"
          onClick={() => navigate('conversation')}
          aria-label="SignBridge — общение"
        >
          <span className="sb-brand-icon">
            <Hand size={22} />
          </span>
          <span>
            Sign<span>Bridge</span>
            <small>ОБЩЕНИЕ БЕЗ ГРАНИЦ</small>
          </span>
        </button>
        <span className="sb-nav-label">ВАШЕ ПРОСТРАНСТВО</span>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => (
            <button
              key={item.id}
              aria-current={page === item.id ? 'page' : undefined}
              className={page === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={21} />
              {item.label}
              {page === item.id && <span className="sb-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sb-sidebar-bottom">
          <div className="sb-mascot-card">
            <span className="sb-kicker">МАЛЕНЬКАЯ ПОДДЕРЖКА</span>
            <strong>
              Важен каждый
              <br />
              ваш разговор.
            </strong>
            <img
              src={`${import.meta.env.BASE_URL}mascot/gesturingo-cat.png`}
              alt="Рыжий кот — помощник SignBridge"
            />
            <p>Я рядом, если понадобится подсказка.</p>
          </div>
          <button
            className="sb-help-link"
            onClick={() => {
              setMenu(false);
              setHelp(true);
            }}
          >
            <CircleHelp size={17} />
            Как это работает
            <ChevronRight size={15} />
          </button>
          <span className="sb-sidebar-foot">
            <ShieldCheck size={13} />
            Видео остаётся у вас
          </span>
        </div>
      </aside>
      <div className="sb-shell" inert={menu}>
        <header className="sb-topbar">
          <div>
            <button
              className="sb-icon sb-mobile-menu"
              aria-label="Открыть меню"
              aria-expanded={menu}
              ref={menuButton}
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="sb-breadcrumb">
              Моё пространство
              <ChevronRight size={13} />
              <strong>{navigation.find((item) => item.id === page)?.label}</strong>
            </span>
          </div>
          <div>
            <span className="sb-language">РЖЯ</span>
            <span className="sb-top-status">
              <span />
              Фронтенд-прототип
            </span>
            <button
              className="sb-avatar"
              aria-label="Открыть настройки"
              onClick={() => navigate('settings')}
            >
              <Hand size={18} />
            </button>
          </div>
        </header>
        <main id="sb-content" tabIndex={-1} className="sb-main">
          {storageError && (
            <div className="sb-alert" role="status">
              Браузер не позволяет сохранять данные. Текущий разговор остаётся доступен до закрытия
              страницы.
            </div>
          )}
          {page === 'conversation' && (
            <>
              <div className="sb-page-heading">
                <div>
                  <span className="sb-kicker">
                    <span className="sb-dot" /> ПРОСТРАНСТВО ДЛЯ ОБЩЕНИЯ
                  </span>
                  <h1>
                    Ваши жесты. <span>Ваш голос.</span>
                  </h1>
                  <p>Покажите жест. Выразите мысль. Продолжайте разговор.</p>
                </div>
                <button
                  className="sb-button light"
                  onClick={() => {
                    setCalibrationStep(0);
                    setCalibration(true);
                  }}
                >
                  <Target size={17} />
                  Настроить камеру
                </button>
              </div>
              <div className="sb-workspace">
                <section className="sb-vision-card">
                  <div className="sb-card-heading">
                    <div>
                      <span className="sb-panel-icon">
                        <Camera size={19} />
                      </span>
                      <div>
                        <h2>Ваша камера</h2>
                        <p>
                          {mode === 'demo'
                            ? 'Демонстрация интерфейса'
                            : camera.status === 'on'
                              ? adapter
                                ? 'Камера включена · РЖЯ'
                                : 'Камера включена · только просмотр'
                              : 'Разместите руку перед камерой'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`sb-state-pill ${mode === 'demo' ? 'demo' : camera.status === 'on' ? 'live' : ''}`}
                    >
                      <span />
                      {mode === 'demo' ? 'ДЕМО' : camera.status === 'on' ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}
                    </span>
                  </div>
                  <div className={`sb-camera-stage status-${frame.status}`}>
                    <video
                      ref={camera.video}
                      muted
                      playsInline
                      autoPlay
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (video.videoWidth && video.videoHeight)
                          setVideoAspect(video.videoWidth / video.videoHeight);
                      }}
                      aria-label="Видео вашей камеры"
                      className={camera.status === 'on' && mode === 'camera' ? 'visible' : ''}
                      style={{
                        transform:
                          preferences.mirror && facing === 'user' ? 'scaleX(-1)' : undefined,
                      }}
                    />
                    <div className="sb-frame-corners">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    {mode === 'demo' ? (
                      <>
                        <div className="sb-demo-watermark">
                          <Sparkles size={14} />
                          Демо-скелет · не анализ камеры
                        </div>
                        <Skeleton frame={frame} />
                        {!frame.landmarks.length && (
                          <div className="sb-demo-empty">
                            <Hand size={54} />
                            <strong>Попробуем один жест?</strong>
                            <p>Выберите фразу и пример результата ниже.</p>
                          </div>
                        )}
                        {frame.corrections[0]?.arrow && (
                          <span className="sb-arrow-label">
                            {frame.corrections[0].arrow.label}
                            <ArrowRight size={14} />
                          </span>
                        )}
                      </>
                    ) : camera.status === 'on' ? (
                      <>
                        {adapter && (
                          <Skeleton
                            frame={frame}
                            aspect={videoAspect}
                            mirror={preferences.mirror && facing === 'user'}
                          />
                        )}
                        {frame.corrections[0]?.arrow && (
                          <span className="sb-arrow-label">{frame.corrections[0].arrow.label}</span>
                        )}
                        <div className="sb-camera-await">
                          <ShieldCheck size={15} />
                          {adapter
                            ? 'Анализ жестов · без записи видео'
                            : 'Видео не записывается. Распознавание пока не подключено.'}
                        </div>
                      </>
                    ) : (
                      <div className="sb-camera-empty">
                        <span className="sb-hand-halo">
                          <Hand size={55} strokeWidth={1.25} />
                        </span>
                        <h3>Давайте начнём разговор</h3>
                        <p>
                          Включите камеру для просмотра
                          <br />
                          или попробуйте демонстрацию.
                        </p>
                        <button
                          className="sb-button primary"
                          disabled={camera.status === 'loading'}
                          onClick={enterCamera}
                        >
                          <Camera size={17} />
                          {camera.status === 'loading' ? 'Подключаем…' : 'Включить камеру'}
                        </button>
                        <button className="sb-text-button" onClick={enterDemo}>
                          Попробовать демо
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                    {frame.landmarks.length > 0 && (
                      <span className={`sb-skeleton-label ${frame.status}`}>
                        <span />
                        {frame.status === 'recognized'
                          ? 'Жест принят'
                          : frame.status === 'almost'
                            ? 'Нужна коррекция'
                            : 'Жест не определён'}
                      </span>
                    )}
                  </div>
                  {camera.error && mode === 'camera' && (
                    <div className="sb-alert error" role="alert">
                      {camera.error}
                    </div>
                  )}
                  {recognition.error && mode === 'camera' && (
                    <div className="sb-alert error" role="alert">
                      {recognition.error}
                    </div>
                  )}
                  <div className="sb-camera-toolbar">
                    <span>
                      <ShieldCheck size={15} />
                      Без записи видео
                    </span>
                    <div>
                      {mode !== 'idle' && (
                        <button
                          className="sb-icon"
                          aria-label="Приостановить сессию"
                          onClick={pause}
                        >
                          <Pause size={17} />
                        </button>
                      )}
                      <button
                        className="sb-icon"
                        aria-label="Переключить камеру"
                        disabled={mode !== 'camera' || camera.status === 'loading'}
                        onClick={() => {
                          const next = facing === 'user' ? 'environment' : 'user';
                          setFacing(next);
                          void camera.start(next);
                        }}
                      >
                        <RotateCcw size={17} />
                      </button>
                      <button
                        className="sb-icon"
                        aria-label="Выключить камеру"
                        disabled={camera.status !== 'on'}
                        onClick={() => {
                          camera.stop();
                          setMode('idle');
                        }}
                      >
                        <CameraOff size={17} />
                      </button>
                    </div>
                  </div>
                  <div className={`sb-feedback ${frame.status}`} role="status">
                    <span className="sb-feedback-symbol">
                      {frame.status === 'recognized' ? (
                        <CheckCheck size={23} />
                      ) : frame.status === 'almost' ? (
                        <Lightbulb size={23} />
                      ) : (
                        <Hand size={23} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {frame.status === 'recognized'
                          ? `«${activeEntry?.phrase}» — добавлено в диалог`
                          : frame.status === 'almost'
                            ? 'Почти. Одна небольшая поправка.'
                            : frame.status === 'uncertain'
                              ? 'Пока не можем подтвердить жест.'
                              : mode === 'camera'
                                ? camera.status !== 'on'
                                  ? 'Включите камеру, чтобы продолжить'
                                  : adapter
                                    ? 'Покажите жест из словаря'
                                    : 'Камера готова к подключению модели'
                                : 'Каждый разговор начинается с первого жеста.'}
                      </strong>
                      <p>
                        {frame.status === 'almost'
                          ? frame.corrections[0]?.message
                          : frame.status === 'recognized'
                            ? frame.source === 'demo'
                              ? 'Демонстрационный результат. Повторно удержанный жест не добавляется автоматически.'
                              : 'Фраза принята. Для повторного сообщения завершите жест и покажите его снова.'
                            : frame.status === 'uncertain'
                              ? 'Уверенного ближайшего образца нет, поэтому корректирующая стрелка не показывается.'
                              : mode === 'camera'
                                ? adapter
                                  ? 'Держите руки целиком в кадре. Сообщение появится после подтверждения жеста.'
                                  : 'Текущая версия показывает видео. Для перевода нужен подключённый распознаватель РЖЯ.'
                                : 'В демо можно увидеть подсказку, зелёный скелет и результат в диалоге.'}
                      </p>
                      {frame.status === 'almost' && (
                        <div className="sb-hold-line">
                          <span>Фиксация положения</span>
                          <div
                            role="progressbar"
                            aria-label="Фиксация жеста"
                            aria-valuenow={Math.round(frame.holdProgress * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span style={{ width: `${frame.holdProgress * 100}%` }} />
                          </div>
                          <small>
                            {frame.source === 'demo' ? 'Пример · 0,5 с' : 'Подтверждение'}
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                  {mode === 'demo' && (
                    <div className="sb-demo-controls">
                      <div className="sb-demo-control-heading">
                        <Sparkles size={15} />
                        <strong>Демонстрация сценария</strong>
                        <span>Результат выбирается вручную</span>
                      </div>
                      <div className="sb-demo-fields">
                        <label>
                          Фраза
                          <select
                            value={selected}
                            onChange={(event) => {
                              setSelected(event.target.value);
                              setFrame({ ...idleFrame, source: 'demo' });
                            }}
                          >
                            {dictionary.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.phrase}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Пример коррекции
                          <select
                            value={correctionKind}
                            onChange={(event) =>
                              setCorrectionKind(event.target.value as Correction['kind'])
                            }
                          >
                            {[
                              ['height', 'Положение кисти'],
                              ['finger', 'Форма пальца'],
                              ['rotation', 'Поворот ладони'],
                              ['movement', 'Направление движения'],
                              ['hold', 'Длительность'],
                            ].map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="sb-demo-actions">
                        <button className="sb-button light" onClick={showError}>
                          <Lightbulb size={16} />
                          Показать ошибку
                        </button>
                        <button className="sb-button primary" onClick={fixGesture}>
                          <Check size={17} />
                          Исправить жест
                        </button>
                        <button
                          className="sb-icon"
                          aria-label="Показать неоднозначный жест"
                          onClick={() => receiveFrame(makeDemoFrame(selected, 'uncertain'))}
                        >
                          <CircleHelp size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </section>
                <aside className="sb-dialog-card">
                  <div className="sb-card-heading">
                    <div>
                      <span className="sb-panel-icon violet">
                        <MessageCircle size={19} />
                      </span>
                      <div>
                        <h2>Ваш диалог</h2>
                        <p>У каждого сообщения есть место.</p>
                      </div>
                    </div>
                    <button
                      className="sb-icon"
                      aria-label="Очистить диалог"
                      disabled={!messages.length}
                      onClick={() => setClear(true)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div
                    className="sb-dialog-stream"
                    role="log"
                    aria-label="Сообщения диалога"
                    aria-live="polite"
                  >
                    {messages.length ? (
                      messages.map((message) => (
                        <article key={message.id} className={`sb-message ${message.role}`}>
                          <div>
                            <strong>{message.role === 'user' ? 'Вы' : 'Собеседник'}</strong>
                            <span>
                              {message.source === 'demo'
                                ? 'Демо · '
                                : message.source === 'caption'
                                  ? 'Субтитры · '
                                  : ''}
                              {timeLabel(message.at)}
                            </span>
                          </div>
                          <p>{message.text}</p>
                          {message.role === 'user' && (
                            <button
                              aria-label={`Озвучить: ${message.text}`}
                              disabled={!voice.available}
                              onClick={() => say(message.text)}
                            >
                              <Volume2 size={14} />
                            </button>
                          )}
                        </article>
                      ))
                    ) : (
                      <div className="sb-dialog-empty">
                        <span>
                          <MessageCircle size={34} strokeWidth={1.25} />
                        </span>
                        <h3>Здесь начинается диалог</h3>
                        <p>
                          Фразы появятся после жеста
                          <br />
                          или отправки текстового сообщения.
                        </p>
                        <span className="sb-chat-bubbles">
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    )}
                    {captions.interim && (
                      <article className="sb-message partner interim">
                        <small>Собеседник говорит…</small>
                        <p>{captions.interim}</p>
                      </article>
                    )}
                    <div ref={dialogBottom} />
                  </div>
                  <div className="sb-dialog-inputs">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const text = userText.trim();
                        if (!text) return;
                        addMessage(text, 'user', 'manual');
                        if (preferences.speak) say(text);
                        setUserText('');
                      }}
                    >
                      <label htmlFor="sb-user-message">Ваше сообщение</label>
                      <div>
                        <input
                          id="sb-user-message"
                          placeholder="Можно написать фразу…"
                          maxLength={500}
                          value={userText}
                          onChange={(event) => setUserText(event.target.value)}
                        />
                        <button aria-label="Отправить ваше сообщение" disabled={!userText.trim()}>
                          <Send size={16} />
                        </button>
                      </div>
                    </form>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!partnerText.trim()) return;
                        addMessage(partnerText, 'partner', 'manual');
                        setPartnerText('');
                      }}
                    >
                      <label htmlFor="sb-partner-message">Ответ собеседника</label>
                      <div>
                        <input
                          id="sb-partner-message"
                          placeholder="Напишите ответ…"
                          maxLength={500}
                          value={partnerText}
                          onChange={(event) => setPartnerText(event.target.value)}
                        />
                        <button
                          aria-label="Отправить ответ собеседника"
                          disabled={!partnerText.trim()}
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </form>
                    <button
                      className={`sb-caption-button ${captions.status === 'listening' ? 'on' : ''}`}
                      disabled={!captions.supported}
                      onClick={toggleCaptions}
                    >
                      {captions.status === 'listening' ? <MicOff size={17} /> : <Mic size={17} />}
                      <span>
                        {captions.status === 'listening'
                          ? 'Выключить субтитры'
                          : captions.status === 'starting'
                            ? 'Подключаем микрофон…'
                            : 'Субтитры речи собеседника'}
                      </span>
                      <span>{captions.supported ? 'β' : 'Недоступны'}</span>
                    </button>
                    {captions.error && (
                      <p className="sb-inline-error" role="alert">
                        {captions.error}
                      </p>
                    )}
                  </div>
                  <div className="sb-dialog-foot">
                    <ShieldCheck size={13} />
                    {preferences.saveDialog
                      ? 'Диалог сохраняется на этом устройстве'
                      : 'Диалог хранится только в текущей вкладке'}
                  </div>
                </aside>
              </div>
              <div className="sb-bottom-row">
                <div className="sb-session-strip">
                  <span className="sb-panel-icon">
                    <Activity size={19} />
                  </span>
                  <div>
                    <strong>Текущая сессия</strong>
                    <span>
                      {duration(seconds)} <i>·</i> {userCount} сообщений <i>·</i> {corrections}{' '}
                      исправлений в демо
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      pause();
                      setFinish(true);
                    }}
                  >
                    Завершить
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="sb-tip-strip">
                  <Lightbulb size={20} />
                  <p>Удобный свет и спокойный темп помогают камере видеть руку.</p>
                </div>
              </div>
            </>
          )}
          {page === 'dictionary' && (
            <Dictionary
              entries={dictionary}
              onSelect={setDetail}
              onDemo={(id) => {
                setSelected(id);
                enterDemo();
                navigate('conversation');
              }}
            />
          )}
          {page === 'session' && (
            <>
              <PageHeading
                kicker="КАЖДЫЙ РАЗГОВОР ИМЕЕТ ЗНАЧЕНИЕ"
                title="Ваш разговор в цифрах"
                description="Результаты текущей вкладки. Демо-сообщения отмечены отдельно."
              />
              <div className="sb-stat-grid">
                {[
                  [MessageCircle, userCount, 'ваших сообщений'],
                  [Clock3, duration(seconds), 'время сессии'],
                  [Lightbulb, corrections, 'исправлений в демо'],
                  [CheckCheck, sessionStats.partner, 'ответов собеседника'],
                ].map(([Icon, value, label]) => {
                  const Symbol = Icon as typeof MessageCircle;
                  return (
                    <div className="sb-stat-card" key={String(label)}>
                      <Symbol size={23} />
                      <strong>{String(value)}</strong>
                      <span>{String(label)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="sb-session-info">
                <div>
                  <span className="sb-kicker">ВАЖЕН ВАШ РЕЗУЛЬТАТ</span>
                  <h2>Сообщение стало частью разговора.</h2>
                  <p>
                    За эту сессию добавлено {demoCount} демонстрационных сообщений. Они проверяют
                    интерфейс и не подтверждают распознавание РЖЯ.
                  </p>
                  <div>
                    <button className="sb-button primary" onClick={() => navigate('conversation')}>
                      Продолжить разговор
                      <ArrowRight size={17} />
                    </button>
                    <button
                      className="sb-button light"
                      disabled={!messages.length}
                      onClick={exportDialog}
                    >
                      <ArrowDownToLine size={17} />
                      Скачать диалог
                    </button>
                  </div>
                </div>
                <img
                  src={`${import.meta.env.BASE_URL}mascot/gesturingo-cat.png`}
                  alt="Кот-помощник SignBridge"
                />
              </div>
            </>
          )}
          {page === 'settings' && (
            <>
              <PageHeading
                kicker="ТАК, КАК УДОБНО ВАМ"
                title="Ваш голос. Ваши настройки."
                description="Настройте просмотр камеры, озвучивание и хранение разговора."
              />
              <div className="sb-settings-grid">
                <div>
                  <section className="sb-settings-card">
                    <h2>
                      <Volume2 size={20} />
                      Озвучивание
                    </h2>
                    <Switch
                      label="Озвучивать новые сообщения"
                      description="Произносить принятые фразы и отправленный вами текст."
                      checked={preferences.speak}
                      onChange={() => {
                        setPreference('speak', !preferences.speak);
                        if (preferences.speak) voice.cancel();
                      }}
                      disabled={!voice.available}
                    />
                    <div className="sb-form-row">
                      <label>
                        Язык озвучивания
                        <select
                          value={preferences.language}
                          onChange={(event) =>
                            setPreference('language', event.target.value as Preferences['language'])
                          }
                        >
                          <option value="ru-RU">Русский</option>
                          <option value="en-US">English</option>
                        </select>
                      </label>
                      <label>
                        Голос браузера
                        <select
                          value={preferences.voice}
                          onChange={(event) => setPreference('voice', event.target.value)}
                        >
                          <option value="">Автоматический выбор</option>
                          {voice.voices.map((item) => (
                            <option key={item.voiceURI} value={item.voiceURI}>
                              {item.name} · {item.lang}
                              {item.localService ? ' · локальный' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="sb-muted">
                      Язык озвучивания не меняет словарь РЖЯ. Доступность голосов зависит от
                      устройства; некоторые голоса используют сетевой сервис.
                    </p>
                    <button
                      className="sb-button light"
                      disabled={!voice.available}
                      onClick={() => say('Здравствуйте. Это голос SignBridge.')}
                    >
                      <Play size={16} />
                      Проверить голос
                    </button>
                    {!voice.available && (
                      <p className="sb-inline-error">
                        В этом браузере доступен текстовый диалог без озвучивания.
                      </p>
                    )}
                  </section>
                  <section className="sb-settings-card">
                    <h2>
                      <Camera size={20} />
                      Комфортный просмотр
                    </h2>
                    <Switch
                      label="Зеркальное видео"
                      description="Отражать фронтальную камеру, как в зеркале."
                      checked={preferences.mirror}
                      onChange={() => setPreference('mirror', !preferences.mirror)}
                    />
                    <Switch
                      label="Плавные анимации"
                      description="Мягкие переходы и прокрутка диалога."
                      checked={preferences.motion}
                      onChange={() => setPreference('motion', !preferences.motion)}
                    />
                    <button
                      className="sb-button light"
                      onClick={() => {
                        setCalibrationStep(0);
                        setCalibration(true);
                      }}
                    >
                      <Target size={17} />
                      Проверить расположение камеры
                    </button>
                  </section>
                  <section className="sb-settings-card">
                    <h2>
                      <ShieldCheck size={20} />
                      Ваши данные
                    </h2>
                    <Switch
                      label="Сохранять диалог на устройстве"
                      description="Сохранять сообщения в этом браузере после закрытия страницы."
                      checked={preferences.saveDialog}
                      onChange={() => setPreference('saveDialog', !preferences.saveDialog)}
                    />
                    <Switch
                      label="Разрешение на субтитры"
                      description="Браузер может отправлять звук сервису распознавания. Микрофон включается отдельно."
                      checked={preferences.captionsConsent}
                      onChange={() => {
                        if (preferences.captionsConsent) {
                          captions.stop();
                          setPreference('captionsConsent', false);
                        } else setCaptionsPermission(true);
                      }}
                    />
                    <button
                      className="sb-button danger"
                      disabled={!messages.length}
                      onClick={() => setClear(true)}
                    >
                      <Trash2 size={16} />
                      Удалить сообщения
                    </button>
                  </section>
                </div>
                <aside className="sb-settings-note">
                  <ShieldCheck size={35} />
                  <h2>
                    Камера остаётся
                    <br />
                    вашим пространством.
                  </h2>
                  <p>Эта версия не записывает и не отправляет видео на сервер.</p>
                  <p>
                    Распознавание РЖЯ будет работать локально после подключения модели. Субтитры
                    речи — отдельная функция с отдельным согласием.
                  </p>
                  <span className="sb-language">РЖЯ · Slovo / Bukva</span>
                  <img
                    src={`${import.meta.env.BASE_URL}mascot/gesturingo-cat.png`}
                    alt="Помощник SignBridge"
                  />
                </aside>
              </div>
            </>
          )}
          {voice.error && (
            <div className="sb-alert error" role="alert">
              {voice.error}
            </div>
          )}
        </main>
        <footer className="sb-footer">
          <span>Мост между жестом и разговором.</span>
          <span>
            SignBridge · РЖЯ
            <button onClick={() => setHelp(true)}>
              О проекте
              <ArrowRight size={12} />
            </button>
          </span>
        </footer>
      </div>
      <nav className="sb-mobile-nav" aria-label="Мобильная навигация" inert={menu}>
        {navigation.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? 'active' : ''}
            onClick={() => navigate(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
          >
            <item.icon size={21} />
            <span>
              {item.id === 'dictionary' ? 'Словарь' : item.id === 'session' ? 'Сессия' : item.label}
            </span>
          </button>
        ))}
      </nav>
      {voice.speaking && (
        <button className="sb-speaking" onClick={voice.cancel}>
          <Volume2 size={17} />
          Озвучиваем сообщение
          <VolumeX size={17} />
        </button>
      )}
      {notice && (
        <div className="sb-toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {help && (
        <Modal title="Как работает SignBridge" onClose={closeHelp} className="sb-modal">
          <span className="sb-kicker">МЕЖДУ НАМИ ЕСТЬ МОСТ</span>
          <h2>
            Показать. Понять.
            <br />
            Продолжить разговор.
          </h2>
          <p>
            SignBridge — интерфейс коммуникации на основе русского жестового языка. Словарь для
            распознавания строится на документированных примерах.
          </p>
          <div className="sb-help-steps">
            {[
              [Hand, 'Жест', 'Камера видит руку и её движение.'],
              [Lightbulb, 'Подсказка', 'Ближайший уверенный образец и конкретное исправление.'],
              [
                MessageCircle,
                'Сообщение',
                'Принятая фраза появляется в диалоге и может быть озвучена.',
              ],
            ].map(([Icon, title, text]) => {
              const Symbol = Icon as typeof Hand;
              return (
                <div key={String(title)}>
                  <Symbol size={22} />
                  <div>
                    <strong>{String(title)}</strong>
                    <p>{String(text)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sb-prototype-note">
            <strong>Сейчас работает фронтенд</strong>
            <p>
              Камера, диалог, TTS и визуальные сценарии. Демо-скелет задаётся вручную; модели
              Slovo/Bukva и автоматическая диагностика ещё не подключены.
            </p>
          </div>
          <div className="sb-source-links">
            <a href="https://github.com/ai-forever/slovo" target="_blank" rel="noreferrer">
              Slovo · жесты-слова
              <ArrowRight size={15} />
            </a>
            <a href="https://github.com/ai-forever/bukva" target="_blank" rel="noreferrer">
              Bukva · дактильная азбука
              <ArrowRight size={15} />
            </a>
          </div>
          <button className="sb-button primary" onClick={closeHelp}>
            Всё понятно
            <Check size={17} />
          </button>
        </Modal>
      )}
      {calibration && (
        <Modal title="Настроить камеру" onClose={closeCalibration} className="sb-modal">
          <span className="sb-kicker">УДОБНАЯ ПОДГОТОВКА</span>
          <h2>
            {
              ['Пусть камера видит вас', 'Проверьте свет', 'Оставьте место для руки'][
                calibrationStep
              ]
            }
          </h2>
          <div className="sb-setup-visual">
            <Target size={75} strokeWidth={1} />
            <span>{calibrationStep + 1} / 3</span>
          </div>
          <p>
            {
              [
                'Поставьте устройство устойчиво. Экран должен быть виден, а кисть — свободно помещаться в кадре.',
                'Расположитесь лицом к источнику мягкого света. Избегайте яркого окна за спиной.',
                'Убедитесь, что кисть целиком видна и её движение не выходит за границу кадра.',
              ][calibrationStep]
            }
          </p>
          <div className="sb-prototype-note">
            <p>
              Это ручная проверка расположения. Измерение масштаба, автоматическая калибровка и
              оценка landmarks будут добавлены вместе с моделью.
            </p>
          </div>
          <button
            className="sb-button primary"
            onClick={() => {
              if (calibrationStep < 2) setCalibrationStep((value) => value + 1);
              else {
                setFramingReady(true);
                setCalibration(false);
                setNotice('Расположение камеры проверено вручную.');
              }
            }}
          >
            {calibrationStep < 2 ? 'Дальше' : 'Расположение проверено'}
            <ArrowRight size={17} />
          </button>
          {framingReady && (
            <span className="sb-muted">Вы уже проходили ручную проверку в этой вкладке.</span>
          )}
        </Modal>
      )}
      {detail && (
        <Modal
          title={`Фраза: ${detail.phrase}`}
          onClose={() => setDetail(null)}
          className="sb-modal"
        >
          <span className="sb-language">
            {detail.verified ? 'РЖЯ · верифицированный жест' : 'РЖЯ · кандидат для MVP'}
          </span>
          <h2>{detail.phrase}</h2>
          <p>{detail.note}</p>
          <div className="sb-reference-placeholder">
            <BookOpen size={43} />
            <strong>Проверенный видеообразец</strong>
            {detail.reference ? (
              <a href={detail.reference} target="_blank" rel="noreferrer">
                Посмотреть источник и образец
              </a>
            ) : (
              <p>Будет добавлен после выбора класса и примеров из Slovo.</p>
            )}
          </div>
          <p className="sb-muted">
            {detail.verified
              ? `Класс словаря: ${detail.gloss}. Используйте документированный образец из источника.`
              : 'Карточка демонстрирует структуру словаря. Форма жеста и соответствие классу пока не верифицированы.'}
          </p>
          <button
            className="sb-button primary"
            onClick={() => {
              setSelected(detail.id);
              setDetail(null);
              enterDemo();
              navigate('conversation');
            }}
          >
            Попробовать сценарий
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {captionsPermission && (
        <Modal
          title="Разрешение на субтитры"
          onClose={() => setCaptionsPermission(false)}
          className="sb-modal"
        >
          <span className="sb-panel-icon violet">
            <Mic size={24} />
          </span>
          <h2>
            Услышать ответ.
            <br />
            Увидеть его текстом.
          </h2>
          <p>
            Для субтитров браузер запросит доступ к микрофону. В некоторых браузерах звук
            отправляется внешнему сервису распознавания; обработка может требовать интернет.
          </p>
          <p>
            SignBridge не записывает аудиофайл. Микрофон можно выключить в любой момент. Собеседник
            также может написать ответ.
          </p>
          <div className="sb-modal-actions">
            <button className="sb-button light" onClick={() => setCaptionsPermission(false)}>
              Без микрофона
            </button>
            <button
              className="sb-button primary"
              disabled={!captions.supported}
              onClick={() => {
                setPreference('captionsConsent', true);
                setCaptionsPermission(false);
                voice.cancel();
                captions.start(preferences.language);
              }}
            >
              Включить субтитры
              <Mic size={16} />
            </button>
          </div>
        </Modal>
      )}
      {clear && (
        <Modal title="Очистить диалог?" onClose={() => setClear(false)} className="sb-modal">
          <h2>Начать новый разговор?</h2>
          <p>
            Сообщения будут удалены из текущей вкладки и сохранённого диалога на этом устройстве.
          </p>
          <div className="sb-modal-actions">
            <button className="sb-button light" onClick={() => setClear(false)}>
              Оставить диалог
            </button>
            <button
              className="sb-button danger"
              onClick={() => {
                setMessages([]);
                setSessionStats({ user: 0, partner: 0, demo: 0 });
                setSeconds(0);
                setCorrections(0);
                consumed.current.clear();
                setClear(false);
                setNotice('Диалог очищен.');
              }}
            >
              Удалить сообщения
            </button>
          </div>
        </Modal>
      )}
      {finish && (
        <Modal title="Итоги сессии" onClose={() => setFinish(false)} className="sb-modal sb-finish">
          <span className="sb-panel-icon">
            <CheckCheck size={27} />
          </span>
          <h2>Разговор имеет значение.</h2>
          <p>Сессия приостановлена. Сообщения остаются в диалоге.</p>
          <div className="sb-result-metrics">
            <div>
              <strong>{userCount}</strong>
              <span>сообщений</span>
            </div>
            <div>
              <strong>{duration(seconds)}</strong>
              <span>время</span>
            </div>
            <div>
              <strong>{corrections}</strong>
              <span>исправлений в демо</span>
            </div>
          </div>
          <p className="sb-muted">
            Из них {demoCount} сообщений — демонстрационные. Они не получены распознавателем жестов.
          </p>
          <div className="sb-modal-actions">
            <button className="sb-button light" disabled={!messages.length} onClick={exportDialog}>
              <ArrowDownToLine size={16} />
              Скачать диалог
            </button>
            <button className="sb-button primary" onClick={() => setFinish(false)}>
              Вернуться
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PageHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="sb-page-heading">
      <div>
        <span className="sb-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function Switch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="sb-setting-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        className={`sb-switch ${checked ? 'on' : ''}`}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}
function Dictionary({
  entries,
  onSelect,
  onDemo,
}: {
  entries: DictionaryEntry[];
  onSelect: (entry: DictionaryEntry) => void;
  onDemo: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Все фразы');
  const categories = ['Все фразы', ...new Set(entries.map((entry) => entry.category))];
  const visible = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (filter === 'Все фразы' || entry.category === filter) &&
          `${entry.phrase} ${entry.gloss}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, filter, entries],
  );
  return (
    <>
      <PageHeading
        kicker="СЛОВАРЬ ДЛЯ ОСМЫСЛЕННОГО ОБЩЕНИЯ"
        title="Один жест. Понятное сообщение."
        description="Кандидаты для ограниченного словаря РЖЯ. Верификация примеров — следующий шаг."
      />
      <div className="sb-dictionary-toolbar">
        <div>
          {categories.map((category) => (
            <button
              key={category}
              aria-pressed={filter === category}
              className={filter === category ? 'active' : ''}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <label>
          <Search size={17} />
          <input
            type="search"
            aria-label="Найти фразу"
            placeholder="Найти фразу…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="sb-dictionary-grid">
        {visible.map((entry, index) => (
          <article className={`sb-sign-card tone-${index % 3}`} key={entry.id}>
            <div>
              <span className="sb-panel-icon">
                <Hand size={23} />
              </span>
              <span className="sb-dictionary-badge">
                {entry.verified ? 'Верифицирован' : 'Макет карточки'}
              </span>
            </div>
            <span className="sb-sign-category">{entry.category}</span>
            <h2>{entry.phrase}</h2>
            <p>{entry.note}</p>
            <div className="sb-sign-card-actions">
              <button aria-label={`Подробнее: ${entry.phrase}`} onClick={() => onSelect(entry)}>
                Подробнее
                <ArrowRight size={15} />
              </button>
              <button
                className="sb-icon"
                aria-label={`Демо: ${entry.phrase}`}
                onClick={() => onDemo(entry.id)}
              >
                <Play size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="sb-empty-state">
          <Search size={38} />
          <h2>Такой фразы пока нет</h2>
          <p>Попробуйте другой запрос или категорию.</p>
          <button
            className="sb-button light"
            onClick={() => {
              setQuery('');
              setFilter('Все фразы');
            }}
          >
            Показать все фразы
          </button>
        </div>
      )}
      <div className="sb-dictionary-note">
        <BookOpen size={25} />
        <div>
          <strong>Ограниченный словарь. Проверяемые примеры.</strong>
          <p>
            Slovo выбран для жестов-слов, Bukva — для будущего режима дактиля. Демо-скелет в
            интерфейсе не является учебным образцом РЖЯ.
          </p>
        </div>
        <a href="https://github.com/ai-forever/slovo" target="_blank" rel="noreferrer">
          Источник
          <ArrowRight size={15} />
        </a>
      </div>
    </>
  );
}
