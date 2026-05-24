import { useState, useEffect } from 'react';
import es from './es.json';
import en from './en.json';

const LANGS: Record<string, Record<string, string>> = { es, en };
const SUPPORTED = Object.keys(LANGS);

const stored = localStorage.getItem('openfutbol_lang') ?? '';
const browser = navigator.language?.slice(0, 2) ?? '';
let currentLang = SUPPORTED.includes(stored) ? stored : SUPPORTED.includes(browser) ? browser : 'es';

// Listeners are notified when setLang() is called so React hooks can re-render.
const listeners = new Set<() => void>();

export const t = (key: string, vars?: Record<string, string>): string => {
  const dict = LANGS[currentLang] ?? LANGS['es'];
  let str = dict[key] ?? LANGS['es'][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }
  return str;
};

export const getLang = (): string => currentLang;
export const getSupportedLangs = (): string[] => SUPPORTED;

export const setLang = (lang: string): void => {
  if (!SUPPORTED.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem('openfutbol_lang', lang);
  listeners.forEach(fn => fn());
};

// React hook — returns t() and re-renders the component when the language changes.
// Pure modules (engine, store) import t() directly instead.
export const useT = (): typeof t => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const notify = () => rerender(n => n + 1);
    listeners.add(notify);
    return () => { listeners.delete(notify); };
  }, []);
  return t;
};
