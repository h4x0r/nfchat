# nfchat

Analyze NetFlow data with an AI chat assistant.

## Quickstart

```bash
npm install && npm run dev
```

Open http://localhost:5173, click **Demo Data** tab, then **Load Demo Dataset**.

## What You Can Do

- **Chat**: Ask questions like "show me the top 10 attackers" or "what attacks happened in the last hour"
- **Timeline**: Scrub through time, adjust playback speed, zoom into specific periods
- **Filter**: Click column headers to sort, type in filter boxes to narrow results
- **Explore**: Click any flow row to see details, hover charts for tooltips

## Configuration

Set `VITE_MOTHERDUCK_TOKEN` to use your own MotherDuck database. Without it, demo mode works with sample data.

---

## Development

See [docs/](docs/) for architecture and design details.

```bash
npm test           # Unit tests
npm run test:e2e   # E2E tests
npm run build      # Production build
```
