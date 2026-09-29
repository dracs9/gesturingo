import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceOptions = { language: string; voice: string };
export const russianVoice: VoiceOptions = { language: 'ru-RU', voice: '' };

export function useVoice() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const available =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';
  const pending = useRef(0);
  const cancel = useCallback(() => {
    pending.current++;
    if (available) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [available]);
  useEffect(() => {
    if (!available) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      pending.current++;
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      window.speechSynthesis.cancel();
    };
  }, [available]);
  const speak = useCallback(
    (text: string, preferences: VoiceOptions) => {
      setError('');
      if (!available) {
        setError('Озвучивание недоступно в этом браузере. Сообщение остаётся на экране.');
        return false;
      }
      if (!text.trim()) return false;
      window.speechSynthesis.cancel();
      const id = ++pending.current;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = preferences.language;
      utterance.rate = 0.95;
      utterance.voice =
        voices.find((item) => item.voiceURI === preferences.voice) ||
        voices.find(
          (item) => item.lang.startsWith(preferences.language.slice(0, 2)) && item.localService,
        ) ||
        voices.find((item) => item.lang.startsWith(preferences.language.slice(0, 2))) ||
        null;
      utterance.onstart = () => {
        if (id === pending.current) setSpeaking(true);
      };
      utterance.onend = () => {
        if (id === pending.current) setSpeaking(false);
      };
      utterance.onerror = () => {
        if (id === pending.current) {
          setSpeaking(false);
          setError(
            'Не удалось озвучить сообщение. Выберите другой голос или прочитайте текст на экране.',
          );
        }
      };
      try {
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        setSpeaking(false);
        setError('Браузер не разрешил озвучивание. Текст сообщения доступен.');
        return false;
      }
    },
    [available, voices],
  );
  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [cancel]);
  return { voices, speaking, error, available, speak, cancel };
}
