# かけいず（family-tree）

子供に家族・親戚のつながりを教えるための、ブラウザだけで動く家系図エディタです。
データはブラウザ内（IndexedDB）にだけ保存され、外部には送信されません。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `app/` | 本番アプリ（Vite + Preact + TypeScript） |
| `docs/` | 設計書（[データモデルと続柄マスター](docs/data-model.md)） |
| `proto/` | レイアウト方式の比較プロトタイプ（参考用） |

## 開発

```bash
cd app
npm install
npm run dev     # 開発サーバー
npm test        # テスト
npm run build   # app/dist に出力
```

## 公開

- GitHub Pages：`.github/workflows/deploy.yml` が main への push でビルド・公開します（リポジトリ設定の Pages > Source を「GitHub Actions」にする）。
- Cloudflare Pages：ビルドコマンド `npm run build`、ルートディレクトリ `app`、出力先 `dist`。

## 注意

書き出した家族データ（JSON）は個人情報です。リポジトリにはコミットしないでください（`.gitignore` で `family-tree-*.json` を除外しています）。
