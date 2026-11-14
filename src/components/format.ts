// Formato de números para la interfaz, según el idioma activo.
import { lang } from '../i18n';

const locale = (): string => (lang.value === 'es' ? 'es-EC' : 'en-US');

/** Número con hasta `digits` decimales: 12,5 / 12.5. */
export function num(value: number, digits = 1): string {
  return value.toLocaleString(locale(), { maximumFractionDigits: digits });
}

/** Número con signo explícito: +2 / −1,5 / 0. Usa el signo menos tipográfico. */
export function signed(value: number, digits = 1): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${num(Math.abs(rounded), digits)}`;
}
