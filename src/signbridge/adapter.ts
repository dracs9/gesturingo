import { useEffect, useRef, useState, type RefObject } from 'react';
import type { DictionaryEntry, RecognitionFrame } from './model';

/** The adapter owns inference/worker resources, not the camera stream.
 * Coordinates are normalized in the original, unmirrored video frame.
 * One eventId identifies one completed gesture, even across many frames. */
export type RecognitionAdapter = {
  start: (input: {
    video: HTMLVideoElement;
    dictionary: readonly DictionaryEntry[];
    onFrame: (frame: RecognitionFrame) => void;
    onError: (message: string) => void;
  }) => () => void;
};

export function useRecognitionAdapter(
  adapter: RecognitionAdapter | undefined,
  enabled: boolean,
  video: RefObject<HTMLVideoElement | null>,
  dictionary: DictionaryEntry[],
  onFrame: (frame: RecognitionFrame) => void,
) {
  const [error, setError] = useState('');
  const deliver = useRef(onFrame);
  useEffect(() => {
    deliver.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    setError('');
    if (!adapter || !enabled || !video.current) return;
    let active = true;
    let dispose: (() => void) | undefined;
    try {
      dispose = adapter.start({
        video: video.current,
        dictionary,
        onFrame: (frame) => {
          if (active) deliver.current({ ...frame, source: 'camera' });
        },
        onError: (message) => {
          if (active) setError(message || 'Не удалось распознать жест. Попробуйте снова.');
        },
      });
    } catch {
      setError('Не удалось запустить распознавание. Камера и текстовый диалог доступны.');
    }
    return () => {
      active = false;
      dispose?.();
    };
  }, [adapter, enabled, video, dictionary]);
  return { error };
}
