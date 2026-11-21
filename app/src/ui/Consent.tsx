// First screen: the about page with the consent card at the bottom. An adult (guardian) reads the
// terms, disclaimer and privacy policy and agrees. After a terms update only the card is shown.
import { useRef, useState } from 'preact/hooks';
import { GUIDE_URL, PRIVACY_URL, TERMS_URL } from '../legal';
import { AboutPage } from './About';

export function ConsentScreen({ renewed, onAgree }: { renewed: boolean; onAgree: () => void }) {
  const [showAbout, setShowAbout] = useState(!renewed);
  const firstCheck = useRef<HTMLInputElement>(null);
  const card = <ConsentCard renewed={renewed} onAgree={onAgree} firstCheck={firstCheck} />;

  if (!showAbout)
    return (
      <div class="consent">
        <h1>かけいず</h1>
        {card}
        <button type="button" class="link-button" onClick={() => setShowAbout(true)}>
          このアプリについて
        </button>
      </div>
    );
  return (
    <AboutPage
      action={
        <button
          type="button"
          class="primary about-start"
          onClick={() => {
            const box = firstCheck.current;
            box?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            box?.focus({ preventScroll: true });
          }}
        >
          はじめる
        </button>
      }
      footer={card}
    />
  );
}

function ConsentCard({ renewed, onAgree, firstCheck }: { renewed: boolean; onAgree: () => void; firstCheck: { current: HTMLInputElement | null } }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [adult, setAdult] = useState(false);
  const ok = terms && privacy && adult;
  const link = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noopener">
      {text}
    </a>
  );
  return (
    <section class="consent-card" id="consent" aria-labelledby="consent-title">
      <h2 id="consent-title">{renewed ? '利用規約などが改定されました' : '保護者の方へ：ご利用の前に'}</h2>
      <p>
        このアプリを使う前に、{link(TERMS_URL, '利用規約・免責事項')}と{link(PRIVACY_URL, 'プライバシーポリシー')}をお読みください。
        {renewed && '内容が改定されたため、改めて同意をお願いします。'}
      </p>
      <ul class="consent-points">
        <li>家系図のデータは、この端末のブラウザの中だけに保存されます。運営者はデータを受け取りません。</li>
        <li>
          書き出したファイルは、<strong>ご自身が管理する端末の間の移動と控えのためだけ</strong>に使えます。<strong>ご家族・ご親族を含め、ほかの人に渡すことは禁止</strong>しています。
        </li>
        <li>入力する親族の情報は、その方々の個人情報です。本人の意向に配慮して扱ってください。</li>
        <li>データはブラウザの削除などで消えることがあります。控えの書き出しをおすすめします。続柄の表示は公的な用途には使えません。</li>
        <li>お子さまが使うときは、保護者の方が見守ってください。詳しくは「{link(GUIDE_URL, '仕組みと注意')}」のページでお子さまと一緒に確認できます。</li>
      </ul>
      <div class="consent-checks">
        <label class="check">
          <input ref={firstCheck} type="checkbox" checked={terms} onChange={() => setTerms(!terms)} />
          利用規約・免責事項を読み、同意します
        </label>
        <label class="check">
          <input type="checkbox" checked={privacy} onChange={() => setPrivacy(!privacy)} />
          プライバシーポリシーを読みました
        </label>
        <label class="check">
          <input type="checkbox" checked={adult} onChange={() => setAdult(!adult)} />
          私は成人です（お子さまが使う場合は、その保護者として同意します）
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="primary" disabled={!ok} onClick={onAgree}>
          同意してはじめる
        </button>
      </div>
    </section>
  );
}
