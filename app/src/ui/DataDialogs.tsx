// Caution dialogs for exporting / importing the family as a JSON file. The file holds the whole
// family unencrypted, so both actions require reading the notes and agreeing first.
import { useState } from 'preact/hooks';
import { GUIDE_URL, TERMS_URL } from '../legal';
import { Modal } from './Modal';

function GuideLink({ anchor, children }: { anchor?: string; children: string }) {
  return (
    <a href={anchor ? `${GUIDE_URL}#${anchor}` : GUIDE_URL} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

function Agree({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="check agree">
      <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
      上の注意を読み、利用規約（第5条）に従います
    </label>
  );
}

const TermsLink = ({ children }: { children: string }) => (
  <a href={TERMS_URL} target="_blank" rel="noopener">
    {children}
  </a>
);

export function ExportDialog({ onExport, onClose }: { onExport: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Modal title="JSONファイルに書き出す（控え）" onClose={onClose} wide>
      <div class="caution" role="note">
        <p class="caution-title">ちゅうい！</p>
        <p>
          この ファイルは、じぶんの パソコンや スマホに しまっておく「ひかえ」だよ。
          <br />
          <strong>かぞくでも、ほかの ひとに わたしては いけない</strong> やくそくだよ。
          <br />
          なまえや たんじょうびが そのまま はいっているから、おとなの ひとと いっしょに つかおう。
        </p>
        <p class="guide-link">
          <GuideLink>くわしい せつめい（しくみと ちゅうい）</GuideLink>を よんでね。
        </p>
      </div>
      <details class="adult-note" open>
        <summary>大人の方へ</summary>
        <ul>
          <li>
            書き出したファイルは、<strong>ご自身が管理する端末の間の移動と、控え（バックアップ）のためだけ</strong>に使えます。
            <TermsLink>利用規約</TermsLink>第5条により、<strong>ご家族・ご親族を含め、ほかの人に渡すこと、送ること、共有・公開することは禁止</strong>しています。
          </li>
          <li>
            ファイルには家系図のデータ（氏名・旧姓・呼び名・生年月日・没年月日・親子と婚姻の関係・呼び方の設定）が<strong>暗号化されずにそのまま</strong>入っています。メモ帳などで開けば誰でも読めます。
          </li>
          <li>
            保存先に注意してください。ダウンロードフォルダは設定によってクラウドに自動で同期されます。ほかの人も使うパソコンや、共有フォルダには置かないでください。
          </li>
          <li>
            ファイルは<strong>書き出した時点の「写し」</strong>です。あとで家系図を直しても中身は変わらないので、控えはときどき書き出し直してください。古い控えや不要になったファイルは削除してください。
          </li>
          <li>万一ファイルが人の手に渡ると、そのコピーは誰にも消せません。</li>
        </ul>
      </details>
      <Agree checked={agreed} onChange={setAgreed} />
      <div class="form-actions">
        <button
          type="button"
          class="primary"
          disabled={!agreed}
          onClick={() => {
            onExport();
            onClose();
          }}
        >
          書き出す
        </button>
      </div>
    </Modal>
  );
}

export function ImportDialog(props: { existingCount: number; onExportCurrent: () => void; onChooseFile: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Modal title="JSONファイルを読み込む（控えから戻す）" onClose={props.onClose} wide>
      <div class="caution" role="note">
        <p class="caution-title">ちゅうい！</p>
        <p>
          じぶんで かきだした ファイルだけを よみこもうね。
          <br />
          <strong>ほかの ひとから もらった ファイルは よみこまないでね</strong>。
          <br />
          よみこむと、いまの かけいずは きえて いれかわるよ。
        </p>
        <p class="guide-link">
          <GuideLink anchor="import">くわしい せつめい（よみこむ ときの ちゅうい）</GuideLink>を よんでね。
        </p>
      </div>
      <details class="adult-note" open>
        <summary>大人の方へ</summary>
        <ul>
          <li>
            読み込めるのは、<strong>ご自身が書き出したファイル</strong>だけです。ほかの人が作ったファイルを読み込むことは、<TermsLink>利用規約</TermsLink>第5条で禁止しています。
          </li>
          <li>
            読み込むと、このブラウザに保存されている家系図は<strong>丸ごと置き換わり、元に戻せません</strong>。先にいまの家系図を書き出しておいてください。
          </li>
          <li>ファイルはデータとして検査してから取り込みます。壊れたファイルや形式の違うファイルは読み込みません。</li>
          <li>読み込んだ後、不要になったファイルは削除してください。</li>
        </ul>
      </details>
      {props.existingCount > 0 && (
        <div class="confirm">
          <p>このブラウザにはいま家系図（{props.existingCount}人）があります。読み込むと置き換わります。</p>
          <button type="button" onClick={props.onExportCurrent}>
            いまの家系図を先に書き出す
          </button>
        </div>
      )}
      <Agree checked={agreed} onChange={setAgreed} />
      <div class="form-actions">
        <button
          type="button"
          class="primary"
          disabled={!agreed}
          onClick={() => {
            props.onChooseFile(); // must run in the click handler to open the file picker
            props.onClose();
          }}
        >
          ファイルを選ぶ
        </button>
      </div>
    </Modal>
  );
}
