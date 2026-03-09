# 📦 AI Handover: ResearchMate Browser Extension

## 🚀 Architectural Context
ResearchMate is a high-fidelity research tool designed to bridge the gap between web browsing and structured data management. The extension is built with **Vite (Manifest V3)** and utilizes a **Shadow DOM** for its trigger to avoid polluting host-site styles.

### 🧠 Strategic "Magic" Logic (Read Carefully)
1.  **Implicit Color Syncing:** To avoid breaking Supabase migrations, highlight colors are stored as prefixed strings in the `tags` array (e.g., `"color:blue"`, `"color:red"`). 
    - `storageService.ts` handles the **bi-directional extraction**: It filters these out during read (mapping them to the `color` property) and injects them back into the array during write.
    - **UI Impact:** The item detail modal in `ItemDetail.tsx` allows users to toggle these colors. Clearing a color simply removes the `color:x` tag from the array.
2.  **Selection Sensitivity Throttling:** 
    - Logic located in `content/index.tsx` inside `handleSelection`.
    - Constraints: **isCollapsed == false**, **words >= 3**, and **chars >= 15**.
    - **Rationale:** This prevents the "Save" button from appearing on simple clicks or tiny selections (like numbers or single words), preserving an unobtrusive UX.
3.  **RLS-Safe Pairing Flow (NEW):**
    - To avoid **406 Not Acceptable** errors (RLS blocks on direct table reads), the extension uses `supabase.functions.invoke("smart-pen", { body: { action: "list" } })` to fetch paired devices.
    - **Pairing Logic:** Moved entirely to the Edge Function. `smartPenService.ts` now only invokes the function, ensuring consistent logic with the website and firmware.
4.  **Local vs. Cloud States:**
    - The project uses a custom Vite plugin `remove-jspdf-cdn-plugin` in `vite.config.ts`. This strips out the `jspdf` CDN string during build to comply with Chrome Store "No Remote Code" policies.

### 🛠️ Core Workflows
- **Capture Flow:** `content/index.tsx` captures selection -> `cleanSelectedText` strips junk (ads, invisible text) -> `saveItemInBackground` sends payload to the background script -> Supabase.
- **Detail View:** `ItemDetail.tsx` handles AI summaries, manual tagging, color selection, and citation generation.
- **Exporting:** Uses `markdownGenerator.ts` to create formatted `.md` files with citations. Supports individual export (slider-driven) and bulk export (Data Management).

### 💅 Design Language
- **Theme:** Apple-inspired, using `backdrop-filter: blur`, dynamic HSL colors, and premium transitions.
- **Icons:** Powered by `Lucide React`. 

### ⏭️ Roadmap for the Next AI
1.  **OCR Injection:** The infrastructure is ready to proxy image/PDF drags to the Vercel API `/api/ocr`.
2.  **Folder Selection (Quick-Save):** Allow users to pick which Collection to save into *before* hitting save (perhaps a long-press on the save button).
3.  **PDF Highlighting:** Currently optimized for HTML; extending `Selection` logic to work inside PDF.js frames is a high-value target.

### ⚠️ Dev Notes
- **Lints:** You will see "CSS inline styles" warnings in `ItemDetail.tsx` and `Dashboard.tsx`. These are used for dynamic color injection (Shadow DOM/dynamic palettes) and can be ignored unless refactoring the Entire UI system.
- **Builds:** The user prefers `npm run build` checks. If `tsc` hangs, use `npx tsc --noEmit`.
