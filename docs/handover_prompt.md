# 📦 Project Handover: ResearchMate Browser Extension

## 🚀 Current Status: STABLE & COMPLIANT

The Chrome Extension is fully functional, capable of extracting text payloads off web pages, saving them to User Collections, and triggering automated background citations.

### ✅ Key Features Working:

1.  **Chrome Store Compliance (Vite Builder):**
    - Replaced all remotely-hosted CDN injected scripts (such as `cdnjs` for `jspdf`).
    - Engineered a custom Vite plugin (`remove-jspdf-cdn-plugin`) to actively strip out the CDN string from the built `index.html` file right before package output.
    - The extension now ships 100% locally hosted, avoiding Google's Remote Code injection rejections outright.
2.  **Smart Floating UI Trigger:**
    - The `trigger` icon injects cleanly onto host websites to allow rapid capture flows.
    - Includes **Fullscreen Evasion**: Actively sweeps the DOM for `document.fullscreenElement` and instantly hides itself when YouTube or fullscreen presentations are running, preventing UI overlap annoyance.
    - Includes **Idle Dimming**: Safely drops to a 10% opacity ghost mode if the mouse hasn't moved in 3 seconds.
3.  **Supabase Auth Bridge:**
    - Correctly syncs Auth Tokens with the Web Application to ensure zero-login capture flows.
4.  **UI Resilience & Parsing:**
    - Wrapped strict DOM URL instantiations (like `new URL()`) inside silent `try...catch` block boundaries within `SidePanel.tsx`. 
    - This mitigates fatal React unmount crashes when processing older or heavily malformed string captures loaded from the Cloud database.

### 🛠️ Technology Stack

- **Frontend:** React, Vite (CRXjs Plugin)
- **Styling:** CSS Modules, Lucide React
- **Browser APIs:** Manifest V3, Storage, ActiveTab

### 📂 Code Structure

- `src/content/`: Foreground UI hooks that render on external websites (Trigger, Sidebar).
- `src/background/`: Background service workers handling global context-menus and auth logic.
- `vite.config.ts`: Advanced build-step plugins mitigating CDN violations.

### ⏭️ Next Steps / Maintenance:

1.  **OCR Injection (Optional Hook):** The user expressed interest in feeding images dragged into the extension directly into the centralized Vercel `/api/ocr` pipeline. This can be built as a `POST` block in the background worker that proxies the web payload.
2.  **DOM Mutation Observers:** Ensure modern Single Page Applications (SPAs) like React sites aren't actively destroying the `content.js` UI trigger when they hot-reload their own DOM structures. You may need to inject a `MutationObserver` to passively re-mount the trigger.
