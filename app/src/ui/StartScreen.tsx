// Shown while the family is empty: create the first person, try the sample, or load a JSON file.
export function StartScreen(props: { onNew: () => void; onSample: () => void; onImport: () => void; onAbout: () => void }) {
  return (
    <div class="start">
      <h1>かけいず</h1>
      <p>家族や親戚のつながりを、図にして見てみよう。</p>
      <div class="start-actions">
        <button type="button" class="primary" onClick={props.onNew}>
          あたらしく作る
        </button>
        <button type="button" onClick={props.onSample}>
          サンプルの家族で試す
        </button>
        <button type="button" onClick={props.onImport}>
          JSONファイルを読み込む
        </button>
      </div>
      <p class="hint">データはこのブラウザの中だけに保存され、どこにも送信されません。</p>
      <button type="button" class="link-button" onClick={props.onAbout}>
        このアプリについて
      </button>
    </div>
  );
}
