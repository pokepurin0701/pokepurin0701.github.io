# 稼働中の全員応援集計

集計サーバーはAppDeployで公開済みです。

- URL: https://app-zlmhhw.v2.appdeploy.ai/
- App ID: app-zlmhhw
- ソース: appdeploy/（公開済みスナップショット）
- GitHub側の接続: assets/counter-bridge.mjs と assets/play.mjs

遊び場の「みんなで進める、ぽけ甘やかし計画」内の応援ボタンから参加します。個人用の「ぽけを褒める」は、個人のコインと実績を増やす別の遊びです。

## 保存と集計

全員の累計はサーバーの永続DBに保存します。日本時間で匿名コード1つにつき1日10回まで加算します。日次の10枠・送信レシート・全体カウンターを原子的に保存するので、同時送信や通信失敗後の再送でも同じ応援を二度加算しません。10回後もボタンの返答を楽しめます。

GitHubのブラウザ保存領域にランダムな256bitコードを保存し、決められたオリジンとフレームの組み合わせにだけpostMessageで渡します。DBはハッシュから参加者を識別し、氏名やメールアドレスを収集しません。ブラウザ保存が無効ならエラーを表示します。未確認の送信IDはページ再読み込み後も同じものを使います。

本人認証ではありません。コードを作り直すことで上限を回避する行為を完全には防ぎません。別ウィンドウの応援ページはGitHubと保存領域が異なるため、別コードになります。

## 公開先の更新

AppDeploy上のアプリを変更するときは、既存の app-zlmhhw を更新してください。SDKはAppDeployが注入します。GitHubにソースをコミットするだけではAppDeploy側は再デプロイされません。公開元スナップショットを読み取ってから編集・再デプロイし、このフォルダも同期してください。

GitHubのドメインを変えた場合、appdeploy/src/main.ts の hostOrigin と assets/counter-bridge.mjs の送信先を確認してください。

## 個人の進捗

訪問日数・称号・コレクションは引き続きブラウザ内保存です。この更新は全員企画の応援集計をサーバー保存するもので、個人進捗をサーバーへ移行しません。

worker.mjs / 0001_initial.sql / wrangler.jsonc は以前のCloudflare向け代替実装です。現在の集計には使用していません。

## みんなのクリスマスツリー

ツリーも既存のAppDeployアプリ `app-zlmhhw` に保存します。更新するファイルは `appdeploy/backend/index.ts`、`appdeploy/src/main.ts`、新規 `appdeploy/src/tree-bridge.ts` です。公開元スナップショットと差分を確認してから、既存アプリへフロントエンドとバックエンドをまとめて再デプロイしてください。別アプリやCloudflareの代替実装へ切り替える必要はありません。GitHubへのコミットだけでは共有APIは更新されません。

- `POST /api/tree/status`：`token` と任意の `before` カーソルを受け取り、今年の飾りを新しい順に最大100件、総数、次のカーソル、本人の今日の飾りを返します。
- `POST /api/tree/decorate`：`token`・`emoji`・`nickname`・確認済みの日本日付 `day` を受け取ります。12月限定で保存コードごとに1日1個。日付が変わった送信は409で拒否します。
- 公開する飾りは `id`・`day`・`emoji`・`nickname` のみ。保存コードと識別ハッシュは公開しません。ニックネームは入力した公開名で、本人認証ではありません。
- DBの `christmas_daily`（日次の一意な枠）・`christmas_entries`（共有の飾り）・`christmas_totals`（年ごとの件数）を一つのトランザクションで保存します。同時送信や結果不明時の再送でも二重登録しません。既存の応援テーブルはそのままです。

GitHub側は `?bridge=christmas` の専用iframeを通してSDKに接続します。フレームは既存の応援集計を実行しません。双方で送信元オリジンとウィンドウを照合します。公開ドメインを変える場合は `src/tree-bridge.ts` の `hostOrigin` と `assets/christmas-client.mjs` の接続先を確認してください。

ローカルの `tests/christmas-server.test.mjs` はSDKのDBを模したテストで、共有・同時送信・日本時間の境界・ページ送りを検証します。`tests/christmas-client.test.mjs` は通信元検証・再接続・既存集計の分離を検証します。本番のSDK・DB・公開先での確認は再デプロイ後に別途必要です。検証のために本番の飾りを書き込まないでください。
