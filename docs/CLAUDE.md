# ResearchMate Extension — Claude Context

## Project Overview
ResearchMate is a Chrome extension (Manifest V3) that lets users save, tag, summarize, and cite research content from any webpage. It pairs with a companion website and optionally a smart pen device.

**Stack:** Vite + React 18 + TypeScript + Tailwind CSS 3 + Supabase + Framer Motion (`motion/react`)
**Build:** `npm run build` (runs `tsc && vite build`)
**Version:** 2.0.4
**Entry points:**
- `src/main.tsx` → side panel UI (React app)
- `src/background/index.ts` → service worker
- `src/content/index.tsx` → injected content script (Shadow DOM)

---

## Architecture

### Storage Dual-Mode (Critical)
Items exist in two places simultaneously:
- **Cloud (Supabase `items` table)** — authenticated users; snake_case column names
- **Local (`chrome.storage.local`)** — guest mode + context-menu saves; key = `STORAGE_KEY` from `src/constants.ts`

`getAllItems()` in `storageService.ts` merges both sources, deduplicating by exact text match (cloud wins). Items are identified as local by `id.startsWith("local_")`.

Auto-sync runs on login and on panel open. Manual sync via the RefreshCw button.

### Color Tag Encoding (Non-Obvious)
Colors are **not** a separate DB column. They are stored as `color:<name>` entries inside the `tags` array (e.g., `"color:yellow"`). This avoids needing a DB migration.

- **Read path:** `transformDatabaseItem()` in `storageService.ts` filters `color:*` tags out and maps them to the `color` field on `StorageItem`.
- **Write path:** `buildTagsForStorage()` in `ItemDetail.tsx` re-injects `color:<name>` back into tags before calling `updateItem()`.
- **`updateItem()` local branch** re-derives `color` from `tags` after merge to keep the field in sync.
- **List view** filters `color:*` from displayed tag chips (`SidePanel.tsx`).
- **Visual indicator** in list view: absolute-positioned `<div>` with inline `backgroundColor` style (not Tailwind border classes — border shorthand overrides `border-l-*` color).

### Citation Lookup Waterfall
```
Tier 1   → ISBN → Open Library API
Tier 1.5 → DOI (meta tag / URL / DOM scan) → CrossRef DOI lookup
Tier 1.75→ No DOI but title present → CrossRef title search
Tier 2   → Local meta tags (author + title) → rule-based formatting
Tier 3   → AI (only if useAiCitation=true or all above fail)
```
CrossRef API: free, no key needed, CORS-enabled. DOM scan checks body text + all `<a href>` attributes for `10.\d{4,}/...` patterns. Title search strips `(PDF)` prefixes and `| SiteName` suffixes before querying.

### RLS / Edge Function Pairing
Direct Supabase table reads for paired devices return 406 (RLS blocks). Smart pen pairing uses `supabase.functions.invoke("smart-pen", { body: { action: "list" } })` exclusively.

### Chrome Store Compliance
`vite.config.ts` includes a custom `remove-jspdf-cdn-plugin` that strips remote CDN strings from the jsPDF bundle. A `postinstall` script (`scripts/patch-jspdf.cjs`) patches jsPDF for the extension environment. Do not remove these.

---

## Key Files

| File | Role |
|------|------|
| `src/SidePanel.tsx` | Main list view, navigation, collection filtering, bulk actions, auth modal |
| `src/components/ItemDetail.tsx` | Detail view: AI summary, citation, tags, color, export |
| `src/services/storageService.ts` | All CRUD — dual local+cloud logic, pagination (`getItemsPage`), transform helpers |
| `src/services/geminiService.ts` | Citation generation (CrossRef waterfall) + AI summarization + `runOCR(imageUrl)` |
| `src/services/citationService.ts` | ISBN lookup via Open Library |
| `src/services/collectionService.ts` | Collections CRUD (cloud-only) |
| `src/services/smartPenService.ts` | Smart pen device pairing (Edge Function) |
| `src/content/index.tsx` | Selection capture, floating save button (Shadow DOM) |
| `src/background/index.ts` | Context menu save, message routing |
| `src/components/Toast.tsx` | Toast notification system (Context + hook) — supports `action: { label, onClick }` for undo |
| `src/components/CollectionSelector.tsx` | Modal: assign items to a collection — has `useFocusTrap` |
| `src/hooks/useFocusTrap.ts` | Reusable focus-trap hook for modals (Tab cycle, Escape to close, focus restore) |
| `src/constants.ts` | Magic string constants (`STORAGE_KEY`, `QUICK_SAVE_TAG`, `CITATION_FORMATS`) |
| `src/types.ts` | Shared TypeScript types (DB snake_case + camelCase variants) |

---

## State Management (SidePanel.tsx)

State is grouped logically — do not split these apart:

```ts
nav     = { view: "list"|"collections"|"detail"|"settings"|"smartpen", item: StorageItem | null }
sync    = { running: boolean, status: { msg, type } | null }
selection = { active: boolean, ids: Set<string>, showCollectionPicker: boolean }
```

Other state: `items`, `loading`, `user`, `searchQuery`, `debouncedSearch` (300ms debounce), `activeCollection`, `hasMore`, `nextOffset`, `isFetchingMore`.

`fetchItems()` also refreshes `nav.item` so ItemDetail always has fresh data after any update.

---

## UI Patterns

- **Toast:** `useToast()` hook from `Toast.tsx`. Never use `alert()`. Provider is at app root in `main.tsx`. Supports `options.action` for undo buttons.
- **Undo delete:** Optimistic remove from state → 5s toast with Undo → `setTimeout(5100ms)` → actual `deleteItem()`. Pattern used in both list (`handleDelete`) and detail (`handleDelete`).
- **Scroll buttons:** In `ItemDetail.tsx`, buttons are positioned `absolute bottom-6 right-4` on the **root div** (not inside the scroll container) — `sticky` inside `overflow-y: auto` is unreliable.
- **Animations:** `motion/react` (Framer Motion v12). Use `AnimatePresence` for view transitions.
- **Design language:** Apple-inspired. `backdrop-blur`, smooth transitions, Lucide React icons.
- **Dark mode:** Tailwind `dark:` variants throughout. No separate theme provider.
- **Modal accessibility:** Use `useFocusTrap(ref, isOpen, onClose)` + `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on every modal overlay.

---

## Pagination / Infinite Scroll

- `PAGE_SIZE = 30` in `storageService.ts`
- `getItemsPage(offset, pageSize)` returns `{ items, hasMore, nextOffset }`
- `IntersectionObserver` watches a sentinel `<div ref={sentinelRef}>` at list bottom; calls `loadMore()` with `rootMargin: "200px"` lookahead
- Search mode bypasses pagination and calls `getAllItems()` instead (so all results are searchable)

---

## Content Script Rules

Selection threshold in `src/content/index.tsx` `handleSelection()`:
- `isCollapsed === false`
- `wordCount >= 3`
- `charCount >= 15`

---

## StorageItem Interface (Canonical)

```ts
interface StorageItem {
  id: string;               // "local_<timestamp>" for local, UUID for cloud
  text: string;
  tags: string[];           // display tags only — color:* filtered out on read
  note: string;
  sourceUrl: string;
  sourceTitle: string;
  createdAt: string;        // ISO string
  updatedAt?: string;
  aiSummary?: string;
  citation?: string;
  citationFormat?: string;
  deviceSource: DeviceSource;
  collectionId?: string;
  imageUrl?: string;        // smart pen captures
  ocrText?: string;
  ocrConfidence?: number;   // 0–100 integer; heuristic from api/ocr.ts word count
  ocrEdited?: boolean;      // true once user has manually corrected the OCR text
  preferredView?: "original" | "summary";
  color?: "yellow" | "green" | "red" | "blue" | "purple";
}
```

---

## Known Patterns / Pitfalls

1. **`onClick={handleSummarize}` won't compile** — after adding `overrideMode?: SummaryMode` param, React's synthetic event is passed as the first arg. Always use `onClick={() => handleSummarize()}`.

2. **Tailwind border shorthand kills `border-l-*` color** — `border-gray-100` sets all four border colors, overriding `border-l-yellow-400`. Use inline `style={{ backgroundColor }}` on an absolute-positioned div instead.

3. **`sticky` inside `overflow-y: auto` is unreliable** — always use `absolute` positioning within a `relative` root container for floating/overlay UI inside scroll panes.

4. **`AbortController` in state causes memory leaks** — keep it in a `useRef`, not `useState`. Add unmount cleanup: `return () => abortControllerRef.current?.abort()`.

5. **Rate limiting:** `handleSummarize` and `handleCite` use `useRef` timestamps with 3-second cooldowns. Don't add state-based cooldowns (causes unnecessary re-renders).

6. **Color tags in tag chips:** Always `.filter(t => !t.startsWith("color:"))` before rendering tags in list view.

7. **`useFocusTrap` in serialized executeScript callbacks** — the hook lives in the React layer only. The `executeScript` func callback is serialized and runs in the page context, so it cannot access React hooks or any outer scope variables.

8. **OCR editing in `ItemDetail.tsx`** — smart pen items (`deviceSource === "smart_pen"`) show a confidence badge (`ocrConfidence`), an Edit button (enter textarea edit mode), and a Retry OCR button. On Save, `updateItem({ text, ocrEdited: true })` persists the correction to Supabase via the `text` column. On Retry, `runOCR(item.imageUrl)` fetches the image → converts to base64 DataURL → calls `api/ocr` and replaces both `text` and `ocrConfidence` in state.

9. **`runOCR` requires a public image URL** — the function fetches `imageUrl` directly. It will fail with a CORS error if the Supabase Storage bucket is not set to public. Ensure bucket policy allows unauthenticated GET.

10. **Book date parsing** — `handleBookSelect()` in `ItemDetail.tsx` uses `/\d{4}/.exec(rawDate)?.[0]` instead of `new Date(x).getFullYear()`. The native `Date` constructor silently returns `NaN` for partial dates like `"2024-12"`. Always use the regex approach for year extraction.

---

## Export Formats

Configurable in Settings, stored in `localStorage` key `"exportFormat"`. Options: `pdf`, `json`, `md`, `txt`.

---

## Build Notes

- `npm run build` is the canonical check. If TypeScript alone is needed: `npx tsc --noEmit`.
- Chunk size warning on `assets/index-*.js` (~810 kB) is expected and non-blocking — it's jsPDF + Supabase bundled together.
- The emitted icon files overwrite warning is also expected and safe to ignore.
