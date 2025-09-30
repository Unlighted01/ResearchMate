// background.js
import {
  auth,
  db,
  addDoc,
  collection,
  serverTimestamp,
} from "../lib/firebase-init.js";

/* ---------- Live selection preview from content scripts ---------- */
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "selectionPreview") {
    const latest = {
      text: msg.text,
      sourceUrl: msg.url || "",
      sourceTitle: msg.title || "",
      createdAt: Date.now(),
    };
    await chrome.storage.local.set({ latestHighlight: latest });
    chrome.runtime.sendMessage({ type: "latestHighlight", payload: latest });
  }

  if (msg?.type === "selectionCleared") {
    await chrome.storage.local.remove("latestHighlight"); // ensure cache is gone
    chrome.runtime.sendMessage({ type: "latestHighlightCleared" }); // popup clears UI
  }
});

/* ---------- Context menu: save highlighted selection ---------- */
async function createMenus() {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: "save-selection",
      title: "Save selection to ResearchMate",
      contexts: ["selection"],
    });
    console.log("Context menu ready");
  } catch (e) {
    console.error("Menu error", e);
  }
}
createMenus();
chrome.runtime.onInstalled.addListener(createMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-selection" || !tab?.id) return;

  // Get page title/url from the tab
  const [{ result: page }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ title: document.title, url: location.href }),
  });

  const u = auth.currentUser;
  const { currentProjectId } = await chrome.storage.local.get(
    "currentProjectId"
  );
  const projectId = currentProjectId || "default"; // always have a project

  if (!u) {
    chrome.notifications?.create({
      type: "basic",
      title: "ResearchMate",
      message: "Please sign in to save.",
      iconUrl: "assets/icon128.png",
    });
    return;
  }

  try {
    await addDoc(collection(db, `users/${u.uid}/projects/${projectId}/items`), {
      text: info.selectionText || "",
      sourceUrl: page.url,
      sourceTitle: page.title,
      createdAt: serverTimestamp(),
    });
    chrome.runtime.sendMessage({ type: "itemSaved" });
    chrome.notifications?.create({
      type: "basic",
      title: "Saved!",
      message: "Selection saved.",
      iconUrl: "assets/icon128.png",
    });
  } catch (e) {
    console.error("Save failed", e);
    chrome.notifications?.create({
      type: "basic",
      title: "ResearchMate",
      message: "Save failed. See Service Worker console.",
      iconUrl: "assets/icon128.png",
    });
  }
});
