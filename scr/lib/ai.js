// lib/ai.js - ResearchMate AI Module with Netlify Backend
// =====================================================================
// This module provides AI-powered features for the ResearchMate extension
// All API calls go through Netlify Functions for security (no API keys in extension)
// =====================================================================

// ============================================
// PART 1: CONFIGURATION
// ============================================

// Netlify Functions URL - handles all AI API calls securely
const BACKEND_URL = "https://researchmate-web.netlify.app";

export const CONFIG = {
  USE_REAL_API: true,
  BACKEND_URL: BACKEND_URL,
  DEMO_MODE_MESSAGE: "(demo summary · using mock data)",
};

/**
 * Store user's custom backend URL (optional, for advanced users/self-hosting)
 */
export async function setBackendUrl(url) {
  await chrome.storage.local.set({ backendUrl: url || "" });
}

/**
 * Get backend URL - uses custom URL if provided, otherwise default Netlify
 */
export async function getBackendUrl() {
  const { backendUrl = "" } = await chrome.storage.local.get("backendUrl");
  return backendUrl.trim() || BACKEND_URL;
}

// Legacy functions for backwards compatibility
export async function setApiKey(key) {
  // No longer needed with backend proxy, but kept for compatibility
  await chrome.storage.local.set({ aiApiKey: key || "" });
}

export async function getApiKey() {
  // No longer needed with backend proxy, but kept for compatibility
  const { aiApiKey = "" } = await chrome.storage.local.get("aiApiKey");
  return aiApiKey.trim();
}

// ============================================
// PART 2: CORE AI FUNCTIONS
// ============================================

/**
 * Main summarization function - generates concise summary of research text
 * Uses multi-provider fallback: Gemini → Groq → OpenRouter
 * @param {string} input - The text to summarize
 * @returns {Promise<{ok: boolean, summary: string, provider?: string, reason?: string, error?: string}>}
 */
export async function summarizeText(input) {
  const text = (input || "").trim();

  // Validation
  if (!text) {
    return { ok: false, summary: "", reason: "empty" };
  }

  // Demo mode fallback (when API is disabled)
  if (!CONFIG.USE_REAL_API) {
    return generateDemoSummary(text);
  }

  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(`${backendUrl}/.netlify/functions/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      ok: true,
      summary: data.summary || "",
      provider: data.provider, // Which AI provider was used (Gemini/Groq/OpenRouter)
    };
  } catch (error) {
    console.error("❌ AI summarization failed:", error);

    // Check if backend is not reachable
    if (error.message === "Failed to fetch") {
      return {
        ok: false,
        summary: "",
        reason: "backend_offline",
        error:
          "Cannot connect to ResearchMate servers. Check your internet connection.",
      };
    }

    return {
      ok: false,
      summary: "",
      reason: "network_error",
      error: error.message,
    };
  }
}

/**
 * Generate intelligent tags for research content
 * @param {string} text - The text to analyze
 * @returns {Promise<{ok: boolean, tags: string[], provider?: string, reason?: string}>}
 */
export async function generateTags(text) {
  const input = (text || "").trim();

  if (!input) {
    return { ok: false, tags: [], reason: "empty" };
  }

  if (!CONFIG.USE_REAL_API) {
    // Demo mode: extract simple keywords
    const words = input.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const uniqueWords = [...new Set(words)].slice(0, 5);
    return { ok: true, tags: uniqueWords };
  }

  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(
      `${backendUrl}/.netlify/functions/generate-tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      ok: true,
      tags: data.tags || [],
      provider: data.provider,
    };
  } catch (error) {
    console.error("❌ Tag generation failed:", error);
    return {
      ok: false,
      tags: [],
      reason: "network_error",
      error: error.message,
    };
  }
}

/**
 * Extract key concepts and insights from research text
 * Uses the chat endpoint for more detailed analysis
 * @param {string} text - The text to analyze
 * @returns {Promise<{ok: boolean, insights: string, reason?: string}>}
 */
export async function extractInsights(text) {
  const input = (text || "").trim();

  if (!input) {
    return { ok: false, insights: "", reason: "empty" };
  }

  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(`${backendUrl}/.netlify/functions/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Extract the key concepts, insights, and main arguments from this research text. Be concise but comprehensive:\n\n${input}`,
          },
        ],
        context: input,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return { ok: true, insights: data.response || "" };
  } catch (error) {
    console.error("❌ Insight extraction failed:", error);
    return {
      ok: false,
      insights: "",
      reason: "network_error",
      error: error.message,
    };
  }
}

/**
 * Chat with AI about research content
 * @param {Array} messages - Chat history [{role: "user"|"assistant", content: "..."}]
 * @param {string} context - Research context to inform the AI
 * @returns {Promise<{ok: boolean, response: string, provider?: string, reason?: string}>}
 */
export async function chat(messages, context = "") {
  if (!messages || messages.length === 0) {
    return { ok: false, response: "", reason: "empty" };
  }

  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(`${backendUrl}/.netlify/functions/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      ok: true,
      response: data.response || "",
      provider: data.provider,
    };
  } catch (error) {
    console.error("❌ Chat failed:", error);
    return {
      ok: false,
      response: "",
      reason: "network_error",
      error: error.message,
    };
  }
}

/**
 * Extract citation metadata from a URL
 * @param {string} url - The URL to extract citation info from
 * @returns {Promise<{ok: boolean, citation: object, reason?: string}>}
 */
export async function extractCitation(url) {
  if (!url || !url.trim()) {
    return { ok: false, citation: null, reason: "empty" };
  }

  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(
      `${backendUrl}/.netlify/functions/extract-citation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();
    return { ok: true, citation: data };
  } catch (error) {
    console.error("❌ Citation extraction failed:", error);
    return {
      ok: false,
      citation: null,
      reason: "network_error",
      error: error.message,
    };
  }
}

// ============================================
// PART 3: DEMO MODE (FALLBACK)
// ============================================

/**
 * Generate mock summary when API is disabled (for testing/development)
 * @private
 */
function generateDemoSummary(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .slice(0, 3)
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const summary = sentences || text.slice(0, 280);

  return {
    ok: true,
    summary: `${summary}\n\n— ${CONFIG.DEMO_MODE_MESSAGE} · ${words} words in original`,
  };
}

// ============================================
// PART 4: UTILITY FUNCTIONS
// ============================================

/**
 * Check if backend is available
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(`${backendUrl}/.netlify/functions/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if API is properly configured
 * @returns {Promise<{configured: boolean, message: string}>}
 */
export async function checkAPIStatus() {
  if (!CONFIG.USE_REAL_API) {
    return {
      configured: false,
      message: "AI features are in demo mode. Enable USE_REAL_API to activate.",
    };
  }

  const backendHealthy = await checkBackendHealth();
  if (!backendHealthy) {
    return {
      configured: false,
      message:
        "Cannot connect to ResearchMate servers. Check your internet connection.",
    };
  }

  return {
    configured: true,
    message: "AI features are active (connected to ResearchMate cloud).",
  };
}

/**
 * Test API connection with a simple request
 * @returns {Promise<{success: boolean, message: string, provider?: string}>}
 */
export async function testAPIConnection() {
  try {
    // First check if backend is running
    const backendHealthy = await checkBackendHealth();
    if (!backendHealthy) {
      return {
        success: false,
        message:
          "Cannot connect to ResearchMate servers. Check your internet connection.",
      };
    }

    // Test actual summarization
    const testText = "This is a test message to verify API connectivity.";
    const result = await summarizeText(testText);

    if (result.ok) {
      return {
        success: true,
        message: `API connection successful! ✅ (${result.provider || "AI"})`,
        provider: result.provider,
      };
    } else {
      return { success: false, message: result.error || result.reason };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ============================================
// PART 5: CACHING
// ============================================

/**
 * Cache for recent summaries to avoid duplicate API calls
 * @private
 */
const summaryCache = new Map();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Get cached summary if available and not expired
 * @private
 */
function getCachedSummary(text) {
  const hash = hashText(text);
  const cached = summaryCache.get(hash);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.summary;
  }

  return null;
}

/**
 * Store summary in cache
 * @private
 */
function cacheSummary(text, summary) {
  const hash = hashText(text);

  // Limit cache size
  if (summaryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = summaryCache.keys().next().value;
    summaryCache.delete(firstKey);
  }

  summaryCache.set(hash, {
    summary,
    timestamp: Date.now(),
  });
}

/**
 * Simple hash function for cache keys
 * @private
 */
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// ============================================
// PART 6: EXPORTS
// ============================================

export default {
  summarizeText,
  generateTags,
  extractInsights,
  chat,
  extractCitation,
  setApiKey,
  getApiKey,
  setBackendUrl,
  getBackendUrl,
  checkAPIStatus,
  checkBackendHealth,
  testAPIConnection,
};
