# NFChat Project Overview

## Purpose
NFChat is a browser-based netflow data analysis tool that uses DuckDB-WASM for in-browser SQL queries on parquet/CSV files. It provides visualizations for network traffic analysis including attack detection.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 7
- **Database**: DuckDB-WASM (in-browser SQL engine)
- **Styling**: Tailwind CSS v4, Radix UI components
- **State Management**: Zustand
- **Charts**: Recharts, react-force-graph-2d
- **Testing**: Vitest (unit), Playwright (e2e)
- **Deployment**: Vercel

## Key Features
- Load parquet/CSV/ZIP files for analysis
- Demo dataset from Cloudflare R2
- Timeline visualization of network flows
- Attack type distribution charts
- Top talkers analysis
- Network graph visualization
