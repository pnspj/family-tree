// Renders ruby markup "{漢字|よみ}…" as <ruby> elements.
const RE = /\{([^|}]*)\|([^}]*)\}/g;

export function Ruby({ text }: { text: string }) {
  const out: (string | preact.JSX.Element)[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(
      m[2] ? (
        <ruby key={i++}>
          {m[1]}
          <rt>{m[2]}</rt>
        </ruby>
      ) : (
        m[1]
      ),
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
