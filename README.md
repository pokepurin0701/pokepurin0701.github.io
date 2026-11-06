# ぽけぷりんの公式サイト

トップページは提供された「ぽけの冷蔵庫」を使用しています。埋め込み画像は内容を変えず assets/fridge/ に分離しています。

右下の「ぽけの遊び場へ」から、日替わりコンテンツ、訪問日数による変化、隠し実績などを遊べます。直接の入口は play.html です。

進捗はブラウザ内保存で動きます。全員の応援集計・サーバー保存には [server/README.md](server/README.md) の追加設定が必要です。

## 確認

```sh
node tests/core.test.mjs
node tests/server.test.mjs
node --check assets/play.mjs
node --check server/worker.mjs
```

画像・リンクはHTTP配信で確認してください。旧トップページは original.html に保存しています。
