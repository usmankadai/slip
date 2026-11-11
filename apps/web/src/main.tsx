import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@slip/ui/fonts.css';
import '@slip/ui/tokens.css';
import '@slip/ui/base.css';
import { App } from './App.tsx';
import { installPerfApi } from './dev/perfApi.ts';

if (new URLSearchParams(location.search).has('perf')) installPerfApi();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
