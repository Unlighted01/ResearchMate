// lib/ai.js
export async function setApiKey(key) {
  await chrome.storage.local.set({ aiApiKey: key || "" });
}
export async function getApiKey() {
  const { aiApiKey = "" } = await chrome.storage.local.get("aiApiKey");
  return aiApiKey;
}

const USE_REAL_API = false;

export async function summarizeText(input) {
  const text = (input || "").trim();
  if (!text) return { ok: false, summary: "", reason: "empty" };

  if (!USE_REAL_API) {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .slice(0, 3)
      .join(" ");
    const words = text.split(/\s+/).filter(Boolean).length;
    const summary = sentences || text.slice(0, 280);
    return {
      ok: true,
      summary: `${summary}\n\n— (demo summary · ${words} words in original)`,
    };
  }

  // Example real call (fill in later)
  /*
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, summary: "", reason: "missing_api_key" };

  const resp = await fetch("https://api.yourprovider.com/v1/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) return { ok: false, summary: "", reason: `HTTP_${resp.status}` };
  const data = await resp.json();
  return { ok: true, summary: data.summary || "" };
  */
}
