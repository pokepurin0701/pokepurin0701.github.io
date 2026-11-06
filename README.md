# ぽけぷりんの公式サイト

トップページは提供された「ぽけの冷蔵庫」を使用しています。埋め込み画像は内容を変えず assets/fridge/ に分離しています。

右下の「ぽけの遊び場へ」から、日替わりコンテンツ、訪問日数による変化、隠し実績などを遊べます。直接の入口は play.html です。

個人の進捗はブラウザ内に保存します。全員の応援集計はサーバーへ接続済みです。遊び場の企画欄から参加できます。[集計ページ](https://app-zlmhhw.v2.appdeploy.ai/) / [実装と保存方法](server/README.md)

## 確認

```sh
node tests/core.test.mjs
node tests/server.test.mjs
node tests/counter.test.mjs
node --check assets/play.mjs
node --check server/worker.mjs
```

画像・リンクはHTTP配信で確認してください。旧トップページは original.html に保存しています。
