import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Check,
  Hand,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Mascot, Modal } from '../components';
import { defaults, type Progress } from '../state';

export function SettingsPage({
  progress,
  setProgress,
  notify,
}: {
  progress: Progress;
  setProgress: Dispatch<SetStateAction<Progress>>;
  notify: (message: string) => void;
}) {
  const [name, setName] = useState(progress.preferences.name);
  const [reset, setReset] = useState(false);
  const closeReset = useCallback(() => setReset(false), []);
  const setPreference = <K extends keyof Progress['preferences']>(
    key: K,
    value: Progress['preferences'][K],
  ) =>
    setProgress((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  return (
    <div className="wide-page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ТАК, КАК УДОБНО ВАМ</span>
          <h1>
            Ваш темп. Ваши правила<span className="heading-dot">.</span>
          </h1>
          <p>Несколько небольших настроек для комфортного обучения.</p>
        </div>
        <span className="large-page-icon">
          <Settings2 size={34} strokeWidth={1.4} />
        </span>
      </div>
      <div className="settings-layout">
        <div>
          <section className="settings-card">
            <div className="settings-card-title">
              <span>
                <Hand size={20} />
              </span>
              <div>
                <h2>Давайте познакомимся</h2>
                <p>Регистрация не нужна. Имя остаётся на вашем устройстве.</p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPreference('name', name.trim());
                notify('Имя сохранено. Рады знакомству!');
              }}
            >
              <label className="field-label" htmlFor="display-name">
                Как вас называть?
              </label>
              <div className="name-field">
                <input
                  id="display-name"
                  placeholder="Ваше имя"
                  maxLength={32}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <button className="button primary" type="submit">
                  Сохранить
                </button>
              </div>
            </form>
          </section>
          <section className="settings-card">
            <div className="settings-card-title">
              <span>
                <Target size={20} />
              </span>
              <div>
                <h2>Небольшая ежедневная цель</h2>
                <p>Выберите комфортное количество упражнений.</p>
              </div>
            </div>
            <div className="goal-options">
              {[
                [3, 'Спокойно', 'Первый шаг'],
                [5, 'Регулярно', 'Хороший ритм'],
                [10, 'Увлечённо', 'Больше практики'],
              ].map(([value, title, subtitle]) => (
                <button
                  key={value}
                  className={progress.preferences.goal === value ? 'selected' : ''}
                  aria-pressed={progress.preferences.goal === value}
                  onClick={() => setPreference('goal', Number(value))}
                >
                  <span>
                    {progress.preferences.goal === value ? (
                      <Check size={17} />
                    ) : (
                      <Target size={17} />
                    )}
                  </span>
                  <strong>{String(title)}</strong>
                  <p>{value} упражнений</p>
                  <small>{subtitle}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card">
            <div className="settings-card-title">
              <span>
                <Settings2 size={20} />
              </span>
              <div>
                <h2>Комфорт во время урока</h2>
                <p>Настройки сохраняются автоматически.</p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Ведущая рука</strong>
                <p>Отражение статических образцов. Для J и Z стрелки сохраняются.</p>
              </div>
              <div className="segmented">
                {[
                  ['right', 'Правая'],
                  ['left', 'Левая'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={progress.preferences.hand === value}
                    className={progress.preferences.hand === value ? 'active' : ''}
                    onClick={() => setPreference('hand', value as 'left' | 'right')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              label="Звуки успеха"
              description="Мягкий сигнал при завершении задания."
              checked={progress.preferences.sound}
              onChange={() => setPreference('sound', !progress.preferences.sound)}
              icon={Volume2}
            />
            <Toggle
              label="Меньше анимации"
              description="Спокойные переходы и статичные эффекты."
              checked={progress.preferences.reducedMotion}
              onChange={() => setPreference('reducedMotion', !progress.preferences.reducedMotion)}
              icon={Sparkles}
            />
          </section>
          <section className="settings-card reset-card">
            <div>
              <h2>Начать с чистого листа</h2>
              <p>Удалить демо-прогресс, историю и настройки с этого устройства.</p>
            </div>
            <button className="button danger" onClick={() => setReset(true)}>
              <RotateCcw size={16} /> Сбросить
            </button>
          </section>
        </div>
        <aside className="settings-aside">
          <div className="privacy-card">
            <span>
              <ShieldCheck size={28} />
            </span>
            <h3>
              Ваше пространство
              <br />
              остаётся вашим.
            </h3>
            <p>Мы не записываем видео и не отправляем изображение камеры на сервер.</p>
            <p>Имя, настройки и демо-прогресс хранятся только в браузере на этом устройстве.</p>
            <span className="pill green">Без аккаунта. Без установки.</span>
          </div>
          <Mascot />
        </aside>
      </div>
      {reset && (
        <Modal title="Сбросить прогресс?" onClose={closeReset} className="confirm-modal">
          <span className="confirm-icon">
            <RotateCcw size={29} />
          </span>
          <h2>Начать сначала?</h2>
          <p>
            Демо-прогресс, история занятий и настройки будут удалены с этого устройства. Это
            действие нельзя отменить.
          </p>
          <div className="confirm-actions">
            <button className="button secondary" onClick={closeReset}>
              Оставить прогресс
            </button>
            <button
              className="button danger"
              onClick={() => {
                setProgress(structuredClone(defaults));
                setName('');
                setReset(false);
                notify('Прогресс сброшен. Впереди новые шаги!');
              }}
            >
              Сбросить всё
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon: LucideIcon;
}) {
  return (
    <div className="settings-row">
      <div>
        <strong>
          <Icon size={15} /> {label}
        </strong>
        <p>{description}</p>
      </div>
      <button
        className={`toggle ${checked ? 'on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}
