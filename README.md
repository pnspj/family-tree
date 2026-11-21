# かけいず（family-tree）

子供に家族・親戚のつながりを教えるための、ブラウザだけで動く家系図エディタです。
データはブラウザ内（IndexedDB）にだけ保存され、外部には送信されません。

**▶ アプリを開く：https://pnspj.github.io/family-tree/**

インストールは不要で、パソコンやスマホのブラウザで開くだけで使えます。初回（と規約の改定時）は、保護者（成人）の方が利用規約・免責事項とプライバシーポリシーに同意してから使います。同意するまで、ブラウザのストレージには一切触れません。

## 主な機能

- **みる**：カードを押すと、その人から見た続柄に切り替わる。名前・続柄を隠して、1枚ずつめくる当てっこもできる
- **クイズ**：「〇〇から見て『おばあさん』はどの人？」「〇〇は〇〇の何？」に答えて得点を競う
- **へんしゅう**：人物の登録・編集、親・配偶者・子・きょうだいの追加、つながりの修正
- 表示文字の切り替え（かんじ／ふりがな／ひらがな）と、家庭ごとの呼び方（パパ・ばあば など）
- メニューで表示を切り替え：続柄、父方・母方、遠い関係の「〜の〜」表示、生年・年齢、性別の色、呼び名、旧姓
- 家系図のドラッグ・拡大縮小、矢印キー・Home・End でのカード移動
- 印刷（A4/A3、名前や続柄を空欄にした書きこみプリント）、SVG/PNG での保存
- JSON での書き出し・読み込み（自分の端末の間の移動と控えのためだけ。どちらも注意事項を読んで同意してから操作）
- 「このアプリについて」のページ（メニューまたは `#about`）：コンセプトと機能の紹介。見本の家族で続柄の切り替え・ひらがな表示・隠すクイズを試せる（保存しない）。初回はこのページの最下部で同意する
- [仕組みと注意のページ](app/public/guide.html)：アプリの仕組み、個人情報の守り方、ファイルの約束を、図とふりがな付きで説明（子供の学習教材にもなる）

## 構成

| ディレクトリ | 内容 |
|---|---|
| `app/` | アプリ本体（Vite + Preact + TypeScript）。`src/core` はデータ・続柄判定・編集操作、`src/layout` は配置計算、`src/ui` は画面 |
| `app/public/` | 静的ページ（仕組みと注意、利用規約、プライバシーポリシー）。`tools/` のスクリプトで生成 |
| `docs/` | 設計書（[データモデルと続柄マスター](docs/data-model.md)） |
| `tools/` | 静的ページの生成スクリプトと、「このアプリについて」で使う画像の撮影スクリプト |
| `.github/workflows/` | テスト・ビルドと GitHub Pages への公開 |

## 開発

Node.js 22 以上を使います。

```bash
cd app
npm install
npm run dev       # 開発サーバー
npm test          # テスト
npm run build     # 型チェックのうえ app/dist に出力
npm run preview   # ビルド結果をローカルで確認
```

| スクリプト | 用途 |
|---|---|
| [tools/build_guide.py](tools/build_guide.py) | 仕組みと注意のページ（`app/public/guide.html`）を生成：`python3 tools/build_guide.py` |
| [tools/build_legal.py](tools/build_legal.py) | 利用規約・プライバシーポリシーを生成：`python3 tools/build_legal.py` |
| [tools/capture_form.mjs](tools/capture_form.mjs) | 編集画面の画像（`app/src/assets/person-form.png`）を見本の家族から撮り直す（開発サーバーと Playwright が必要） |

## 公開

- GitHub Pages：[.github/workflows/deploy.yml](.github/workflows/deploy.yml) が main への push でテスト・ビルドして公開します（リポジトリ設定の Pages > Source は「GitHub Actions」）。
- main は保護されており、変更はプルリクエスト経由でマージします。PR ごとにテストとビルド（`build`）が走り、成功しないとマージできません。

## 利用規約・プライバシーポリシー・ライセンス

- [利用規約・免責事項](app/public/terms.html)、[プライバシーポリシー](app/public/privacy.html)：改定するときは、[tools/build_legal.py](tools/build_legal.py) の `VERSION` と [app/src/legal.ts](app/src/legal.ts) の `TERMS_VERSION` を同じ日付に上げてください（利用者に再同意を求めます。食い違いはテストで検出します）。
- 文面は一般的な内容をもとにした下書きです。広く公開する前に専門家の確認を受けることを想定しています。
- ソースコードは [MIT ライセンス](LICENSE) です。利用規約は、運営者が公開するアプリの利用に適用されます。

## 注意

書き出した家族データ（JSON）は個人情報です。リポジトリにはコミットしないでください（`.gitignore` で `family-tree-*.json` を除外しています）。
