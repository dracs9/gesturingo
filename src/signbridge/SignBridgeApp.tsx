import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  Hand,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useRecognitionAdapter, type RecognitionAdapter } from './adapter';
import { useCamera } from './camera';
import {
  credibleCandidate,
  demoDictionary,
  guardFrame,
  idleFrame,
  type DictionaryEntry,
  type RecognitionFrame,
} from './model';
import { Skeleton } from './Skeleton';
import { russianVoice, useVoice } from './speech';

type Screen = 'welcome' | 'conversation' | 'result';
type ConversationMessage = { id: string; text: string; source: 'gesture' | 'text'; at: number };
const messageNoun = (count: number) =>
  count % 100 >= 11 && count % 100 <= 14
    ? 'сообщений'
    : count % 10 === 1
      ? 'сообщение'
      : [2, 3, 4].includes(count % 10)
        ? 'сообщения'
        : 'сообщений';

export function SignBridgeApp({
  dictionary = demoDictionary,
  adapter,
}: {
  dictionary?: DictionaryEntry[];
  adapter?: RecognitionAdapter;
}) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [videoAspect, setVideoAspect] = useState(4 / 3);
  const [frame, setFrame] = useState<RecognitionFrame>(idleFrame);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [gestureCount, setGestureCount] = useState(0);
  const [draft, setDraft] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const consumed = useRef(new Set<string>());
  const camera = useCamera();
  const voice = useVoice();

  const say = (text: string) => voice.speak(text, russianVoice);
  const addMessage = useCallback((text: string, source: ConversationMessage['source']) => {
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    setMessages((current) =>
      [...current, { id: crypto.randomUUID(), text: clean, source, at: Date.now() }].slice(-50),
    );
    setMessageCount((value) => value + 1);
    if (source === 'gesture') setGestureCount((value) => value + 1);
  }, []);
  const receiveFrame = (incoming: RecognitionFrame) => {
    const checked = guardFrame(incoming, dictionary);
    setFrame(checked);
    if (
      checked.status !== 'recognized' ||
      !checked.eventId ||
      consumed.current.has(checked.eventId)
    )
      return;
    const candidate = credibleCandidate(checked.candidates, dictionary);
    const entry = dictionary.find((item) => item.id === candidate?.id);
    if (!entry) return;
    consumed.current.add(checked.eventId);
    addMessage(entry.phrase, 'gesture');
    if (soundOn) say(entry.phrase);
  };
  const recognition = useRecognitionAdapter(
    adapter,
    screen === 'conversation' && camera.status === 'on',
    camera.video,
    dictionary,
    receiveFrame,
  );

  useEffect(() => {
    if (screen === 'conversation') void camera.start(facing);
    // Switching the camera calls start explicitly, so facing is not a dependency here.
  }, [screen, camera.start]);
  useEffect(() => {
    if (screen !== 'welcome') document.getElementById('main')?.focus();
  }, [screen]);
  useEffect(() => {
    if (screen === 'conversation' && camera.status !== 'on') setFrame(idleFrame);
  }, [screen, camera.status]);
  useEffect(() => {
    if (screen !== 'conversation' || camera.status !== 'on') return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, camera.status]);

  const begin = () => {
    consumed.current.clear();
    setMessages([]);
    setMessageCount(0);
    setGestureCount(0);
    setSeconds(0);
    setFrame(idleFrame);
    setDraft('');
    setScreen('conversation');
  };
  const finish = () => {
    camera.stop();
    voice.cancel();
    setScreen('result');
    setFrame(idleFrame);
  };
  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    addMessage(clean, 'text');
    if (soundOn) say(clean);
    setDraft('');
  };
  const latest = messages.at(-1);
  const correction = frame.status === 'almost' ? frame.corrections[0] : undefined;
  const timeLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand" aria-label="SignBridge">
            <span className="brand-icon">
              <Hand size={19} strokeWidth={2.4} />
            </span>
            sign<span>bridge</span>
            <span className="brand-stop">.</span>
          </span>
          <span className="header-note">Общение начинается здесь</span>
        </div>
      </header>

      {screen === 'welcome' && (
        <main className="welcome" id="main" tabIndex={-1}>
          <div className="welcome-mark" aria-hidden="true">
            <span>
              <Hand size={60} strokeWidth={1.45} />
            </span>
          </div>
          <p className="eyebrow">ВАШИ ЖЕСТЫ. ВАШ ГОЛОС.</p>
          <h1>
            Покажите жест.
            <br />
            <em>Мы поможем сказать.</em>
          </h1>
          <p className="welcome-copy">
            Откройте камеру и покажите жест. SignBridge выведет фразу на экран и произнесёт её для
            собеседника.
          </p>
          <button className="primary-button start-button" onClick={begin}>
            <Camera size={21} /> Начать общение <ArrowRight size={20} />
          </button>
          <p className="welcome-privacy">
            Камера включится после нажатия. Видео не записывается и не отправляется на сервер.
          </p>
          {!adapter && (
            <p className="prototype-note" role="note">
              Сейчас доступен интерфейс общения. Распознавание жестов ещё не подключено; текст можно
              написать и озвучить.
            </p>
          )}
        </main>
      )}

      {screen === 'conversation' && (
        <main className="conversation" id="main" tabIndex={-1}>
          <div className="conversation-heading">
            <div>
              <p className="eyebrow">РАЗГОВОР</p>
              <h1>Говорите жестами.</h1>
              <p>Держите руки в кадре. Готовая фраза появится рядом.</p>
            </div>
            <button className="quiet-button end-button" onClick={finish}>
              <ArrowLeft size={17} /> Завершить
            </button>
          </div>
          <div className="conversation-grid">
            <section className="camera-panel" aria-label="Камера и подсказки">
              <div className="panel-heading">
                <span>Камера</span>
                <span className={`camera-state ${camera.status === 'on' ? 'active' : ''}`}>
                  <i />
                  {camera.status === 'on'
                    ? 'ВКЛЮЧЕНА'
                    : camera.status === 'loading'
                      ? 'ПОДКЛЮЧАЕМ'
                      : 'ВЫКЛЮЧЕНА'}
                </span>
              </div>
              <div className={`camera-stage state-${frame.status}`}>
                <video
                  ref={camera.video}
                  muted
                  playsInline
                  autoPlay
                  aria-label="Изображение с вашей камеры"
                  className={camera.status === 'on' ? 'visible' : ''}
                  style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    if (video.videoWidth && video.videoHeight)
                      setVideoAspect(video.videoWidth / video.videoHeight);
                  }}
                />
                {camera.status === 'on' && adapter && (
                  <Skeleton frame={frame} aspect={videoAspect} mirror={facing === 'user'} />
                )}
                {camera.status !== 'on' && (
                  <div className="camera-placeholder">
                    <span>
                      <CameraOff size={32} />
                    </span>
                    <strong>
                      {camera.status === 'loading' ? 'Подключаем камеру…' : 'Камера выключена'}
                    </strong>
                    <p>
                      {camera.status === 'error'
                        ? 'Вы можете написать фразу ниже.'
                        : 'Разрешите доступ к камере для начала разговора.'}
                    </p>
                    {camera.status !== 'loading' && (
                      <button className="camera-retry" onClick={() => void camera.start(facing)}>
                        Включить камеру
                      </button>
                    )}
                  </div>
                )}
                {camera.status === 'on' && frame.status === 'recognized' && (
                  <span className="camera-tag success">
                    <Check size={16} /> Жест принят
                  </span>
                )}
                {camera.status === 'on' && correction && (
                  <span className="camera-tag correction">
                    <span className="tag-dot" /> Нужна поправка
                  </span>
                )}
                {camera.status === 'on' && (
                  <button
                    className="switch-camera"
                    aria-label="Переключить камеру"
                    title="Переключить камеру"
                    onClick={() => {
                      const next = facing === 'user' ? 'environment' : 'user';
                      setFacing(next);
                      setFrame(idleFrame);
                      void camera.start(next);
                    }}
                  >
                    <RotateCcw size={18} />
                  </button>
                )}
              </div>
              {camera.error && (
                <p className="inline-alert" role="alert">
                  {camera.error}
                </p>
              )}
              {recognition.error && (
                <p className="inline-alert" role="alert">
                  {recognition.error}
                </p>
              )}
              {correction ? (
                <div className="gesture-feedback error" role="status">
                  <span>ПОЧТИ ПОЛУЧИЛОСЬ</span>
                  <strong>{correction.message}</strong>
                  {correction.arrow && <small>Следуйте стрелке на изображении.</small>}
                </div>
              ) : frame.status === 'uncertain' ? (
                <div className="gesture-feedback" role="status">
                  <span>НУЖНО УТОЧНЕНИЕ</span>
                  <strong>Покажите жест ещё раз.</strong>
                  <small>Система пока не может уверенно выбрать фразу.</small>
                </div>
              ) : frame.status === 'tracking' ? (
                <div className="gesture-feedback" role="status">
                  <span>ВИЖУ ДВИЖЕНИЕ</span>
                  <strong>Продолжайте показывать жест.</strong>
                </div>
              ) : frame.status === 'recognized' ? (
                <div className="gesture-feedback success" role="status">
                  <span>ЖЕСТ ПРИНЯТ</span>
                  <strong>Фраза появилась на экране.</strong>
                  <small>Её можно повторно произнести кнопкой рядом.</small>
                </div>
              ) : (
                <div className="gesture-feedback" role="status">
                  <span>КАК НАЧАТЬ</span>
                  <strong>
                    {adapter
                      ? 'Покажите жест перед камерой.'
                      : 'Распознавание жестов ещё не подключено.'}
                  </strong>
                  <small>
                    {adapter
                      ? 'Результат появится справа и прозвучит вслух.'
                      : 'Пока можно написать фразу — она появится на экране и прозвучит вслух.'}
                  </small>
                </div>
              )}
              <p className="camera-privacy">Видео обрабатывается только на вашем устройстве.</p>
            </section>

            <section className="speech-panel" aria-label="Фраза и история разговора">
              <div className="panel-heading">
                <span>Ваше сообщение</span>
                <button
                  className="sound-toggle"
                  aria-pressed={soundOn}
                  onClick={() => {
                    setSoundOn((value) => !value);
                    if (soundOn) voice.cancel();
                  }}
                  aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
                >
                  {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  <span>Звук {soundOn ? 'включён' : 'выключен'}</span>
                </button>
              </div>
              <div
                className={`spoken-card ${latest ? 'has-phrase' : ''}`}
                role="status"
                aria-live="polite"
              >
                <p>
                  {latest
                    ? latest.source === 'gesture'
                      ? 'РАСПОЗНАННЫЙ ЖЕСТ'
                      : 'ТЕКСТОВОЕ СООБЩЕНИЕ'
                    : 'ФРАЗА ПОЯВИТСЯ ЗДЕСЬ'}
                </p>
                <strong>{latest ? latest.text : 'Здесь будут ваши слова.'}</strong>
                {latest && (
                  <button
                    className="replay-button"
                    onClick={() => say(latest.text)}
                    disabled={!voice.available}
                  >
                    <Volume2 size={19} /> Произнести ещё раз
                  </button>
                )}
              </div>
              {voice.error && (
                <p className="inline-alert" role="alert">
                  {voice.error}
                </p>
              )}
              <div className="history-heading">
                <span>История разговора</span>
                <span>{messageCount}</span>
              </div>
              <div className="history" role="log" aria-label="История разговора" aria-live="polite">
                {messages.length ? (
                  messages.map((message) => (
                    <div className="history-item" key={message.id}>
                      <span className="history-dot" />
                      <div>
                        <p>{message.text}</p>
                        <small>
                          {message.source === 'gesture' ? 'Жест' : 'Текст'} ·{' '}
                          {new Date(message.at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="history-empty">Сообщения появятся здесь во время разговора.</p>
                )}
              </div>
              <form className="composer" onSubmit={submitText}>
                <label htmlFor="message-input">Можно написать, если так удобнее</label>
                <div>
                  <input
                    id="message-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={500}
                    placeholder="Напишите фразу…"
                  />
                  <button type="submit" aria-label="Отправить фразу" disabled={!draft.trim()}>
                    <Send size={19} />
                  </button>
                </div>
              </form>
            </section>
          </div>
          <p className="conversation-footnote">
            Сессия {timeLabel} · {messageCount} {messageNoun(messageCount)} · Видео не сохраняется
          </p>
        </main>
      )}

      {screen === 'result' && (
        <main className="result" id="main" tabIndex={-1}>
          <div className="result-mark">
            <Check size={39} />
          </div>
          <p className="eyebrow">РАЗГОВОР ЗАВЕРШЁН</p>
          <h1>Разговор завершён.</h1>
          <p>
            За этот разговор отправлено {messageCount} {messageNoun(messageCount)}
            {gestureCount > 0 ? `, из них ${gestureCount} — жестами` : ''}.
          </p>
          {latest && (
            <div className="result-last">
              <span>ПОСЛЕДНЯЯ ФРАЗА</span>
              <strong>{latest.text}</strong>
            </div>
          )}
          <button className="primary-button" onClick={begin}>
            Начать новый разговор <ArrowRight size={19} />
          </button>
        </main>
      )}
    </div>
  );
}
