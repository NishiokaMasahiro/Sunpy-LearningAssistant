/* 保存層
   1. window.storage（Claude アーティファクト環境）
   2. localStorage（GitHub Pages / ローカル）
   3. メモリ（どちらも使えない場合）
   API キーはブラウザのみに保存し、送信先は api.anthropic.com だけです。 */
window.Store = (function () {
  const mem = {};
  const hasWS = typeof window.storage === "object" && window.storage !== null;

  function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  return {
    async get(key) {
      if (hasWS) { try { const r = await window.storage.get(key, false); if (r) return JSON.parse(r.value); } catch (e) { /* 未登録キー */ } }
      const l = lsGet(key);
      return l !== null ? l : (key in mem ? mem[key] : null);
    },
    async set(key, value) {
      mem[key] = value;
      if (hasWS) { try { await window.storage.set(key, JSON.stringify(value), false); return true; } catch (e) { /* fall through */ } }
      return lsSet(key, value);
    },
    async del(key) {
      delete mem[key];
      if (hasWS) { try { await window.storage.delete(key, false); } catch (e) {} }
      try { localStorage.removeItem(key); } catch (e) {}
    },
    /* API キーは localStorage 固定（アーティファクト環境では不要） */
    getKey() { try { return localStorage.getItem("sunpy_la:key") || ""; } catch (e) { return ""; } },
    setKey(v) { try { v ? localStorage.setItem("sunpy_la:key", v) : localStorage.removeItem("sunpy_la:key"); } catch (e) {} }
  };
})();
