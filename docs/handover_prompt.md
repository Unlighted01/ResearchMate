# AI Handover: ResearchMate Browser Extension

## What Is This?
ResearchMate is a Chrome extension (Manifest V3, v2.0.4) that lets users save, tag, summarize, cite, and export research from any webpage. It has a companion website and supports a smart pen hardware device. The extension is built with Vite + React 18 + TypeScript + Tailwind CSS + Supabase.

The authoritative technical reference for continuing work is **`CLAUDE.md`** in the project root. Read it first. This document adds context that isn't derivable from the code.

---

## Current State (as of 2026-03-15)

### What's Working
- Save items from any page via right-click context menu or floating button on text selection
- Side panel list view with search (debounced 300ms), collection filtering, bulk select/delete/assign
- Item detail view: AI summary (3 modes), citation generation (6 formats), tags, color tagging, export
- Toast notification system (replaces all `alert()` calls)
- Color indicator bar in list view (absolute-positioned div with inline style — not Tailwind border)
- Scroll-to-top / scroll-to-bottom buttons in detail view (absolute-positioned outside scroll container)
- Guest mode with `chrome.storage.local` fallback + auto-sync on login
- Collections (cloud-only for now)
- Smart pen capture + OCR via Edge Function

### Recently Fixed
- Summary sparkle button always re-generates (doesn't toggle); "View Original/Summary" is the toggle
- Memory leak: `AbortController` moved from state to `useRef` with unmount cleanup
- `alert()` calls replaced with toast notifications throughout
- Rate limiting on summarize + cite (3s cooldown via `useRef` timestamps)
- Format selector in detail view auto-regenerates when a summary/citation already exists
- Magic strings centralized in `src/constants.ts` (`STORAGE_KEY`, `QUICK_SAVE_TAG`, `CITATION_FORMATS`)
- State grouping in `SidePanel.tsx` (nav, sync, selection grouped objects)
- Debounced search (300ms)
- Color tag duplication bug fixed — `updateItem()` local branch re-derives `color` from `tags`
- `color:*` internal tags filtered from displayed tag chips in list view
- Scroll buttons moved outside scroll container (were using broken `sticky` approach)
- Build error: `onClick={handleSummarize}` → `onClick={() => handleSummarize()}` (MouseEvent type mismatch after adding optional param)
- Silent cloud failure: `addItem()` calls `onCloudFallback?.()` then falls back to local storage
- Import crash: Settings.tsx validates each imported field before saving

---

## Architecture Decisions Worth Knowing

### Color Storage (Non-Obvious)
Colors are encoded as `color:<name>` strings in the `tags` array (e.g., `"color:yellow"`). This was done to avoid a Supabase schema migration. `transformDatabaseItem()` strips these out on read; `buildTagsForStorage()` in `ItemDetail.tsx` puts them back on write. The `color` field on `StorageItem` is always derived, never stored separately.

### Dual Storage
Every operation must handle both `local_*` (chrome.storage.local) and UUID (Supabase) IDs. `id.startsWith("local_")` is the canonical check. `getAllItems()` merges both, deduplicating by exact text match.

### Edge Functions for Smart Pen
Direct Supabase table reads for smart pen device lists return 406 (RLS). Always use `supabase.functions.invoke("smart-pen", { body: { action: "list" } })`.

### Chrome Store Compliance
`vite.config.ts` has `remove-jspdf-cdn-plugin` to strip remote code references. `scripts/patch-jspdf.cjs` runs on `postinstall`. Both are required — do not remove.

---

## Known Pitfalls

See `CLAUDE.md` → "Known Patterns / Pitfalls" for the complete list. Quick summary:
- `onClick={handler}` breaks when handler has optional params — use `onClick={() => handler()}`
- Tailwind `border-*` shorthand nukes `border-l-*` color — use inline `style={{ backgroundColor }}`
- `sticky` inside `overflow-y: auto` doesn't work — use `absolute` in a `relative` container
- `AbortController` belongs in `useRef`, not `useState`

---

## Remaining Backlog (Not Yet Fixed)

These were identified in a prior audit but not yet actioned:

| # | Area | Issue |
|---|------|-------|
| #4 | UX | No empty state illustration for "no items" (just plain text) |
| #7 | UX | No loading skeleton — "Loading..." text only |
| #8 | UX | No keyboard navigation / accessibility audit |
| #9 | Performance | `getAllItems()` fetches up to 500 items with no virtual scroll |
| #14 | UX | No "undo delete" — deletion is immediate and permanent |
| #P2 | Performance | No pagination or infinite scroll on the item list |

---

## Roadmap (Future Features)

1. **Folder selection on quick-save** — let users pick a collection before hitting Save (long-press on floating button?)
2. **OCR injection** — infrastructure exists; proxy image/PDF drags to Vercel `/api/ocr`
3. **PDF highlighting** — extend Selection logic to work inside PDF.js iframes
4. **Undo delete** — short toast window with undo action before permanent deletion

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
