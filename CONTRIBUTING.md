# 貢献のしかた

ビルド環境は不要です。`index.html` をブラウザで開けば動きます（`python -m http.server` 推奨）。

## いちばん歓迎される貢献：落とし穴の追加

設問の質は `assets/js/config.js` の `packages[].pitfalls` に依存します。実際に踏んだエラーとその原因を、1 行の日本語で足してください。

```js
{ id: "aiapy", label: "aiapy", area: "…",
  detect: ["aiapy"],
  pitfalls: "…, ここに追記" }
```

新しいパッケージを足す場合は `detect` に import 名や traceback に現れる文字列を入れます。判定は小文字化した部分一致です。

## プロンプトを変えるとき

`assets/js/prompts.js` の 6 つの絶対規則は、このツールの性格そのものです。変更する場合は理由を PR に書いてください。JSON スキーマを変えたときは `assets/js/app.js` の描画側も合わせて更新が必要です。

## 提出前に

```bash
node --check assets/js/*.js
node tools/build-standalone.mjs
```

`dist/index.html` は生成物です。手で編集せず、必ずビルドし直してコミットしてください。

## 動作確認の目安

- 選択問題・記述問題の両方でセッションを最後まで通せるか
- 「原因が分かった」で 正解 / あと一歩 / 違います の 3 分岐が出るか
- 正解時に図と出典が表示されるか
- マスキング確認カードが出るか（メールアドレスを含むトレースバックで確認）
- 画面幅 880px 以下でも操作できるか
