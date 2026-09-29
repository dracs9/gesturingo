import { strings } from "../data/strings.ru";
import s from "./Screen.module.css";

// Service page for recording samples/references. Reachable only by URL `/record`.
export function Record() {
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.record.title}</h1>
      <p className={s.placeholder}>{strings.common.wip}</p>
    </main>
  );
}
