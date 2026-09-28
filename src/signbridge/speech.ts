import { useCallback, useEffect, useRef, useState } from 'react';
import type { Preferences } from './model';

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
    (text: string, preferences: Preferences) => {
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

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start: () => void;
  abort: () => void;
};
type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognizer;
  webkitSpeechRecognition?: new () => SpeechRecognizer;
};
const recognitionConstructor = () => {
  const browser = window as unknown as SpeechWindow;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
};

export function useCaptions(onMessage: (text: string) => void) {
  const [status, setStatus] = useState<'off' | 'starting' | 'listening' | 'error'>('off');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const current = useRef<SpeechRecognizer | null>(null);
  const deliver = useRef(onMessage);
  useEffect(() => {
    deliver.current = onMessage;
  }, [onMessage]);
  const supported = Boolean(recognitionConstructor());
  const dispose = useCallback(() => {
    const recognizer = current.current;
    current.current = null;
    if (recognizer) {
      recognizer.onstart = null;
      recognizer.onend = null;
      recognizer.onerror = null;
      recognizer.onresult = null;
      try {
        recognizer.abort();
      } catch {
        /* Already stopped. */
      }
    }
  }, []);
  const stop = useCallback(() => {
    dispose();
    setStatus('off');
    setInterim('');
  }, [dispose]);
  const start = useCallback(
    (language: string) => {
      if (current.current) return;
      setError('');
      const Constructor = recognitionConstructor();
      if (!Constructor) {
        setError('Автоматические субтитры недоступны. Собеседник может написать ответ.');
        setStatus('error');
        return;
      }
      const recognizer = new Constructor();
      current.current = recognizer;
      const sent = new Set<number>();
      recognizer.lang = language;
      recognizer.continuous = true;
      recognizer.interimResults = true;
      setStatus('starting');
      recognizer.onstart = () => {
        if (current.current === recognizer) setStatus('listening');
      };
      recognizer.onend = () => {
        if (current.current === recognizer) {
          current.current = null;
          setStatus('off');
          setInterim('');
        }
      };
      recognizer.onerror = (event) => {
        if (current.current !== recognizer) return;
        dispose();
        setStatus('error');
        setInterim('');
        setError(
          event.error === 'not-allowed'
            ? 'Доступ к микрофону закрыт. Можно написать ответ вместо субтитров.'
            : event.error === 'no-speech'
              ? 'Речь не услышана. Попробуйте ещё раз или напишите ответ.'
              : 'Не удалось получить субтитры. Проверьте микрофон и соединение.',
        );
      };
      recognizer.onresult = (event) => {
        if (current.current !== recognizer) return;
        let partial = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript.trim();
          if (result.isFinal && !sent.has(i) && text) {
            sent.add(i);
            deliver.current(text);
          } else if (!result.isFinal) partial += text + ' ';
        }
        setInterim(partial.trim());
      };
      try {
        recognizer.start();
      } catch {
        dispose();
        setStatus('error');
        setError('Не удалось включить микрофон. Попробуйте снова.');
      }
    },
    [dispose],
  );
  useEffect(() => () => dispose(), [dispose]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [stop]);
  return { supported, status, interim, error, start, stop };
}
