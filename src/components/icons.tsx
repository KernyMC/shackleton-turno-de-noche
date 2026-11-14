// Íconos SVG de trazo propio (docs/ARTE.md §8): 20×20, un solo grosor, color heredado.
// Son decorativos (aria-hidden): el texto al lado siempre dice lo mismo.
import type { JSX } from 'preact';

export type IconName =
  | 'recycler'
  | 'greenhouse'
  | 'shield'
  | 'workshop'
  | 'battery'
  | 'life_support'
  | 'food'
  | 'dose'
  | 'sun'
  | 'moon'
  | 'alert'
  | 'check'
  | 'close';

const PATHS: Record<IconName, JSX.Element> = {
  // Dos flechas en ciclo.
  recycler: (
    <>
      <path d="M4 10a6 6 0 0 1 10.2-4.3" />
      <path d="M14.5 2.8v3.2h-3.2" />
      <path d="M16 10a6 6 0 0 1-10.2 4.3" />
      <path d="M5.5 17.2V14h3.2" />
    </>
  ),
  // Brote con dos hojas.
  greenhouse: (
    <>
      <path d="M10 17V9" />
      <path d="M10 11c0-3 2-5 5.5-5 0 3.2-2 5-5.5 5Z" />
      <path d="M10 9C10 6.5 8.4 4.5 5 4.5c0 2.8 1.6 4.5 5 4.5Z" />
      <path d="M5 17h10" />
    </>
  ),
  shield: <path d="M10 2.5 16 5v4.5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V5Z" />,
  // Llave inglesa.
  workshop: (
    <>
      <path d="M12.5 3.2a3.8 3.8 0 0 0-4.6 5L3.4 12.7a1.6 1.6 0 0 0 2.3 2.3l4.5-4.5a3.8 3.8 0 0 0 5-4.6l-2.3 2.3-2-.4-.4-2Z" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="6" width="13" height="8" rx="1" />
      <path d="M17.5 8.5v3" />
      <path d="M5.5 9v2M8.5 9v2" />
    </>
  ),
  // Gota de agua: aire y agua.
  life_support: <path d="M10 2.8c2.8 3.6 4.8 6.4 4.8 9a4.8 4.8 0 0 1-9.6 0c0-2.6 2-5.4 4.8-9Z" />,
  // Hoja.
  food: (
    <>
      <path d="M4 16c0-7 4.5-11 12-12 0 7.5-4 12-11 12" />
      <path d="M4 16l6-6" />
    </>
  ),
  // Trébol de radiación simplificado.
  dose: (
    <>
      <circle cx="10" cy="10" r="1.4" />
      <path d="M10 8.6V3a7 7 0 0 1 6 3.5l-4.8 2.8" />
      <path d="M8.8 10.7 4 13.5A7 7 0 0 1 4 6.5l4.8 2.8" />
      <path d="M11.2 10.7 16 13.5A7 7 0 0 1 10 17v-5.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    </>
  ),
  moon: <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" />,
  alert: (
    <>
      <path d="M10 3 17.5 16h-15Z" />
      <path d="M10 8v3.5M10 13.6v.2" />
    </>
  ),
  check: <path d="M4 10.5l4 4 8-9" />,
  close: <path d="M5 5l10 10M15 5 5 15" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
