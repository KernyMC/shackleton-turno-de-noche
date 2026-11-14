// i18n mínimo: t('clave', { variable }) con respaldo a español.
// REGLA: ninguna cadena visible va escrita dentro de un componente.

import { signal } from '@preact/signals';
import en from './en.json';
import es from './es.json';

export type Lang = 'es' | 'en';
const dictionaries: Record<Lang, Record<string, string>> = { es, en };

export const lang = signal<Lang>('es');

export function t(key: string, vars: Record<string, string | number> = {}): string {
  let text = dictionaries[lang.value][key];
  if (text === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] falta "${key}" en ${lang.value}`);
    text = dictionaries.es[key] ?? key;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
