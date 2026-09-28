import { useCallback, useEffect, useRef, useState } from 'react';
import { defaults, parseProgress, STORAGE_KEY, type Progress } from './state';

export function useProgress() {
  const [unavailable, setUnavailable] = useState(false);
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      return parseProgress(localStorage.getItem(STORAGE_KEY));
    } catch {
      return structuredClone(defaults);
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, [progress]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setProgress(parseProgress(event.newValue));
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);
  return { progress, setProgress, unavailable };
}

export type Page = 'learn' | 'alphabet' | 'progress' | 'settings';
export function usePage() {
  const getPage = () => {
    const path = location.hash.slice(1);
    return ['learn', 'alphabet', 'progress', 'settings'].includes(path) ? (path as Page) : 'learn';
  };
  const [page, setPage] = useState<Page>(getPage);
  useEffect(() => {
    const listener = () => setPage(getPage());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  const navigate = (next: Page) => {
    location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  return { page, navigate };
}

export function useCamera() {
  const [status, setStatus] = useState<'off' | 'loading' | 'on' | 'error'>('off');
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef(0);
  const stop = useCallback(() => {
    request.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setStatus('off');
  }, []);
  const start = useCallback(async () => {
    const id = ++request.current;
    setStatus('loading');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      if (id !== request.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      if (id !== request.current) return;
      setStatus('on');
    } catch (reason) {
      if (id !== request.current) return;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (video.current) video.current.srcObject = null;
      const name =
        typeof reason === 'object' && reason !== null && 'name' in reason ? reason.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Доступ к камере закрыт. Разрешите его в настройках сайта и попробуйте снова.'
          : name === 'NotFoundError'
            ? 'Камера не найдена. Можно продолжить урок в демо-режиме.'
            : name === 'NotReadableError'
              ? 'Камера занята другим приложением. Закройте его и попробуйте снова.'
              : 'Не удалось включить камеру. Проверьте доступ и HTTPS-соединение. Демо-режим доступен.',
      );
      setStatus('error');
    }
  }, []);
  useEffect(
    () => () => {
      request.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(() => {
    const listener = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, [stop]);
  return { video, status, error, start, stop };
}

export function playSuccess(enabled: boolean) {
  if (!enabled) return;
  try {
    const context = new AudioContext();
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.setValueAtTime(0.06, context.currentTime + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + index * 0.1 + 0.15);
      oscillator.start(context.currentTime + index * 0.1);
      oscillator.stop(context.currentTime + index * 0.1 + 0.18);
    });
    setTimeout(() => void context.close(), 650);
  } catch {
    /* Sound is optional; the visual result always remains available. */
  }
}
