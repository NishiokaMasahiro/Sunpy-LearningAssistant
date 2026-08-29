/* SunPy 学習支援 — 対話の進行 */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const log = () => $("#log"), wrap = () => $("#wrap"), input = () => $("#input");

  const S = {
    id: null, started: false, mode: "select", depth: "実務（研究で日常的に使う）",
    packages: [], gate: "A", level: 0, hintsUsed: 0,
    history: [], seed: "", err: null, result: null, reportTitle: "",
    refs: [], useWeb: false, awaitingAnswer: false, busy: false, sessions: []
  };
  window.S = S;

  /* ---------- 表示ユーティリティ ---------- */
  const now = () => new Date().toTimeString().slice(0, 5);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const scrollDown = () => requestAnimationFrame(() => { log().scrollTop = log().scrollHeight; });

  function cleanSVG(s) {
    if (!s || !/^\s*<svg/i.test(s)) return "";
    return s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  }

  function paintProgress() {
    $("#prog").innerHTML = CFG.levels.map((l, i) =>
      `<div class="step ${i < S.level ? "on" : ""}"><b>Lv${l.n} ${l.name}</b><i></i><span>${l.desc}</span></div>`).join("");
    $("#crumbGate").textContent = "Gate " + S.gate;
    $("#crumbMode").textContent = S.mode === "select" ? "選択問題" : "記述問題";
  }

  function sourcesHTML(list) {
    if (!list || !list.length) return "";
    return `<div class="src"><h4>出典</h4><ol>${list.map(s => {
      const t = esc(s.title || ""), m = [s.authors, s.year, s.venue].filter(Boolean).map(esc).join(", ");
      return `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${t}</a>` : t}${m ? " — " + m : ""}</li>`;
    }).join("")}</ol></div>`;
  }

  const ACT = {
    toQuestions: startGateB,
    hint: moreHint,
    disclose: disclose,
    know: () => setAnswerMode(true),
    report: openReport,
    sendMasked: () => { const p = S.pending; S.pending = null; if (p) firstTurn(p.masked); },
    sendRaw: () => { const p = S.pending; S.pending = null; if (p) firstTurn(p.raw); }
  };

  function addBot(o) {
    const el = document.createElement("div");
    el.className = "turn";
    const badge = o.badge ? `<span class="badge">${esc(o.badge)}</span>` : "";
    const choices = (o.choices && o.choices.length)
      ? `<div class="choices">${o.choices.map((c, i) => `<button class="choice" data-c="${i}">${esc(c)}</button>`).join("")}</div>` : "";
    const acts = (o.acts && o.acts.length)
      ? `<div class="acts">${o.acts.map(a => `<button class="btn ${a.solid ? "solid" : ""} ${a.ghost ? "ghost" : ""}" data-a="${a.id}">${esc(a.label)}</button>`).join("")}${o.stars ? `<span class="stars">${esc(o.stars)}</span>` : ""}</div>`
      : (o.stars ? `<div class="acts"><span class="stars">${esc(o.stars)}</span></div>` : "");
    el.innerHTML = `<div class="bot ${o.tone || ""}">
      <div class="meta"><span class="name">SUNPY_BOT (AI MENTOR)</span>${badge}<span class="time">${now()}</span></div>
      ${o.title ? `<p class="q">${esc(o.title)}</p>` : ""}
      ${o.text ? `<p class="sub">${esc(o.text)}</p>` : ""}
      ${o.html || ""}${choices}${sourcesHTML(o.sources)}${acts}</div>`;
    wrap().appendChild(el);
    el.querySelectorAll(".choice").forEach(b => b.addEventListener("click", () => {
      el.querySelectorAll(".choice").forEach(x => { x.disabled = true; });
      b.classList.add("picked");
      submit(o.choices[+b.dataset.c]);
    }));
    bindActs(el);
    scrollDown();
    return el;
  }

  function bindActs(root) {
    root.querySelectorAll("[data-a]").forEach(b => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.addEventListener("click", () => { const f = ACT[b.dataset.a]; if (f) f(); });
    });
  }

  function addUser(text, isCode) {
    const el = document.createElement("div");
    el.className = "turn user";
    el.innerHTML = `<div class="meta"><span class="name">YOU</span><span class="time">${now()}</span></div>` +
      (isCode ? `<pre>${esc(text)}</pre>` : `<div>${esc(text)}</div>`);
    wrap().appendChild(el);
    scrollDown();
  }

  function thinking(msg) {
    const el = document.createElement("div");
    el.className = "turn";
    el.innerHTML = `<div class="bot plain"><div class="meta"><span class="name">SUNPY_BOT (AI MENTOR)</span><span class="time">${now()}</span></div>
      <p class="sub" style="margin:0">${esc(msg)} <span class="dots"><i></i><i></i><i></i></span></p></div>`;
    wrap().appendChild(el); scrollDown();
    return el;
  }

  function errCardHTML(e) {
    const pkgs = (e.packages || []).map(id => {
      const p = CFG.packages.find(x => x.id === id);
      return `<span class="pill">${esc(p ? p.label : id)}</span>`;
    }).join("");
    const frames = (e.frames || []).slice(-4).map(f =>
      `<div>${esc(Analyzer.shortFile(f.file))}:${f.line} in ${esc(f.fn)}</div>`).join("");
    return `<div class="errcard">
      <div class="head"><span class="etype">${esc(e.type || "Exception")}</span><span class="pkgs">${pkgs}</span></div>
      ${e.message ? `<div class="emsg">${esc(e.message)}</div>` : ""}
      ${frames ? `<div class="frames">${frames}</div>` : ""}</div>`;
  }

  /* ---------- API ラッパ ---------- */
  async function ask(userText, opts) {
    const messages = S.history.concat([{ role: "user", content: userText }]);
    const r = await API.send({ system: Prompts.system(S), messages, useWeb: (opts && opts.web && S.useWeb) });
    S.history = messages.concat([{ role: "assistant", content: r.text }]);
    if (S.history.length > 24) S.history = S.history.slice(-24);
    return r;
  }

  function setBusy(b) {
    S.busy = b;
    $("#send").disabled = b;
    const t = $("#status");
    t.textContent = b ? "AI: 思考中" : (S.started ? "AI: オンライン" : "AI: 待機中");
    t.className = "status " + (b ? "busy" : (S.started ? "live" : ""));
  }

  function setAnswerMode(on) {
    S.awaitingAnswer = on;
    $("#box").classList.toggle("answer", on);
    $("#state").classList.toggle("answer", on);
    $("#state").textContent = on ? "原因を記述 — 判定します" : "設問への回答を入力";
    input().placeholder = on ? "たどり着いた原因を、根拠とともに書いてください…" : "回答を入力…";
    $("#btnKnow").hidden = on || !S.started;
    $("#btnCancel").hidden = !on;
    input().focus();
  }

  function fail(e) {
    addBot({
      tone: "err", title: "AI に接続できませんでした。",
      text: e.message + "\n\nGitHub Pages やローカルで動かしている場合は、右上の「設定」で Anthropic API キーを登録してください。同じ内容をもう一度送信すると再試行します。"
    });
  }

  /* ---------- セットアップ画面 ---------- */
  function showSetup() {
    wrap().innerHTML = "";
    const el = document.createElement("div");
    el.className = "turn";
    el.innerHTML = `<div class="setup">
      <h2>SunPy 学習支援へようこそ。</h2>
      <p class="lead">ここは答えを渡す場所ではありません。あなたが自分でエラーの原因にたどり着くまで、私は問いを返し続けます。sunpy 本体に加えて aiapy・irispy・xrtpy などの関連パッケージにも対応します。</p>
      <div class="field">
        <label>出題形式</label>
        <div class="opts">
          <button class="opt on" data-m="select"><b>選択問題</b><span>4択で切り分ける。デバッグの型を掴みたいとき。</span></button>
          <button class="opt" data-m="free"><b>記述問題</b><span>自分の言葉で説明する。理解の穴が見える。</span></button>
        </div>
      </div>
      <div class="field">
        <label>対象パッケージ（未選択ならエラー本文から自動判定）</label>
        <div class="chips" id="pkgChips">${CFG.packages.filter(p => p.id !== "other").map(p =>
          `<button class="chip" data-p="${p.id}">${esc(p.label)}</button>`).join("")}</div>
      </div>
      <div class="field">
        <label>想定水準</label>
        <select id="depth">
          <option>入門（Python は書けるが SunPy は初めて）</option>
          <option selected>実務（研究で日常的に使う）</option>
          <option>上級（内部実装や貢献も視野）</option>
        </select>
      </div>
      <p class="note">はじめの一歩 ─ 下の入力欄に、エラーの全文（トレースバック）・該当コード・あなたの仮説を貼り付けてください。送信前にマスキング結果を表示します。</p>
    </div>`;
    wrap().appendChild(el);
    el.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
      el.querySelectorAll(".opt").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); S.mode = b.dataset.m; paintProgress();
    }));
    el.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
      b.classList.toggle("on");
      S.packages = Array.from(el.querySelectorAll(".chip.on")).map(x => x.dataset.p);
    }));
    el.querySelector("#depth").addEventListener("change", e => { S.depth = e.target.value; });
    paintProgress();
  }

  /* ---------- 送信 ---------- */
  function submit(text) {
    if (S.busy) return;
    const t = (text === undefined ? input().value : text).trim();
    if (!t) return;
    if (text === undefined) { input().value = ""; input().style.height = "auto"; }
    if (!S.started) return prepareFirst(t);
    addUser(t, false);
    if (S.awaitingAnswer) return judge(t);
    return nextTurn(t);
  }

  /* 送信前マスキング確認 */
  function prepareFirst(raw) {
    const m = Analyzer.mask(raw);
    if (!m.count) return firstTurn(raw);
    S.pending = { raw, masked: m.text };
    addBot({
      tone: "plain", badge: "送信前の確認", title: "個人情報らしき箇所をマスキングしました。",
      text: m.hits.map(h => `${h.name} × ${h.count}`).join(" / "),
      html: `<pre class="block">${esc(m.text)}</pre>`,
      acts: [{ id: "sendMasked", label: "この内容で送信", solid: true }, { id: "sendRaw", label: "元のまま送信", ghost: true }]
    });
  }

  async function firstTurn(seed) {
    S.started = true; S.seed = seed; S.id = "s" + Date.now();
    S.gate = "A"; S.level = 0; S.hintsUsed = 0; S.history = []; S.result = null;
    const err = Analyzer.parse(seed);
    S.err = err;
    if (!S.packages.length && err.packages.length) S.packages = err.packages;
    addUser(seed, true);
    if (err.type || err.frames.length) addBot({ tone: "plain", badge: "自動解析", title: "受け取ったエラーの構造", html: errCardHTML(err) });
    paintProgress();
    $("#state").textContent = "設問への回答を入力";
    $("#btnKnow").hidden = false; $("#btnHint").hidden = false;

    const th = thinking("エラーを読んでいます");
    setBusy(true);
    try {
      const { json } = await ask(Prompts.first(S, seed, err), { web: true });
      th.remove();
      addBot({
        tone: "hint", badge: "GATE A", title: (json && json.opening) || "エラーを直視し、学びを得る準備ができましたね。",
        text: "まず、着眼点だけをお渡しします。答えは言いません。",
        acts: [{ id: "toQuestions", label: "設問に進む", solid: true }, { id: "hint", label: "もう一段ヒント" }]
      });
      if (json && json.hint) addBot({ tone: "hint", badge: "HINT 1", title: json.hint });
    } catch (e) { th.remove(); fail(e); }
    setBusy(false); save();
  }

  async function moreHint() {
    if (S.busy || !S.started) return;
    S.hintsUsed++;
    const th = thinking("ヒントを一段深めています");
    setBusy(true);
    try {
      const { json } = await ask(Prompts.moreHint());
      th.remove();
      addBot({
        tone: "hint", badge: "HINT " + (S.hintsUsed + 1),
        title: (json && json.hint) || "（ヒントを取得できませんでした）",
        acts: [{ id: "toQuestions", label: "設問に進む", solid: true }, { id: "hint", label: "もう一段ヒント" }]
      });
    } catch (e) { th.remove(); fail(e); }
    setBusy(false); save();
  }

  async function startGateB() {
    if (S.busy) return;
    S.gate = "B"; S.level = Math.max(S.level, 1); paintProgress();
    const th = thinking("Lv1 観察の設問を作成中");
    setBusy(true);
    try {
      const { json } = await ask(Prompts.gateB(S));
      th.remove(); renderQuestion(json);
    } catch (e) { th.remove(); fail(e); }
    setBusy(false); save();
  }

  function renderQuestion(j) {
    if (!j || !j.question) {
      return addBot({ tone: "err", title: "設問を組み立てられませんでした。", text: "もう一度送信すると再試行します。" });
    }
    const lvl = Math.max(1, Math.min(5, +j.level || S.level || 1));
    S.level = Math.max(S.level, lvl); paintProgress();
    addBot({
      badge: `Lv${lvl} ${j.phase || CFG.levels[lvl - 1].name}`,
      title: j.question,
      text: S.mode === "select" ? "選択問題（Gate B）" : "記述問題（Gate B）— あなたの言葉で説明してください。",
      choices: S.mode === "select" ? (j.choices || []) : null,
      acts: [{ id: "know", label: "原因が分かった" }, { id: "disclose", label: "わからない（開示）", ghost: true }]
    });
  }

  async function nextTurn(answer) {
    const th = thinking("回答を検討しています");
    setBusy(true);
    try {
      const { json } = await ask(Prompts.next(S, answer));
      th.remove();
      if (json && json.feedback) addBot({ tone: "plain", badge: "RESPONSE", title: json.feedback });
      renderQuestion(json);
    } catch (e) { th.remove(); fail(e); }
    setBusy(false); save();
  }

  async function judge(answer) {
    setAnswerMode(false);
    const th = thinking("あなたの回答を判定しています");
    setBusy(true);
    try {
      const { json } = await ask(Prompts.judge(S, answer), { web: true });
      th.remove();
      const v = (json && json.verdict) || "close";
      if (v === "correct") {
        S.level = 5; paintProgress();
        const stars = S.gate === "C" ? "★☆☆ 開示による解決" : (S.gate === "B" ? "★★☆ 誘導ありで到達" : "★★★ 自力解決");
        const card = addBot({
          tone: "correct", badge: "VERDICT", title: "正解です。",
          text: (json && json.message) || "", sources: json && json.sources,
          acts: [{ id: "report", label: "レポートを表示", solid: true }], stars
        });
        S.result = { verdict: "correct", stars, message: json && json.message, sources: (json && json.sources) || [], answer };
        drawFigure((json && json.explanation) || (json && json.message) || "", card);
      } else if (v === "close") {
        addBot({ tone: "close", badge: "VERDICT", title: "あと一歩です。", text: (json && json.message) || "" });
        renderQuestion(json && json.question ? { question: json.question, level: json.level, phase: json.phase, choices: json.choices } : null);
      } else {
        addBot({ tone: "wrong", badge: "VERDICT", title: "違います。", text: (json && json.message) || "" });
        renderQuestion(json && json.question ? { question: json.question, level: json.level, phase: json.phase, choices: json.choices } : null);
      }
    } catch (e) { th.remove(); fail(e); }
    setBusy(false); save();
  }

  async function drawFigure(explanation, card) {
    const holder = document.createElement("div");
    holder.innerHTML = `<p class="sub">図を作成しています <span class="dots"><i></i><i></i><i></i></span></p>`;
    card.querySelector(".bot").appendChild(holder);
    try {
      const { json } = await ask(Prompts.figure(explanation));
      holder.remove();
      const svg = cleanSVG(json && json.svg);
      const box = document.createElement("div");
      box.innerHTML = `${json && json.body ? `<p class="sub">${esc(json.body)}</p>` : ""}
        ${svg ? `<div class="figure">${svg}<div class="figcap">図 ─ ${esc((json && json.caption) || "説明図")}</div></div>`
              : `<p class="sub">図を生成できませんでした。出典の一次資料を参照してください。</p>`}`;
      const acts = card.querySelector(".acts");
      card.querySelector(".bot").insertBefore(box, acts || null);
      if (S.result) S.result.figureBody = (json && json.body) || "";
      scrollDown();
    } catch (e) {
      holder.innerHTML = `<p class="sub">図の生成に失敗しました。</p>`;
    }
    save();
  }

  async function disclose() {
    if (S.busy) return;
    S.gate = "C"; paintProgress();
    const th = thinking("開示を準備しています");
    setBusy(true);
    try {
      const { json } = await ask(Prompts.disclose(), { web: true });
      th.remove();
      const j = json || {};
      const card = addBot({
        badge: "GATE C 開示", title: j.cause || "（開示を取得できませんでした）",
        text: [j.evidence && "根拠： " + j.evidence, j.fix && "修正方針： " + j.fix, j.prevention && "再発防止： " + j.prevention].filter(Boolean).join("\n\n"),
        sources: j.sources, acts: [{ id: "report", label: "レポートを表示", solid: true }], stars: "★☆☆ 開示による解決"
      });
      S.result = { verdict: "disclosed", stars: "★☆☆ 開示による解決", message: j.evidence, sources: j.sources || [], answer: j.cause };
      drawFigure([j.cause, j.evidence, j.fix].filter(Boolean).join(" / "), card);
    } catch (e) { th.remove(); fail(e); }
    setBusy(false); save();
  }

  /* ---------- レポート ---------- */
  async function openReport() {
    if (!S.started) return;
    const b = $("#reportBody");
    $("#veilReport").classList.add("open");
    b.innerHTML = `<p class="sub">レポートを生成しています <span class="dots"><i></i><i></i><i></i></span></p>`;
    try {
      const { json } = await ask(Prompts.report());
      const j = json || {};
      S.reportTitle = j.title || (S.err && S.err.type) || S.seed.slice(0, 30);
      b.innerHTML = `
        <p class="q" style="margin-top:0">${esc(S.reportTitle)}</p>
        <div class="acts"><span class="stars">${esc((S.result && S.result.stars) || "—")}</span>
          <span class="badge">Gate ${esc(S.gate)}</span>
          <span class="badge">ヒント ${S.hintsUsed} 回</span>
          <span class="badge">${S.mode === "select" ? "選択問題" : "記述問題"}</span>
          <span class="badge">${esc(S.packages.join(", ") || "sunpy")}</span></div>
        <h4>到達した理解</h4><p class="sub">${esc(j.summary || (S.result && S.result.message) || "")}</p>
        ${(j.learned || []).length ? `<h4>掴んだこと</h4><ul>${j.learned.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${(j.gaps || []).length ? `<h4>まだ曖昧なところ</h4><ul>${j.gaps.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${(j.next || []).length ? `<h4>次の一歩</h4><ul>${j.next.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${sourcesHTML(S.result && S.result.sources)}`;
      save();
    } catch (e) {
      b.innerHTML = `<p class="sub">レポートを生成できませんでした。${esc(e.message)}</p>`;
    }
  }

  /* ---------- 参照ライブラリ ---------- */
  function paintRefs() {
    $("#refCount").textContent = S.refs.length || "";
    const l = $("#refList");
    l.innerHTML = S.refs.length ? S.refs.map((r, i) => `
      <div class="item"><div><b>${esc(r.title)}</b><p>${esc(r.meta || "")}${r.url ? " · " + esc(r.url) : ""}</p></div>
      <button class="del" data-d="${i}">削除</button></div>`).join("")
      : `<p class="sub" style="margin:0">まだ登録がありません。論文のアブストラクト、公式ドキュメントの該当節、変更履歴（CHANGELOG）などを貼り付けると、以降の設問と出典がその内容に沿います。</p>`;
    l.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
      S.refs.splice(+b.dataset.d, 1); Store.set("sunpy_la:refs", S.refs); paintRefs();
    }));
  }

  /* ---------- セッション ---------- */
  async function save() {
    if (!S.id) return;
    const list = (await Store.get("sunpy_la:sessions")) || [];
    const rec = {
      id: S.id, title: S.reportTitle || (S.err && S.err.type) || S.seed.slice(0, 34),
      date: new Date().toLocaleDateString("ja-JP"),
      stars: (S.result && S.result.stars) || "", gate: S.gate, mode: S.mode, depth: S.depth,
      packages: S.packages, seed: S.seed, err: S.err, level: S.level, hintsUsed: S.hintsUsed,
      history: S.history, html: wrap().innerHTML, result: S.result
    };
    const i = list.findIndex(x => x.id === S.id);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    S.sessions = list.slice(0, 30);
    await Store.set("sunpy_la:sessions", S.sessions);
    paintSessions();
  }

  function paintSessions() {
    const box = $("#sessions");
    box.innerHTML = (S.sessions || []).length ? S.sessions.map(s =>
      `<button class="link" data-s="${s.id}">${esc(s.title || "無題")}<span class="sub">${esc(s.date)} · Gate ${esc(s.gate)} ${esc(s.stars.slice(0, 3))}</span></button>`).join("")
      : `<p class="note" style="padding:0 20px">履歴はまだありません</p>`;
    box.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", () => loadSession(b.dataset.s)));
  }

  function loadSession(id) {
    const s = (S.sessions || []).find(x => x.id === id);
    if (!s) return;
    Object.assign(S, {
      id: s.id, started: true, mode: s.mode, depth: s.depth, gate: s.gate, level: s.level,
      hintsUsed: s.hintsUsed, history: s.history || [], seed: s.seed, err: s.err,
      packages: s.packages || [], result: s.result, awaitingAnswer: false
    });
    wrap().innerHTML = s.html;
    wrap().querySelectorAll(".choice").forEach(b => { b.disabled = true; });
    bindActs(wrap());
    paintProgress(); setAnswerMode(false);
    $("#btnKnow").hidden = false; $("#btnHint").hidden = false;
    setBusy(false); scrollDown();
  }

  function newSession() {
    Object.assign(S, {
      id: null, started: false, gate: "A", level: 0, hintsUsed: 0, history: [],
      result: null, seed: "", err: null, packages: [], awaitingAnswer: false, reportTitle: ""
    });
    setAnswerMode(false);
    $("#btnKnow").hidden = true; $("#btnHint").hidden = true;
    $("#state").textContent = "エラー全文・コード・仮説を入力";
    input().placeholder = "トレースバックを貼り付けてください…";
    setBusy(false); showSetup();
  }

  /* ---------- 起動 ---------- */
  function wire() {
    $("#send").addEventListener("click", () => submit());
    input().addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
      else if (e.key === "Enter" && !e.shiftKey && input().value.length < 120 && !input().value.includes("\n")) { e.preventDefault(); submit(); }
    });
    input().addEventListener("input", () => {
      input().style.height = "auto";
      input().style.height = Math.min(input().scrollHeight, 220) + "px";
    });
    $("#btnKnow").addEventListener("click", () => setAnswerMode(true));
    $("#btnCancel").addEventListener("click", () => setAnswerMode(false));
    $("#btnHint").addEventListener("click", moreHint);
    document.querySelectorAll("[data-new]").forEach(b => b.addEventListener("click", newSession));
    document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.open;
      if (id === "veilRefs") paintRefs();
      if (id === "veilReport") { openReport(); return; }
      $("#" + id).classList.add("open");
    }));
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => $("#" + b.dataset.close).classList.remove("open")));
    document.querySelectorAll(".veil").forEach(v => v.addEventListener("click", e => { if (e.target === v) v.classList.remove("open"); }));
    document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".veil.open").forEach(v => v.classList.remove("open")); });

    $("#refAdd").addEventListener("click", () => {
      const t = $("#rTitle").value.trim(); if (!t) return;
      S.refs.unshift({ title: t, meta: $("#rMeta").value.trim(), url: $("#rUrl").value.trim(), body: $("#rBody").value.trim() });
      ["#rTitle", "#rMeta", "#rUrl", "#rBody"].forEach(s => { $(s).value = ""; });
      Store.set("sunpy_la:refs", S.refs); paintRefs();
    });
    $("#useWeb").addEventListener("change", e => { S.useWeb = e.target.checked; Store.set("sunpy_la:useweb", S.useWeb); });
    $("#keySave").addEventListener("click", () => {
      Store.setKey($("#apiKey").value.trim());
      $("#keyState").textContent = Store.getKey() ? "保存しました（このブラウザのみ）" : "キーを削除しました";
    });
  }

  async function init() {
    wire();
    S.refs = (await Store.get("sunpy_la:refs")) || [];
    S.useWeb = (await Store.get("sunpy_la:useweb")) || false;
    S.sessions = (await Store.get("sunpy_la:sessions")) || [];
    $("#useWeb").checked = S.useWeb;
    $("#apiKey").value = Store.getKey();
    $("#appVersion").textContent = CFG.version;
    paintRefs(); paintSessions(); newSession();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
