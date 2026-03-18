# ResearchMate Extension — Improvement Recommendations
> Audited March 2026. Read `docs/CLAUDE.md` before touching anything.
> Items are numbered globally. Work top-down — fix higher priority items first.

---

## ✅ Completed

---

**#1 — Settings import is JSON-only; no image or PDF support** ✅ *Done March 2026*

- `accept` changed to `.json,.pdf,.png,.jpg,.jpeg` with `multiple`
- Handler loops all files and routes by type: JSON → array import, PDF → `pdfjs-dist` text extraction, image → `runOCRFromDataUrl` → saved as `smart_pen` item
- `runOCRFromDataUrl` added to `geminiService.ts` for local file OCR (skips URL fetch step)
- `pdfjs-dist` installed; worker uses `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` to satisfy Chrome extension CSP

---

**#2 — SmartPenView image upload is single-file only** ✅ *Done March 2026*

- `multiple` added to file input
- Handler loops all files sequentially with `uploadProgress` state — button shows `"Processing 2 of 5…"`
- Summary toast at end: `"Imported X of Y images successfully"` (with failure count if any)
- Fixed `deviceSource` from `"extension"` → `"smart_pen"`

---

**#3 — No way to create collections from the extension** ✅ *Done March 2026*

- "New" button added to Collections tab toolbar; empty state also has a create button
- Create modal: name input + 8-color picker + live preview card
- `CollectionSelector` (multi-select flow) auto-opens create form when no collections exist; create form has same color picker and auto-assigns selected items on creation
- Fixed `useFocusTrap` — `onEscape` moved to a ref so typing in inputs no longer loses focus
- Fixed `collectionService.ts` — removed `icon` field (column doesn't exist in DB); replaced embedded `items(count)` join with manual count query (FK not in Supabase schema cache)
- Delete collection: `MoreVertical` menu on each card with "Delete" option; optimistic remove + 5s undo toast; `deleteCollection` nullifies `collection_id` on items before deleting

---

## 📋 Summary

| # | Status | Issue | File |
|---|---|---|---|
| 1 | ✅ Done | Settings import — PDF + image support added | `src/components/Settings.tsx` |
| 2 | ✅ Done | SmartPenView — batch upload with progress | `src/components/SmartPenView.tsx` |
| 3 | ✅ Done | Collections — create, delete, multi-select wiring | `src/components/CollectionsView.tsx` |

---

*Generated March 2026 — gap identified by comparing extension vs website import capabilities.*
