// Panel "¿De dónde salen los datos?": fichas de public/data/sources.json con su estado
// (real de NASA / simulado / decisión del juego) y enlace a la fuente. Funciona sin red:
// el JSON es del repo. El estado nunca va solo en color: ícono + palabra.
import { useEffect, useRef, useState } from 'preact/hooks';
import { lang, t } from '../i18n';
import { sourcesOpen } from '../state/sources';
import { Icon } from './icons';
import type { IconName } from './icons';
import '../styles/sources.css';

type Status = 'verified' | 'simulated' | 'game_balance';

interface Source {
  name_es: string;
  name_en: string;
  explain_es: string;
  explain_en: string;
  status: Status;
  source_name?: string;
  url?: string | null;
  requires_files?: string[];
  status_without_files?: Status;
  explain_without_files_es?: string;
  explain_without_files_en?: string;
}

const ORDER: Record<Status, number> = { verified: 0, simulated: 1, game_balance: 2 };
const BADGE: Record<Status, { icon: IconName; label: string }> = {
  verified: { icon: 'check', label: 'sources.status.verified' },
  simulated: { icon: 'info', label: 'sources.status.simulated' },
  game_balance: { icon: 'workshop', label: 'sources.status.game_balance' },
};

/** ¿Está instalado el archivo? (los mapas y modelos de NASA son opcionales). */
async function exists(path: string): Promise<boolean> {
  try {
    const res = await fetch(`/${path}`, { method: 'HEAD' });
    return res.ok && !(res.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}

async function load(): Promise<Source[]> {
  const res = await fetch('/data/sources.json');
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { sources: Record<string, Source> };
  const list = await Promise.all(
    Object.values(json.sources).map(async (s) => {
      if (!s.requires_files || !s.status_without_files) return s;
      const found = await Promise.all(s.requires_files.map(exists));
      return found.every(Boolean)
        ? s
        : {
            ...s,
            status: s.status_without_files,
            explain_es: s.explain_without_files_es ?? s.explain_es,
            explain_en: s.explain_without_files_en ?? s.explain_en,
            url: s.status_without_files === 'verified' ? s.url : null,
          };
    }),
  );
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => ORDER[a.s.status] - ORDER[b.s.status] || a.i - b.i)
    .map((x) => x.s);
}

function Card({ s }: { s: Source }) {
  const en = lang.value === 'en';
  const badge = BADGE[s.status];
  return (
    <li class={`src-card src-card--${s.status}`}>
      <div class="src-card__top">
        <h3 class="src-card__name">{en ? s.name_en : s.name_es}</h3>
        <span class={`src-badge src-badge--${s.status}`}>
          <Icon name={badge.icon} size={14} />
          {t(badge.label)}
        </span>
      </div>
      <p class="src-card__text">{en ? s.explain_en : s.explain_es}</p>
      {s.url && (
        <a class="src-card__link" href={s.url} target="_blank" rel="noopener noreferrer">
          {t('sources.link')}
          <span class="src-sr"> ({t('sources.new_tab')})</span>
          <span aria-hidden="true"> ↗</span>
        </a>
      )}
    </li>
  );
}

export function SourcesPanel() {
  const open = sourcesOpen.value;
  const [list, setList] = useState<Source[] | null>(null);
  const [failed, setFailed] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    let alive = true;
    setFailed(false);
    load().then(
      (l) => alive && setList(l),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const close = (): void => {
    sourcesOpen.value = false;
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div class="src-overlay" onClick={(e) => e.target === e.currentTarget && close()} onKeyDown={onKey}>
      <section class="src-dialog" role="dialog" aria-modal="true" aria-labelledby="src-title">
        <header class="src-dialog__head">
          <h2 id="src-title">{t('sources.title')}</h2>
          <button ref={closeBtn} type="button" class="src-close" aria-label={t('sources.close')} onClick={close}>
            <Icon name="close" />
          </button>
        </header>
        <p class="src-dialog__intro">{t('sources.intro')}</p>
        {failed ? (
          <p class="src-dialog__msg" role="status">{t('sources.error')}</p>
        ) : list === null ? (
          <p class="src-dialog__msg" role="status">{t('sources.loading')}</p>
        ) : (
          <ul class="src-list">{list.map((s) => <Card key={s.name_es} s={s} />)}</ul>
        )}
      </section>
    </div>
  );
}
