import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Flame,
  Hand,
  LockKeyhole,
  ShieldCheck,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { courses } from '../data';
import { Mascot, ProgressBar } from '../components';
import { minutes, streak, type Progress } from '../state';

export function ProgressPage({ progress, onStart }: { progress: Progress; onStart: () => void }) {
  const xp = progress.mastered.length * 10;
  const level = Math.floor(xp / 60) + 1;
  const practiceTime = progress.history.reduce((sum, item) => sum + item.seconds, 0);
  const achieved = [
    progress.mastered.length >= 1,
    progress.completedCourses.length >= 1,
    streak(progress.history) >= 3,
    progress.mastered.length >= 26,
  ];
  return (
    <div className="wide-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">КАЖДЫЙ ШАГ ИМЕЕТ ЗНАЧЕНИЕ</span>
          <h1>
            Ваши маленькие победы<span className="heading-dot">.</span>
          </h1>
          <p>Здесь живут результаты ваших демо-занятий. Продолжайте в своём темпе.</p>
        </div>
        <span className="large-page-icon">
          <Trophy size={34} strokeWidth={1.4} />
        </span>
      </div>
      <div className="stats-grid">
        {[
          [BookOpen, `${progress.mastered.length}/26`, 'букв пройдено', 'green'],
          [Flame, String(streak(progress.history)), 'дней подряд', 'peach'],
          [Zap, String(xp), 'опыта XP', 'purple'],
          [Clock3, minutes(practiceTime), 'время практики', 'blue'],
        ].map(([Icon, value, label, color]) => {
          const Component = Icon as LucideIcon;
          return (
            <div className={`stat-card ${color}`} key={String(label)}>
              <span>
                <Component size={24} />
              </span>
              <strong>{String(value)}</strong>
              <p>{String(label)}</p>
            </div>
          );
        })}
      </div>
      <div className="progress-columns">
        <section className="level-card">
          <div className="level-badge">
            <Award size={37} strokeWidth={1.5} />
            <strong>{level}</strong>
          </div>
          <div>
            <span className="eyebrow">ВАШ УРОВЕНЬ</span>
            <h2>
              {level === 1
                ? 'Любопытный исследователь'
                : level === 2
                  ? 'Уверенный новичок'
                  : 'Знаток азбуки'}
            </h2>
            <p>Новая буква — ещё 10 XP. Повторение закрепляет знакомство с формой.</p>
            <ProgressBar value={((xp % 60) / 60) * 100} label="Опыт до следующего уровня" />
            <span className="small-muted">{xp % 60} / 60 XP до следующего уровня</span>
          </div>
        </section>
        <section className="mini-mascot-card">
          <Mascot />
          <div>
            <strong>
              Сравнивайте себя
              <br />
              только с собой.
            </strong>
            <p>Каждый новый жест — ваш шаг вперёд.</p>
          </div>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">ПОВОД ГОРДИТЬСЯ</span>
          <h2>Ваши достижения</h2>
        </div>
        <span className="section-counter">{achieved.filter(Boolean).length} / 4</span>
      </div>
      <div className="achievement-grid">
        {[
          [Hand, 'Первый жест', 'Пройдите любую букву'],
          [Star, 'Первый урок', 'Завершите первый урок'],
          [Flame, 'Хорошая привычка', 'Занимайтесь 3 дня подряд'],
          [Trophy, 'Весь алфавит', 'Пройдите все 26 букв'],
        ].map(([Icon, title, description], index) => {
          const Component = Icon as LucideIcon;
          return (
            <div className={`achievement ${achieved[index] ? 'earned' : ''}`} key={String(title)}>
              <span>
                <Component size={29} strokeWidth={1.5} />
              </span>
              <strong>{String(title)}</strong>
              <p>{String(description)}</p>
              {achieved[index] ? (
                <span className="achievement-state">
                  <Check size={12} /> Получено
                </span>
              ) : (
                <span className="achievement-state">
                  <LockKeyhole size={12} /> Впереди
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="section-heading">
        <h2>История занятий</h2>
        <span className="section-counter">Только на этом устройстве</span>
      </div>
      {progress.history.length ? (
        <div className="history-list">
          {progress.history.slice(0, 10).map((record) => (
            <div className="history-row" key={record.id}>
              <span className="history-icon">
                <CheckCheck size={21} />
              </span>
              <div>
                <strong>
                  {courses.find((course) => course.id === record.courseId)?.title ||
                    `Практика ${record.letters.join(', ')}`}
                </strong>
                <span>
                  {record.letters.join(' · ')} <span className="history-dot">•</span>{' '}
                  {minutes(record.seconds)}
                </span>
              </div>
              <div className="history-date">
                <strong>
                  {new Date(`${record.date}T12:00:00`).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </strong>
                <span>{record.assisted ? `${record.assisted} с подсказкой` : 'Без подсказки'}</span>
              </div>
              <span className="pill green">Демо</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state history-empty">
          <BookOpen size={35} />
          <h3>Здесь появится ваша история</h3>
          <p>Первый урок займёт всего несколько минут.</p>
          <button className="button primary" onClick={onStart}>
            Сделать первый шаг <ArrowRight size={17} />
          </button>
        </div>
      )}
      <p className="progress-disclaimer">
        <ShieldCheck size={15} /> Демо-прогресс показывает прохождение интерфейса. Он не
        подтверждает правильность жестов или знание ASL.
      </p>
    </div>
  );
}
