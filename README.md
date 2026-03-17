# ResearchMate Browser Extension

A high-fidelity research tool for Chrome that allows capturing and structuring data directly from the web. Part of the ResearchMate ecosystem.

## 🚀 Features

- **Smart Capture** - Highlight text and save it with one click.
- **AI Integration** - Generate summaries and tags using Gemini.
- **Cloud Sync** - Instant sync with the ResearchMate Web Dashboard via Supabase.
- **Smart Pen Support** - Manage paired smart pens and view scans. OCR confidence score displayed per capture; inline text editing and one-tap OCR retry available in the detail view.
- **Export Options** - Export research items to Markdown with proper citations.

## 📋 Prerequisites

- Node.js 18+
- npm
- Supabase account (shared with website and smart pen)

## ⚙️ Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file from the metadata provided in the project handover:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Build**
   ```bash
   npm run build
   ```
   The build output will be in the `dist/` folder. Load this as an unpacked extension in Chrome.

## 🏗️ Architecture

- **Manifest V3** - Uses the latest Chrome Extension standards.
- **Shadow DOM** - The trigger button is injected via Shadow DOM to prevent style leakage.
- **Service Workers** - Background processes handle Supabase communication and sync.
- **Edge Function Pairing** - Pairing with the Smart Pen is handled via Supabase Edge Functions to bypass RLS restrictions and ensure security.

## 📁 Project Structure

```
src/
├── components/       # React components (Popup, Sidebar, Modal)
├── content/          # Content scripts for DOM interaction
├── background/       # Service workers for background tasks
├── services/         # Supabase client and specialized services (smartPenService)
└── hooks/            # Custom React hooks
```

## 🔗 Ecosystem

| Component | Role | Link |
|-----------|------|------|
| **Smart Pen** | Physical Capture | [Firmware Repo](https://github.com/Unlighted01/ResearchMate-pen) |
| **Website** | Central Hub | [Website Repo](https://github.com/Unlighted01/Researchmate-Website) |

---
**Part of the ResearchMate Ecosystem** 🔬✨
