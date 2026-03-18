# ResearchMate Extension — Improvement Recommendations
> Audited March 2026. Read `docs/CLAUDE.md` before touching anything.
> Items are numbered globally. Work top-down — fix higher priority items first.

---

## 🔴 Critical (Fix First)

---

**#1 — Settings import is JSON-only; no image or PDF support**

- **File:** `src/components/Settings.tsx`
- **Problem:** The import file input only accepts `.json`:
  ```tsx
  // line ~449
  accept=".json"
  ```
  It also only reads `e.target.files?.[0]` — one file at a time. There is no handler for PDF or image (jpg/png) files.
- **Gap vs Website:** The companion website (`SettingsPage.tsx`) supports bulk import of `.json`, `.pdf`, `.png`, and `.jpg` files simultaneously — each routed to the correct handler (PDF → pdfjs, image → `/api/ocr`, JSON → Supabase insert). The extension import is far behind.
- **Fix:**
  1. Change `accept` to `.json,.pdf,.png,.jpg,.jpeg` and add `multiple` attribute on the file input
  2. Change `e.target.files?.[0]` to `Array.from(e.target.files || [])` and loop
  3. Add a PDF handler using `pdfjs-dist` (already used in the website — mirror that logic)
  4. Add an image handler that converts the file to a base64 data URL and POSTs to `/api/ocr` with `{ image: base64DataUrl }` — same as `importImageFile()` in the website's `SettingsPage.tsx`
  5. Save image OCR results as `device_source: "smart_pen"` items with `ocr_confidence` from the API response
- **Reference:** `Researchmate Website/src/components/App/SettingsPage.tsx` — `handleImport()` and `importImageFile()` are the exact implementations to mirror

---

**#2 — SmartPenView image upload is single-file only**

- **File:** `src/components/SmartPenView.tsx`
- **Problem:** The file upload handler reads only the first file:
  ```tsx
  // line ~91
  const file = e.target.files?.[0];
  ```
  The file input has `accept="image/*"` and no `multiple` attribute. Users cannot batch-upload multiple scans at once.
- **Fix:**
  1. Add `multiple` attribute to the file input
  2. Change handler to `Array.from(e.target.files || [])` and loop — process each image sequentially with a progress indicator (e.g. `"Processing 2 of 5..."`)
  3. Show a summary toast at the end: `"Imported X of Y images successfully"`

---

## 📋 Summary

| # | Priority | Issue | File |
|---|---|---|---|
| 1 | 🔴 Critical | Settings import is JSON-only — no PDF or image support | `src/components/Settings.tsx` |
| 2 | 🔴 Critical | SmartPenView upload is single-file only — no bulk | `src/components/SmartPenView.tsx` |

---

*Generated March 2026 — gap identified by comparing extension vs website import capabilities.*
