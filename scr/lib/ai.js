// lib/ai.js
export async function setApiKey(key) {
  await chrome.storage.local.set({ aiApiKey: key || "" });
}

export async function getApiKey() {
  const { aiApiKey = "" } = await chrome.storage.local.get("aiApiKey");
  return aiApiKey;
}

const USE_REAL_API = false; // ✅ Change to true when ready to use OpenAI

export async function summarizeText(input) {
  const text = (input || "").trim();
  if (!text) return { ok: false, summary: "", reason: "empty" };

  if (!USE_REAL_API) {
    // Demo mode (existing code)
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

  // ✅ Real API implementation
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, summary: "", reason: "missing_api_key" };

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful research assistant. Summarize the following text concisely in 2-3 sentences, preserving key points and main arguments.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      console.error("OpenAI API error:", error);
      return {
        ok: false,
        summary: "",
        reason: `HTTP_${resp.status}`,
        error: error.error?.message || "API request failed",
      };
    }

    const data = await resp.json();
    const summary = data.choices[0]?.message?.content || "";

    if (!summary) {
      return { ok: false, summary: "", reason: "empty_response" };
    }

    return { ok: true, summary };
  } catch (error) {
    console.error("AI summarization failed:", error);
    return {
      ok: false,
      summary: "",
      reason: "network_error",
      error: error.message,
    };
  }
}
