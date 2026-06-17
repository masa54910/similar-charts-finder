# Similar Charts Finder

Next.js App Router 版の本番環境用スターターです。

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## Vercel公開

```bash
git init
git add .
git commit -m "initial similar charts finder"
git branch -M master
git remote add origin <GitHubのURL>
git push -u origin master
```

その後、VercelでGitHubリポジトリをImportしてください。

## 実装済み

- Apple風の白基調UI
- タイトル：Similar Charts Finder
- SL OFF削除済み
- 下段の四角デザイン削除済み
- 類似ランキング上位5件
- ランキング番号は半透明四角背景＋黒字
- 時間足：1分 / 5分 / 15分 / 30分 / 1時間
- 全時間足を横断検索するUI
- チャートをドラッグで上下左右移動
- マウスホイールで拡大縮小
- 未来予測側にもEMA25/75/200/600を表示
