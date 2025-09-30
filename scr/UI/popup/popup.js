// popup/popup.js
import { validateItemData, sanitizeText } from "../../lib/validation.js";
import { aiRateLimiter } from "../../lib/rateLimiter.js";
import { summarizeText, setApiKey, getApiKey } from "../../lib/ai.js";
import { buildCitation } from "../../lib/citation.js"; // ✅ ADD THIS
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  GoogleAuthProvider, // <-- keep
  signInWithPopup, // <-- keep
} from "../../lib/firebase-init.js";

function handleAsyncError(operation, context = "") {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      const msg = friendlyAuthError(error.code || error.message);
      // nice UI feedback
      toast(msg);
      markInputsError?.();
      shake?.("#auth .auth-card");
      console.error(`${context} failed:`, error);
      return null;
    }
  };
}

// WRAP existing async functions
const safeSignUp = handleAsyncError(async () => {
  const em = (email.value || "").trim();
  const pw = password.value || "";
  if (!em || !pw) {
    toast("Enter email and password");
    markInputsError();
    return;
  }
  if (pw.length < 6) {
    toast("Password must be at least 6 characters");
    markInputsError();
    return;
  }
  await createUserWithEmailAndPassword(auth, em, pw);
  toast("Account created");
  showApp?.();
}, "Sign up");

const safeSignIn = handleAsyncError(async () => {
  const em = (email.value || "").trim();
  const pw = password.value || "";
  if (!em || !pw) {
    toast("Enter email and password");
    markInputsError();
    return;
  }
  await signInWithEmailAndPassword(auth, em, pw);
  toast("Signed in");
  showApp?.();
}, "Sign in");

/* ---------- DOM helpers ---------- */
// Summary tab controls
const summaryInput = document.getElementById("summary-input");
const summarizeBtn = document.getElementById("summarize-btn");
const summaryResult = document.getElementById("summary-result");
const aiKeyInput = document.getElementById("aiKey");
const saveAIKeyBtn = document.getElementById("saveAIKey");

// Settings tab control
const shuffleThemeBtn = document.getElementById("shuffleTheme");
const googleBtn = document.getElementById("google-signin");

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const byId = (id) => document.getElementById(id);

//Edit tab controls
const editTab = byId("edit-tab");
const editTags = byId("edit-tags");
const editNotes = byId("edit-notes");
const editMeta = byId("edit-meta");
const editSave = byId("edit-save");
const editCancel = byId("edit-cancel");
let editItemId = null;

// Citation tab controls
const citationTab = byId("citation-tab");
const citeStyle = byId("cite-style");
const citeType = byId("cite-type");
const citeAuthors = byId("cite-authors");
const citeTitle = byId("cite-title");
const citeContainer = byId("cite-container");
const citeYear = byId("cite-year");
const citeMonth = byId("cite-month");
const citeDay = byId("cite-day");
const citeUrl = byId("cite-url");
const citeOutput = byId("cite-output");
const citeCopy = byId("cite-copy");
const citeCancel = byId("cite-cancel");
const citationMeta = byId("citation-meta");

// Auth and App views
const authView = byId("auth");
const appView = byId("app");
const authLog = byId("auth-log");
const email = byId("email");
const password = byId("password");
const signupBtn = byId("signup");
const signinBtn = byId("signin");
const signoutBtn = byId("signout");

const tagsInput = byId("tags-input");
const notesInput = byId("notes-input");
const saveBtn = byId("save-btn");

const savedList = byId("saved-items-list");
const emptyState = byId("empty-state");
const searchInput = byId("search-input");

const darkMode = byId("darkMode");
const fontFamily = byId("fontFamily");
const fontSize = byId("fontSize");

// --- show/hide helpers ---
// Move the interactive glow with the pointer
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

function friendlyAuthError(codeOrMsg = "") {
  const code = String(codeOrMsg).toLowerCase();
  if (code.includes("invalid-credential"))
    return "Incorrect email or password.";
  if (code.includes("missing-password")) return "Enter your password.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("user-not-found")) return "Account not found.";
  if (code.includes("email-already-in-use")) return "Email is already in use.";
  if (code.includes("too-many-requests"))
    return "Too many attempts. Please try again later.";
  if (code.includes("network-request-failed"))
    return "Network error. Check your connection.";
  return "Sign in failed. Please try again.";
}
function shake(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth; // restart animation
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 400);
}
function markInputsError() {
  [
    document.getElementById("email"),
    document.getElementById("password"),
  ].forEach((i) => {
    if (!i) return;
    i.classList.add("input-error");
    setTimeout(() => i.classList.remove("input-error"), 1200);
  });
}

function showSection(id) {
  document
    .querySelectorAll(".tab-content")
    .forEach((s) => s.classList.remove("active"));
  byId(id)?.classList.add("active");
}

// ✅ ADD CITATION FUNCTIONS
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
  };
}

function refreshCitation() {
  if (!citeOutput) return;
  const data = getCitationData();
  try {
    const citation = buildCitation(data);
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
  if (citeOutput) citeOutput.innerHTML = "";
  if (citationMeta) citationMeta.textContent = "";
}

function openEditItem(itemId) {
  const rec = itemsCache.find((x) => x.id === itemId);
  if (!rec) return toast("Item not found");
  editItemId = itemId;

  const it = rec.data;
  const title = it.sourceTitle || it.sourceUrl || "Untitled";
  const domain = it.sourceUrl ? new URL(it.sourceUrl).hostname : "";
  editMeta.textContent = domain ? `${title} — ${domain}` : title;

  editTags.value = Array.isArray(it.tags) ? it.tags.join(", ") : "";
  editNotes.value = it.note || "";

  showSection("edit-tab");
}

function showApp() {
  authView?.classList.add("hidden");
  appView?.classList.remove("hidden");
}

function showAuth() {
  appView?.classList.add("hidden");
  authView?.classList.remove("hidden");
  if (email) email.value = "";
  if (password) password.value = "";
  const log = document.getElementById("auth-log");
  if (log) log.textContent = ""; // keep the log empty
  clearPreview?.();
}

/* ---------- State ---------- */
let user = null;
let currentProjectId = "default";
let itemsCache = [];

/* ---------- Utils ---------- */
function say(el, msg) {
  if (!el) return;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n${
    el.textContent || ""
  }`;
}
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
async function ensureDefaultProject() {
  try {
    const ref = doc(db, `users/${user.uid}/projects/${currentProjectId}`);
    await setDoc(
      ref,
      { name: "Default", updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch {}
}

function finishBoot() {
  document.body.classList.remove("booting");
  document.body.classList.add("ready");
}

/* ---------- Dynamic Theme ---------- */
function hsl(h, s, l) {
  return `hsl(${h} ${s}% ${l}%)`;
}

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

  // Accent + panel gradient you already had
  const root = document.documentElement.style;
  const accentH = seed % 360;
  const accent = `hsl(${accentH} ${70}% ${dark ? 55 : 45}%)`;
  root.setProperty("--accent", accent);
  root.setProperty(
    "--grad-start",
    `hsl(${(accentH + 10) % 360} 80% ${dark ? 24 : 84}%)`
  );
  root.setProperty(
    "--grad-end",
    `hsl(${(accentH + 60) % 360} 80% ${dark ? 28 : 78}%)`
  );

  // Bubbles palette (RGB triplets)
  setRgbVar("--color1", accentH, 85, dark ? 60 : 55);
  setRgbVar("--color2", (accentH + 40) % 360, 85, dark ? 62 : 58);
  setRgbVar("--color3", (accentH + 80) % 360, 85, dark ? 64 : 60);
  setRgbVar("--color4", (accentH + 160) % 360, 78, dark ? 58 : 50);
  setRgbVar("--color5", (accentH + 200) % 360, 78, dark ? 52 : 48);
  setRgbVar("--color-interactive", (accentH + 300) % 360, 85, dark ? 65 : 55);

  // background stops
  root.setProperty(
    "--color-bg1",
    `hsl(${(accentH + 335) % 360} 32% ${dark ? 10 : 98}%)`
  );
  root.setProperty(
    "--color-bg2",
    `hsl(${(accentH + 30) % 360} 32% ${dark ? 14 : 96}%)`
  );
}

/* ---------- Tabs ---------- */
googleBtn?.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
    // clear any lingering fields and switch view
    if (email) email.value = "";
    if (password) password.value = "";
    showApp?.();
    toast?.("Signed in with Google");
  } catch (e) {
    say(authLog, `Google sign-in failed: ${e.code || e.message}`);
  }
});

const sections = {
  collect: byId("collect-tab"),
  saved: byId("saved-tab"),
  summary: byId("summary-tab"),
  settings: byId("settings-tab"),
};

// Initialize active tab based on URL hash (e.g. #summary), fallback to 'collect'
document.addEventListener("DOMContentLoaded", () => {
  const hash = (location.hash || "").replace(/^#/, "");
  const valid = ["collect", "saved", "summary", "settings"];
  const initial = valid.includes(hash) ? hash : "collect";

  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelector(`.tab-btn[data-tab="${initial}"]`)
    ?.classList.add("active");

  Object.values(sections).forEach((s) => s?.classList.remove("active"));
  sections[initial]?.classList.add("active");
});

document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveBtn?.click();
  }

  // Escape to clear selection
  if (e.key === "Escape") {
    clearPreview();
  }

  // Tab navigation between tabs
  if (e.key === "Tab" && e.altKey) {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll(".tab-btn"));
    const active = document.querySelector(".tab-btn.active");
    const currentIndex = tabs.indexOf(active);
    const nextIndex = (currentIndex + 1) % tabs.length;
    tabs[nextIndex]?.click();
  }
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  $$(".tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  // Use the generic section switcher so ALL .tab-content panels are reset
  showSection(btn.dataset.tab + "-tab");
});

/* ---------- Auth UI ---------- */

/* ---------- Citation Builder ---------- */
// Auto-refresh citation on any input change
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
].forEach((el) => {
  el?.addEventListener("input", refreshCitation);
  el?.addEventListener("change", refreshCitation);
});

// Copy citation
citeCopy?.addEventListener("click", async () => {
  const html = citeOutput?.innerHTML?.trim() || "";
  const text = citeOutput?.textContent?.trim() || "";

  if (!text) {
    toast("Please fill in the citation fields first");
    return;
  }

  try {
    // Try to copy as both HTML and plain text
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
    } else {
      // Fallback to plain text
      await navigator.clipboard.writeText(text);
    }
    toast("Citation copied to clipboard!");
  } catch (error) {
    console.error("Copy failed:", error);
    toast("Copy failed. Please try again.");
  }
});

// Cancel citation
citeCancel?.addEventListener("click", () => {
  // Go back to saved tab
  document
    .querySelectorAll(".tab-content")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("saved-tab")?.classList.add("active");

  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="saved"]')?.classList.add("active");

  const citeTabBtn = document.getElementById("citation-tab-btn");
  if (citeTabBtn) citeTabBtn.style.display = "none";

  clearCitationForm();
});

/* ---------- Auth UI ---------- */

// REPLACE existing onclick handlers
signupBtn.onclick = safeSignUp;
signinBtn.onclick = safeSignIn;
// SIGN OUT
signoutBtn.onclick = async () => {
  try {
    await signOut(auth);
    await chrome.storage.local.remove("latestHighlight");
  } finally {
    if (email) email.value = "";
    if (password) password.value = "";
    showAuth();
  }
};

/* ---------- Selection helpers ---------- */
function showSkeletonLoader() {
  if (savedList) {
    savedList.innerHTML = `
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width: 80%"></div>
    `.repeat(3);
  }
}
// Auto-save drafts
function saveDraft() {
  const draft = {
    tags: tagsInput?.value || "",
    notes: notesInput?.value || "",
    timestamp: Date.now(),
  };
  chrome.storage.local.set({ researchDraft: draft });
}

function loadDraft() {
  chrome.storage.local.get("researchDraft").then(({ researchDraft }) => {
    if (researchDraft && Date.now() - researchDraft.timestamp < 3600000) {
      // 1 hour
      if (tagsInput) tagsInput.value = researchDraft.tags;
      if (notesInput) notesInput.value = researchDraft.notes;
    }
  });
}

// Add event listeners
tagsInput?.addEventListener("input", debounce(saveDraft, 500));
notesInput?.addEventListener("input", debounce(saveDraft, 500));

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
function applyPreview(text, url, title) {
  const st = byId("selected-text");
  const cm = byId("captured-meta");
  if (!st || !cm) return;
  st.textContent = text || "";
  cm.textContent = url ? new URL(url).hostname : "";
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

    // 1) Ask the content script
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

    // 2) Fallback: execute in page
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

/* ---------- Messaging (selection + saved) ---------- */
chrome.runtime.onMessage.addListener((msg) => {
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
});

/* ---------- Auth state ---------- */
let booted = false;

onAuthStateChanged(auth, async (u) => {
  user = u || null;

  if (!user) {
    showAuth(); // your existing helper
    finishBoot(); // << hide the splash now
    booted = false;
    return;
  }

  showApp();
  finishBoot(); // hide the splash now

  if (email) email.value = "";
  if (password) password.value = "";

  if (booted) return; // prevent double init
  booted = true;

  // initial app setup
  await ensureDefaultProject?.();
  await applyDynamicTheme?.();
  await loadSettings?.();
  await loadItems?.();

  // After: await loadItems?.();
  const { focusTab } = await chrome.storage.local.get("focusTab");
  if (focusTab) {
    // your code already has showSection(id) that activates a tab by id
    showSection("summary-tab"); // force AI tab
    await chrome.storage.local.remove("focusTab");
  }

  const gotLive = await tryFetchSelection?.();
  if (!gotLive) {
    await chrome.storage.local.remove("latestHighlight");
    clearPreview();
  }
});

/* ---------- Load latest cached preview ---------- */
async function loadLatestHighlight() {
  const st = byId("selected-text");
  const cm = byId("captured-meta");
  if (!st || !cm) return;
  const { latestHighlight } = await chrome.storage.local.get("latestHighlight");
  if (latestHighlight?.text) {
    st.textContent = latestHighlight.text;
    cm.textContent = latestHighlight.sourceUrl
      ? new URL(latestHighlight.sourceUrl).hostname
      : "";
  } else {
    clearPreview();
  }
}

/* ---------- Disable Save when empty ---------- */
function updateSaveEnabled() {
  const st = byId("selected-text");
  const ok = !!(st && (st.textContent || "").trim());
  if (saveBtn) saveBtn.disabled = !ok;
}
new MutationObserver(updateSaveEnabled).observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
});
updateSaveEnabled();

/* ---------- Save from Collect tab ---------- */
saveAIKeyBtn?.addEventListener("click", async () => {
  const value = (aiKeyInput?.value || "").trim();
  // if the field is masked, do nothing
  if (value === "••••••••••") return toast("Key unchanged");
  await setApiKey(value);
  if (aiKeyInput) aiKeyInput.value = value ? "••••••••••" : "";
  toast(value ? "API key saved" : "API key cleared");
});

saveBtn.onclick = async () => {
  if (!user) return toast("Sign in first.");

  let st = byId("selected-text");
  if (!st || !(st.textContent || "").trim()) {
    const ok = await tryFetchSelection();
    st = byId("selected-text");
    if (!ok || !st || !(st.textContent || "").trim())
      return toast("No selection found on this page.");
  }

  // ✅ Sanitize and validate
  const text = sanitizeText(st.textContent);
  const tags = (tagsInput.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20); // max 20 tags

  const { latestHighlight } = await chrome.storage.local.get("latestHighlight");

  const payload = {
    text,
    tags,
    note: (notesInput.value || "").trim().slice(0, 1000), // max 1000 chars
    sourceUrl: latestHighlight?.sourceUrl || "",
    sourceTitle: latestHighlight?.sourceTitle || "",
    createdAt: serverTimestamp(),
  };

  // ✅ Validate before saving
  const validation = validateItemData(payload);
  if (!validation.valid) {
    toast(validation.errors[0]);
    return;
  }

  try {
    await addDoc(
      collection(db, `users/${user.uid}/projects/${currentProjectId}/items`),
      payload
    );

    // Clear inputs
    tagsInput.value = "";
    notesInput.value = "";
    await chrome.storage.local.remove("latestHighlight");
    clearPreview();
    updateSaveEnabled?.();

    toast("Saved!");
    await loadItems();
  } catch (e) {
    console.error(e);
    toast("Save failed: " + (e.message || "Unknown error"));
  }
};

summarizeBtn?.removeAttribute("disabled");

summarizeBtn?.addEventListener("click", async () => {
  const text = (summaryInput?.value || "").trim();
  if (!text) return toast("Paste some text to summarize");

  summarizeBtn.disabled = true;
  summarizeBtn.textContent = "Summarizing…";

  try {
    // ✅ Apply rate limiting
    await aiRateLimiter.throttle();

    const out = await summarizeText(text);
    if (!out.ok) {
      if (out.reason === "missing_api_key")
        return toast("Add your API key in the AI tab first");
      if (out.reason === "network_error")
        return toast("Network error. Check your connection.");
      return toast(`Summarization failed: ${out.error || out.reason}`);
    }

    // Show result
    const box = summaryResult?.querySelector(".summary-content");
    if (summaryResult) summaryResult.classList.remove("hidden");
    if (box) box.textContent = out.summary;
    toast("Summary ready");
  } catch (error) {
    console.error("Summarization error:", error);
    toast("An unexpected error occurred");
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = "Generate Summary";
  }
});

/* ---------- Saved tab ---------- */
async function loadItems() {
  if (!user) {
    if (savedList) savedList.innerHTML = "";
    emptyState?.classList.remove("hidden");
    return;
  }
  const qy = query(
    collection(db, `users/${user.uid}/projects/${currentProjectId}/items`),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qy);

  itemsCache = [];
  if (savedList) savedList.innerHTML = "";
  if (snap.empty) emptyState?.classList.remove("hidden");
  else emptyState?.classList.add("hidden");

  snap.forEach((d) => {
    const it = d.data();
    itemsCache.push({ id: d.id, data: it });
    const div = document.createElement("div");
    div.className = "item";

    const title = it.sourceTitle || it.sourceUrl || "Untitled";
    const text = (it.text || "").slice(0, 240).replace(/\s+/g, " ");
    const domain = it.sourceUrl ? new URL(it.sourceUrl).hostname : "";

    // tags → chips
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const chips = tags.length
      ? `<div class="chips">${tags
          .map((t) => `<span class="chip">#${t}</span>`)
          .join("")}</div>`
      : "";

    div.innerHTML = `
  <div class="title">${title}${
      domain ? `<span class="domain">${domain}</span>` : ""
    }</div>
  ${chips}
  <div class="text">${text}</div>
  ${
    it.note
      ? `<div class="note">📝 ${String(it.note).slice(0, 140)}${
          (it.note || "").length > 140 ? "…" : ""
        }</div>`
      : ""
  }
  <div class="actions">
    <button data-act="copy" data-id="${d.id}">Copy</button>
    ${
      it.sourceUrl
        ? `<button data-act="open" data-id="${d.id}">Open</button>`
        : ""
    }
    <button data-act="edit" data-id="${d.id}">Edit</button>
    <button data-act="cite" data-id="${d.id}">Cite</button>
    <button data-act="delete" data-id="${d.id}">Delete</button>
    </div>`;

    savedList?.appendChild(div);
  });
}

// actions: Copy / Open / Delete (delegated)
shuffleThemeBtn?.addEventListener("click", async () => {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  rmSettings.themeSeed = Math.floor(Math.random() * 360);
  await chrome.storage.local.set({ rmSettings });
  await applyDynamicTheme();
  toast("Theme updated");
});

saveAIKeyBtn?.addEventListener("click", async () => {
  const value = (aiKeyInput?.value || "").trim();
  // if it’s already masked, do nothing
  if (value === "••••••••••") return toast("Key unchanged");
  await setApiKey(value);
  if (aiKeyInput) aiKeyInput.value = value ? "••••••••••" : "";
  toast(value ? "API key saved" : "API key cleared");
});

savedList?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const rec = itemsCache.find((x) => x.id === btn.dataset.id);
  if (!rec) return;
  const it = rec.data;

  // ===== COPY ACTION =====
  if (btn.dataset.act === "copy") {
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const blob = [
      it.text || "",
      tags.length ? "\n\nTags: " + tags.map((t) => `#${t}`).join(" ") : "",
      it.sourceTitle || it.sourceUrl
        ? `\nSource: ${it.sourceTitle || ""}${
            it.sourceUrl ? ` (${it.sourceUrl})` : ""
          }`
        : "",
      it.note ? `\nNote: ${it.note}` : "",
    ].join("");
    try {
      await navigator.clipboard.writeText(blob.trim());
      toast("Copied to clipboard");
    } catch {
      toast("Copy failed");
    }
  }

  // ===== OPEN ACTION =====
  if (btn.dataset.act === "open" && it.sourceUrl) {
    chrome.tabs.create({ url: it.sourceUrl });
  }

  // ===== EDIT ACTION ===== ✅ FIXED
  if (btn.dataset.act === "edit") {
    editItemId = btn.dataset.id;

    // Populate edit form
    const title = it.sourceTitle || it.sourceUrl || "Untitled";
    const domain = it.sourceUrl ? new URL(it.sourceUrl).hostname : "";
    editMeta.textContent = domain ? `${title} — ${domain}` : title;
    editTags.value = Array.isArray(it.tags) ? it.tags.join(", ") : "";
    editNotes.value = it.note || "";

    // Show edit tab button and switch to it
    const editTabBtn = document.getElementById("edit-tab-btn");
    if (editTabBtn) editTabBtn.style.display = "block";

    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.tab-btn[data-tab="edit"]')
      ?.classList.add("active");

    showSection("edit-tab");
    return;
  }

  // ===== CITE ACTION ===== ✅ NEW
  // ===== CITE ACTION ===== ✅ UPDATED
  if (btn.dataset.act === "cite") {
    // Populate citation form
    clearCitationForm();

    if (citeTitle) citeTitle.value = it.sourceTitle || "";
    if (citeUrl) citeUrl.value = it.sourceUrl || "";

    // Try to extract domain for container
    if (it.sourceUrl && citeContainer) {
      try {
        const hostname = new URL(it.sourceUrl).hostname.replace(/^www\./, "");
        citeContainer.value = hostname;
      } catch {}
    }

    // Extract year from createdAt if available
    if (it.createdAt && citeYear) {
      try {
        const date = it.createdAt.toDate
          ? it.createdAt.toDate()
          : new Date(it.createdAt);
        citeYear.value = date.getFullYear().toString();
        citeMonth.value = (date.getMonth() + 1).toString();
        citeDay.value = date.getDate().toString();
      } catch {}
    }

    // Set meta info
    const title = it.sourceTitle || it.sourceUrl || "Untitled";
    if (citationMeta) citationMeta.textContent = `Citing: ${title}`;

    // Refresh citation preview
    refreshCitation();

    // Show citation tab button and switch to it
    const citeTabBtn = document.getElementById("citation-tab-btn");
    if (citeTabBtn) citeTabBtn.style.display = "block";

    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.tab-btn[data-tab="citation"]')
      ?.classList.add("active");

    showSection("citation-tab");
    return;
  }

  // ===== DELETE ACTION =====
  if (btn.dataset.act === "delete") {
    if (!confirm("Delete this item permanently?")) return;
    try {
      await deleteDoc(
        doc(
          db,
          `users/${user.uid}/projects/${currentProjectId}/items/${btn.dataset.id}`
        )
      );
      toast("Deleted");
      await loadItems();
    } catch (e) {
      console.error(e);
      toast("Delete failed");
    }
  }
});

editCancel?.addEventListener("click", () => {
  // ✅ Go back to saved tab and hide edit button
  showSection("saved-tab");
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="saved"]')?.classList.add("active");

  const editTabBtn = document.getElementById("edit-tab-btn");
  if (editTabBtn) editTabBtn.style.display = "none";

  editItemId = null;
});

editSave?.addEventListener("click", async () => {
  if (!user || !editItemId) {
    toast("No item selected to edit");
    return;
  }

  const tags = (editTags.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const note = (editNotes.value || "").trim();

  try {
    await setDoc(
      doc(
        db,
        `users/${user.uid}/projects/${currentProjectId}/items/${editItemId}`
      ),
      { tags, note, updatedAt: serverTimestamp() },
      { merge: true }
    );
    toast("Changes saved");
    await loadItems();

    // ✅ Go back to saved tab and hide edit button
    showSection("saved-tab");
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.tab-btn[data-tab="saved"]')
      ?.classList.add("active");

    const editTabBtn = document.getElementById("edit-tab-btn");
    if (editTabBtn) editTabBtn.style.display = "none";

    editItemId = null;
  } catch (e) {
    console.error(e);
    toast("Update failed: " + e.message);
  }
});

/* search filter */
searchInput?.addEventListener("input", () => {
  const q = (searchInput.value || "").toLowerCase();
  const filtered = itemsCache.filter(
    (x) =>
      (x.data.text || "").toLowerCase().includes(q) ||
      (x.data.sourceTitle || "").toLowerCase().includes(q) ||
      (x.data.sourceUrl || "").toLowerCase().includes(q) ||
      (Array.isArray(x.data.tags) ? x.data.tags.join(" ") : "")
        .toLowerCase()
        .includes(q)
  );
  renderFiltered(filtered);
});

function renderFiltered(list) {
  if (!savedList) return;
  savedList.innerHTML = "";
  if (!list.length) {
    emptyState?.classList.remove("hidden");
    return;
  }
  emptyState?.classList.add("hidden");
  list.forEach(({ id, data: it }) => {
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = id;
    const title = it.sourceTitle || it.sourceUrl || "Untitled";
    const text = (it.text || "").slice(0, 240).replace(/\s+/g, " ");
    const domain = it.sourceUrl ? new URL(it.sourceUrl).hostname : "";
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const chips = tags.length
      ? `<div class="chips">${tags
          .map((t) => `<span class="chip">#${t}</span>`)
          .join("")}</div>`
      : "";

    div.innerHTML = `
  <div class="title">${title}${
      domain ? `<span class="domain">${domain}</span>` : ""
    }</div>
  ${chips}
  <div class="text">${text}</div>
  ${
    it.note
      ? `<div class="note">📝 ${String(it.note).slice(0, 140)}${
          (it.note || "").length > 140 ? "…" : ""
        }</div>`
      : ""
  }
  <div class="actions">
    <button data-act="copy" data-id="${id}">Copy</button>
    ${
      it.sourceUrl
        ? `<button data-act="open" data-id="${d.id}">Open</button>`
        : ""
    }
    <button data-act="edit" data-id="${d.id}">Edit</button>
    <button data-act="delete" data-id="${d.id}">Delete</button>
  </div>`;

    savedList.appendChild(div);
  });
}

/* ---------- Settings ---------- */
async function loadSettings() {
  const { rmSettings = {} } = await chrome.storage.local.get("rmSettings");
  const { dark = false, ff = "system-ui", fs = 14 } = rmSettings;
  if (darkMode) darkMode.checked = dark;
  if (fontFamily) fontFamily.value = ff;
  if (fontSize) fontSize.value = fs;
  applySettings(dark, ff, fs);
}

const existingKey = await getApiKey();
if (aiKeyInput) aiKeyInput.value = existingKey ? "••••••••••" : "";

function applySettings(dark, ff, fs) {
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
  applySettings(rmSettings.dark, rmSettings.ff, rmSettings.fs);
  await applyDynamicTheme(); // re-apply gradient for new mode
}
[darkMode, fontFamily, fontSize].forEach((el) =>
  el?.addEventListener("change", saveSettings)
);
