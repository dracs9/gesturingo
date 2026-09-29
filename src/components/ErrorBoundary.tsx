import { Component, type ErrorInfo, type ReactNode } from "react";
import { strings } from "../data/strings.ru";
import s from "../screens/Screen.module.css";
import { GestureButton } from "./GestureButton";

interface ErrorBoundaryState {
  failed: boolean;
}

/** Last line of defence: an unexpected render error shows a clear message, never a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Gesturingo crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className={s.screen} role="alert">
        <h1 className={s.title}>{strings.crash.title}</h1>
        <p className={s.text}>{strings.crash.text}</p>
        <div className={s.actions}>
          <GestureButton variant="primary" onClick={() => window.location.assign("/")}>
            {strings.crash.reload}
          </GestureButton>
        </div>
      </main>
    );
  }
}
