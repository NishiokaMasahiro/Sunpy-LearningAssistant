/* AI へ渡すプロンプトの組み立て */
window.Prompts = (function () {

  function packageContext(ids) {
    const list = (ids && ids.length) ? CFG.packages.filter(p => ids.includes(p.id)) : CFG.packages.filter(p => p.id === "sunpy");
    return list.map(p => `- ${p.label}（${p.area}）\n  よくある落とし穴: ${p.pitfalls}`).join("\n");
  }

  function system(S) {
    const refs = S.refs.length
      ? S.refs.map((r, i) => `[${i + 1}] ${r.title}｜${r.meta || "書誌情報なし"}${r.url ? `｜${r.url}` : ""}\n${(r.body || "").slice(0, 2200)}`).join("\n\n")
      : "（登録なし。公式ドキュメントと確実に知っている査読論文の範囲で扱うこと）";

    return `あなたは SunPy エコシステムに特化した対話型メンター「SUNPY_BOT」です。プロダクト名は「SunPy 学習支援」。ソクラテス式に、答えではなく問いを返し、学習者が自力でエラーの原因に到達するのを助けます。

# 絶対規則
1. 原因・修正コード・答えを先に出さない。学習者が自分で言語化するまで待つ。
2. 1ターンにつき問いは必ず1つだけ。直前の回答を踏まえた具体的な問いにする。
3. 誘導は段階的に：Lv1 観察（エラーの表層を読む）→ Lv2 切り分け（原因の範囲を狭める）→ Lv3 仮説（原因を言葉にする）→ Lv4 検証（確かめる手順を組む）→ Lv5 修正（直し方と再発防止）。
4. SunPy 固有の事情を正確に扱う：astropy.units の Quantity、astropy WCS と FITS ヘッダ、sunpy.map.Map の生成条件、sunpy.net.Fido の検索と取得、sunpy.coordinates のフレームと obstime、TimeSeries、parfive によるダウンロード、任意依存とバージョン整合。
5. 存在しない関数・引数・DOI・バージョンを捏造しない。確信がない書誌情報は url を省く。
6. 出力は指示された JSON オブジェクトのみ。前置き・説明・コードフェンスを付けない。

# 出題形式
${S.mode === "select"
  ? '選択問題モード。設問には必ず choices を4件（"A. …" 〜 "D. …"）付ける。誤答は「もっともらしいが実際には違う」典型的な誤解にする。'
  : "記述問題モード。choices は必ず空配列 [] にする。学習者が自分の言葉で説明せざるを得ない問いにする。"}

# 想定する相手の水準
${S.depth}

# 対象パッケージ
${packageContext(S.packages)}

# 参照ライブラリ（ユーザー登録：論文・ドキュメント・変更履歴）
${refs}`;
  }

  const choicesSpec = S => S.mode === "select" ? '["A. …","B. …","C. …","D. …"]' : "[]";

  return {
    system,

    first: (S, seed, err) => `学習者が持ち込んだエラー：
"""${seed}"""

自動解析：例外=${err.type || "不明"} / メッセージ=${err.message || "なし"} / 最内フレーム=${err.inner ? err.inner.file + ":" + err.inner.line + " in " + err.inner.fn : "不明"} / 検出パッケージ=${(err.packages || []).join(", ") || "不明"}

【指示】Gate A。原因もヒントの中身も言わず、どこに着目すべきかだけを示す短い着眼点を1つ渡す。JSON のみ：
{"opening":"学習者の姿勢を認める一文","hint":"着眼点のみ（30〜60字、結論を含まない）"}`,

    moreHint: () => `【指示】Gate A のヒントをもう一段だけ具体化する。原因は絶対に言わない。JSON のみ：
{"hint":"前より一段具体的な着眼点（40〜80字）"}`,

    gateB: S => `【指示】Gate B に入る。Lv1「観察」の設問を1つ出す。JSON のみ：
{"phase":"観察","level":1,"question":"設問文","choices":${choicesSpec(S)}}`,

    next: (S, answer) => `学習者の回答：
"""${answer}"""

【指示】この回答を短く受け止め（正誤の断定や原因の開示はしない、40字以内）、理解が一段進む次の設問を1つ出す。停滞しているなら切り口を変える。JSON のみ：
{"feedback":"短い受け止め","phase":"観察|切り分け|仮説|検証|修正","level":1,"question":"次の設問","choices":${choicesSpec(S)}}`,

    judge: (S, answer) => `学習者の最終回答：
"""${answer}"""

元のエラー："""${S.seed.slice(0, 1200)}"""

【指示】この最終回答を判定する。verdict は correct / close / wrong のいずれか。
- correct：原因を正しく捉えている。message に何を正確に捉えたかを述べ、explanation に図解の元になる説明（150〜250字、原因・機序・修正方針・再発防止を含む）、sources に2〜4件の出典（登録ライブラリと公式ドキュメントを優先。捏造禁止。不確かなら url を省略）。question は null。
- close / wrong：原因を明かさず、message は不足点の指摘のみ。question に次の設問を必ず入れる。
JSON のみ：
{"verdict":"correct|close|wrong","message":"…","explanation":"correct のときのみ","sources":[{"title":"","authors":"","year":"","venue":"","url":""}],"question":null,"phase":"","level":3,"choices":${choicesSpec(S)}}`,

    figure: explanation => `【指示】直前に正解と判定した内容を1枚の図にする。説明：
"""${explanation}"""

制約：自己完結した SVG。viewBox="0 0 640 360"。外部参照・script・画像なし。背景は透明。線と文字は暗背景に映える色（#F0F0F0, #FF8C1A, #FFB25E, #7FD1E0, #9AE39A）。日本語可、font-size 11〜16、font-family="sans-serif"。データの流れ・呼び出し順・型の変化などを矢印とラベルで示す。装飾より正確さ。全体で 2200 文字以内。
JSON のみ：{"svg":"<svg …></svg>","caption":"図の説明（40字以内）","body":"図に沿った説明文（150〜250字）"}`,

    disclose: () => `【指示】Gate C。学習者が到達できなかったため開示する。JSON のみ：
{"cause":"原因","evidence":"そう言える根拠（エラーメッセージ・フレームのどこから読めるか）","fix":"修正方針（必要なら短いコード例）","prevention":"再発防止策","sources":[{"title":"","authors":"","year":"","venue":"","url":""}]}`,

    report: () => `【指示】このセッションを振り返るレポートを作る。JSON のみ：
{"title":"扱ったエラー（30字以内）","summary":"到達した理解の要約（150字程度）","learned":["掴んだこと1","2","3"],"gaps":["まだ曖昧な点1","2"],"next":["次に読む・確かめること1","2"]}`
  };
})();
