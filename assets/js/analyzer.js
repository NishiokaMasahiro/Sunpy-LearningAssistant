/* トレースバックの解析・パッケージ判定・送信前マスキング */
window.Analyzer = (function () {

  /* ---- マスキング ------------------------------------------------------ */
  const RULES = [
    { name: "メールアドレス", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, to: "<email>" },
    { name: "APIキー・トークン", re: /\b(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, to: "<token>" },
    { name: "ホームディレクトリ", re: /(\/(?:home|Users)\/)[^/\s"']+/g, to: "$1<user>" },
    { name: "Windows ユーザー", re: /([A-Za-z]:\\Users\\)[^\\\s"']+/g, to: "$1<user>" },
    { name: "IP アドレス", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, to: "<ip>" }
  ];

  function mask(text) {
    let out = text, hits = [];
    for (const r of RULES) {
      const m = text.match(r.re);
      if (m && m.length) { hits.push({ name: r.name, count: m.length }); out = out.replace(r.re, r.to); }
    }
    return { text: out, hits, count: hits.reduce((a, b) => a + b.count, 0) };
  }

  /* ---- トレースバック解析 ---------------------------------------------- */
  function parse(text) {
    const lines = text.split(/\r?\n/);
    const frames = [];
    const frameRe = /File\s+"([^"]+)",\s+line\s+(\d+),\s+in\s+(.+)/;
    for (const l of lines) {
      const m = l.match(frameRe);
      if (m) frames.push({ file: m[1], line: +m[2], fn: m[3].trim() });
    }
    /* 例外行：最後に現れる "SomeError: message" 形式 */
    let type = "", message = "";
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/^\s*(?:[\w.]+\.)?([A-Za-z_]\w*(?:Error|Exception|Warning|Interrupt))\s*:\s*(.*)$/);
      if (m) { type = m[1]; message = m[2].trim(); break; }
    }
    if (!type) {
      const m = text.match(/\b([A-Za-z_]\w*(?:Error|Exception))\b/);
      if (m) type = m[1];
    }
    const inner = frames.length ? frames[frames.length - 1] : null;
    return { type, message, frames, inner, packages: detect(text) };
  }

  function detect(text) {
    const t = text.toLowerCase();
    const found = [];
    for (const p of CFG.packages) {
      if (!p.detect.length) continue;
      if (p.detect.some(k => t.includes(k.toLowerCase()))) found.push(p.id);
    }
    return found;
  }

  function shortFile(path) {
    const parts = String(path).split(/[\\/]/);
    return parts.slice(-2).join("/");
  }

  return { mask, parse, detect, shortFile };
})();
