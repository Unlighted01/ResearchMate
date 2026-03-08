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
    - **Simplified Save Flow:** Reverted the floating button to a single "Save" action for zero-friction capture.
    - **Refined Trigger Logic:** To avoid UI annoyance, the button only appears if a selection contains at least **3 words** and **15 characters**. It explicitly skips "collapsed" selections (simple clicks) using `selection.isCollapsed`.
    - **Modal Color Tagging:** Moved the color picker into the Item Detail modal. Users can optionally assign one of 5 aesthetic colors (Yellow, Green, Blue, Red, Purple) during review. Colors are persistent via the Supabase `tags` array (e.g. `"color:blue"`).
3.  **Markdown Support & Export UI:**
    - **Single Item Export:** Supports "MD" as a default format in the extension Settings slider.
    - **Bulk Export:** Dedicated "Bulk Markdown Export" button in the Data Management section.
    - **Copy as Markdown:** High-fidelity markdown generation (with citations) available via a single click in those item details.
4.  **Supabase Auth Bridge:**
    - Correctly syncs Auth Tokens with the Web Application to ensure zero-login capture flows.
5.  **UI Resilience & Parsing:**
    - Wrapped strict DOM URL instantiations (like `new URL()`) inside silent `try...catch` block boundaries within `SidePanel.tsx`. 
    - This mitigates fatal React unmount crashes when processing older or heavily malformed string captures loaded from the Cloud database.
6.  **Smart Text Extraction & Formatting Preservation:**
    - The content script (`index.tsx`) now features a custom DOM-walking extractor (`cleanSelectedText`).
    - Actively strips out ads (`ins.adsbygoogle`, `<iframe/>`, sponsored tags), invisible UI elements (`display: none`, `opacity: 0`), and non-content markup (scripts, styles, headers, sidebars) from user selections.
    - Intelligently translates HTML block-level elements (`<p>`, `<div>`, `<h1>`-`<h6>`) into double line breaks (`\n\n`), seamlessly hooking into the UI's existing `white-space: pre-wrap` styles to render perfectly formatted paragraphs without saving unwanted junk.

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
