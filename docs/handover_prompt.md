# AI Handover: ResearchMate Browser Extension

## What Is This?
ResearchMate is a Chrome extension (Manifest V3, v2.0.4) that lets users save, tag, summarize, cite, and export research from any webpage. It has a companion website and supports a smart pen hardware device. The extension is built with Vite + React 18 + TypeScript + Tailwind CSS + Supabase.

The authoritative technical reference for continuing work is **`docs/CLAUDE.md`** in the project root. Read it first. This document adds context that isn't derivable from the code.

---

## Current State (as of 2026-03-17)

### What's Working
- Save items from any page via right-click context menu or floating button on text selection
- Side panel list view with search (debounced 300ms), collection filtering, bulk select/delete/assign
- Item detail view: AI summary (3 modes), citation generation (6 formats), tags, color tagging, export
- Toast notification system (replaces all `alert()` calls), with undo action support
- **Undo delete** — optimistic removal + 5-second undo toast in both list and detail view
- **Loading skeleton** — `SkeletonCard` with staggered `animate-pulse` animation (not "Loading..." text)
- **Empty state** — SVG illustration + step-by-step instructions for new users; separate "no results" state for search
- **Infinite scroll / pagination** — `getItemsPage(offset, pageSize=30)` + `IntersectionObserver` sentinel at list bottom
- **Keyboard navigation** — all list items have `role="button"`, `tabIndex={0}`, `aria-label`, `onKeyDown` (Enter/Space)
- **Modal accessibility** — auth modal + CollectionSelector both have `role="dialog"`, `aria-modal="true"`, `useFocusTrap` hook (Tab cycle + Escape to close + focus restore), backdrop click to close
- **Color buttons** — `aria-pressed` + `aria-label` with selected state indicator
- **Sync status** — wrapped in `aria-live="polite"` region for screen readers
- Color indicator bar in list view (absolute-positioned div with inline style — not Tailwind border)
- Scroll-to-top / scroll-to-bottom buttons in detail view (absolute-positioned outside scroll container)
- Guest mode with `chrome.storage.local` fallback + auto-sync on login
- Collections (cloud-only for now)
- Smart pen capture + OCR via Edge Function
- **Citation accuracy** — 3-tier CrossRef lookup: DOI meta tag → DOM scan (body text + links) → title search
  - Handles ResearchGate, Springer, PubMed, Academia.edu (no DOI in URL)
  - `extractYear()` handles all date formats — no more `NaN → "n.d."` regressions
  - Tier 2 corporate-author fallback blocked when a DOI is found

### Recently Fixed (this session)
- Citation: multi-author `querySelectorAll` (was `querySelector`, got only first author)
- Citation: `extractYear()` replaces broken `new Date(x).getFullYear()` (NaN on `"2025/12"`, `"December 2025"`)
- Citation: CrossRef DOI lookup (Tier 1.5) — free, no API key, CORS-enabled
- Citation: CrossRef title search (Tier 1.75) — fires when DOI not in URL/meta, fixes ResearchGate
- Citation: DOM scan for DOI in body text + `<a href>` links (catches embedded DOIs)
- Accessibility: `useFocusTrap` hook + applied to auth modal and CollectionSelector
- Accessibility: `aria-pressed` on color swatches, `aria-live` on sync status
- **T-2**: Smart Capture Import — "Upload Image" button added to `SmartPenView.tsx`; reads file as base64 DataURL → `runOCR()` → `addItem()` with `deviceSource: "extension"`
- **T-3**: OCR confidence cleared on manual edit (`ocrConfidence: null`), persisted on Retry OCR; `StorageItem.ocrConfidence` widened to `number | null`; `updateItem()` cloud branch now maps `ocr_confidence`
- **T-4**: Citation auto-regenerated after OCR edit save if a citation already exists (`handleCite(citationFormat)` called at end of `handleSaveOcrEdit()`)

---

## Architecture Decisions Worth Knowing

### Color Storage (Non-Obvious)
Colors are encoded as `color:<name>` strings in the `tags` array (e.g., `"color:yellow"`). This was done to avoid a Supabase schema migration. `transformDatabaseItem()` strips these out on read; `buildTagsForStorage()` in `ItemDetail.tsx` puts them back on write. The `color` field on `StorageItem` is always derived, never stored separately.

### Dual Storage
Every operation must handle both `local_*` (chrome.storage.local) and UUID (Supabase) IDs. `getAllItems()` merges both, deduplicating by exact text match.

### Citation Lookup Waterfall
```
Tier 1   → ISBN → Open Library API
Tier 1.5 → DOI found (meta tag / URL / DOM scan) → CrossRef DOI lookup
Tier 1.75→ No DOI but title present → CrossRef title search  (fixes ResearchGate/Springer)
Tier 2   → Local meta tags (author + title) → rule-based formatting
Tier 3   → AI (only if useAiCitation=true or Tiers 1-2 all fail)
```

### Edge Functions for Smart Pen
Direct Supabase table reads for smart pen device lists return 406 (RLS). Always use `supabase.functions.invoke("smart-pen", { body: { action: "list" } })`.

### Chrome Store Compliance
`vite.config.ts` has `remove-jspdf-cdn-plugin` to strip remote code references. `scripts/patch-jspdf.cjs` runs on `postinstall`. Both are required — do not remove.

---

## Known Pitfalls

See `docs/CLAUDE.md` → "Known Patterns / Pitfalls" for the complete list.

---

## Remaining Backlog

All prior backlog items (#4, #7, #8, #9, #14, #P2) are resolved. The remaining work before Chrome Store submission:

| # | Area | Issue |
|---|------|-------|
| CS-1 | Store | Privacy policy URL needed at submission time (not in code) |
| CS-2 | Store | Store listing assets: screenshots (1280×800 or 640×400), promo tile (440×280) |
| CS-3 | Store | Justify `<all_urls>` host permission in store listing description |
| CS-4 | UX | ISBNSearchModal has no focus trap (lower priority — rarely opened) |

### ✅ Failed Test Fixes (From Test Suite — Tables 8.3, 8.5, 9.1, 9.3) — ALL RESOLVED

| # | Test | Fix |
|---|------|-----|
| T-1 | 8.3-7 | Citation date parsing: `/\d{4}/.exec(rawDate)?.[0]` replaces broken `new Date(x).getFullYear()` in `handleBookSelect()` |
| T-2 | 8.5-10 | Smart Capture Import: "Upload Image" button in `SmartPenView.tsx` (image → base64 → `runOCR()` → `addItem()`) |
| T-3 | 8.5-11, 9.1-5 | OCR confidence: cleared on manual edit (`ocrConfidence: null`), persisted on Retry; `StorageItem.ocrConfidence` is `number \| null`; `updateItem()` maps `ocr_confidence` via `"ocrConfidence" in updates` |
| T-4 | 9.3-4 | Citation auto-regenerated after OCR edit save if citation already exists (`handleCite(citationFormat)` at end of `handleSaveOcrEdit()`) |

---

## Roadmap (Future Features)

1. **Folder selection on quick-save** — let users pick a collection before hitting Save (long-press on floating button?)
2. **OCR injection** — infrastructure exists; proxy image/PDF drags to Vercel `/api/ocr`
3. **PDF highlighting** — extend Selection logic to work inside PDF.js iframes

---

## Dev Workflow

```bash
npm run build          # canonical — runs tsc then vite build
npx tsc --noEmit       # type-check only (faster, if build hangs)
```

Load the `dist/` folder as an unpacked extension in `chrome://extensions` (Developer mode on).

Expected build warnings (safe to ignore):
- `Some chunks are larger than 500 kB` — jsPDF + Supabase bundle size
- `The emitted file "public/icons/icon*.png" overwrites...` — icon duplication in vite plugin
