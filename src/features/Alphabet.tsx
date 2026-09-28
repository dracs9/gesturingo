import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  Hand,
  Lightbulb,
  Search,
  WandSparkles,
} from 'lucide-react';
import { letters, referenceUrl, type Letter } from '../data';
import { type Progress } from '../state';

export function Alphabet({
  progress,
  onSelect,
}: {
  progress: Progress;
  onSelect: (letter: Letter) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const visible = useMemo(
    () =>
      letters.filter(
        (letter) =>
          (!query.trim() ||
            `${letter.id} ${letter.title}`.toLowerCase().includes(query.trim().toLowerCase())) &&
          (filter === 'all' ||
            (filter === 'static' && !letter.dynamic) ||
            (filter === 'dynamic' && letter.dynamic) ||
            (filter === 'completed' && progress.mastered.includes(letter.id))),
      ),
    [query, filter, progress.mastered],
  );
  return (
    <div className="wide-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">26 БУКВ. НОВЫЙ СПОСОБ ОБЩАТЬСЯ.</span>
          <h1>
            Азбука в ваших руках<span className="heading-dot">.</span>
          </h1>
          <p>Выберите букву. Познакомьтесь с формой. Попробуйте сами.</p>
        </div>
        <span className="large-page-icon">
          <BookOpen size={34} strokeWidth={1.4} />
        </span>
      </div>
      <div className="alphabet-toolbar">
        <div className="filter-tabs" aria-label="Фильтры букв">
          {[
            ['all', 'Все буквы'],
            ['static', 'Статические'],
            ['dynamic', 'В движении'],
            ['completed', 'Пройденные'],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? 'active' : ''}
              onClick={() => setFilter(id)}
            >
              {label}
              {id === 'all' && <span>26</span>}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <input
            type="search"
            aria-label="Найти букву"
            placeholder="Найти букву…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="alphabet-grid">
        {visible.map((letter) => {
          const done = progress.mastered.includes(letter.id);
          return (
            <button
              key={letter.id}
              className={`alphabet-tile ${letter.dynamic ? 'dynamic' : ''} ${done ? 'mastered' : ''}`}
              onClick={() => onSelect(letter)}
              aria-label={`Буква ${letter.id}: ${letter.title}`}
            >
              <span className="tile-top">
                {letter.dynamic ? <WandSparkles size={15} /> : <Hand size={15} />}
                {done && (
                  <span className="tile-check">
                    <Check size={11} />
                  </span>
                )}
              </span>
              <strong>{letter.id}</strong>
              <span className="tile-description">{letter.title}</span>
              <span className="tile-footer">
                {letter.dynamic ? 'С движением' : 'Посмотреть'} <ArrowRight size={13} />
              </span>
            </button>
          );
        })}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Search size={36} />
          <h3>
            {filter === 'completed' && !query
              ? 'Первые буквы ещё впереди'
              : 'Пока ничего не нашлось'}
          </h3>
          <p>
            {filter === 'completed' && !query
              ? 'Пройдите демо-урок, и буквы появятся здесь.'
              : 'Попробуйте другую букву или уберите фильтр.'}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Показать все буквы
          </button>
        </div>
      )}
      <div className="alphabet-info">
        <Lightbulb size={22} />
        <div>
          <strong>Алфавит — начало, а не весь язык.</strong>
          <p>
            ASL — самостоятельный язык со своей грамматикой. Здесь мы знакомимся с дактильной
            азбукой. Для J и Z важно также движение руки.
          </p>
        </div>
        <a
          href={referenceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Открыть учебный источник"
        >
          <ExternalLink size={19} />
        </a>
      </div>
    </div>
  );
}
