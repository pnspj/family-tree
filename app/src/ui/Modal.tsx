import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog:
 * - focuses `[data-autofocus]`, else the first form field, else the first button in the body
 * - keeps Tab / Shift+Tab inside the dialog, closes on Escape
 * - on close, gives focus back to the element that had it before (when it still exists),
 *   unless the parent moves focus somewhere more useful itself.
 */
export function Modal(props: { title: string; subtitle?: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const body = ref.current!.querySelector('.modal-body')!;
    const first =
      body.querySelector<HTMLElement>('[data-autofocus]') ??
      body.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])') ??
      body.querySelector<HTMLElement>('button:not([disabled])') ??
      ref.current!.querySelector<HTMLElement>('button');
    first?.focus();
    return () => {
      // Only restore when nothing else took focus meanwhile (focus fell back to <body>).
      requestAnimationFrame(() => {
        if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus();
      });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        props.onClose();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || !ref.current.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !ref.current.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div ref={ref} class={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header>
          <div>
            <h2 id="modal-title">{props.title}</h2>
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
