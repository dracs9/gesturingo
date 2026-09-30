import { useEffect, useState } from "react";
import { strings } from "../data/strings.ru";
import { SPEECH_RATE_MAX, SPEECH_RATE_MIN, useSettings } from "../store/settings";
import { listRussianVoices, speak, type VoiceOption } from "../tts/speech";
import { Icon } from "./Icon";
import s from "./TalkSettings.module.css";

/**
 * Settings of the talk screen behind a gear (docs/TRANSLATOR_SPEC.md §4.3–4.5): sound, rate, volume, voice,
 * «озвучивать сразу» and a new calibration. Mouse / touch — set up once, e.g. by a helper; saved in localStorage.
 */
export function TalkSettings({ onRecalibrate }: { onRecalibrate(): void }) {
  const t = strings.talk.settings;
  const settings = useSettings();
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listRussianVoices().then((v) => {
      if (!cancelled) setVoices(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <details className={s.panel}>
      <summary className={s.summary} aria-label={t.title} title={t.title}>
        <Icon name="gear" />
      </summary>
      <div className={s.body}>
        <label className={s.check}>
          <input type="checkbox" checked={settings.soundOn} onChange={settings.toggleSound} />
          {t.sound}
        </label>
        <label className={s.row}>
          <span>{t.rate(settings.speechRate.toFixed(1))}</span>
          <input
            type="range"
            min={SPEECH_RATE_MIN}
            max={SPEECH_RATE_MAX}
            step={0.1}
            value={settings.speechRate}
            onChange={(e) => settings.setSpeechRate(Number(e.target.value))}
          />
        </label>
        <label className={s.row}>
          <span>{t.volume(Math.round(settings.speechVolume * 100))}</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.1}
            value={settings.speechVolume}
            onChange={(e) => settings.setSpeechVolume(Number(e.target.value))}
          />
        </label>
        <label className={s.row}>
          <span>{t.voice}</span>
          {voices.length > 0 ? (
            <select value={settings.voiceURI ?? ""} onChange={(e) => settings.setVoice(e.target.value || null)}>
              <option value="">{t.voiceAuto}</option>
              {voices.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name} ({v.lang}
                  {v.local ? "" : `, ${t.online}`})
                </option>
              ))}
            </select>
          ) : (
            <span className={s.muted}>{t.noVoices}</span>
          )}
        </label>
        <button type="button" className={s.button} onClick={() => void speak(t.sample)}>
          {t.test}
        </button>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={settings.speakImmediately}
            onChange={(e) => settings.setSpeakImmediately(e.target.checked)}
          />
          <span>
            {t.immediately}
            <br />
            <span className={s.muted}>{t.immediatelyNote}</span>
          </span>
        </label>
        <button type="button" className={s.button} onClick={onRecalibrate}>
          {t.recalibrate}
        </button>
      </div>
    </details>
  );
}
