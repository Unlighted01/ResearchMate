// popup.js - Clean version with Supabase auth
import { validateItemData, sanitizeText } from "../../lib/validation.js";
import { aiRateLimiter } from "../../lib/rateLimiter.js";
import { summarizeText, setApiKey, getApiKey } from "../../lib/ai.js";
import { buildCitation } from "../../lib/citation.js";
import { initFileImporter } from "../../lib/fileImport.js";
import { exportItems } from "../../lib/fileExport.js";
import {
  getAllItems,
  addItem,
  updateItem,
  deleteItem,
} from "../../lib/storage.js";
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as supabaseSignOut,
  onAuthStateChange,
  getCurrentUser,
  processOAuthCallback, // ✅ Add this
  supabase, // ✅ Add this
} from "../../lib/supabase.js";

/* ---------- DOM helpers ---------- */
const byId = (id) => document.getElementById(id);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Views
const authView = byId("auth");
const appView = byId("app");

// Main UI
const tagsInput = byId("tags-input");
const notesInput = byId("notes-input");
const saveBtn = byId("save-btn");
const savedList = byId("saved-items-list");
const emptyState = byId("empty-state");
const searchInput = byId("search-input");
const sortSelect = byId("sort-select");

// Edit overlay
const editOverlay = byId("edit-overlay");
const editBack = byId("edit-back");
const editTags = byId("edit-tags");
const editNotes = byId("edit-notes");
const editMeta = byId("edit-meta");
const editSave = byId("edit-save");
const editCancel = byId("edit-cancel");
let editItemId = null;

// Citation overlay
const citationOverlay = byId("citation-overlay");
const citationBack = byId("citation-back");
const citeStyle = byId("cite-style");
const citeType = byId("cite-type");
const citeAuthors = byId("cite-authors");
const citeTitle = byId("cite-title");
const citeContainer = byId("cite-container");
const citeYear = byId("cite-year");
const citeMonth = byId("cite-month");
const citeDay = byId("cite-day");
const citeUrl = byId("cite-url");
const citeAccessed = byId("cite-accessed");
const citeEdition = byId("cite-edition");
const citeOutput = byId("cite-output");
const citeCopy = byId("cite-copy");
const citeCancel = byId("cite-cancel");
const citationMeta = byId("citation-meta");

// Summary
const summaryInput = byId("summary-input");
const summarizeBtn = byId("summarize-btn");
const summaryResult = byId("summary-result");
const aiKeyInput = byId("aiKey");
const saveAIKeyBtn = byId("saveAIKey");

// Settings
const shuffleThemeBtn = byId("shuffleTheme");
const exportBtn = byId("exportData");
const importBtn = byId("importData");
const exportFormat = byId("exportFormat");
const darkMode = byId("darkMode");
const fontFamily = byId("fontFamily");
const fontSize = byId("fontSize");
const signupBtn = byId("signup");
const signinBtn = byId("signin");
const signoutBtn = byId("signout");
const email = byId("email");
const password = byId("password");

/* ---------- State ---------- */
let itemsCache = [];
let triggerFileImport = null;
let currentUser = null;

/* ---------- Utils ---------- */
function toast(msg) {
  const t = byId("toast");
  if (!t) return alert(msg);
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 1800);
}

function clearPreview() {
  const st = byId("selected-text");
  const cm = byId("captured-meta");
  if (st) st.textContent = "";
  if (cm) cm.textContent = "";
}

function debounce(func, wait) {
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

/* ---------- Overlays ---------- */
function showOverlay(overlayId) {
  document.body.classList.add("overlay-active");
  const overlay = byId(overlayId);
  if (overlay) overlay.classList.remove("hidden", "closing");
}

function hideOverlay(overlayId) {
  const overlay = byId(overlayId);
  if (overlay) {
    overlay.classList.add("closing");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("closing");
      document.body.classList.remove("overlay-active");
    }, 300);
  }
}

function showSection(id) {
  document
    .querySelectorAll(".tab-content")
    .forEach((s) => s.classList.remove("active"));
  byId(id)?.classList.add("active");
}

/* ---------- Citations ---------- */
function getCitationData() {
  return {
    style: citeStyle?.value || "apa",
    type: citeType?.value || "web",
    authors: (citeAuthors?.value || "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean),
    title: citeTitle?.value?.trim() || "",
    container: citeContainer?.value?.trim() || "",
    year: citeYear?.value?.trim() || "",
    month: citeMonth?.value?.trim() || "",
    day: citeDay?.value?.trim() || "",
    url: citeUrl?.value?.trim() || "",
    accessed: citeAccessed?.value?.trim() || "",
    edition: citeEdition?.value?.trim() || "",
  };
}

function refreshCitation() {
  if (!citeOutput) return;
  try {
    const citation = buildCitation(getCitationData());
    citeOutput.innerHTML = citation || "";
  } catch (error) {
    console.error("Citation error:", error);
    citeOutput.textContent = "Error generating citation";
  }
}

function clearCitationForm() {
  if (citeAuthors) citeAuthors.value = "";
  if (citeTitle) citeTitle.value = "";
  if (citeContainer) citeContainer.value = "";
  if (citeYear) citeYear.value = "";
  if (citeMonth) citeMonth.value = "";
  if (citeDay) citeDay.value = "";
  if (citeUrl) citeUrl.value = "";
  if (citeAccessed) citeAccessed.value = "";
  if (citeEdition) citeEdition.value = "";
  if (citeOutput) citeOutput.innerHTML = "";
  if (citationMeta) citationMeta.textContent = "";
}

/* ---------- Theme ---------- */
function hslToRgb(h, s, l) {
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

function setRgbVar(name, h, s, l) {
  const [r, g, b] = hslToRgb(h, s, l);
  document.documentElement.style.setProperty(name, `${r}, ${g}, ${b}`);
}

async function applyDynamicTheme() {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  const dark = !!rmSettings.dark;
  let seed = rmSettings.themeSeed;
  if (typeof seed !== "number") {
    seed = Math.floor(Date.now() / 86400000) % 360;
    rmSettings.themeSeed = seed;
    await chrome.storage.local.set({ rmSettings });
  }

  const root = document.documentElement.style;
  const accentH = seed % 360;
  root.setProperty("--accent", `hsl(${accentH} 70% ${dark ? 55 : 45}%)`);
  root.setProperty(
    "--grad-start",
    `hsl(${(accentH + 10) % 360} 80% ${dark ? 24 : 84}%)`
  );
  root.setProperty(
    "--grad-end",
    `hsl(${(accentH + 60) % 360} 80% ${dark ? 28 : 78}%)`
  );

  setRgbVar("--color1", accentH, 85, dark ? 60 : 55);
  setRgbVar("--color2", (accentH + 40) % 360, 85, dark ? 62 : 58);
  setRgbVar("--color3", (accentH + 80) % 360, 85, dark ? 64 : 60);
  setRgbVar("--color4", (accentH + 160) % 360, 78, dark ? 58 : 50);
  setRgbVar("--color5", (accentH + 200) % 360, 78, dark ? 52 : 48);
  setRgbVar("--color-interactive", (accentH + 300) % 360, 85, dark ? 65 : 55);
  root.setProperty(
    "--color-bg1",
    `hsl(${(accentH + 335) % 360} 32% ${dark ? 10 : 98}%)`
  );
  root.setProperty(
    "--color-bg2",
    `hsl(${(accentH + 30) % 360} 32% ${dark ? 14 : 96}%)`
  );
}

async function loadSettings() {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  const { dark = false, ff = "system-ui", fs = 14 } = rmSettings;
  if (darkMode) darkMode.checked = dark;
  if (fontFamily) fontFamily.value = ff;
  if (fontSize) {
    fontSize.value = fs;
    const display = document.getElementById("fontSize-value");
    if (display) display.textContent = fs;
  }
  document.body.classList.toggle("dark", !!dark);
  document.body.style.fontFamily = ff;
  document.body.style.fontSize = fs + "px";
}

async function saveSettings() {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  rmSettings.dark = !!darkMode?.checked;
  rmSettings.ff = fontFamily?.value || "system-ui";
  rmSettings.fs = Number(fontSize?.value) || 14;
  await chrome.storage.local.set({ rmSettings });
  document.body.classList.toggle("dark", rmSettings.dark);
  document.body.style.fontFamily = rmSettings.ff;
  document.body.style.fontSize = rmSettings.fs + "px";
  await applyDynamicTheme();
}

/* ---------- Sorting ---------- */
function sortItems(items, sortBy) {
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

async function loadSortPreference() {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  const sortBy = rmSettings.sortBy || "date-desc";
  if (sortSelect) sortSelect.value = sortBy;
  return sortBy;
}

async function saveSortPreference(sortBy) {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  rmSettings.sortBy = sortBy;
  await chrome.storage.local.set({ rmSettings });
}

/* ---------- Selection ---------- */
function applyPreview(text, url, title) {
  const st = byId("selected-text");
  const cm = byId("captured-meta");
  if (!st || !cm) return;
  st.textContent = text || "";
  try {
    cm.textContent = url ? new URL(url).hostname : "";
  } catch {
    cm.textContent = "";
  }
  chrome.storage.local.set({
    latestHighlight: {
      text: text || "",
      sourceUrl: url || "",
      sourceTitle: title || "",
      createdAt: Date.now(),
    },
  });
}

async function tryFetchSelection() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return false;

    try {
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: "getSelection",
      });
      const txt = (res?.text || "").trim();
      if (txt) {
        applyPreview(txt, res?.url || "", res?.title || "");
        return true;
      }
    } catch {}

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
        applyPreview(txt, result?.url || "", result?.title || "");
        return true;
      }
    } catch {}

    return false;
  } catch {
    return false;
  }
}

function updateSaveEnabled() {
  const st = byId("selected-text");
  if (saveBtn) saveBtn.disabled = !(st && (st.textContent || "").trim());
}

function saveDraft() {
  chrome.storage.local.set({
    researchDraft: {
      tags: tagsInput?.value || "",
      notes: notesInput?.value || "",
      timestamp: Date.now(),
    },
  });
}

function loadDraft() {
  chrome.storage.local.get("researchDraft").then(({ researchDraft }) => {
    if (researchDraft && Date.now() - researchDraft.timestamp < 3600000) {
      if (tagsInput) tagsInput.value = researchDraft.tags;
      if (notesInput) notesInput.value = researchDraft.notes;
    }
  });
}

/* ---------- Messaging ---------- */
chrome.runtime.onMessage.addListener(async (msg) => {
  console.log("📨 Message:", msg.type);

  if (msg?.type === "latestHighlight") {
    const p = msg.payload || {};
    applyPreview(p.text || "", p.sourceUrl || "", p.sourceTitle || "");
  }

  if (msg?.type === "latestHighlightCleared") {
    clearPreview();
  }

  if (msg?.type === "itemSaved") {
    if (byId("saved-tab")?.classList.contains("active")) loadItems();
  }

  if (msg?.type === "contextMenuSave") {
    const { pendingSave } = await chrome.storage.local.get("pendingSave");
    if (pendingSave && Date.now() - pendingSave.timestamp < 60000) {
      try {
        await addItem({
          text: pendingSave.text,
          sourceUrl: pendingSave.sourceUrl,
          sourceTitle: pendingSave.sourceTitle,
          tags: [],
          note: "",
        });
        await chrome.storage.local.remove("pendingSave");
        toast("Saved from context menu!");
        await loadItems();
      } catch (e) {
        console.error("Context save failed:", e);
        toast("Save failed");
      }
    }
  }
});

/* ---------- Load & Render ---------- */
async function loadItems() {
  try {
    itemsCache = await getAllItems();
    console.log("✅ Loaded", itemsCache.length, "items");

    if (!itemsCache.length) {
      if (savedList) savedList.innerHTML = "";
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");
    const sortBy = await loadSortPreference();
    const sorted = sortItems(itemsCache, sortBy);
    renderFiltered(sorted);
  } catch (e) {
    console.error("❌ Load error:", e);
    itemsCache = [];
    if (savedList) savedList.innerHTML = "";
    emptyState?.classList.remove("hidden");
  }
}

function renderFiltered(list) {
  if (!savedList) return;
  savedList.innerHTML = "";

  if (!list.length) {
    emptyState?.classList.remove("hidden");
    return;
  }

  emptyState?.classList.add("hidden");

  list.forEach((item) => {
    if (!item || !item.id) return;

    const div = document.createElement("div");
    div.className = "item";
    div.tabIndex = 0;

    const title = item.sourceTitle || item.sourceUrl || "Untitled";
    const text = (item.text || "").slice(0, 240).replace(/\s+/g, " ");

    let domain = "";
    try {
      domain = item.sourceUrl ? new URL(item.sourceUrl).hostname : "";
    } catch {}

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
        ${
          item.sourceUrl
            ? `<button data-act="open" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
          Open
        </button>`
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

    savedList.appendChild(div);
  });
}

/* ---------- Event Listeners ---------- */

// Tab switching
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  $$(".tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  showSection(btn.dataset.tab + "-tab");
});

// Save button
saveBtn?.addEventListener("click", async () => {
  let st = byId("selected-text");
  if (!st || !(st.textContent || "").trim()) {
    const ok = await tryFetchSelection();
    st = byId("selected-text");
    if (!ok || !st || !(st.textContent || "").trim()) {
      return toast("No selection found");
    }
  }

  const text = sanitizeText(st.textContent);
  const tags = (tagsInput.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const { latestHighlight } = await chrome.storage.local.get("latestHighlight");

  const payload = {
    text,
    tags,
    note: (notesInput.value || "").trim().slice(0, 1000),
    sourceUrl: latestHighlight?.sourceUrl || "",
    sourceTitle: latestHighlight?.sourceTitle || "",
  };

  const validation = validateItemData(payload);
  if (!validation.valid) return toast(validation.errors[0]);

  try {
    await addItem(payload);
    tagsInput.value = "";
    notesInput.value = "";
    await chrome.storage.local.remove("latestHighlight");
    clearPreview();
    updateSaveEnabled();
    toast("Saved!");
    await loadItems();
  } catch (e) {
    console.error(e);
    toast("Save failed: " + (e.message || "Unknown error"));
  }
});

// Search
searchInput?.addEventListener("input", async () => {
  const q = (searchInput.value || "").toLowerCase();
  const filtered = itemsCache.filter(
    (x) =>
      (x.text || "").toLowerCase().includes(q) ||
      (x.sourceTitle || "").toLowerCase().includes(q) ||
      (x.sourceUrl || "").toLowerCase().includes(q) ||
      (Array.isArray(x.tags) ? x.tags.join(" ") : "").toLowerCase().includes(q)
  );
  const sortBy = sortSelect?.value || "date-desc";
  renderFiltered(sortItems(filtered, sortBy));
});

// Sort
sortSelect?.addEventListener("change", async () => {
  await saveSortPreference(sortSelect.value);
  renderFiltered(sortItems(itemsCache, sortSelect.value));
  toast(`Sorted by ${sortSelect.options[sortSelect.selectedIndex].text}`);
});

// Item actions
savedList?.addEventListener("click", async (e) => {
  const moreBtn = e.target.closest("[data-act='more']");
  if (moreBtn) {
    e.stopPropagation();
    const id = moreBtn.dataset.id;
    const dropdown = savedList.querySelector(`.more-dropdown[data-id="${id}"]`);
    savedList.querySelectorAll(".more-dropdown").forEach((d) => {
      if (d !== dropdown) d.classList.remove("show");
    });
    dropdown?.classList.toggle("show");
    return;
  }

  const btn = e.target.closest("button[data-act]:not([data-act='more'])");
  if (!btn) return;

  const action = btn.dataset.act;
  const itemId = btn.dataset.id;
  const item = itemsCache.find((x) => String(x.id) === String(itemId));

  if (!item) {
    console.error("Item not found:", itemId);
    toast("Item not found - refreshing");
    await loadItems();
    return;
  }

  if (action === "copy") {
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
      toast("Copied!");
    } catch {
      toast("Copy failed");
    }
    return;
  }

  if (action === "open" && item.sourceUrl) {
    chrome.tabs.create({ url: item.sourceUrl });
    return;
  }

  if (action === "edit") {
    editItemId = itemId;
    const title = item.sourceTitle || item.sourceUrl || "Untitled";
    let domain = "";
    try {
      domain = item.sourceUrl ? new URL(item.sourceUrl).hostname : "";
    } catch {}
    editMeta.textContent = domain ? `${title} — ${domain}` : title;
    editTags.value = Array.isArray(item.tags) ? item.tags.join(", ") : "";
    editNotes.value = item.note || "";
    savedList
      .querySelectorAll(".more-dropdown")
      .forEach((d) => d.classList.remove("show"));
    showOverlay("edit-overlay");
    return;
  }

  if (action === "cite") {
    clearCitationForm();
    if (citeTitle) citeTitle.value = item.sourceTitle || "";
    if (citeUrl) citeUrl.value = item.sourceUrl || "";
    if (item.sourceUrl && citeContainer) {
      try {
        citeContainer.value = new URL(item.sourceUrl).hostname.replace(
          /^www\./,
          ""
        );
      } catch {}
    }
    if (item.createdAt && citeYear) {
      try {
        const date = new Date(item.createdAt);
        citeYear.value = date.getFullYear().toString();
        citeMonth.value = (date.getMonth() + 1).toString();
        citeDay.value = date.getDate().toString();
      } catch {}
    }
    if (citationMeta)
      citationMeta.textContent = `Citing: ${
        item.sourceTitle || item.sourceUrl || "Untitled"
      }`;
    refreshCitation();
    savedList
      .querySelectorAll(".more-dropdown")
      .forEach((d) => d.classList.remove("show"));
    showOverlay("citation-overlay");
    return;
  }

  if (action === "delete") {
    if (!confirm("Delete permanently?")) return;
    try {
      await deleteItem(itemId);
      toast("Deleted");
      await loadItems();
    } catch (e) {
      console.error(e);
      toast("Delete failed");
    }
  }
});

// Close dropdowns
document.addEventListener("click", (e) => {
  if (!e.target.closest(".more-menu")) {
    document
      .querySelectorAll(".more-dropdown")
      .forEach((d) => d.classList.remove("show"));
  }
});

// Edit overlay
editSave?.addEventListener("click", async () => {
  if (!editItemId) return toast("No item selected");
  const tags = (editTags.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const note = (editNotes.value || "").trim();
  try {
    await updateItem(editItemId, { tags, note });
    toast("Saved");
    await loadItems();
    hideOverlay("edit-overlay");
    editItemId = null;
  } catch (e) {
    console.error(e);
    toast("Update failed");
  }
});

editCancel?.addEventListener("click", () => {
  hideOverlay("edit-overlay");
  editItemId = null;
});

editBack?.addEventListener("click", () => {
  hideOverlay("edit-overlay");
  editItemId = null;
});

// Citation overlay
[
  citeStyle,
  citeType,
  citeAuthors,
  citeTitle,
  citeContainer,
  citeYear,
  citeMonth,
  citeDay,
  citeUrl,
  citeAccessed,
  citeEdition,
].forEach((el) => {
  el?.addEventListener("input", refreshCitation);
  el?.addEventListener("change", refreshCitation);
});

citeCopy?.addEventListener("click", async () => {
  const html = citeOutput?.innerHTML?.trim() || "";
  const text = citeOutput?.textContent?.trim() || "";
  if (!text) return toast("Fill citation fields first");
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
    toast("Citation copied!");
  } catch (error) {
    console.error("Copy failed:", error);
    toast("Copy failed");
  }
});

citeCancel?.addEventListener("click", () => {
  hideOverlay("citation-overlay");
  clearCitationForm();
});

citationBack?.addEventListener("click", () => {
  hideOverlay("citation-overlay");
  clearCitationForm();
});

// AI Summary
summarizeBtn?.addEventListener("click", async () => {
  const text = (summaryInput?.value || "").trim();
  if (!text) return toast("Paste text to summarize");
  summarizeBtn.disabled = true;
  summarizeBtn.textContent = "Summarizing…";
  try {
    await aiRateLimiter.throttle();
    const out = await summarizeText(text);
    if (!out.ok) {
      if (out.reason === "missing_api_key") return toast("Add API key first");
      if (out.reason === "network_error") return toast("Network error");
      return toast(`Failed: ${out.error || out.reason}`);
    }
    const box = summaryResult?.querySelector(".summary-content");
    if (summaryResult) summaryResult.classList.remove("hidden");
    if (box) box.textContent = out.summary;
    toast("Summary ready");
  } catch (error) {
    console.error(error);
    toast("Unexpected error");
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = "Generate Summary";
  }
});

saveAIKeyBtn?.addEventListener("click", async () => {
  const value = (aiKeyInput?.value || "").trim();
  if (value === "••••••••••") return toast("Key unchanged");
  await setApiKey(value);
  if (aiKeyInput) aiKeyInput.value = value ? "••••••••••" : "";
  toast(value ? "API key saved" : "API key cleared");
});

// Settings
shuffleThemeBtn?.addEventListener("click", async () => {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  rmSettings.themeSeed = Math.floor(Math.random() * 360);
  await chrome.storage.local.set({ rmSettings });
  await applyDynamicTheme();
  toast("Theme updated");
});

[darkMode, fontFamily, fontSize].forEach((el) =>
  el?.addEventListener("change", saveSettings)
);

fontSize?.addEventListener("input", (e) => {
  const display = document.getElementById("fontSize-value");
  if (display) display.textContent = e.target.value;
});

// Export
exportBtn?.addEventListener("click", async () => {
  if (itemsCache.length === 0) return toast("No items to export");
  try {
    const filename = exportItems(itemsCache, exportFormat?.value || "txt");
    toast(`Exported ${itemsCache.length} items`);
  } catch (error) {
    console.error(error);
    toast("Export failed");
  }
});

// Import
importBtn?.addEventListener("click", () => {
  if (triggerFileImport) {
    triggerFileImport();
  } else {
    toast("Import not ready");
  }
});

// Auto-save drafts
tagsInput?.addEventListener("input", debounce(saveDraft, 500));
notesInput?.addEventListener("input", debounce(saveDraft, 500));

// Save button observer
new MutationObserver(updateSaveEnabled).observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (!editOverlay?.classList.contains("hidden")) {
      editSave?.click();
    } else {
      saveBtn?.click();
    }
    return;
  }
  if (e.key === "Escape") {
    if (!editOverlay?.classList.contains("hidden")) {
      hideOverlay("edit-overlay");
      editItemId = null;
      return;
    }
    if (!citationOverlay?.classList.contains("hidden")) {
      hideOverlay("citation-overlay");
      clearCitationForm();
      return;
    }
    const openDropdown = document.querySelector(".more-dropdown.show");
    if (openDropdown) {
      openDropdown.classList.remove("show");
      return;
    }
    clearPreview();
  }
});

// Animated background
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

// Auth buttons
signupBtn?.addEventListener("click", async () => {
  const em = (email.value || "").trim();
  const pw = password.value || "";
  if (!em || !pw) return toast("Enter email and password");
  if (pw.length < 6) return toast("Password min 6 chars");
  const { error } = await signUpWithEmail(em, pw);
  if (error) return toast(error.message);
  toast("Check email to verify!");
});

signinBtn?.addEventListener("click", async () => {
  const em = (email.value || "").trim();
  const pw = password.value || "";
  if (!em || !pw) return toast("Enter email and password");
  const { error } = await signInWithEmail(em, pw);
  if (error) return toast(error.message);
  toast("Signed in!");
});

signoutBtn?.addEventListener("click", async () => {
  const { error } = await supabaseSignOut();
  if (error) console.error(error);
  toast("Signed out");
});

// Google Sign-in button
const googleSigninBtn = byId("google-signin");

googleSigninBtn?.addEventListener("click", async () => {
  try {
    console.log("🔵 Google button clicked");

    googleSigninBtn.disabled = true;
    googleSigninBtn.textContent = "Opening Google...";

    const { signInWithGoogle } = await import("../../lib/oauth-simple.js");
    const result = await signInWithGoogle();

    if (!result.success) {
      toast("Failed to start Google sign-in");
      googleSigninBtn.disabled = false;
      googleSigninBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        Continue with Google
      `;
    } else {
      // Tab opened, button will re-enable when user returns
      toast("Complete sign-in in the new tab");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    toast("Sign-in failed");
    googleSigninBtn.disabled = false;
  }
});

/* ---------- Initialization ---------- */
(async function init() {
  console.log("🚀 Init starting...");

  await applyDynamicTheme();
  await loadSettings();

  // ✅ Check for OAuth callback FIRST
  const { oauthCallback, oauthTimestamp } = await chrome.storage.local.get([
    "oauthCallback",
    "oauthTimestamp",
  ]);

  if (oauthCallback && Date.now() - (oauthTimestamp || 0) < 60000) {
    console.log("🔑 Processing OAuth callback...");

    const { success, error } = await processOAuthCallback(oauthCallback);

    if (success) {
      toast("Signed in with Google!");
    } else {
      console.error("❌ OAuth processing failed:", error);
      toast("Google sign-in failed");
    }

    // Clear the callback data
    await chrome.storage.local.remove(["oauthCallback", "oauthTimestamp"]);
  }

  // Check current user
  currentUser = await getCurrentUser();
  console.log("👤 Current user on init:", currentUser?.id || "none");

  // Remove booting state and show correct view
  document.body.classList.remove("booting");
  document.body.classList.add("ready");

  if (currentUser) {
    // User is logged in - show app immediately
    if (authView) authView.style.display = "none";
    if (appView) {
      appView.style.display = "block";
      appView.classList.remove("hidden");
    }

    // Load items
    try {
      console.log("📚 Loading items...");
      await loadItems();
      console.log("✅ Items loaded, count:", itemsCache.length);

      if (itemsCache.length > 0) {
        const sortBy = await loadSortPreference();
        const sorted = sortItems(itemsCache, sortBy);
        renderFiltered(sorted);
        console.log("🎨 Rendered", sorted.length, "items");
      }
    } catch (e) {
      console.error("❌ Load error:", e);
    }

    loadDraft();
    updateSaveEnabled();
  } else {
    // No user - show auth
    console.log("❌ No user, showing auth");
    itemsCache = [];
    if (appView) appView.style.display = "none";
    if (authView) authView.style.display = "flex";
  }

  // Set up auth listener for future changes
  onAuthStateChange(async (event, session) => {
    console.log(
      "🔑 Auth changed:",
      event,
      "User:",
      session?.user?.id || "none"
    );
    currentUser = session?.user || null;

    if (currentUser && event === "SIGNED_IN") {
      if (authView) authView.style.display = "none";
      if (appView) {
        appView.style.display = "block";
        appView.classList.remove("hidden");
      }
      await loadItems();
      console.log("✅ Loaded after sign in");
    } else if (!currentUser) {
      itemsCache = [];
      if (savedList) savedList.innerHTML = "";
      if (appView) appView.style.display = "none";
      if (authView) authView.style.display = "flex";
    }
  });

  // File importer
  triggerFileImport = initFileImporter({
    onPreview: (text, fileName) => {
      applyPreview(text, "", fileName);
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelector('.tab-btn[data-tab="collect"]')
        ?.classList.add("active");
      showSection("collect-tab");
    },
    onToast: toast,
    onAutoSave: async (text, fileName) => {
      if (!currentUser) return toast("Sign in first");
      await addItem({
        text,
        sourceTitle: fileName,
        sourceUrl: "",
        tags: ["imported"],
        note: `Imported from ${fileName}`,
      });
      await loadItems();
      toast("Imported!");
    },
  });

  const existingKey = await getApiKey();
  if (aiKeyInput) aiKeyInput.value = existingKey ? "••••••••••" : "";

  const gotLive = await tryFetchSelection();
  if (!gotLive) {
    await chrome.storage.local.remove("latestHighlight");
    clearPreview();
  }

  console.log("✅ Init complete!");
})();
