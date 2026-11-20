import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Modal(props: { title: string; subtitle?: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title}>
        <header>
          <div>
            <h2>{props.title}</h2>
            {props.subtitle && <p class="subtitle">{props.subtitle}</p>}
          </div>
          <button type="button" class="icon" aria-label="閉じる" onClick={props.onClose}>
            ×
          </button>
        </header>
        <div class="modal-body">{props.children}</div>
      </div>
    </div>
  );
}
