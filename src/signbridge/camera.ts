import { useCallback, useEffect, useRef, useState } from 'react';

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
  const start = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    const id = ++request.current;
    setStatus('loading');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 960 }, height: { ideal: 720 } },
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
            ? 'Камера не найдена. Можно продолжить в демонстрационном режиме.'
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
