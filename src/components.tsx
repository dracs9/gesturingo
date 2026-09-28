import { useEffect, useRef, type ReactNode } from 'react';
import { X, Sparkles } from 'lucide-react';

export function Mascot({
  className = '',
  alt = 'Рыжий котёнок — ваш помощник Gesturingo',
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={`mascot ${className}`}
      src={`${import.meta.env.BASE_URL}mascot/gesturingo-cat.png`}
      alt={alt}
      draggable={false}
    />
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <img src={`${import.meta.env.BASE_URL}mascot/gesturingo-cat.png`} alt="" />
      </span>
      {!compact && (
        <span>
          gesturingo<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeHandler = useRef(onClose);
  useEffect(() => {
    closeHandler.current = onClose;
  }, [onClose]);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    const saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHandler.current();
      }
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, select, [tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = elements[0],
        last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (!ref.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = saved;
      document.removeEventListener('keydown', listener);
      previousFocus.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <button className="icon-button modal-close" aria-label="Закрыть" onClick={onClose}>
          <X size={21} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function HandSign({ letter, left = false }: { letter: string; left?: boolean }) {
  const dynamic = ['J', 'Z'].includes(letter);
  // Keep direction arrows intact for dynamic letters; mirror static handshapes only.
  return (
    <div className="hand-illustration">
      <div className="hand-diagram-stage">
        <img
          src={`${import.meta.env.BASE_URL}asl/${letter}.png`}
          alt={`Образец буквы ${letter} в дактильной азбуке ASL${dynamic ? ', со стрелкой движения' : ''}`}
          className="hand-diagram"
          style={{ transform: left && !dynamic ? 'scaleX(-1)' : undefined }}
        />
      </div>
      <span className="hand-caption">
        <Sparkles size={12} />{' '}
        {dynamic ? 'Повторите движение по стрелке' : 'Рассмотрите положение пальцев'}
      </span>
    </div>
  );
}
