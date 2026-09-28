import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  CameraOff,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Hand,
  Heart,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { letterById } from '../data';
import { HandSign, Mascot, Modal, ProgressBar } from '../components';
import { playSuccess, useCamera } from '../hooks';
import { dayKey, minutes, type Progress, type SessionRecord } from '../state';

export type LessonConfig = { id: string; title: string; letters: readonly string[] };

export function Lesson({
  config,
  preferences,
  mastered,
  onClose,
  onComplete,
}: {
  config: LessonConfig;
  preferences: Progress['preferences'];
  mastered: string[];
  onClose: () => void;
  onComplete: (record: SessionRecord) => void;
}) {
  const [phase, setPhase] = useState<'intro' | 'exercise' | 'feedback' | 'complete'>('intro');
  const [index, setIndex] = useState(0);
  const [correction, setCorrection] = useState(false);
  const [hint, setHint] = useState(false);
  const [helped, setHelped] = useState<string[]>([]);
  const [showExit, setShowExit] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordId] = useState(() => crypto.randomUUID());
  const [newlyCompleted] = useState(
    () => config.letters.filter((id) => !mastered.includes(id)).length,
  );
  const camera = useCamera();
  const current = letterById[config.letters[index]];
  useEffect(() => {
    if (!['exercise', 'feedback'].includes(phase) || showExit) return;
    const timer = setInterval(() => {
      if (!document.hidden) setElapsed((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, showExit]);
  const close = useCallback(() => {
    if (phase === 'intro' || phase === 'complete') onClose();
    else setShowExit(true);
  }, [phase, onClose]);
  const accept = () => {
    if (phase !== 'exercise') return;
    if (hint || correction) setHelped((items) => [...new Set([...items, current.id])]);
    setCorrection(false);
    setPhase('feedback');
    playSuccess(preferences.sound);
  };
  const next = () => {
    if (index + 1 < config.letters.length) {
      setIndex((i) => i + 1);
      setCorrection(false);
      setHint(false);
      setPhase('exercise');
    } else {
      camera.stop();
      onComplete({
        id: recordId,
        courseId: config.id,
        date: dayKey(),
        letters: [...config.letters],
        assisted: helped.length,
        seconds: elapsed,
      });
      setPhase('complete');
    }
  };
  return (
    <Modal
      title={config.title}
      onClose={close}
      className={`lesson-modal ${phase === 'intro' || phase === 'complete' ? 'lesson-centered' : ''}`}
    >
      {showExit ? (
        <div className="lesson-exit">
          <span className="confirm-icon">
            <Heart size={29} />
          </span>
          <h2>Сделаем паузу?</h2>
          <p>
            Незавершённый урок не будет засчитан. Можно вернуться и попробовать ещё раз в любое
            время.
          </p>
          <div className="confirm-actions">
            <button className="button secondary" onClick={onClose}>
              Завершить урок
            </button>
            <button className="button primary" onClick={() => setShowExit(false)}>
              Продолжить <ArrowRight size={17} />
            </button>
          </div>
        </div>
      ) : phase === 'intro' ? (
        <div className="lesson-intro">
          <span className="pill green">
            <Sparkles size={13} /> НОВЫЙ МАЛЕНЬКИЙ ШАГ
          </span>
          <Mascot />
          <h2>{config.title}</h2>
          <p>
            Познакомимся с буквами <strong>{config.letters.join(', ')}</strong>.<br />
            Не спешите — у каждого свой темп.
          </p>
          <div className="intro-facts">
            <span>
              <BookOpen size={16} /> {config.letters.length}{' '}
              {config.letters.length === 1 ? 'буква' : config.letters.length < 5 ? 'буквы' : 'букв'}
            </span>
            <span>
              <ShieldCheck size={16} /> Камера необязательна
            </span>
          </div>
          <div className="lesson-demo-notice">
            <span className="demo-dot" />
            <p>
              Это демо-урок. Результаты выбираются кнопками; распознавание жестов пока не
              подключено.
            </p>
          </div>
          <button className="button primary" onClick={() => setPhase('exercise')}>
            Начнём <ArrowRight size={18} />
          </button>
        </div>
      ) : phase === 'complete' ? (
        <div className="lesson-result">
          <div className="confetti">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
          <span className="pill green">
            <CheckCheck size={14} /> УРОК ЗАВЕРШЁН
          </span>
          <Mascot />
          <h2>Ещё один шаг вперёд!</h2>
          <p>
            Вы прошли задания <strong>{config.letters.join(', ')}</strong>.<br />
            Небольшая практика — большое начало.
          </p>
          <div className="result-stats">
            <div>
              <Zap size={21} />
              <strong>+{newlyCompleted * 10}</strong>
              <span>демо XP</span>
            </div>
            <div>
              <Clock3 size={21} />
              <strong>{minutes(elapsed)}</strong>
              <span>практики</span>
            </div>
            <div>
              <Lightbulb size={21} />
              <strong>{helped.length}</strong>
              <span>с подсказкой</span>
            </div>
          </div>
          <div className="result-letters">
            {config.letters.map((id) => (
              <span key={id}>
                {id}
                <Check size={11} />
              </span>
            ))}
          </div>
          {helped.length > 0 && (
            <p className="result-review">
              Стоит повторить: <strong>{helped.join(', ')}</strong>. Подсказки — естественная часть
              обучения.
            </p>
          )}
          <p className="small-muted">
            Результат сохранён как демо-прохождение. Правильность жестов не проверялась
            автоматически.
          </p>
          <button className="button primary" onClick={onClose}>
            Вернуться к обучению <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="lesson-header">
            <button className="icon-button" aria-label="Выйти из урока" onClick={close}>
              <ArrowLeft size={21} />
            </button>
            <div>
              <span>{config.title}</span>
              <ProgressBar
                value={((index + (phase === 'feedback' ? 1 : 0)) / config.letters.length) * 100}
                label="Прогресс урока"
              />
            </div>
            <strong>
              {index + 1} / {config.letters.length}
            </strong>
          </div>
          <div className="lesson-demo-label">
            <span className="demo-dot" /> Демо-режим <span>·</span> Автоматическая проверка пока не
            подключена
          </div>
          <div className="exercise-heading">
            <span className="eyebrow">ПОСМОТРИТЕ. ПОВТОРИТЕ. ПОПРОБУЙТЕ.</span>
            <h2>
              Покажите букву <span>{current.id}</span>
            </h2>
            <p>{current.title}</p>
          </div>
          <div className="exercise-grid">
            <section className="reference-panel">
              <div className="panel-label">
                <BookOpen size={15} /> Учебный ориентир <span>ASL</span>
              </div>
              <HandSign letter={current.id} left={preferences.hand === 'left'} />
              <p>{current.instruction}</p>
              <button
                className={`hint-button ${hint ? 'active' : ''}`}
                onClick={() => setHint(!hint)}
              >
                <Lightbulb size={16} /> {hint ? 'Скрыть подсказку' : 'Небольшая подсказка'}{' '}
                <ChevronRight size={14} />
              </button>
              {hint && (
                <div className="exercise-tip" role="status">
                  {current.tip}
                </div>
              )}
            </section>
            <section
              className={`camera-panel ${phase === 'feedback' ? 'success' : correction ? 'needs-correction' : ''}`}
            >
              <div className="panel-label">
                <Camera size={15} /> Ваша практика{' '}
                <span className={`camera-status ${camera.status === 'on' ? 'live' : ''}`}>
                  {camera.status === 'on' ? 'КАМЕРА ВКЛЮЧЕНА' : 'КАМЕРА ВЫКЛЮЧЕНА'}
                </span>
              </div>
              <div className="camera-stage">
                <video
                  ref={camera.video}
                  className={camera.status === 'on' ? 'visible' : ''}
                  muted
                  playsInline
                  autoPlay
                  aria-label="Изображение вашей камеры"
                />
                <div className="camera-guide">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                {camera.status !== 'on' && (
                  <div className="camera-placeholder">
                    <span>
                      <Hand size={42} strokeWidth={1.25} />
                    </span>
                    <strong>Здесь будет ваша рука</strong>
                    <p>
                      Включите камеру для практики
                      <br />
                      или продолжайте без неё.
                    </p>
                    <button
                      className="button secondary"
                      disabled={camera.status === 'loading'}
                      onClick={() => void camera.start()}
                    >
                      <Camera size={16} />
                      {camera.status === 'loading'
                        ? 'Подключаем…'
                        : camera.status === 'error'
                          ? 'Попробовать снова'
                          : 'Включить камеру'}
                    </button>
                  </div>
                )}
                {camera.status === 'on' && (
                  <>
                    <span className="camera-overlay-note">Держите руку внутри рамки</span>
                    <button className="camera-stop" onClick={camera.stop}>
                      <CameraOff size={14} /> Выключить
                    </button>
                  </>
                )}
              </div>
              {camera.error && (
                <p className="camera-error" role="alert">
                  {camera.error}
                </p>
              )}
              <div className="camera-bottom">
                <ShieldCheck size={14} />
                <span>Только просмотр. Без записи и распознавания.</span>
              </div>
            </section>
          </div>
          {phase === 'feedback' ? (
            <div className="feedback-panel good" role="status">
              <span className="feedback-icon">
                <Check size={23} />
              </span>
              <div>
                <strong>Отличный шаг. Продолжаем!</strong>
                <p>Успешный результат выбран в демо-режиме.</p>
              </div>
              <button className="button primary" onClick={next}>
                {index + 1 === config.letters.length ? 'Завершить урок' : 'Следующая буква'}{' '}
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              {correction && (
                <div className="feedback-panel correction" role="status">
                  <span className="feedback-icon">
                    <Lightbulb size={23} />
                  </span>
                  <div>
                    <strong>{current.correction}</strong>
                    <p>Пример конкретной подсказки. Попробуйте исправить положение руки.</p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setCorrection(false)}
                    aria-label="Скрыть пример ошибки"
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
              <div className="demo-controls">
                <div>
                  <span className="eyebrow">ДЕМО-ПАНЕЛЬ</span>
                  <p>Выберите результат, чтобы проверить сценарий урока.</p>
                </div>
                <div>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setCorrection(true);
                      setHint(true);
                    }}
                  >
                    <Lightbulb size={16} /> Показать ошибку
                  </button>
                  <button className="button primary" onClick={accept}>
                    <Check size={17} /> Верный жест
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
