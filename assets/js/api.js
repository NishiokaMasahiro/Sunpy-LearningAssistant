/* Anthropic API クライアント
   - Claude アーティファクト内：キー不要（実行環境が付与）
   - GitHub Pages / ローカル：設定画面で入力した自分の API キーを使う */
window.API = (function () {

  function grabJSON(text) {
    if (!text) return null;
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s < 0 || e <= s) return null;
    const raw = text.slice(s, e + 1);
    try { return JSON.parse(raw); }
    catch (_) {
      try { return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")); } catch (__) { return null; }
    }
  }

  async function send({ system, messages, useWeb }) {
    const headers = { "Content-Type": "application/json" };
    const key = Store.getKey();
    if (key) {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    const body = { model: CFG.model, max_tokens: CFG.maxTokens, system, messages };
    if (useWeb) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

    const res = await fetch(CFG.endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j.error && j.error.message ? "：" + j.error.message : ""; } catch (e) {}
      if (res.status === 401 || res.status === 403) throw new Error("認証に失敗しました（" + res.status + "）。設定で API キーを確認してください" + detail);
      throw new Error("API エラー " + res.status + detail);
    }
    const data = await res.json();
    const text = (data.content || []).map(c => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
    return { text, json: grabJSON(text) };
  }

  return { send, grabJSON };
})();
