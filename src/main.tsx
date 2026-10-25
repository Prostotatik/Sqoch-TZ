import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// fonts (guidelines §1): variable Unbounded + Onest; Bad Script is lazy (success screen only)
import '@fontsource-variable/unbounded/wght.css';
import '@fontsource-variable/onest/wght.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import '@/styles/ui.css';
import '@/styles/landing.css';
import '@/styles/flow.css';
import '@/styles/final.css';
import '@/styles/motion.css';
import { App } from '@/app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
