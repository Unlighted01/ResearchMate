// lib/ai.js - ResearchMate AI Module with Google Gemini Integration
// =====================================================================
// This module provides AI-powered features for the ResearchMate extension
// using Google's Gemini API (Gemini 2.5 Flash model)
// =====================================================================

// ============================================
// PART 1: CONFIGURATION
// ============================================

// ResearchMate's default API Key (used when user doesn't provide their own)
const RESEARCHMATE_API_KEY = "AIzaSyAhpuWKPqU0Q2htWeUmSJNkHLK6TSB_BuQ";

export const CONFIG = {
  USE_REAL_API: true,
  GEMINI_MODEL: "gemini-2.5-flash",
  GEMINI_ENDPOINT: "https://generativelanguage.googleapis.com/v1/models",
  MAX_TOKENS: 1024,
  TEMPERATURE: 0.7,
  DEMO_MODE_MESSAGE: "(demo summary · using mock data)",
};

/**
 * Store user's custom API key (optional)
 */
export async function setApiKey(key) {
  await chrome.storage.local.set({ aiApiKey: key || "" });
}

/**
 * Get API key - uses user's key if provided, otherwise falls back to ResearchMate's key
 */
export async function getApiKey() {
  const { aiApiKey = "" } = await chrome.storage.local.get("aiApiKey");

  // If user has their own key, use it; otherwise use ResearchMate's default
  return aiApiKey.trim() || RESEARCHMATE_API_KEY;
}

// ============================================
// PART 2: CORE AI FUNCTIONS
// ============================================

/**
 * Main summarization function - generates concise summary of research text
 * @param {string} input - The text to summarize
 * @returns {Promise<{ok: boolean, summary: string, reason?: string, error?: string}>}
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

  // Real Gemini API call
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, summary: "", reason: "missing_api_key" };
  }

  try {
    const summary = await callGeminiAPI(text, apiKey, "summarize");
    return { ok: true, summary };
  } catch (error) {
    console.error("❌ AI summarization failed:", error);

    // Enhanced debugging for network errors
    if (error.message === "Failed to fetch") {
      console.error("⚠️ Network error detected. This might be due to:");
      console.error("   1. Content Security Policy (CSP) blocking the request");
      console.error("   2. No internet connection");
      console.error("   3. Ad blockers or firewall");
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
 * @returns {Promise<{ok: boolean, tags: string[], reason?: string}>}
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

  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, tags: [], reason: "missing_api_key" };
  }

  try {
    const response = await callGeminiAPI(input, apiKey, "tags");
    const tags = response
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, 5);

    return { ok: true, tags };
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
 * @param {string} text - The text to analyze
 * @returns {Promise<{ok: boolean, insights: string, reason?: string}>}
 */
export async function extractInsights(text) {
  const input = (text || "").trim();

  if (!input) {
    return { ok: false, insights: "", reason: "empty" };
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, insights: "", reason: "missing_api_key" };
  }

  try {
    const insights = await callGeminiAPI(input, apiKey, "insights");
    return { ok: true, insights };
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

// ============================================
// PART 3: GEMINI API INTEGRATION
// ============================================

/**
 * Call Google Gemini API with proper error handling
 * @private
 */
async function callGeminiAPI(text, apiKey, mode = "summarize") {
  const url = `${CONFIG.GEMINI_ENDPOINT}/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Build appropriate prompt based on mode
  const prompt = buildPrompt(text, mode);

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: CONFIG.TEMPERATURE,
      maxOutputTokens: CONFIG.MAX_TOKENS,
      topP: 0.8,
      topK: 40,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("🔴 Gemini API error:", errorData);

    // Handle specific error cases
    if (
      response.status === 400 &&
      errorData.error?.message?.includes("API key")
    ) {
      throw new Error("Invalid API key. Please check your Gemini API key.");
    }

    throw new Error(
      errorData.error?.message || `API request failed: HTTP ${response.status}`
    );
  }

  const data = await response.json();

  // Extract text from Gemini response structure
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!generatedText) {
    throw new Error("Empty response from Gemini API");
  }

  return generatedText.trim();
}

// ============================================
// PART 4: PROMPT BUILDER
// ============================================

/**
 * Build enhanced prompt based on task mode
 * @private
 */
function buildPrompt(text, mode) {
  switch (mode) {
    case "summarize":
      return `You are a summarization engine. Your task is to condense text into 2-3 sentences.

STRICT RULES:
- Output ONLY the summary itself
- Do NOT start with "This text...", "The article...", "This passage...", "Here is...", or any preamble
- Do NOT include phrases like "In summary...", "To summarize...", "The main points are..."
- Do NOT add commentary, opinions, or meta-statements about the text
- Do NOT use first person ("I think...", "I found...")
- Just write the condensed information directly as if it were a rewritten shorter version

Text to summarize:
"""
${text}
"""

Summary:`;

    case "tags":
      return `You are a tagging engine. Extract 3-5 relevant keywords/tags from this text.

STRICT RULES:
- Output ONLY comma-separated lowercase tags
- No explanations, no preamble, no numbering
- Example correct output: machine learning, neural networks, data science

Text:
"""
${text.slice(0, 1000)}
"""

Tags:`;

    case "insights":
      return `You are an insight extraction engine. Extract key insights as bullet points.

STRICT RULES:
- Output ONLY bullet points (use • or -)
- No preamble like "Here are the insights..."
- No concluding statements
- Each bullet should be a standalone insight

Text:
"""
${text}
"""

Insights:`;

    default:
      return text;
  }
}

// ============================================
// PART 5: DEMO MODE (FALLBACK)
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
// PART 6: UTILITY FUNCTIONS
// ============================================

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

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      configured: false,
      message: "API key not configured.",
    };
  }

  return {
    configured: true,
    message: "AI features are active and ready to use.",
  };
}

/**
 * Test API connection with a simple request
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testAPIConnection() {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { success: false, message: "No API key configured" };
  }

  try {
    const testText = "This is a test message to verify API connectivity.";
    const result = await summarizeText(testText);

    if (result.ok) {
      return { success: true, message: "API connection successful! ✅" };
    } else {
      return { success: false, message: result.error || result.reason };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ============================================
// PART 7: CACHING (Future Enhancement)
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
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// ============================================
// PART 8: EXPORTS
// ============================================

export default {
  summarizeText,
  generateTags,
  extractInsights,
  setApiKey,
  getApiKey,
  checkAPIStatus,
  testAPIConnection,
};
