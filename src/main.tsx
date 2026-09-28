import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import { SignBridgeApp } from './signbridge/SignBridgeApp';
import './signbridge/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SignBridgeApp />
  </StrictMode>,
);
