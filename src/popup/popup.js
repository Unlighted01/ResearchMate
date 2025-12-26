// ============================================
// PART 1: IMPORTS AND CONSTANTS
// ============================================

import { validateItemData, sanitizeText } from "../utils/validation.js";
import { aiRateLimiter } from "../utils/rateLimiter.js";
import { summarizeText, extractCitation } from "../services/ai.js";
import { buildCitation } from "../utils/citation.js";
import { initFileImporter } from "../utils/fileImport.js";
import { exportItems } from "../utils/fileExport.js";
import {
  getAllItems,
  addItem,
  updateItem,
  deleteItem,
  migrateLocalToCloud,
  getLocalItemsCount,
} from "../services/storage.js";
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as supabaseSignOut,
  onAuthStateChange,
  getCurrentUser,
  processOAuthCallback,
  supabase,
} from "../services/supabase.js";
import { signInWithGoogleExtension } from "../services/oauth.js";

// Constants
const TOAST_DURATION = 1800;
const DRAFT_EXPIRY = 3600000; // 1 hour
const PENDING_SAVE_TIMEOUT = 60000; // 1 minute
const OAUTH_CALLBACK_TIMEOUT = 60000; // 1 minute
const SESSION_STABILIZE_DELAY = 150;

// ============================================
// PART 2: DOM REFERENCES
// ============================================

class DOMRefs {
  constructor() {
    // Helper functions
    this.byId = (id) => document.getElementById(id);
    this.$$ = (s) => Array.from(document.querySelectorAll(s));

    // Views
    this.authView = this.byId("auth");
    this.appView = this.byId("app");

    // Main UI
    this.tagsInput = this.byId("tags-input");
    this.notesInput = this.byId("notes-input");
    this.saveBtn = this.byId("save-btn");
    this.savedList = this.byId("saved-items-list");
    this.emptyState = this.byId("empty-state");
    this.searchInput = this.byId("search-input");
    this.sortSelect = this.byId("sort-select");
    this.selectedText = this.byId("selected-text");
    this.capturedMeta = this.byId("captured-meta");

    // Edit overlay
    this.editOverlay = this.byId("edit-overlay");
    this.editBack = this.byId("edit-back");
    this.editTags = this.byId("edit-tags");
    this.editNotes = this.byId("edit-notes");
    this.editMeta = this.byId("edit-meta");
    this.editSave = this.byId("edit-save");
    this.editCancel = this.byId("edit-cancel");

    // Citation overlay
    this.citationOverlay = this.byId("citation-overlay");
    this.citationBack = this.byId("citation-back");
    this.citeStyle = this.byId("cite-style");
    this.citeType = this.byId("cite-type");
    this.citeAuthors = this.byId("cite-authors");
    this.citeTitle = this.byId("cite-title");
    this.citeContainer = this.byId("cite-container");
    this.citeYear = this.byId("cite-year");
    this.citeMonth = this.byId("cite-month");
    this.citeDay = this.byId("cite-day");
    this.citeUrl = this.byId("cite-url");
    this.citeAccessed = this.byId("cite-accessed");
    this.citeEdition = this.byId("cite-edition");
    this.citeOutput = this.byId("cite-output");
    this.citeCopy = this.byId("cite-copy");
    this.citeCancel = this.byId("cite-cancel");
    this.citationMeta = this.byId("citation-meta");

    // Summary (removed aiKeyInput and saveAIKeyBtn)
    this.summaryInput = this.byId("summary-input");
    this.summarizeBtn = this.byId("summarize-btn");
    this.summaryResult = this.byId("summary-result");
    this.copySummaryBtn = this.byId("copy-summary-btn");

    // Settings
    this.shuffleThemeBtn = this.byId("shuffleTheme");
    this.exportBtn = this.byId("exportData");
    this.importBtn = this.byId("importData");
    this.exportFormat = this.byId("exportFormat");
    this.darkMode = this.byId("darkMode");
    this.fontFamily = this.byId("fontFamily");
    this.fontSize = this.byId("fontSize");

    // Auth
    this.signupBtn = this.byId("signup");
    this.signinBtn = this.byId("signin");
    this.googleSigninBtn = this.byId("google-signin");
    this.email = this.byId("email");
    this.password = this.byId("password");
    this.authStatus = this.byId("auth-status");
    this.authIcon = this.byId("auth-icon");
    this.authText = this.byId("auth-text");
    this.authAction = this.byId("auth-action");

    // Toast
    this.toast = this.byId("toast");
  }
}

const dom = new DOMRefs();

// ============================================
// PART 3: STATE MANAGEMENT
// ============================================

class AppState {
  constructor() {
    this.itemsCache = [];
    this.currentUser = null;
    this.editItemId = null;
    this.triggerFileImport = null;
  }

  setItems(items) {
    this.itemsCache = items;
  }

  getItems() {
    return this.itemsCache;
  }

  setUser(user) {
    this.currentUser = user;
  }

  getUser() {
    return this.currentUser;
  }

  setEditItemId(id) {
    this.editItemId = id;
  }

  getEditItemId() {
    return this.editItemId;
  }

  clearEditItemId() {
    this.editItemId = null;
  }

  setFileImporter(fn) {
    this.triggerFileImport = fn;
  }

  getFileImporter() {
    return this.triggerFileImport;
  }
}

const state = new AppState();

// ============================================
// PART 4: UI UTILITIES
// ============================================

class UIUtils {
  static toast(msg) {
    if (!dom.toast) return alert(msg);
    dom.toast.textContent = msg;
    dom.toast.classList.add("show");
    clearTimeout(dom.toast._h);
    dom.toast._h = setTimeout(
      () => dom.toast.classList.remove("show"),
      TOAST_DURATION
    );
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static showOverlay(overlayId) {
    document.body.classList.add("overlay-active");
    const overlay = dom.byId(overlayId);
    if (overlay) overlay.classList.remove("hidden", "closing");
  }

  static hideOverlay(overlayId) {
    const overlay = dom.byId(overlayId);
    if (overlay) {
      overlay.classList.add("closing");
      setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("closing");
        document.body.classList.remove("overlay-active");
      }, 300);
    }
  }

  static showSection(id) {
    document
      .querySelectorAll(".tab-content")
      .forEach((s) => s.classList.remove("active"));
    const section = dom.byId(id);
    if (section) {
      section.classList.add("active");
      // FIX: Scroll to top of tab content when switching
      section.scrollTop = 0;
    }
  }

  static getDomainFromUrl(url) {
    try {
      return url ? new URL(url).hostname : "";
    } catch {
      return "";
    }
  }

  static showMainView() {
    document.body.classList.remove("booting");
    document.body.classList.add("ready");

    if (dom.authView) dom.authView.style.display = "none";
    if (dom.appView) {
      dom.appView.style.display = "flex";
      dom.appView.classList.remove("hidden");
    }

    // FIX: Ensure body scroll is reset
    document.body.scrollTop = 0;
    if (dom.appView) dom.appView.scrollTop = 0;
  }

  static showAuthView() {
    document.body.classList.remove("booting");
    document.body.classList.add("ready");
    document.body.classList.add("auth-visible"); // ✅ NEW: Add class to hide scrollbar

    if (dom.appView) dom.appView.style.display = "none";
    if (dom.authView) {
      dom.authView.style.display = "flex";
      dom.authView.classList.remove("hidden");
    }

    // FIX: Reset scroll position
    document.body.scrollTop = 0;
    if (dom.appView) dom.appView.scrollTop = 0;
  }

  static updateAuthStatus(user) {
    AuthManager.updateStatus();
  }
}

// ============================================
// PART 5: PREVIEW MANAGEMENT
// ============================================

class PreviewManager {
  static clear() {
    if (dom.selectedText) dom.selectedText.textContent = "";
    if (dom.capturedMeta) dom.capturedMeta.textContent = "";
  }

  static apply(text, url, title) {
    if (!dom.selectedText || !dom.capturedMeta) return;

    dom.selectedText.textContent = text || "";
    dom.capturedMeta.textContent = UIUtils.getDomainFromUrl(url);

    chrome.storage.local.set({
      latestHighlight: {
        text: text || "",
        sourceUrl: url || "",
        sourceTitle: title || "",
        createdAt: Date.now(),
      },
    });
  }

  static async tryFetchSelection() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) return false;

      // Try content script first
      try {
        const res = await chrome.tabs.sendMessage(tab.id, {
          type: "getSelection",
        });
        const txt = (res?.text || "").trim();
        if (txt) {
          this.apply(txt, res?.url || "", res?.title || "");
          return true;
        }
      } catch {}

      // Fallback to scripting API
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const text =
              (window.getSelection && window.getSelection().toString()) || "";
            return { text, url: location.href, title: document.title };
          },
        });
        const txt = (result?.text || "").trim();
        if (txt) {
          this.apply(txt, result?.url || "", result?.title || "");
          return true;
        }
      } catch {}

      return false;
    } catch {
      return false;
    }
  }

  static updateSaveEnabled() {
    if (dom.saveBtn) {
      const hasText =
        dom.selectedText && (dom.selectedText.textContent || "").trim();
      dom.saveBtn.disabled = !hasText;
    }
  }
}

// ============================================
// PART 6: DRAFT MANAGEMENT
// ============================================

class DraftManager {
  static save() {
    chrome.storage.local.set({
      researchDraft: {
        tags: dom.tagsInput?.value || "",
        notes: dom.notesInput?.value || "",
        timestamp: Date.now(),
      },
    });
  }

  static async load() {
    const { researchDraft } = await chrome.storage.local.get("researchDraft");
    if (researchDraft && Date.now() - researchDraft.timestamp < DRAFT_EXPIRY) {
      if (dom.tagsInput) dom.tagsInput.value = researchDraft.tags;
      if (dom.notesInput) dom.notesInput.value = researchDraft.notes;
    }
  }
}

// ============================================
// PART 7: THEME MANAGEMENT
// ============================================
class ThemeManager {
  static THEMES = {
    GRADIENT_BUBBLE: "gradient-bubble",
    LIQUID_GLASS: "liquid-glass",
    NEON_CYBER: "neon-cyber",
    MINIMAL_CLEAN: "minimal-clean",
  };

  static STORAGE_KEY = "researchmate_theme";
  static MODE_STORAGE_KEY = "researchmate_dark_mode";
  static currentTheme = this.THEMES.MINIMAL_CLEAN;
  static isDarkMode = false;

  // Legacy HSL to RGB conversion (keep for gradient bubble & neon cyber)
  static hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [
      Math.round(255 * f(0)),
      Math.round(255 * f(8)),
      Math.round(255 * f(4)),
    ];
  }

  static setRgbVar(name, h, s, l) {
    const [r, g, b] = this.hslToRgb(h, s, l);
    document.documentElement.style.setProperty(name, `${r}, ${g}, ${b}`);
  }

  /**
   * Clear all dynamic color variables
   */
  static clearDynamicColors() {
    const root = document.documentElement.style;

    // Remove inline style overrides for colors
    root.removeProperty("--accent");
    root.removeProperty("--grad-start");
    root.removeProperty("--grad-end");
    root.removeProperty("--border");
    root.removeProperty("--color1");
    root.removeProperty("--color2");
    root.removeProperty("--color3");
    root.removeProperty("--color4");
    root.removeProperty("--color5");
    root.removeProperty("--color-interactive");
    root.removeProperty("--color-bg1");
    root.removeProperty("--color-bg2");
  }

  /**
   * Initialize theme system with error handling
   */
  static async init() {
    try {
      // FIX: Check if chrome.storage is available
      if (!chrome?.storage?.local) {
        console.warn("⚠️ Chrome storage not available, using defaults");
        this.applyTheme(this.THEMES.MINIMAL_CLEAN, false);
        setTimeout(() => this.setupThemeSelector(), 100);
        return;
      }

      // Load saved theme and mode from storage
      const saved = await chrome.storage.local.get([
        this.STORAGE_KEY,
        this.MODE_STORAGE_KEY,
      ]);

      const savedTheme = saved[this.STORAGE_KEY] || this.THEMES.MINIMAL_CLEAN;
      const savedMode = saved[this.MODE_STORAGE_KEY] || false;

      this.isDarkMode = savedMode;

      // Apply theme without transition on first load
      this.applyTheme(savedTheme, false);

      // Setup theme selector
      setTimeout(() => this.setupThemeSelector(), 100);

      console.log(
        "✅ Theme system initialized:",
        savedTheme,
        "Dark mode:",
        savedMode
      );
    } catch (error) {
      console.error("❌ Theme init error:", error);
      // Fallback to default theme
      this.applyTheme(this.THEMES.MINIMAL_CLEAN, false);
      setTimeout(() => this.setupThemeSelector(), 100);
    }
  }

  /**
   * Apply gradient colors (for gradient-bubble theme ONLY)
   */
  static async applyGradientColors() {
    try {
      const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
      let seed = rmSettings.themeSeed;

      if (typeof seed !== "number") {
        seed = Math.floor(Date.now() / 86400000) % 360;
        rmSettings.themeSeed = seed;
        await chrome.storage.local.set({ rmSettings });
      }

      const root = document.documentElement.style;
      const accentH = seed % 360;

      root.setProperty("--accent", `hsl(${accentH} 70% 55%)`);
      root.setProperty("--grad-start", `hsl(${(accentH + 10) % 360} 80% 24%)`);
      root.setProperty("--grad-end", `hsl(${(accentH + 60) % 360} 80% 28%)`);

      this.setRgbVar("--color1", accentH, 85, 60);
      this.setRgbVar("--color2", (accentH + 40) % 360, 85, 62);
      this.setRgbVar("--color3", (accentH + 80) % 360, 85, 64);
      this.setRgbVar("--color4", (accentH + 160) % 360, 78, 58);
      this.setRgbVar("--color5", (accentH + 200) % 360, 78, 52);
      this.setRgbVar("--color-interactive", (accentH + 300) % 360, 85, 65);

      root.setProperty("--color-bg1", `hsl(${(accentH + 335) % 360} 32% 10%)`);
      root.setProperty("--color-bg2", `hsl(${(accentH + 30) % 360} 32% 14%)`);
    } catch (error) {
      console.warn("⚠️ Gradient colors failed:", error);
    }
  }

  /**
   * Apply neon colors (for neon-cyber theme ONLY)
   */
  static async applyNeonColors() {
    try {
      const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
      let seed = rmSettings.neonSeed;

      if (typeof seed !== "number") {
        seed = Math.floor(Date.now() / 86400000) % 360;
        rmSettings.neonSeed = seed;
        await chrome.storage.local.set({ rmSettings });
      }

      const root = document.documentElement.style;
      const baseH = seed % 360;
      const complementH = (baseH + 180) % 360;

      // Primary neon color
      root.setProperty("--accent", `hsl(${baseH} 100% 50%)`);
      root.setProperty("--grad-start", `hsl(${baseH} 100% 50%)`);
      root.setProperty("--grad-end", `hsl(${complementH} 100% 50%)`);
      root.setProperty("--border", `hsl(${baseH} 100% 50%)`);

      // Neon gradient colors
      this.setRgbVar("--color1", baseH, 100, 50);
      this.setRgbVar("--color2", complementH, 100, 50);
      this.setRgbVar("--color3", (baseH + 60) % 360, 100, 50);
      this.setRgbVar("--color4", (baseH + 120) % 360, 100, 50);
      this.setRgbVar("--color5", (baseH + 240) % 360, 100, 50);
      this.setRgbVar("--color-interactive", (complementH + 30) % 360, 100, 50);
    } catch (error) {
      console.warn("⚠️ Neon colors failed:", error);
    }
  }

  /**
   * Apply a theme
   */
  static applyTheme(themeName, animate = true) {
    const root = document.documentElement;

    // Validate theme name
    if (!Object.values(this.THEMES).includes(themeName)) {
      console.error("Invalid theme:", themeName);
      return;
    }

    // FIX: Clear dynamic colors when switching to static themes
    if (
      themeName === this.THEMES.MINIMAL_CLEAN ||
      themeName === this.THEMES.LIQUID_GLASS
    ) {
      this.clearDynamicColors();
    }

    // Apply theme attribute
    if (animate && document.startViewTransition) {
      document.startViewTransition(() => {
        root.setAttribute("data-theme", themeName);
        this.currentTheme = themeName;
        this.applyDarkMode();
        this.saveTheme(themeName);
        this.updateThemeSelector();
        this.applyThemeColors();
      });
    } else {
      root.setAttribute("data-theme", themeName);
      this.currentTheme = themeName;
      this.applyDarkMode();
      this.saveTheme(themeName);
      this.updateThemeSelector();
      this.applyThemeColors();
    }
  }

  /**
   * Apply theme-specific colors ONLY for animated themes
   */
  static applyThemeColors() {
    // ONLY apply dynamic colors for Gradient Bubble and Neon Cyber
    if (this.currentTheme === this.THEMES.GRADIENT_BUBBLE) {
      this.applyGradientColors();
    } else if (this.currentTheme === this.THEMES.NEON_CYBER) {
      this.applyNeonColors();
    }
    // No color application for Minimal Clean and Liquid Glass
  }

  /**
   * Apply dark/light mode
   */
  static applyDarkMode() {
    const root = document.documentElement;

    // Only apply dark mode class for themes that support it
    if (
      this.currentTheme === this.THEMES.LIQUID_GLASS ||
      this.currentTheme === this.THEMES.MINIMAL_CLEAN
    ) {
      if (this.isDarkMode) {
        root.classList.add("dark-mode");
      } else {
        root.classList.remove("dark-mode");
      }
    } else {
      root.classList.remove("dark-mode");
    }
  }

  /**
   * Toggle dark/light mode
   */
  static async toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    await chrome.storage.local.set({
      [this.MODE_STORAGE_KEY]: this.isDarkMode,
    });
    this.applyDarkMode();
    this.updateModeToggle();

    const modeText = this.isDarkMode ? "Dark" : "Light";
    UIUtils.toast(`${modeText} mode enabled`);
  }

  /**
   * Save theme to storage
   */
  static async saveTheme(themeName) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: themeName });
      console.log("💾 Theme saved:", themeName);
    } catch (error) {
      console.warn("⚠️ Theme save failed:", error);
    }
  }

  /**
   * Setup theme selector UI
   */
  static setupThemeSelector() {
    const settingsTab = document.querySelector("#settings-tab");
    if (!settingsTab) return;

    // Check if theme selector already exists
    if (document.querySelector(".theme-selector-compact")) return;

    // Create compact theme selector HTML
    const themeSelectorHTML = `
      <div class="settings-section">
        <h3 class="settings-section-title">🎨 Appearance</h3>
        
        <div class="theme-selector-compact">
          <label for="theme-select">Theme</label>
          <div class="theme-dropdown">
            <select id="theme-select">
              <option value="${this.THEMES.MINIMAL_CLEAN}" ${
      this.currentTheme === this.THEMES.MINIMAL_CLEAN ? "selected" : ""
    }>
                📄 Minimal Clean
              </option>
              <option value="${this.THEMES.LIQUID_GLASS}" ${
      this.currentTheme === this.THEMES.LIQUID_GLASS ? "selected" : ""
    }>
                💎 Liquid Glass
              </option>
              <option value="${this.THEMES.GRADIENT_BUBBLE}" ${
      this.currentTheme === this.THEMES.GRADIENT_BUBBLE ? "selected" : ""
    }>
                🌊 Gradient Bubble
              </option>
              <option value="${this.THEMES.NEON_CYBER}" ${
      this.currentTheme === this.THEMES.NEON_CYBER ? "selected" : ""
    }>
                ⚡ Neon Cyber
              </option>
            </select>
          </div>
        </div>

        <div class="theme-selector-compact mode-toggle-container">
          <label class="mode-label">Mode</label>
          <div class="mode-toggle ${
            this.isDarkMode ? "active" : ""
          }" id="mode-toggle">
            <div class="mode-toggle-slider"></div>
          </div>
          <span class="mode-label" id="mode-label">${
            this.isDarkMode ? "Dark" : "Light"
          }</span>
        </div>
      </div>
    `;

    // Insert at the beginning of settings tab
    settingsTab.insertAdjacentHTML("afterbegin", themeSelectorHTML);

    // Add event listeners
    this.attachThemeHandlers();
  }

  /**
   * Attach event handlers
   */
  static attachThemeHandlers() {
    // Theme dropdown
    const themeSelect = document.querySelector("#theme-select");
    if (themeSelect) {
      themeSelect.addEventListener("change", (e) => {
        this.applyTheme(e.target.value, true);
      });
    }

    // Mode toggle
    const modeToggle = document.querySelector("#mode-toggle");
    if (modeToggle) {
      modeToggle.addEventListener("click", () => {
        this.toggleDarkMode();
      });
    }
  }

  /**
   * Update theme selector state
   */
  static updateThemeSelector() {
    const themeSelect = document.querySelector("#theme-select");
    if (themeSelect) {
      themeSelect.value = this.currentTheme;
    }
  }

  /**
   * Update mode toggle state
   */
  static updateModeToggle() {
    const modeToggle = document.querySelector("#mode-toggle");
    const modeLabel = document.querySelector("#mode-label");

    if (modeToggle) {
      if (this.isDarkMode) {
        modeToggle.classList.add("active");
      } else {
        modeToggle.classList.remove("active");
      }
    }

    if (modeLabel) {
      modeLabel.textContent = this.isDarkMode ? "Dark" : "Light";
    }
  }

  /**
   * Shuffle colors (for Gradient Bubble and Neon Cyber themes ONLY)
   */
  static async shuffle() {
    if (this.currentTheme === this.THEMES.GRADIENT_BUBBLE) {
      const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
      rmSettings.themeSeed = Math.floor(Math.random() * 360);
      await chrome.storage.local.set({ rmSettings });
      await this.applyGradientColors();
      UIUtils.toast("Gradient colors updated! 🌈");
    } else if (this.currentTheme === this.THEMES.NEON_CYBER) {
      const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
      rmSettings.neonSeed = Math.floor(Math.random() * 360);
      await chrome.storage.local.set({ rmSettings });
      await this.applyNeonColors();
      UIUtils.toast("Neon colors updated! ⚡");
    } else {
      UIUtils.toast(
        "Color shuffle only works with Gradient Bubble & Neon Cyber themes"
      );
    }
  }

  /**
   * Legacy apply method
   */
  static async apply() {
    this.applyThemeColors();
  }

  /**
   * Get current theme
   */
  static getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Check if theme is dark
   */
  static isCurrentlyDark() {
    if (
      this.currentTheme === this.THEMES.GRADIENT_BUBBLE ||
      this.currentTheme === this.THEMES.NEON_CYBER
    ) {
      return true;
    }
    return this.isDarkMode;
  }
}

// ============================================
// PART 8: SETTINGS MANAGEMENT
// ============================================

class SettingsManager {
  static async load() {
    const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
    const {
      dark = false,
      ff = "system-ui",
      fs = 14,
      sortBy = "date-desc",
    } = rmSettings;

    if (dom.fontFamily) dom.fontFamily.value = ff;
    if (dom.fontSize) {
      dom.fontSize.value = fs;
      const display = document.getElementById("fontSize-value");
      if (display) display.textContent = fs;
    }
    if (dom.sortSelect) dom.sortSelect.value = sortBy;

    document.body.classList.toggle("dark", !!dark);
    document.body.style.fontFamily = ff;
    document.body.style.fontSize = fs + "px";

    return { dark, ff, fs, sortBy };
  }

  static async save() {
    const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
    rmSettings.ff = dom.fontFamily?.value || "system-ui";
    rmSettings.fs = Number(dom.fontSize?.value) || 14;

    await chrome.storage.local.set({ rmSettings });

    document.body.classList.toggle("dark", rmSettings.dark);
    document.body.style.fontFamily = rmSettings.ff;
    document.body.style.fontSize = rmSettings.fs + "px";

    await ThemeManager.apply();
  }

  static async getSortPreference() {
    const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
    return rmSettings.sortBy || "date-desc";
  }

  static async saveSortPreference(sortBy) {
    const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
    rmSettings.sortBy = sortBy;
    await chrome.storage.local.set({ rmSettings });
  }
}

// ============================================
// PART 9: CITATION MANAGEMENT
// ============================================

class CitationManager {
  static getData() {
    return {
      style: dom.citeStyle?.value || "apa",
      type: dom.citeType?.value || "web",
      authors: (dom.citeAuthors?.value || "")
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
      title: dom.citeTitle?.value?.trim() || "",
      container: dom.citeContainer?.value?.trim() || "",
      year: dom.citeYear?.value?.trim() || "",
      month: dom.citeMonth?.value?.trim() || "",
      day: dom.citeDay?.value?.trim() || "",
      url: dom.citeUrl?.value?.trim() || "",
      accessed: dom.citeAccessed?.value?.trim() || "",
      edition: dom.citeEdition?.value?.trim() || "",
    };
  }

  static refresh() {
    if (!dom.citeOutput) return;
    try {
      const citation = buildCitation(this.getData());
      dom.citeOutput.innerHTML = citation || "";
    } catch (error) {
      console.error("Citation error:", error);
      dom.citeOutput.textContent = "Error generating citation";
    }
  }

  static clear() {
    if (dom.citeAuthors) dom.citeAuthors.value = "";
    if (dom.citeTitle) dom.citeTitle.value = "";
    if (dom.citeContainer) dom.citeContainer.value = "";
    if (dom.citeYear) dom.citeYear.value = "";
    if (dom.citeMonth) dom.citeMonth.value = "";
    if (dom.citeDay) dom.citeDay.value = "";
    if (dom.citeUrl) dom.citeUrl.value = "";
    if (dom.citeAccessed) dom.citeAccessed.value = "";
    if (dom.citeEdition) dom.citeEdition.value = "";
    if (dom.citeOutput) dom.citeOutput.innerHTML = "";
    if (dom.citationMeta) dom.citationMeta.textContent = "";
  }

  static async copy() {
    const html = dom.citeOutput?.innerHTML?.trim() || "";
    const text = dom.citeOutput?.textContent?.trim() || "";

    if (!text) {
      UIUtils.toast("Fill citation fields first");
      return;
    }

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      UIUtils.toast("Citation copied!");
    } catch (error) {
      console.error("Copy failed:", error);
      UIUtils.toast("Copy failed");
    }
  }

  static populateFromItem(item) {
    this.clear();
    if (dom.citeTitle) dom.citeTitle.value = item.sourceTitle || "";
    if (dom.citeUrl) dom.citeUrl.value = item.sourceUrl || "";

    if (item.sourceUrl && dom.citeContainer) {
      try {
        dom.citeContainer.value = new URL(item.sourceUrl).hostname.replace(
          /^www\./,
          ""
        );
      } catch {}
    }

    if (item.createdAt && dom.citeYear) {
      try {
        const date = new Date(item.createdAt);
        dom.citeYear.value = date.getFullYear().toString();
        dom.citeMonth.value = (date.getMonth() + 1).toString();
        dom.citeDay.value = date.getDate().toString();
      } catch {}
    }

    if (dom.citationMeta) {
      dom.citationMeta.textContent = `Citing: ${
        item.sourceTitle || item.sourceUrl || "Untitled"
      }`;
    }

    this.refresh();
  }
}

// ============================================
// PART 10: SORTING UTILITIES
// ============================================

class SortUtils {
  static sortItems(items, sortBy) {
    const sorted = [...items];

    switch (sortBy) {
      case "date-desc":
        return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      case "date-asc":
        return sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      case "title-asc":
        return sorted.sort((a, b) => {
          const titleA = (a.sourceTitle || a.sourceUrl || "").toLowerCase();
          const titleB = (b.sourceTitle || b.sourceUrl || "").toLowerCase();
          return titleA.localeCompare(titleB);
        });

      case "title-desc":
        return sorted.sort((a, b) => {
          const titleA = (a.sourceTitle || a.sourceUrl || "").toLowerCase();
          const titleB = (b.sourceTitle || b.sourceUrl || "").toLowerCase();
          return titleB.localeCompare(titleA);
        });

      default:
        return sorted;
    }
  }
}

// ============================================
// PART 11: ITEM RENDERING
// ============================================

class ItemRenderer {
  static renderList(list) {
    if (!dom.savedList) return;

    dom.savedList.innerHTML = "";

    if (!list.length) {
      dom.emptyState?.classList.remove("hidden");
      return;
    }

    dom.emptyState?.classList.add("hidden");

    list.forEach((item) => {
      if (!item || !item.id) return;
      const itemEl = this.createItemElement(item);
      dom.savedList.appendChild(itemEl);
    });
  }

  static createItemElement(item) {
    const div = document.createElement("div");
    div.className = "item";
    div.tabIndex = 0;

    const title = item.sourceTitle || item.sourceUrl || "Untitled";
    const text = (item.text || "").slice(0, 240).replace(/\s+/g, " ");
    const domain = UIUtils.getDomainFromUrl(item.sourceUrl);
    const tags = Array.isArray(item.tags) ? item.tags : [];

    const chips = tags.length
      ? `<div class="chips">${tags
          .map((t) => `<span class="chip">#${t}</span>`)
          .join("")}</div>`
      : "";

    div.innerHTML = `
      <button class="delete-btn" data-act="delete" data-id="${
        item.id
      }" title="Delete">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <div class="title">${title}${
      domain ? `<span class="domain">${domain}</span>` : ""
    }</div>
      ${chips}
      <div class="text">${text}</div>
      ${
        item.note
          ? `<div class="note">📝 ${String(item.note).slice(0, 140)}</div>`
          : ""
      }
      <div class="actions">
        <button data-act="copy" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          Copy
        </button>
        <button data-act="summarize" data-id="${item.id}">
          ✨ Summary
        </button>

        ${
          item.sourceUrl
            ? `
          <button data-act="open" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
            Open
          </button>
        `
            : ""
        }
        <div class="more-menu">
          <button class="more-btn" data-act="more" data-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
          <div class="more-dropdown" data-id="${item.id}">
            <button data-act="edit" data-id="${item.id}">📝 Edit</button>
            <button data-act="cite" data-id="${item.id}">📋 Citation</button>
          </div>
        </div>
      </div>
    `;

    return div;
  }
}

// ============================================
// PART 12: ITEM MANAGEMENT
// ============================================

class ItemManager {
  static async load() {
    try {
      const items = await getAllItems();
      state.setItems(items);
      console.log("✅ Loaded", items.length, "items");

      if (!items.length) {
        if (dom.savedList) dom.savedList.innerHTML = "";
        dom.emptyState?.classList.remove("hidden");
        return;
      }

      dom.emptyState?.classList.add("hidden");
      const sortBy = await SettingsManager.getSortPreference();
      const sorted = SortUtils.sortItems(items, sortBy);
      ItemRenderer.renderList(sorted);
    } catch (e) {
      console.error("❌ Load error:", e);
      state.setItems([]);
      if (dom.savedList) dom.savedList.innerHTML = "";
      dom.emptyState?.classList.remove("hidden");
    }
  }

  static async save() {
    if (!dom.selectedText || !(dom.selectedText.textContent || "").trim()) {
      const ok = await PreviewManager.tryFetchSelection();
      if (
        !ok ||
        !dom.selectedText ||
        !(dom.selectedText.textContent || "").trim()
      ) {
        UIUtils.toast("No selection found");
        return;
      }
    }

    const text = sanitizeText(dom.selectedText.textContent);
    const tags = (dom.tagsInput?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    const { latestHighlight } = await chrome.storage.local.get(
      "latestHighlight"
    );

    const payload = {
      text,
      tags,
      note: (dom.notesInput?.value || "").trim().slice(0, 1000),
      sourceUrl: latestHighlight?.sourceUrl || "",
      sourceTitle: latestHighlight?.sourceTitle || "",
    };

    const validation = validateItemData(payload);
    if (!validation.valid) {
      UIUtils.toast(validation.errors[0]);
      return;
    }

    try {
      await addItem(payload);
      if (dom.tagsInput) dom.tagsInput.value = "";
      if (dom.notesInput) dom.notesInput.value = "";
      await chrome.storage.local.remove("latestHighlight");
      PreviewManager.clear();
      PreviewManager.updateSaveEnabled();
      UIUtils.toast("Saved!");
      await this.load();
    } catch (e) {
      console.error(e);
      UIUtils.toast("Save failed: " + (e.message || "Unknown error"));
    }
  }

  static async copy(itemId) {
    const item = state.getItems().find((x) => String(x.id) === String(itemId));
    if (!item) {
      UIUtils.toast("Item not found");
      await this.load();
      return;
    }

    const tags = Array.isArray(item.tags) ? item.tags : [];
    const blob = [
      item.text || "",
      tags.length ? "\n\nTags: " + tags.map((t) => `#${t}`).join(" ") : "",
      item.sourceTitle || item.sourceUrl
        ? `\nSource: ${item.sourceTitle || ""}${
            item.sourceUrl ? ` (${item.sourceUrl})` : ""
          }`
        : "",
      item.note ? `\nNote: ${item.note}` : "",
    ].join("");

    try {
      await navigator.clipboard.writeText(blob.trim());
      UIUtils.toast("Copied!");
    } catch {
      UIUtils.toast("Copy failed");
    }
  }

  static async delete(itemId) {
    if (!confirm("Delete permanently?")) return;

    try {
      await deleteItem(itemId);
      UIUtils.toast("Deleted");
      await this.load();
    } catch (e) {
      console.error(e);
      UIUtils.toast("Delete failed");
    }
  }

  static async update(itemId, updates) {
    try {
      await updateItem(itemId, updates);
      UIUtils.toast("Saved");
      await this.load();
    } catch (e) {
      console.error(e);
      UIUtils.toast("Update failed");
    }
  }

  static async search(query) {
    const q = query.toLowerCase();
    const filtered = state
      .getItems()
      .filter(
        (x) =>
          (x.text || "").toLowerCase().includes(q) ||
          (x.sourceTitle || "").toLowerCase().includes(q) ||
          (x.sourceUrl || "").toLowerCase().includes(q) ||
          (Array.isArray(x.tags) ? x.tags.join(" ") : "")
            .toLowerCase()
            .includes(q)
      );
    const sortBy = dom.sortSelect?.value || "date-desc";
    ItemRenderer.renderList(SortUtils.sortItems(filtered, sortBy));
  }
}

// ============================================
// PART 13: AUTH MANAGEMENT
// ============================================

class AuthManager {
  static updateStatus() {
    const user = state.getUser();

    if (!dom.authStatus) {
      console.warn("⚠️ Auth status div not found");
      return;
    }

    console.log("🎨 Updating auth status, user:", user?.email || "none");

    if (user) {
      dom.authStatus.classList.add("signed-in");
      if (dom.authIcon) dom.authIcon.textContent = "☁️";
      if (dom.authText) dom.authText.textContent = `Signed in as ${user.email}`;
      if (dom.authAction) {
        dom.authAction.textContent = "Sign Out";
        dom.authAction.onclick = async () => {
          await this.signOut();
        };
      }
    } else {
      dom.authStatus.classList.remove("signed-in");
      if (dom.authIcon) dom.authIcon.textContent = "💾";
      if (dom.authText) dom.authText.textContent = "Offline Mode";
      if (dom.authAction) {
        dom.authAction.textContent = "Sign In";
        dom.authAction.onclick = () => {
          if (dom.appView) dom.appView.style.display = "none";
          if (dom.authView) dom.authView.style.display = "flex";
        };
      }
    }
  }

  static async signOut() {
    console.log("🚪 Sign-out clicked");
    const { error } = await supabaseSignOut();

    if (error) {
      console.error("❌ Sign-out error:", error);
      UIUtils.toast("Sign-out failed");
      return;
    }

    state.setUser(null);
    state.setItems([]);
    this.updateStatus();
    await ItemManager.load();

    if (dom.authView) dom.authView.style.display = "none";
    if (dom.appView) dom.appView.style.display = "flex";

    UIUtils.toast("Signed out - now in offline mode");
  }

  static async checkForMigration() {
    const localCount = await getLocalItemsCount();

    if (localCount > 0) {
      const migrate = confirm(
        `You have ${localCount} saved items in offline mode.\n\n` +
          `Upload them to your cloud account for sync across devices?`
      );

      if (migrate) {
        try {
          const result = await migrateLocalToCloud();
          UIUtils.toast(`✅ Uploaded ${result.success} items!`);
          await ItemManager.load();
        } catch (error) {
          console.error("Migration failed:", error);
          UIUtils.toast("❌ Upload failed. Your local data is safe.");
        }
      }
    }
  }

  static setupListener() {
    onAuthStateChange(async (event, session) => {
      console.log("🔐 Auth event:", event);
      console.log("👤 Session user:", session?.user?.email || "none");

      if (event === "INITIAL_SESSION") {
        if (state.getUser()) {
          console.log("ℹ️ INITIAL_SESSION ignored - already have user");
          return;
        }
        if (session?.user) {
          console.log("🔄 INITIAL_SESSION - restoring user");
          state.setUser(session.user);
          this.updateStatus();
          if (state.getItems().length === 0) await ItemManager.load();
        }
        return;
      }

      if (event === "SIGNED_IN") {
        console.log("✅ SIGNED_IN event");
        if (session?.user) {
          state.setUser(session.user);
          if (dom.authView) dom.authView.style.display = "none";
          if (dom.appView) {
            dom.appView.style.display = "flex";
            dom.appView.classList.remove("hidden");
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.updateStatus();
          await ItemManager.load();
          await this.checkForMigration();
          UIUtils.toast("Signed in! Data syncs across devices");
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        console.log("🚪 SIGNED_OUT event");
        state.setUser(null);
        state.setItems([]);
        this.updateStatus();
        await ItemManager.load();
        if (dom.authView) dom.authView.style.display = "none";
        if (dom.appView) dom.appView.style.display = "flex";
        UIUtils.toast("Signed out. Using offline mode");
        return;
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        if (state.getUser()?.id !== session.user.id) {
          state.setUser(session.user);
          this.updateStatus();
        }
      }
    });
  }
}

// ============================================
// PART 14: MESSAGE HANDLER
// ============================================

class MessageHandler {
  static setup() {
    chrome.runtime.onMessage.addListener(async (msg) => {
      console.log("📨 Message:", msg.type);

      if (msg?.type === "latestHighlight") {
        const p = msg.payload || {};
        PreviewManager.apply(
          p.text || "",
          p.sourceUrl || "",
          p.sourceTitle || ""
        );
      }

      if (msg?.type === "latestHighlightCleared") {
        PreviewManager.clear();
      }

      if (msg?.type === "itemSaved") {
        if (dom.byId("saved-tab")?.classList.contains("active")) {
          await ItemManager.load();
        }
      }

      if (msg?.type === "contextMenuSave") {
        const { pendingSave } = await chrome.storage.local.get("pendingSave");
        if (
          pendingSave &&
          Date.now() - pendingSave.timestamp < PENDING_SAVE_TIMEOUT
        ) {
          try {
            await addItem({
              text: pendingSave.text,
              sourceUrl: pendingSave.sourceUrl,
              sourceTitle: pendingSave.sourceTitle,
              tags: [],
              note: "",
            });
            await chrome.storage.local.remove("pendingSave");
            UIUtils.toast("Saved from context menu!");
            await ItemManager.load();
          } catch (e) {
            console.error("Context save failed:", e);
            UIUtils.toast("Save failed");
          }
        }
      }
    });
  }
}

// ============================================
// PART 15: TAB AND NAVIGATION HANDLERS
// ============================================

class NavigationHandlers {
  static setupTabSwitching() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;

      dom.$$(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      UIUtils.showSection(btn.dataset.tab + "-tab");
    });
  }

  static setupDropdownClosing() {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".more-menu")) {
        document
          .querySelectorAll(".more-dropdown")
          .forEach((d) => d.classList.remove("show"));
      }
    });
  }
}

// ============================================
// PART 16: ITEM ACTION HANDLERS
// ============================================

class ItemActionHandlers {
  static setup() {
    dom.savedList?.addEventListener("click", async (e) => {
      // Handle "more" button
      const moreBtn = e.target.closest("[data-act='more']");
      if (moreBtn) {
        e.stopPropagation();
        const id = moreBtn.dataset.id;
        const dropdown = dom.savedList.querySelector(
          `.more-dropdown[data-id="${id}"]`
        );
        dom.savedList.querySelectorAll(".more-dropdown").forEach((d) => {
          if (d !== dropdown) d.classList.remove("show");
        });
        dropdown?.classList.toggle("show");
        return;
      }

      // Handle other actions
      const btn = e.target.closest("button[data-act]:not([data-act='more'])");
      if (!btn) return;

      const action = btn.dataset.act;
      const itemId = btn.dataset.id;
      const item = state
        .getItems()
        .find((x) => String(x.id) === String(itemId));

      if (!item) {
        console.error("Item not found:", itemId);
        UIUtils.toast("Item not found - refreshing");
        await ItemManager.load();
        return;
      }

      switch (action) {
        case "copy":
          await ItemManager.copy(itemId);
          break;

        case "open":
          if (item.sourceUrl) {
            chrome.tabs.create({ url: item.sourceUrl });
          }
          break;

        case "edit":
          this.openEditOverlay(item, itemId);
          break;

        case "cite":
          this.openCitationOverlay(item);
          break;

        case "delete":
          await ItemManager.delete(itemId);
          break;

        case "summarize":
          await this.handleSummarize(item);
          break;
      }
    });
  }

  static refineSummary(text) {
    let clean = text.trim();
    // Remove "Here is a summary..." variations (case insensitive, handling bold/newlines)
    const patterns = [
      /^(\*\*|__)?(here is|here's|this is)( a| the)?( concise| short| brief)? summary.*?(:|\.)(\*\*|__)?\s*/i,
      /^(\*\*|__)?sure,?( here is| here's)?( a| the)? summary.*?(:|\.)(\*\*|__)?\s*/i,
      /^(\*\*|__)?summary:(\*\*|__)?\s*/i,
    ];

    for (const p of patterns) {
      clean = clean.replace(p, "").trim();
    }
    // Capitalize first letter
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean;
  }

  static async handleSummarize(item) {
    if (!item || !item.text) {
      UIUtils.toast("No text to summarize");
      return;
    }

    // Switch to summary tab
    const summaryTabBtn = document.querySelector(
      '.tab-btn[data-tab="summary"]'
    );
    summaryTabBtn?.click();

    // Show loading state in result box
    if (dom.summaryResult) dom.summaryResult.classList.remove("hidden");
    const box = dom.summaryResult?.querySelector(".summary-content");
    const placeholder = document.getElementById("summary-placeholder");

    if (placeholder) placeholder.classList.add("hidden");
    if (box) {
      box.innerHTML = `
        <div style="text-align: center; color: var(--muted); padding: 20px;">
          <div style="font-size: 24px; margin-bottom: 10px;">✨</div>
          <p>Analyzing text with AI...</p>
        </div>
      `;
    }

    try {
      // Check for cached summary first (optimization)
      if (item.aiSummary) {
        // Clean cached summary too (fixes legacy chatty responses)
        const cleanCached = this.refineSummary(item.aiSummary);

        // If it changed, update the cache
        if (cleanCached !== item.aiSummary && item.id) {
          item.aiSummary = cleanCached;
          // We don't async await this update to avoid delay, just let it happen
          ItemManager.update(item.id, { aiSummary: cleanCached });
        }

        if (box) box.innerText = cleanCached;
        UIUtils.toast("Loaded from cache (No API used)");
        return;
      }

      // Confirmation before using API (if not cached)
      if (
        !confirm(
          "✨ Generate AI Summary?\n\nThis will assume usage of your free AI quota."
        )
      ) {
        // Reset/clear if cancelled - show placeholder again
        if (box) box.innerHTML = "";
        if (placeholder) placeholder.classList.remove("hidden");
        if (dom.summaryResult) dom.summaryResult.classList.add("hidden");
        return;
      }

      await aiRateLimiter.throttle();
      const out = await summarizeText(item.text);

      if (!out.ok) {
        if (box) box.textContent = "Failed to generate summary.";
        // Restore placeholder if it was a failure
        if (placeholder) placeholder.classList.remove("hidden");
        if (dom.summaryResult) dom.summaryResult.classList.add("hidden");
        UIUtils.toast(`Failed: ${out.error || out.reason}`);
        return;
      }

      // Clean up common conversational prefixes
      const cleanSummary = this.refineSummary(out.summary);

      // Display result
      if (box) box.innerText = cleanSummary;

      // Save summary back to item (cache it)
      if (item.id) {
        await ItemManager.update(item.id, { aiSummary: cleanSummary });
      }

      UIUtils.toast("Summary generated & saved!");
    } catch (error) {
      console.error(error);
      if (box) box.textContent = "Error generating summary.";
      UIUtils.toast("Unexpected error");
    }
  }

  static openEditOverlay(item, itemId) {
    state.setEditItemId(itemId);
    const title = item.sourceTitle || item.sourceUrl || "Untitled";
    const domain = UIUtils.getDomainFromUrl(item.sourceUrl);

    if (dom.editMeta) {
      dom.editMeta.textContent = domain ? `${title} — ${domain}` : title;
    }
    if (dom.editTags) {
      dom.editTags.value = Array.isArray(item.tags) ? item.tags.join(", ") : "";
    }
    if (dom.editNotes) {
      dom.editNotes.value = item.note || "";
    }

    dom.savedList
      ?.querySelectorAll(".more-dropdown")
      .forEach((d) => d.classList.remove("show"));
    UIUtils.showOverlay("edit-overlay");
  }

  static openCitationOverlay(item) {
    CitationManager.populateFromItem(item);
    dom.savedList
      ?.querySelectorAll(".more-dropdown")
      .forEach((d) => d.classList.remove("show"));
    UIUtils.showOverlay("citation-overlay");
  }
}

// ============================================
// PART 17: EDIT OVERLAY HANDLERS
// ============================================

class EditOverlayHandlers {
  static setup() {
    dom.editSave?.addEventListener("click", async () => {
      const itemId = state.getEditItemId();
      if (!itemId) {
        UIUtils.toast("No item selected");
        return;
      }

      const tags = (dom.editTags?.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const note = (dom.editNotes?.value || "").trim();

      await ItemManager.update(itemId, { tags, note });
      UIUtils.hideOverlay("edit-overlay");
      state.clearEditItemId();
    });

    dom.editCancel?.addEventListener("click", () => {
      UIUtils.hideOverlay("edit-overlay");
      state.clearEditItemId();
    });

    dom.editBack?.addEventListener("click", () => {
      UIUtils.hideOverlay("edit-overlay");
      state.clearEditItemId();
    });
  }
}

// ============================================
// PART 18: CITATION OVERLAY HANDLERS
// ============================================

class CitationOverlayHandlers {
  static setup() {
    // AI Citation Extraction
    const extractBtn = document.getElementById("ai-extract-btn");
    const extractStatus = document.getElementById("extract-status");

    extractBtn?.addEventListener("click", async () => {
      // 1. Get URL from input or current tab
      let url = dom.citeUrl?.value?.trim();

      if (!url) {
        try {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs[0]?.url) {
            url = tabs[0].url;
            if (dom.citeUrl) dom.citeUrl.value = url;
            // Trigger input event to update everything
            dom.citeUrl.dispatchEvent(new Event("input"));
          }
        } catch {
          // Ignore tab query errors
        }
      }

      if (!url) {
        UIUtils.toast("Enter a URL or open a page");
        return;
      }

      // 2. Show loading state
      if (extractStatus) {
        extractStatus.classList.remove("hidden");
        extractStatus.textContent = "✨ Extracting metadata... ⏳";
      }
      extractBtn.disabled = true;
      extractBtn.style.opacity = "0.7";

      try {
        // 3. Call AI service
        const result = await extractCitation(url);

        if (result.ok && result.citation) {
          const data = result.citation;

          // 4. Populate fields
          // 4. Populate fields
          if (data.title && dom.citeTitle) dom.citeTitle.value = data.title;

          // Site Name -> Container
          if ((data.siteName || data.website) && dom.citeContainer) {
            dom.citeContainer.value = data.siteName || data.website;
          }

          // Authors: Try multiple field names and formats
          const authorText = data.author || data.authors || data.creator || "";
          console.log("📝 Author data received:", authorText);

          if (authorText && dom.citeAuthors) {
            if (Array.isArray(authorText)) {
              dom.citeAuthors.value = authorText.join("\n");
            } else if (typeof authorText === "string" && authorText.trim()) {
              // Split by common delimiters
              dom.citeAuthors.value = authorText
                .split(/[,;]\s*/)
                .filter(Boolean)
                .join("\n");
            }
            console.log("✅ Authors populated:", dom.citeAuthors.value);
          } else {
            console.warn("⚠️ No author data found in response");
          }

          // Date: Try multiple formats and field names
          console.log("📅 Date data received:", {
            publishDate: data.publishDate,
            date: data.date,
            published: data.published,
            year: data.year,
            month: data.month,
            day: data.day,
          });

          const dateString =
            data.publishDate || data.date || data.published || "";

          if (dateString) {
            // Try parsing YYYY-MM-DD or YYYY/MM/DD format
            const parts = dateString.split(/[-/]/);
            if (parts.length >= 1 && dom.citeYear)
              dom.citeYear.value = parts[0];
            if (parts.length >= 2 && dom.citeMonth)
              dom.citeMonth.value = parts[1];
            if (parts.length >= 3 && dom.citeDay) dom.citeDay.value = parts[2];
            console.log("✅ Date populated:", {
              year: parts[0],
              month: parts[1],
              day: parts[2],
            });
          } else if (data.year || data.month || data.day) {
            // Fallback to individual fields
            if (data.year && dom.citeYear) dom.citeYear.value = data.year;
            if (data.month && dom.citeMonth) dom.citeMonth.value = data.month;
            if (data.day && dom.citeDay) dom.citeDay.value = data.day;
            console.log("✅ Date populated (individual):", {
              year: data.year,
              month: data.month,
              day: data.day,
            });
          } else {
            console.warn("⚠️ No date data found in response");
          }

          // Refresh the citation preview
          CitationManager.refresh();

          // Better success message showing what was extracted
          const extracted = [];
          if (data.title) extracted.push("title");
          if (authorText) extracted.push("author");
          if (dateString || data.year) extracted.push("date");
          if (data.siteName || data.website) extracted.push("source");

          const message =
            extracted.length > 0
              ? `Extracted: ${extracted.join(", ")} ✨`
              : "Extracted metadata (some fields may be empty)";
          UIUtils.toast(message);
        } else {
          UIUtils.toast(result.error || "Could not find citation info");
        }
      } catch (error) {
        console.error("Extraction error:", error);
        UIUtils.toast("Extraction failed");
      } finally {
        // 5. Restore UI
        if (extractStatus) extractStatus.classList.add("hidden");
        extractBtn.disabled = false;
        extractBtn.style.opacity = "1";
      }
    });

    // Setup input listeners for live citation updates
    const citationInputs = [
      dom.citeStyle,
      dom.citeType,
      dom.citeAuthors,
      dom.citeTitle,
      dom.citeContainer,
      dom.citeYear,
      dom.citeMonth,
      dom.citeDay,
      dom.citeUrl,
      dom.citeAccessed,
      dom.citeEdition,
    ];

    citationInputs.forEach((el) => {
      el?.addEventListener("input", () => CitationManager.refresh());
      el?.addEventListener("change", () => CitationManager.refresh());
    });

    // Copy button
    dom.citeCopy?.addEventListener("click", async () => {
      await CitationManager.copy();
    });

    // Cancel button
    dom.citeCancel?.addEventListener("click", () => {
      UIUtils.hideOverlay("citation-overlay");
      CitationManager.clear();
    });

    // Back button
    dom.citationBack?.addEventListener("click", () => {
      UIUtils.hideOverlay("citation-overlay");
      CitationManager.clear();
    });
  }
}

// ============================================
// PART 19: AI SUMMARY HANDLERS
// ============================================

class AISummaryHandlers {
  static setup() {
    // Summarize button
    dom.summarizeBtn?.addEventListener("click", async () => {
      const text = (dom.summaryInput?.value || "").trim();

      if (!text) {
        UIUtils.toast("Paste text to summarize");
        return;
      }

      dom.summarizeBtn.disabled = true;
      dom.summarizeBtn.textContent = "Summarizing…";

      try {
        await aiRateLimiter.throttle();
        const out = await summarizeText(text);

        if (!out.ok) {
          if (out.reason === "network_error") {
            UIUtils.toast("Network error - try again");
            return;
          }
          UIUtils.toast(`Failed: ${out.error || out.reason}`);
          return;
        }

        const box = dom.summaryResult?.querySelector(".summary-content");
        if (dom.summaryResult) dom.summaryResult.classList.remove("hidden");
        if (box) box.textContent = out.summary;
        UIUtils.toast("Summary ready");
      } catch (error) {
        console.error(error);
        UIUtils.toast("Unexpected error");
      } finally {
        dom.summarizeBtn.disabled = false;
        dom.summarizeBtn.textContent = "Generate Summary";
      }
    });

    // Copy summary button
    dom.copySummaryBtn?.addEventListener("click", async () => {
      const box = dom.summaryResult?.querySelector(".summary-content");
      const text = box?.textContent?.trim() || "";

      if (!text) {
        UIUtils.toast("No summary to copy");
        return;
      }

      try {
        await navigator.clipboard.writeText(text);

        // Visual feedback
        const originalText = dom.copySummaryBtn.textContent;
        dom.copySummaryBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          dom.copySummaryBtn.textContent = originalText;
        }, 1500);

        UIUtils.toast("Summary copied!");
      } catch (error) {
        console.error("Copy failed:", error);
        UIUtils.toast("Copy failed");
      }
    });
  }
}

// ============================================
// PART 20: SETTINGS HANDLERS
// ============================================

class SettingsHandlers {
  static setup() {
    // Shuffle theme button
    dom.shuffleThemeBtn?.addEventListener("click", async () => {
      await ThemeManager.shuffle();
    });

    // Export button
    dom.exportBtn?.addEventListener("click", async () => {
      const items = state.getItems();
      if (items.length === 0) {
        UIUtils.toast("No items to export");
        return;
      }

      try {
        const filename = exportItems(items, dom.exportFormat?.value || "txt");
        UIUtils.toast(`Exported ${items.length} items`);
      } catch (error) {
        console.error(error);
        UIUtils.toast("Export failed");
      }
    });

    // Import button
    dom.importBtn?.addEventListener("click", () => {
      const triggerImport = state.getFileImporter();
      if (triggerImport) {
        triggerImport();
      } else {
        UIUtils.toast("Import not ready");
      }
    });

    // Smart Pen connect button (placeholder - coming soon)
    document
      .getElementById("connect-smartpen")
      ?.addEventListener("click", () => {
        UIUtils.toast("🖊️ Smart Pen integration coming soon!");
      });

    // Dark mode, font family, and font size changes
    [dom.fontFamily, dom.fontSize].forEach((el) => {
      el?.addEventListener("change", async () => {
        await SettingsManager.save();
      });
    });

    // Font size display update
    dom.fontSize?.addEventListener("input", (e) => {
      const display = document.getElementById("fontSize-value");
      if (display) display.textContent = e.target.value;
    });
  }
}

// ============================================
// PART 21: AUTH HANDLERS
// ============================================

class AuthHandlers {
  static setup() {
    // Sign up button
    dom.signupBtn?.addEventListener("click", async () => {
      const em = (dom.email?.value || "").trim();
      const pw = dom.password?.value || "";

      if (!em || !pw) {
        UIUtils.toast("Enter email and password");
        return;
      }

      if (pw.length < 6) {
        UIUtils.toast("Password min 6 chars");
        return;
      }

      const { error } = await signUpWithEmail(em, pw);
      if (error) {
        UIUtils.toast(error.message);
        return;
      }

      UIUtils.toast("Check email to verify!");
    });

    // Sign in button
    dom.signinBtn?.addEventListener("click", async () => {
      const em = (dom.email?.value || "").trim();
      const pw = dom.password?.value || "";

      if (!em || !pw) {
        UIUtils.toast("Enter email and password");
        return;
      }

      console.log("🔐 Attempting sign-in with:", em);

      dom.signinBtn.disabled = true;
      dom.signinBtn.textContent = "Signing in...";

      const { user, error } = await signInWithEmail(em, pw);

      if (error) {
        console.error("❌ Sign-in error:", error.message);
        UIUtils.toast(error.message);
        dom.signinBtn.disabled = false;
        dom.signinBtn.textContent = "Sign in";
        return;
      }

      if (!user) {
        console.error("❌ No user returned from sign-in");
        UIUtils.toast("Sign-in failed - no user returned");
        dom.signinBtn.disabled = false;
        dom.signinBtn.textContent = "Sign in";
        return;
      }

      console.log("✅ Sign-in successful!");
      console.log("👤 User ID:", user.id);
      console.log("📧 Email:", user.email);

      await new Promise((resolve) =>
        setTimeout(resolve, SESSION_STABILIZE_DELAY)
      );

      state.setUser(user);
      AuthManager.updateStatus();

      if (dom.authView) dom.authView.style.display = "none";
      if (dom.appView) {
        dom.appView.style.display = "block";
        dom.appView.classList.remove("hidden");
      }

      dom.signinBtn.disabled = false;
      dom.signinBtn.textContent = "Sign in";

      UIUtils.toast("Signed in!");

      await ItemManager.load();
      await AuthManager.checkForMigration();
    });

    // Google Sign-in button
    dom.googleSigninBtn?.addEventListener("click", async () => {
      this.handleGoogleSignIn();
    });
  }

  static async handleGoogleSignIn() {
    try {
      console.log("🔵 Google button clicked");

      dom.googleSigninBtn.disabled = true;
      dom.googleSigninBtn.textContent = "Opening Google...";

      console.log("🌐 Using tab-based OAuth...");

      const result = await signInWithGoogleExtension();

      if (!result.success) {
        console.error("❌ OAuth initialization failed:", result.error);
        UIUtils.toast(
          "Google sign-in failed: " + (result.error?.message || "Unknown error")
        );
        this.resetGoogleButton();
        return;
      }

      console.log("✅ OAuth tab opened");
      UIUtils.toast("Complete sign-in in Google tab, then reopen this popup");

      // Reset button
      this.resetGoogleButton();

      // Close popup - user will reopen after OAuth completes
      window.close();
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      UIUtils.toast("Sign-in failed: " + error.message);
      this.resetGoogleButton();
    }
  }

  static resetGoogleButton() {
    dom.googleSigninBtn.disabled = false;
    dom.googleSigninBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    `;
  }
}

// ============================================
// PART 22: SEARCH AND SORT HANDLERS
// ============================================

class SearchSortHandlers {
  static setup() {
    // Search input
    dom.searchInput?.addEventListener("input", async () => {
      const query = dom.searchInput.value || "";
      await ItemManager.search(query);
    });

    // Sort select
    dom.sortSelect?.addEventListener("change", async () => {
      const sortBy = dom.sortSelect.value;
      await SettingsManager.saveSortPreference(sortBy);
      const sorted = SortUtils.sortItems(state.getItems(), sortBy);
      ItemRenderer.renderList(sorted);
      UIUtils.toast(
        `Sorted by ${dom.sortSelect.options[dom.sortSelect.selectedIndex].text}`
      );
    });
  }
}

// ============================================
// PART 23: KEYBOARD SHORTCUTS
// ============================================

class KeyboardHandlers {
  static setup() {
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!dom.editOverlay?.classList.contains("hidden")) {
          dom.editSave?.click();
        } else {
          dom.saveBtn?.click();
        }
        return;
      }

      // Escape: Close overlays or clear
      if (e.key === "Escape") {
        if (!dom.editOverlay?.classList.contains("hidden")) {
          UIUtils.hideOverlay("edit-overlay");
          state.clearEditItemId();
          return;
        }
        if (!dom.citationOverlay?.classList.contains("hidden")) {
          UIUtils.hideOverlay("citation-overlay");
          CitationManager.clear();
          return;
        }
        const openDropdown = document.querySelector(".more-dropdown.show");
        if (openDropdown) {
          openDropdown.classList.remove("show");
          return;
        }
        PreviewManager.clear();
      }

      // Alt + 1-4: Switch tabs
      if (e.altKey && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        const tabs = ["collect", "saved", "summary", "settings"];
        const tabIndex = parseInt(e.key) - 1;
        if (tabs[tabIndex]) {
          const btn = document.querySelector(
            `.tab-btn[data-tab="${tabs[tabIndex]}"]`
          );
          btn?.click();
        }
      }

      // Ctrl/Cmd + F: Focus search (in saved tab)
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        const savedTab = dom.byId("saved-tab");
        if (savedTab?.classList.contains("active")) {
          e.preventDefault();
          dom.searchInput?.focus();
        }
      }
    });
  }
}

// ============================================
// PART 24: MISCELLANEOUS HANDLERS
// ============================================

class MiscHandlers {
  static setupAnimatedBackground() {
    window.addEventListener(
      "pointermove",
      (e) => {
        const r = document.body.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(100, ((e.clientX - r.left) / r.width) * 100)
        );
        const y = Math.max(
          0,
          Math.min(100, ((e.clientY - r.top) / r.height) * 100)
        );
        const root = document.documentElement.style;
        root.setProperty("--mx", x + "%");
        root.setProperty("--my", y + "%");
      },
      { passive: true }
    );
  }

  static setupSaveButtonObserver() {
    new MutationObserver(() => {
      PreviewManager.updateSaveEnabled();
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  static setupDraftAutoSave() {
    dom.tagsInput?.addEventListener(
      "input",
      UIUtils.debounce(() => DraftManager.save(), 500)
    );
    dom.notesInput?.addEventListener(
      "input",
      UIUtils.debounce(() => DraftManager.save(), 500)
    );
  }

  static setupFileImporter() {
    const triggerImport = initFileImporter({
      onPreview: (text, fileName) => {
        PreviewManager.apply(text, "", fileName);
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelector('.tab-btn[data-tab="collect"]')
          ?.classList.add("active");
        UIUtils.showSection("collect-tab");
      },
      onToast: UIUtils.toast,
      onAutoSave: async (text, fileName) => {
        await addItem({
          text,
          sourceTitle: fileName,
          sourceUrl: "",
          tags: ["imported"],
          note: `Imported from ${fileName}`,
        });
        await ItemManager.load();
        UIUtils.toast("Imported!");
      },
    });
    state.setFileImporter(triggerImport);
  }
}

// ============================================
// PART 25: OAUTH CALLBACK PROCESSING
// ============================================

class OAuthProcessor {
  static async process() {
    const { oauthCallback, oauthTimestamp, oauthInProgress } =
      await chrome.storage.local.get([
        "oauthCallback",
        "oauthTimestamp",
        "oauthInProgress",
      ]);

    // Check if we have a fresh OAuth callback
    if (
      oauthCallback &&
      Date.now() - (oauthTimestamp || 0) < OAUTH_CALLBACK_TIMEOUT
    ) {
      console.log("🔐 Processing OAuth callback...");

      try {
        const { success, error } = await processOAuthCallback(oauthCallback);

        if (success) {
          console.log("✅ OAuth callback processed");

          // Wait for Supabase session to establish
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Get session
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError || !session?.user) {
            throw new Error("No session after OAuth");
          }

          console.log("✅ Session confirmed:", session.user.email);
          state.setUser(session.user);

          // Clean up OAuth storage
          await chrome.storage.local.remove([
            "oauthCallback",
            "oauthTimestamp",
            "oauthInProgress",
            "oauthStartTime",
          ]);

          // Remove boot splash and show app
          document.body.classList.remove("booting");
          document.body.classList.add("ready");

          if (dom.authView) dom.authView.style.display = "none";
          if (dom.appView) {
            dom.appView.style.display = "flex";
            dom.appView.classList.remove("hidden");
          }

          // Force reflow
          void dom.appView?.offsetHeight;

          // Wait for browser to paint
          await new Promise((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve);
            });
          });

          // Update auth status
          console.log("🎨 Updating auth status...");
          this.updateAuthStatusDirectly();

          // Load items and check migration
          await ItemManager.load();
          await AuthManager.checkForMigration();

          UIUtils.toast("Signed in with Google!");
          console.log("✅ Google OAuth complete!");

          return true; // OAuth was processed
        } else {
          console.error("❌ OAuth failed:", error);
          UIUtils.toast("Google sign-in failed");
          await chrome.storage.local.remove([
            "oauthCallback",
            "oauthTimestamp",
            "oauthInProgress",
            "oauthStartTime",
          ]);
        }
      } catch (error) {
        console.error("❌ OAuth exception:", error);
        UIUtils.toast("Sign-in error: " + error.message);
        await chrome.storage.local.remove([
          "oauthCallback",
          "oauthTimestamp",
          "oauthInProgress",
          "oauthStartTime",
        ]);
      }
    }

    // Clean up stale OAuth attempts (older than 5 minutes)
    if (oauthInProgress) {
      const { oauthStartTime } = await chrome.storage.local.get(
        "oauthStartTime"
      );
      if (Date.now() - (oauthStartTime || 0) > 300000) {
        console.log("🧹 Cleaning up stale OAuth attempt");
        await chrome.storage.local.remove([
          "oauthInProgress",
          "oauthStartTime",
        ]);
      }
    }

    return false; // OAuth was not processed
  }

  static updateAuthStatusDirectly() {
    const user = state.getUser();

    if (dom.authStatus) dom.authStatus.classList.add("signed-in");
    if (dom.authIcon) {
      dom.authIcon.textContent = "☁️";
      console.log("✅ Icon updated to:", dom.authIcon.textContent);
    }
    if (dom.authText) {
      dom.authText.textContent = `Signed in as ${user.email}`;
      console.log("✅ Text updated to:", dom.authText.textContent);
    }
    if (dom.authAction) {
      dom.authAction.textContent = "Sign Out";
      dom.authAction.onclick = async () => {
        await AuthManager.signOut();
      };
      console.log("✅ Button updated to:", dom.authAction.textContent);
    }
  }
}

// ============================================
// PART 26: MAIN INITIALIZATION
// ============================================

class AppInitializer {
  static async init() {
    console.log("🚀 Init starting...");

    try {
      // Wait for DOM to be fully ready
      if (document.readyState === "loading") {
        await new Promise((resolve) => {
          document.addEventListener("DOMContentLoaded", resolve);
        });
      }

      // Initialize theme with error handling
      await ThemeManager.init();

      // Load settings with error handling
      await SettingsManager.load().catch((err) => {
        console.warn("⚠️ Settings load failed:", err);
      });

      // Check for OAuth callback first
      const oauthProcessed = await OAuthProcessor.process();

      if (oauthProcessed) {
        console.log("✅ OAuth processed - setting up all handlers...");
        this.setupAllHandlers();
        AuthManager.setupListener();
        MiscHandlers.setupFileImporter();

        const gotLive = await PreviewManager.tryFetchSelection();
        if (!gotLive) {
          await chrome.storage.local.remove("latestHighlight");
          PreviewManager.clear();
        }

        console.log("✅ Init complete (OAuth path)!");
        return;
      }

      // Normal init path - Check user status
      const user = await getCurrentUser();
      console.log("👤 Current user:", user?.email || "guest");

      state.setUser(user);

      // ✅ FIXED: Always show main app view (guest mode supported)
      // Users can sign in via the auth status bar if they want
      await ItemManager.load();
      UIUtils.showMainView();
      AuthManager.updateStatus();

      if (user) {
        console.log("✅ User authenticated - syncing enabled");
      } else {
        console.log("ℹ️ Guest mode - local storage only");
      }

      this.setupAllHandlers();
      AuthManager.setupListener();
      MiscHandlers.setupFileImporter();

      const gotLive = await PreviewManager.tryFetchSelection();
      if (!gotLive) {
        await chrome.storage.local.remove("latestHighlight");
        PreviewManager.clear();
      }

      console.log("✅ Init complete!");
    } catch (error) {
      console.error("❌ Critical init error:", error);

      // ✅ FIXED: Show app view as fallback instead of auth view
      document.body.classList.remove("booting");
      document.body.classList.add("ready");

      // Try to show main app view even on error
      if (dom.appView) {
        dom.appView.style.display = "flex";
        dom.appView.classList.remove("hidden");
        UIUtils.toast("Some features may be limited");
      } else if (dom.authView) {
        // Last resort fallback
        dom.authView.style.display = "flex";
        dom.authView.innerHTML = `
          <div class="card auth-card" style="text-align: center;">
            <h2>⚠️ Initialization Error</h2>
            <p class="sub" style="color: #ef4444;">
              ${
                error.message ||
                "An error occurred while starting the extension"
              }
            </p>
            <button class="primary-btn" onclick="location.reload()">
              Reload Extension
            </button>
          </div>
        `;
      }
    }
  }

  static setupAllHandlers() {
    // Save button
    dom.saveBtn?.addEventListener("click", async () => {
      await ItemManager.save();
    });

    // Setup all handler classes
    NavigationHandlers.setupTabSwitching();
    NavigationHandlers.setupDropdownClosing();
    ItemActionHandlers.setup();
    EditOverlayHandlers.setup();
    CitationOverlayHandlers.setup();
    AISummaryHandlers.setup();
    SettingsHandlers.setup();
    AuthHandlers.setup();
    SearchSortHandlers.setup();
    KeyboardHandlers.setup();
    MessageHandler.setup();
    MiscHandlers.setupAnimatedBackground();
    MiscHandlers.setupSaveButtonObserver();
    MiscHandlers.setupDraftAutoSave();
  }
}

// ============================================
// START THE APPLICATION
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    AppInitializer.init();
  });
} else {
  AppInitializer.init();
}
