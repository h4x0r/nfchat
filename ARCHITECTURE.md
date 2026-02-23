# nfchat Architecture Guide

> A network forensics analysis platform that combines AI-powered chat, DuckDB-based SQL analytics, and unsupervised machine learning (Hidden Markov Models) to help security analysts investigate NetFlow data through MITRE ATT&CK-aligned workflows.

## Table of Contents

- [System Overview](#system-overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Architecture Layers](#architecture-layers)
- [Data Flow](#data-flow)
- [Data Formats](#data-formats)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Security Architecture](#security-architecture)
- [HMM Anomaly Detection Pipeline](#hmm-anomaly-detection-pipeline)
- [Deployment](#deployment)

---

## System Overview

```
                          ┌──────────────────────────────────────────────────┐
                          │                 Browser (SPA)                    │
                          │                                                  │
  ┌─────────┐  Parquet/   │  ┌────────────┐  ┌──────────┐  ┌────────────┐  │
  │ Analyst  │◀──CSV────▶│  │  Landing    │──│ Loading  │──│ Forensic   │  │
  │          │  or demo    │  │  Page      │  │ Screen   │  │ Dashboard  │  │
  └─────────┘             │  └────────────┘  └──────────┘  └─────┬──────┘  │
                          │        │ XHR PUT                     │         │
                          │        │ (presigned)                 │         │
                          │        │         ┌───────────────────┤         │
                          │        │         │         │         │         │
                          │    ┌───│────┐  ┌─▼───────┐  ┌──────▼───┐     │
                          │    │FlowTab│  │ Chat    │  │ State    │     │
                          │    │(virt) │  │ (AI NL) │  │ Explorer │     │
                          │    └───┬───┘  └───┬─────┘  └────┬─────┘     │
                          │        │          │             │            │
                          │    ┌───▼──────────▼─────────────▼───┐       │
                          │    │       Zustand Store (7 slices)  │       │
                          │    └──────────────┬─────────────────┘       │
                          │                   │                          │
                          └───────────────────┼──────────────────────────┘
                                  │           │  REST API calls
                                  │  ┌────────▼───────────────────────────┐
                                  │  │      Vercel Serverless Functions    │
                                  │  │                                     │
                                  │  │  /api/motherduck/*  /api/chat/*     │
                                  │  │  (SQL + chunked)    (AI analysis)   │
                                  │  │                                     │
                                  │  │  /api/upload/*      /api/auth/*     │
                                  │  │  (presign+cleanup)  (GitHub OAuth)  │
                                  │  │                                     │
                                  │  │  /api/stripe/*                      │
                                  │  │  (Payments)                         │
                                  │  └────┬──────────────────┬────────────┘
                                  │       │                  │
                          ┌───────▼───────▼──┐  ┌───────────▼──────┐
                          │  Cloudflare R2   │  │  Claude Sonnet    │
                          │  (nfchat-data)   │  │  (via Vercel      │
                          │  + MotherDuck    │  │   AI Gateway)     │
                          │  (Cloud DuckDB)  │  └──────────────────┘
                          └──────────────────┘
```

**Key architectural decisions:**

- **SPA, not SSR** -- Vite + React, not Next.js. All routing is client-side state transitions.
- **Server-side SQL** -- Queries run on MotherDuck (cloud DuckDB) via Vercel serverless functions with `duckdb-lambda-x86`. The browser never runs DuckDB WASM for primary queries.
- **Chunked loading** -- Large datasets (>500K rows) are loaded via a probe→create→append protocol to stay within Vercel's 60-second function timeout. Each chunk targets ~500K rows.
- **Presigned R2 uploads** -- User file uploads bypass Vercel's 4.5MB body limit by uploading directly to Cloudflare R2 via presigned S3 PUT URLs. Vercel only generates the URL and triggers cleanup. Files are ephemeral (auto-deleted after loading, 1-hour lifecycle rule as safety net).
- **Two-step AI chat** -- User question -> Claude generates SQL -> SQL executes on MotherDuck -> Claude analyzes results. This keeps the LLM grounded in actual data.
- **Client-side HMM** -- The Gaussian HMM trains in a Web Worker to avoid blocking the UI. State assignments are written back to MotherDuck.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + TypeScript 5.9 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS 4 + shadcn/ui (Radix primitives) |
| State management | Zustand (7 slices) |
| Table rendering | TanStack Table + TanStack Virtual |
| Backend | Vercel Serverless Functions (Node.js) |
| Database | MotherDuck (cloud DuckDB) via `duckdb-lambda-x86` |
| Object storage | Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3` |
| AI | Claude Sonnet 4 via Vercel AI Gateway (`ai` SDK) |
| Auth | GitHub OAuth |
| Bot protection | Cloudflare Turnstile |
| Prompt security | Lakera Guard + Claude-based classifier |
| Payments | Stripe |
| Testing | Vitest + Testing Library (unit), Playwright (E2E) |
| Data format | Apache Parquet (ingestion), Apache Arrow (transport) |

---

## Directory Structure

```
nfchat/
├── api/                        # Vercel serverless backend
│   ├── auth/                   #   GitHub OAuth routes
│   ├── chat/                   #   AI chat endpoints (query.ts, analyze.ts)
│   ├── motherduck/             #   DuckDB endpoints (load, flows, dashboard, query)
│   │                           #     load.ts supports chunked loading (probe/create/append/convert)
│   ├── upload/                 #   File upload lifecycle
│   │   ├── presign.ts          #     Generate presigned S3 PUT URL for R2 tmp/
│   │   └── cleanup.ts          #     Delete temp files from R2 after loading
│   ├── stripe/                 #   Payment endpoints
│   └── lib/                    #   Shared backend utils (guards, prompts, validation)
│       └── chat/               #     Chat processing pipeline
│           ├── guard.ts        #       Prompt injection detection (Lakera)
│           ├── prompts/        #       System + user prompt templates
│           ├── queries/        #       SQL generation logic
│           └── validation/     #       Input sanitization
│
├── src/                        # Frontend application
│   ├── App.tsx                 #   Root: state machine (landing→loading→dashboard)
│   ├── main.tsx                #   React entry point
│   ├── components/
│   │   ├── forensic/           #   Main analysis UI
│   │   │   ├── ForensicDashboard.tsx   # Split-view container
│   │   │   ├── KillChainTimeline.tsx   # MITRE ATT&CK timeline
│   │   │   ├── StatsBar.tsx            # Stats popovers
│   │   │   ├── StateExplorer/          # HMM state analysis module
│   │   │   │   ├── index.tsx           #   Orchestrator
│   │   │   │   ├── StateCard.tsx       #   Per-state detail card
│   │   │   │   ├── TacticSelector.tsx  #   ATT&CK tactic assignment
│   │   │   │   ├── StateComparison.tsx #   Side-by-side state diff
│   │   │   │   ├── StateTransitions.tsx#   NxN transition matrix
│   │   │   │   └── StateTemporal.tsx   #   Temporal distribution
│   │   │   └── popovers/              # Drill-down stat popovers
│   │   ├── dashboard/
│   │   │   └── FlowTable/     #   Virtualized netflow table
│   │   ├── landing/            #   Landing page + file upload
│   │   ├── error/              #   Error boundaries
│   │   └── ui/                 #   shadcn/ui primitives
│   ├── hooks/                  #   Custom React hooks
│   ├── lib/
│   │   ├── schema.ts           #   FlowRecord type + constants
│   │   ├── api-client.ts       #   HTTP client with dedup + tracing
│   │   ├── store/              #   Zustand slices
│   │   ├── motherduck/         #   DB connection + query functions
│   │   │   └── queries/        #     SQL query builders
│   │   ├── hmm/                #   HMM anomaly detection (client-side)
│   │   │   ├── gaussian-hmm.ts #     Baum-Welch EM implementation
│   │   │   ├── features.ts     #     17-feature extraction
│   │   │   ├── anomaly.ts      #     MAD-based anomaly scoring
│   │   │   ├── narrative.ts    #     Human-readable state descriptions
│   │   │   ├── tactic-suggester.ts # Heuristic ATT&CK mapping
│   │   │   └── worker-bridge.ts#     Web Worker bridge
│   │   ├── errors/             #   Structured error classes
│   │   ├── schemas/            #   Zod response validators
│   │   ├── sql/                #   SQL utilities
│   │   └── tracing/            #   Request tracing infrastructure
│   ├── styles/                 #   Tailwind + CRT terminal styles
│   └── test/                   #   Factories, mocks, utils
│
├── scripts/hmm/                # Python HMM labeler (offline tool)
├── datasets/                   # Sample data files
├── e2e/                        # Playwright E2E tests
├── netflow-mcp/                # MCP server for AI tool integration
└── docs/
    ├── adr/                    # Architecture decision records
    ├── research/               # Research reports
    └── presentations/          # Conference/demo slide decks
```

---

## Architecture Layers

The system has five distinct layers. Each depends only on layers below it.

```
┌─────────────────────────────────────────────────────────────┐
│  5. UI Components                                           │
│     React components, lazy loading, virtual scrolling       │
├─────────────────────────────────────────────────────────────┤
│  4. State & Hooks                                           │
│     Zustand store (7 slices), custom hooks, selectors       │
├─────────────────────────────────────────────────────────────┤
│  3. API Client                                              │
│     api-client.ts: HTTP POST with dedup, tracing, errors    │
├─────────────────────────────────────────────────────────────┤
│  2. Serverless API                                          │
│     Vercel functions: /api/motherduck/*, /api/chat/*        │
│     Guards: Turnstile, Lakera, SQL validation               │
├─────────────────────────────────────────────────────────────┤
│  1. Data Layer                                              │
│     MotherDuck (DuckDB), Claude Sonnet 4, Stripe, GitHub    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Initial Data Load (Chunked)

The entry point is a Parquet/CSV file (demo URL or user upload). The `useNetflowData` hook accepts a `DataSource` (string URL or `{ type: 'file', file: File }`). This sequence runs once per session.

**Path A: URL source (demo dataset)**
```
User clicks "Load Demo" on LandingPage
        │
        ▼
App.tsx sets dataSource = "url"
        │
        ▼
useNetflowData(url) hook fires
        │
        ├──▶ POST /api/motherduck/load  { url, action: 'probe' }
        │         │
        │         ▼  DuckDB: SELECT COUNT(*) FROM read_parquet(url)
        │         │  (reads Parquet metadata only — fast)
        │         ▼  Returns { rowCount: 2400000 }
        │
        │    2.4M > 500K threshold → chunked path
        │
        ├──▶ POST /api/motherduck/load  { url, action: 'create', chunkSize: 500000 }
        │         ▼  CREATE OR REPLACE TABLE flows AS SELECT * ... LIMIT 500000
        │
        ├──▶ POST /api/motherduck/load  { url, action: 'append', chunkSize: 500000, offset: 500000 }
        ├──▶ ... (repeat for chunks 3, 4, 5)
        │
        ├──▶ POST /api/motherduck/dashboard  { whereClause: '1=1' }
        │         ▼  Server runs 6 parallel queries → DashboardData
        │
        ▼
Store updated → App renders ForensicDashboard (lazy-loaded)
```

**Path B: File upload source**
```
User drops .parquet or .csv onto LandingPage
        │
        ▼
App.tsx sets dataSource = { type: 'file', file }
        │
        ▼
useNetflowData({ type: 'file', file }) hook fires
        │
        ├──▶ POST /api/upload/presign  { filename }
        │         ▼  Returns { uploadUrl (presigned S3 PUT), publicUrl, key }
        │
        ├──▶ XHR PUT to uploadUrl  [browser → R2 direct, with progress]
        │
        ├──▶ (same chunked load protocol as Path A, using publicUrl)
        │
        ├──▶ POST /api/upload/cleanup  { keys: [key] }  [in finally block]
        │         ▼  Deletes temp file from R2
        │
        ▼
Store updated → App renders ForensicDashboard
```

For datasets ≤500K rows, the probe step is followed by a single `load` action (no chunking).

### 2. Filtering & Pagination

All filtering and pagination is **server-side**. The FlowTable never holds more than one page of data.

```
User changes column filter or page
        │
        ▼
ForensicDashboard builds SQL WHERE clause
  e.g. "IPV4_SRC_ADDR LIKE '%192.168%' AND Attack != 'Benign'"
        │
        ▼
POST /api/motherduck/flows {
  whereClause,
  limit: pageSize,     // dynamic, based on container height
  offset: page * size
}
        │
        ▼
DuckDB: SELECT * FROM flows WHERE ... LIMIT ... OFFSET ...
        │
        ▼
Component state: pageFlows = [...], filteredTotalCount = N
```

### 3. AI Chat Query

The chat pipeline is two-step to keep the LLM grounded in actual query results rather than hallucinating data.

```
User types: "Show me the top 5 source IPs doing credential access"
        │
        ▼
Step 1: POST /api/chat/query
        │
        ├─ Turnstile CAPTCHA verification
        ├─ Lakera Guard (prompt injection scan, 3s timeout, fail-open)
        ├─ Claude Classifier (CLEAN / INJECTION / OFF_TOPIC / PII)
        │
        ▼
Claude Sonnet 4 receives:
  - NETFLOW_SCHEMA (column names + types)
  - System prompt: "You are a network forensics SQL analyst..."
  - User question
        │
        ▼
Returns { queries: ["SELECT IPV4_SRC_ADDR, COUNT(*) ..."], reasoning: "..." }
        │
        ▼
SQL validation:
  - Must be SELECT only
  - Blocked: DROP, DELETE, INSERT, UPDATE, ALTER, CREATE, TRUNCATE
  - Row limit: 10,000
        │
        ▼
Step 2: Each query executes via POST /api/motherduck/query
        │
        ▼
Step 3: POST /api/chat/analyze
        │
        ├─ Same guard pipeline (Lakera + Claude classifier)
        │
        ▼
Claude Sonnet 4 receives:
  - Original question
  - Query results (JSON)
  - System prompt: "You are a senior security analyst..."
        │
        ▼
Returns { response: "The top 5 source IPs performing credential access are..." }
        │
        ▼
Chat message rendered with markdown
```

### 4. HMM State Discovery

The HMM pipeline runs client-side in a Web Worker to avoid blocking the UI.

```
User clicks "Discover States" in StateExplorer
        │
        ▼
POST /api/motherduck/query (extractFeatures SQL)
  - Selects IPs with >= 3 flows, caps at 500 IPs
  - Extracts 17 features per flow via SQL expressions
        │
        ▼
Feature matrix returned to browser
        │
        ▼
Web Worker: GaussianHMM.fit(features, nStates)
  - StandardScaler normalization
  - Baum-Welch EM algorithm (max 100 iterations)
  - BIC-based state count selection (if auto)
  - Viterbi decoding for state assignments
        │
        ▼
POST /api/motherduck/query (writeStateAssignments)
  - UPDATE flows SET HMM_STATE = N WHERE rowid = ...
        │
        ▼
POST /api/motherduck/query (getStateSignatures)
  - Aggregate per-state statistics
        │
        ▼
Client-side:
  ├─ Anomaly scoring (MAD Z-scores)
  ├─ Narrative generation (threshold-based text)
  └─ Tactic suggestion (heuristic matching to ATT&CK)
        │
        ▼
Store: hmmSlice.hmmStates = [StateProfile, ...]
StateExplorer renders state cards with tactic assignments
```

---

## Datasets & Scale

### Available Datasets

Two Parquet files are hosted in a public Cloudflare R2 bucket (`nfchat-data`):

| File | Rows | Parquet Size | Labels | Status |
|------|------|-------------|--------|--------|
| `UWF-ZeekData24.parquet` | 2.4M | 83 MB | MITRE ATT&CK tactics + techniques | **Active** -- wired up as the demo dataset |
| `NF-UNSW-NB15-v3.parquet` | ~2.5M | 100 MB | Legacy attack types (Exploits, DoS, etc.) | In R2 but not referenced by the app |

The demo dataset URL is hardcoded in `src/App.tsx` and `src/components/landing/LandingPage.tsx`:
```
https://pub-d25007b87b76480b851d23d324d67505.r2.dev/UWF-ZeekData24.parquet
```

### Per-Session Load Pattern

Data is **not persisted** between sessions. Every time a user loads a dataset, the file is re-ingested via the chunked protocol:

```
Browser                    Vercel Function              MotherDuck          R2
   │                            │                          │                │
   │  POST load {action:'probe'}│                          │                │
   │ ──────────────────────────▶│  COUNT(*) FROM           │                │
   │                            │  read_parquet(url)       │  metadata read │
   │                            │ ────────────────────────▶│ ──────────────▶│
   │◀──────────────────────────│  { rowCount: 2400000 }   │                │
   │                            │                          │                │
   │  POST load {action:'create', chunkSize: 500000}      │                │
   │ ──────────────────────────▶│  CREATE TABLE ... LIMIT  │  partial read  │
   │◀──────────────────────────│  { rowCount: 500000 }    │                │
   │                            │                          │                │
   │  POST load {action:'append', offset: 500000}         │                │
   │ ──────────────────────────▶│  INSERT INTO ... OFFSET  │  partial read  │
   │◀──────────────────────────│  { rowCount: 1000000 }   │                │
   │                            │                          │                │
   │  ... (repeat until all chunks loaded)                 │                │
```

This means:
- MotherDuck pulls the Parquet from R2 on every session (not cached)
- Each chunk must complete within the **60-second Vercel function timeout** (~500K rows/chunk)
- No data survives between browser sessions

For user-uploaded files, an additional presign→upload→cleanup lifecycle wraps the load:
- Browser uploads directly to R2 `tmp/` via presigned S3 PUT URL
- After loading, the temp file is deleted from R2
- R2 lifecycle rule auto-deletes `tmp/*` after 1 hour as safety net

### Scalability Constraints

| Constraint | Limit | Impact |
|-----------|-------|--------|
| Vercel function timeout | 60 seconds | Each chunk must finish within this window |
| Chunk size | 500,000 rows | ~18MB data per chunk at ~37 bytes/row, fits in ~30-40s |
| User file upload | 100 MB max | Enforced via presigned URL constraints |
| Supported upload formats | `.parquet`, `.csv` | CSV converted to Parquet via MotherDuck before chunked load |
| MotherDuck free tier | 10 GB storage | Could hold ~50-100M flows if pre-loaded |
| HMM feature extraction | 500 IPs, >= 3 flows each | SQL-side cap to keep training tractable |
| HMM Web Worker | ~50-100K flows | Browser CPU/memory bound for Baum-Welch EM |
| Chat query row limit | 10,000 rows | Hard cap in SQL validation layer |

### Real-World Comparison

The demo datasets are useful for proof-of-concept but are small relative to production environments:

| Environment | Daily Flow Volume | vs. Demo Dataset |
|-------------|-------------------|------------------|
| Small office (50 users) | 1-5M flows/day | ~1x (comparable) |
| Mid-size enterprise (1K users) | 50-200M flows/day | 20-80x larger |
| Large enterprise / ISP | 1-10B+ flows/day | 400-4000x larger |
| Typical SOC investigation window | 10-100M flows | 4-40x larger |

Chunked loading extends the practical limit from ~5M rows (single-load) to ~50M+ rows (limited by user patience, not timeout). For real-world volumes beyond that, pre-loaded persistent tables in MotherDuck would eliminate the load step entirely.

---

## Data Formats

### FlowRecord (Core Schema)

Every row in the `flows` table conforms to this interface. Defined in `src/lib/schema.ts`.

```typescript
interface FlowRecord {
  // ── Temporal ───────────────────────────────────
  FLOW_START_MILLISECONDS: number    // Unix ms
  FLOW_END_MILLISECONDS: number      // Unix ms
  FLOW_DURATION_MILLISECONDS: number

  // ── 5-Tuple ────────────────────────────────────
  IPV4_SRC_ADDR: string              // e.g. "192.168.1.10"
  L4_SRC_PORT: number
  IPV4_DST_ADDR: string
  L4_DST_PORT: number
  PROTOCOL: number                   // 6=TCP, 17=UDP, 1=ICMP

  // ── Traffic Volume ─────────────────────────────
  IN_BYTES: number                   // src → dst
  OUT_BYTES: number                  // dst → src
  IN_PKTS: number
  OUT_PKTS: number

  // ── TCP/Protocol Detail ────────────────────────
  TCP_FLAGS: number
  CLIENT_TCP_FLAGS: number
  SERVER_TCP_FLAGS: number
  L7_PROTO: number                   // 5=DNS, 7=HTTP, 91=SSH, 92=TLS
  MIN_TTL: number
  MAX_TTL: number

  // ── Packet Size Distribution ───────────────────
  LONGEST_FLOW_PKT: number
  SHORTEST_FLOW_PKT: number
  MIN_IP_PKT_LEN: number
  MAX_IP_PKT_LEN: number
  NUM_PKTS_UP_TO_128_BYTES: number
  NUM_PKTS_128_TO_256_BYTES: number
  NUM_PKTS_256_TO_512_BYTES: number
  NUM_PKTS_512_TO_1024_BYTES: number
  NUM_PKTS_1024_TO_1514_BYTES: number

  // ── Throughput & Retransmission ────────────────
  SRC_TO_DST_AVG_THROUGHPUT: number  // bps
  DST_TO_SRC_AVG_THROUGHPUT: number
  SRC_TO_DST_SECOND_BYTES: number
  DST_TO_SRC_SECOND_BYTES: number
  RETRANSMITTED_IN_BYTES: number
  RETRANSMITTED_IN_PKTS: number
  RETRANSMITTED_OUT_BYTES: number
  RETRANSMITTED_OUT_PKTS: number

  // ── Inter-Arrival Time ─────────────────────────
  SRC_TO_DST_IAT_MIN: number        // ms
  SRC_TO_DST_IAT_MAX: number
  SRC_TO_DST_IAT_AVG: number
  SRC_TO_DST_IAT_STDDEV: number
  DST_TO_SRC_IAT_MIN: number
  DST_TO_SRC_IAT_MAX: number
  DST_TO_SRC_IAT_AVG: number
  DST_TO_SRC_IAT_STDDEV: number

  // ── TCP Window ─────────────────────────────────
  TCP_WIN_MAX_IN: number
  TCP_WIN_MAX_OUT: number

  // ── Protocol-Specific ──────────────────────────
  ICMP_TYPE: number
  ICMP_IPV4_TYPE: number
  DNS_QUERY_ID: number
  DNS_QUERY_TYPE: number             // 1=A, 2=NS, 5=CNAME
  DNS_TTL_ANSWER: number
  FTP_COMMAND_RET_CODE: number

  // ── Classification ─────────────────────────────
  Label: string                      // "Benign" | "Attack"
  Attack: string                     // Attack type or MITRE tactic

  // ── MITRE ATT&CK (UWF-ZeekData24 dataset) ─────
  MITRE_TACTIC?: string              // "Credential Access", "Reconnaissance", etc.
  MITRE_TECHNIQUE?: string           // "T1110", "T1595", etc.

  // ── Zeek Enrichment ────────────────────────────
  CONN_STATE?: string                // S0, S1, SF, REJ, RSTO, RSTR
  SERVICE?: string                   // http, dns, ssh, etc.
  HISTORY?: string                   // Connection history string
  COMMUNITY_ID?: string              // Cross-tool correlation hash

  // ── HMM Assignment (computed at runtime) ───────
  HMM_STATE?: number                 // Assigned state from Gaussian HMM
}
```

**Total: 65+ columns.** The schema supports two dataset formats:

| Dataset | Label system | Classification column |
|---------|-------------|----------------------|
| NF-UNSW-NB15 (legacy) | Attack type names | `Attack` = "Exploits", "DoS", "Fuzzers", etc. |
| UWF-ZeekData24 (primary) | MITRE ATT&CK tactics | `Attack` = tactic name, `MITRE_TECHNIQUE` = "T1110", etc. |

### HMM Feature Vector (17 features)

Extracted from FlowRecords for HMM training. Defined in `src/lib/hmm/features.ts`.

```
 #  Feature              Description                          Transform
 1  log1p_in_bytes       Incoming bytes                       log1p
 2  log1p_out_bytes      Outgoing bytes                       log1p
 3  log1p_in_pkts        Incoming packets                     log1p
 4  log1p_out_pkts       Outgoing packets                     log1p
 5  log1p_duration_ms    Flow duration                        log1p
 6  log1p_iat_avg        Inter-arrival time avg               log1p
 7  bytes_ratio          IN_BYTES / (OUT_BYTES + 1)           raw
 8  pkts_per_second      Total pkts / duration                raw
 9  is_tcp               Protocol == 6                        binary
10  is_udp               Protocol == 17                       binary
11  is_icmp              Protocol == 1                        binary
12  port_category         0=well-known, 1=registered, 2=ephemeral  ordinal
13  is_conn_complete     CONN_STATE == 'SF'                   binary
14  is_conn_no_reply     CONN_STATE == 'S0'                   binary
15  is_conn_rejected     CONN_STATE in (REJ,RSTO,RSTR)       binary
16  log1p_bytes_per_pkt  Total bytes / total packets          log1p
17  log1p_inter_flow_gap Gap between consecutive flows        log1p
```

### StateProfile (HMM output)

Stored in Zustand `hmmSlice.hmmStates`. Defined in `src/lib/store/types.ts`.

```typescript
interface StateProfile {
  stateId: number
  flowCount: number
  avgInBytes: number
  avgOutBytes: number
  bytesRatio: number
  avgDurationMs: number
  avgPktsPerSec: number
  protocolDist: { tcp: number; udp: number; icmp: number }    // 0-1
  portCategoryDist: { wellKnown: number; registered: number; ephemeral: number }
  connCompletePct?: number
  noReplyPct?: number
  rejectedPct?: number
  avgBytesPerPkt?: number
  avgInterFlowGapMs?: number
  anomalyScore?: number       // 0-100, MAD-based
  anomalyFactors?: string[]   // e.g. ["bytes_ratio", "duration"]
}
```

### API Request/Response Formats

All endpoints accept `POST` with JSON body and return JSON.

**`POST /api/motherduck/load`**
```
Request:  {
  url: string,
  action?: 'load' | 'probe' | 'create' | 'append' | 'convert',  // default: 'load'
  chunkSize?: number,     // for create/append, default 500,000
  offset?: number,        // for append, default 0
  parquetKey?: string     // for convert (CSV→Parquet destination in R2)
}
Response: { success: boolean, rowCount?: number, url?: string, key?: string, error?: string }
```

**`POST /api/upload/presign`**
```
Request:  { filename: string }
Response: { success: boolean, uploadUrl: string, publicUrl: string, key: string }
```

**`POST /api/upload/cleanup`**
```
Request:  { keys: string[] }         // must all start with "tmp/"
Response: { success: boolean }
```

**`POST /api/motherduck/dashboard`**
```
Request:  { bucketMinutes?: number, whereClause?: string, limit?: number, offset?: number }
Response: {
  success: boolean,
  data?: {
    timeline:  [{ time: number, attack: string, count: number }]
    attacks:   [{ attack: string, count: number }]
    topSrcIPs: [{ ip: string, value: number }]
    topDstIPs: [{ ip: string, value: number }]
    flows:     FlowRecord[]
    totalCount: number
  }
}
```

**`POST /api/motherduck/flows`**
```
Request:  { whereClause?: string, limit?: number, offset?: number, deduplicate?: boolean }
Response: { success: boolean, data?: { flows: FlowRecord[], totalCount: number } }
```

**`POST /api/motherduck/query`**
```
Request:  { sql: string }
Response: { success: boolean, data?: Record<string, unknown>[], error?: string }
```

**`POST /api/chat/query`**
```
Request:  { question: string, turnstileToken: string, clientIP: string, userId?: string }
Response: { success: boolean, queries?: string[], reasoning?: string, error?: string }
```

**`POST /api/chat/analyze`**
```
Request:  { question: string, data: unknown[], turnstileToken: string, clientIP: string }
Response: { success: boolean, response?: string, error?: string }
```

---

## Component Architecture

### App State Machine

The root `App.tsx` manages a simple state machine, not a router:

```
  ┌──────────────┐    user picks source    ┌──────────────┐
  │   LANDING    │ ──────────────────────▶ │   LOADING    │
  │ (no data)    │                         │ (CRT screen) │
  └──────────────┘                         └──────┬───────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    │ success     │             │ error
                              ┌─────▼──────┐                ┌──▼─────────┐
                              │ DASHBOARD  │                │   ERROR    │
                              │ (forensic) │                │ (retry)    │
                              └────────────┘                └────────────┘
```

### ForensicDashboard Layout (65/35 split)

```
┌───────────────────────────────────────────────────────────────────────┐
│  [Flows]  [State Explorer]   tabs            StatsBar (popovers)     │
├────────────────────────────────────┬──────────────────────────────────┤
│                                    │                                  │
│  FlowTable (65%)                   │  Right Panel (35%)               │
│  ┌──────────────────────────────┐  │  ┌────────────────────────────┐ │
│  │ Column headers + filters     │  │  │ Tab: Chat                  │ │
│  │ ─────────────────────────────│  │  │   AI-powered NL queries    │ │
│  │ Virtual scrolling rows       │  │  │   Markdown responses       │ │
│  │ (only renders visible rows)  │  │  │                            │ │
│  │                              │  │  │ Tab: Kill Chain Timeline   │ │
│  │ Click cell → pivot in chat   │  │  │   Attack sessions list     │ │
│  │                              │  │  │   MITRE tactic pills       │ │
│  │ ─────────────────────────────│  │  │   Phase visualization      │ │
│  │ Pagination (server-side)     │  │  │                            │ │
│  └──────────────────────────────┘  │  └────────────────────────────┘ │
│                                    │                                  │
├────────────────────────────────────┴──────────────────────────────────┤
│  Alternative view: StateExplorer (replaces FlowTable when active)    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ DiscoveryControls → StateSummaryBar → StateGridControls         │ │
│  │ ┌────────┐ ┌────────┐ ┌────────┐                               │ │
│  │ │ State 0│ │ State 1│ │ State 2│  ... StateCard grid            │ │
│  │ │ TCP 92%│ │ UDP 78%│ │ Mix    │                                │ │
│  │ │ Recon  │ │ C2     │ │ Normal │  ← TacticSelector per card    │ │
│  │ └────────┘ └────────┘ └────────┘                               │ │
│  │ StateTransitions (NxN matrix)  │  StateTemporal (time chart)    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Key Component Files

| Component | File | Role |
|-----------|------|------|
| `App` | `src/App.tsx` | State machine root, data source selection |
| `LandingPage` | `src/components/landing/LandingPage.tsx` | Demo/upload entry |
| `ForensicDashboard` | `src/components/forensic/ForensicDashboard.tsx` | Main split-view |
| `FlowTable` | `src/components/dashboard/FlowTable/index.tsx` | Virtualized table |
| `Chat` | `src/components/Chat.tsx` | AI chat (lazy) |
| `KillChainTimeline` | `src/components/forensic/KillChainTimeline.tsx` | ATT&CK timeline (lazy) |
| `StateExplorer` | `src/components/forensic/StateExplorer/index.tsx` | HMM analysis (lazy) |
| `StatsBar` | `src/components/forensic/StatsBar.tsx` | Stat popovers |
| `ErrorBoundary` | `src/components/error/ErrorBoundary.tsx` | Error recovery |

---

## State Management

The Zustand store is composed from 7 slices in `src/lib/store/`:

```
useStore (AppState)
│
├── dataSlice ─── flows, attackBreakdown, topSrcIPs, topDstIPs,
│                 totalFlowCount, selectedFlow, dataLoaded/Loading/Error
│
├── filterSlice ─ timeRange, srcIps, dstIps, srcPorts, dstPorts,
│                 protocols, attackTypes, customFilter
│
├── paginationSlice ─ currentPage, pageSize
│
├── chatSlice ─── messages (ChatMessage[]), isLoading
│
├── hmmSlice ──── hmmStates (StateProfile[]), hmmTraining, hmmProgress,
│                 tacticAssignments (Record<stateId, tactic>),
│                 hmmConverged, hmmIterations, hmmLogLikelihood
│
├── viewSlice ─── activeView ('dashboard' | 'stateExplorer'),
│                 selectedHmmState (flow filter by state)
│
└── uiSlice ───── hideBenign, filteredFlows
```

**Selectors** (in `src/lib/store/selectors.ts`) provide derived state:
- `buildWhereClause()` -- constructs SQL WHERE from active filters
- `selectFilteredFlows()` -- applies client-side benign filter
- `selectDashboardState()` / `selectChatState()` -- grouped accessors

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useNetflowData` | `src/hooks/useNetflowData.ts` | Orchestrates upload (if file) + chunked load + dashboard fetch + cleanup |
| `useStateGrid` | `src/hooks/useStateGrid.ts` | Sort/filter/compare state for StateExplorer |
| `useStateDetails` | `src/hooks/useStateDetails.ts` | Lazy-fetches per-state details on expand |
| `useTablePageSize` | `src/hooks/useTablePageSize.ts` | Dynamic page size from container height |
| `useContainerDimensions` | `src/hooks/useContainerDimensions.ts` | ResizeObserver-based dimensions |

---

## Security Architecture

```
                   Request
                      │
                      ▼
              ┌───────────────┐
              │  Cloudflare   │  Bot detection (Turnstile CAPTCHA)
              │  Turnstile    │  Tokens verified server-side
              └───────┬───────┘
                      │
              ┌───────▼───────┐
              │  Lakera Guard │  Prompt injection detection
              │  (3s timeout, │  External API, fail-open
              │   fail-open)  │  for availability
              └───────┬───────┘
                      │
              ┌───────▼───────┐
              │  Claude       │  Message classification:
              │  Classifier   │  CLEAN / INJECTION / OFF_TOPIC / PII
              └───────┬───────┘
                      │
              ┌───────▼───────┐
              │  SQL          │  SELECT only whitelist
              │  Validation   │  Blocked: DROP, DELETE, INSERT, UPDATE,
              └───────┬───────┘  ALTER, CREATE, TRUNCATE, EXEC
                      │          Row limit: 10,000
              ┌───────▼───────┐
              │  Rate Limiter │  Per-user request caps
              └───────┬───────┘
                      │
                      ▼
                  Execute query
```

**Additional security measures:**
- GitHub OAuth for authenticated access
- COOP/COEP headers for SharedArrayBuffer isolation (required by WASM)
- API routes validate all inputs with Zod schemas
- Vercel function timeout: 60 seconds max (per chunk, not per dataset)
- R2 upload keys validated to start with `tmp/` prefix (prevents deletion of curated datasets)
- MotherDuck token stored as environment secret

---

## HMM Anomaly Detection Pipeline

This is the machine learning subsystem. It operates as a fully client-side pipeline (except for data I/O) that enriches flows with behavioral state labels.

```
                   ┌─────────────────────────────┐
                   │    1. Feature Extraction     │
                   │    (SQL on MotherDuck)        │
                   │                               │
                   │  - Filter: IPs with >= 3 flows│
                   │  - Cap: 500 IPs max           │
                   │  - Extract 17 features/flow   │
                   │  - log1p transforms           │
                   └──────────────┬────────────────┘
                                  │
                   ┌──────────────▼────────────────┐
                   │    2. HMM Training            │
                   │    (Web Worker)                │
                   │                               │
                   │  - StandardScaler normalize   │
                   │  - Gaussian HMM, diag cov     │
                   │  - Baum-Welch EM (<=100 iter) │
                   │  - BIC for state count select │
                   │  - Viterbi state assignment    │
                   └──────────────┬────────────────┘
                                  │
                   ┌──────────────▼────────────────┐
                   │    3. State Assignment         │
                   │    (Write back to MotherDuck)  │
                   │                               │
                   │  UPDATE flows SET HMM_STATE=N │
                   │  Aggregate state signatures   │
                   └──────────────┬────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
   ┌──────────▼──────────┐ ┌────▼──────────┐ ┌─────▼──────────┐
   │ 4a. Anomaly Scoring │ │ 4b. Narrative │ │ 4c. Tactic     │
   │                     │ │   Generation  │ │   Suggestion   │
   │ MAD-based Z-scores  │ │               │ │                │
   │ Score 0-100         │ │ Threshold     │ │ Heuristic      │
   │ Top 3 factors       │ │ classification│ │ matching to    │
   │                     │ │ "High-volume  │ │ ATT&CK tactics │
   │ bytes_ratio,        │ │  TCP traffic  │ │                │
   │ duration,           │ │  on well-     │ │ Recon, C2,     │
   │ pkts_per_sec,       │ │  known ports" │ │ Exfil, etc.    │
   │ protocol_skew       │ │               │ │ + confidence   │
   └─────────────────────┘ └───────────────┘ └────────────────┘
```

**Key files:**

| File | Purpose |
|------|---------|
| `src/lib/hmm/gaussian-hmm.ts` | Core Baum-Welch EM + Viterbi |
| `src/lib/hmm/features.ts` | 17-feature extraction definitions |
| `src/lib/hmm/anomaly.ts` | MAD-based outlier scoring |
| `src/lib/hmm/narrative.ts` | Human-readable state descriptions |
| `src/lib/hmm/tactic-suggester.ts` | Heuristic ATT&CK tactic mapping |
| `src/lib/hmm/worker-bridge.ts` | Web Worker bridge (sync fallback for SSR/tests) |
| `src/lib/hmm/state-analyzer.ts` | State property analysis |
| `src/lib/motherduck/queries/hmm.ts` | SQL queries for feature extraction + state I/O |

---

## Deployment

```
Git push
    │
    ▼
Vercel auto-deploys
    │
    ├── Frontend: Vite build → static assets in dist/
    │     COOP + COEP headers (vercel.json) enable SharedArrayBuffer
    │
    └── Backend: Each api/**/*.ts → individual serverless function
          MotherDuck endpoints include duckdb-lambda-x86 binary
          Upload endpoints use @aws-sdk/client-s3 for R2
          60-second max timeout per function invocation
          Fluid Compute enabled for extended execution
```

**Environment variables required:**

| Variable | Purpose |
|----------|---------|
| `MOTHERDUCK_TOKEN` | MotherDuck cloud DuckDB access |
| `AI_GATEWAY_URL` | Vercel AI Gateway endpoint |
| `ANTHROPIC_API_KEY` | Claude Sonnet 4 access |
| `TURNSTILE_SECRET_KEY` | Cloudflare CAPTCHA verification |
| `LAKERA_API_KEY` | Prompt injection detection |
| `GITHUB_CLIENT_ID` | OAuth app ID |
| `GITHUB_CLIENT_SECRET` | OAuth app secret |
| `STRIPE_SECRET_KEY` | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API token (S3-compatible, read+write) |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_ENDPOINT` | R2 S3-compatible endpoint URL |
| `R2_BUCKET` | R2 bucket name (`nfchat-data`) |
| `R2_PUBLIC_URL` | R2 public URL for reading uploaded files |

**Performance optimizations:**

- Chunked loading: datasets >500K rows are split into chunks to stay within 60s timeout per request
- Presigned R2 uploads: browser uploads directly to R2, bypassing Vercel's 4.5MB body limit and 60s timeout
- Lazy-loaded components: `ForensicDashboard`, `Chat`, `KillChainTimeline`, `StateExplorer`
- Virtual scrolling via TanStack Virtual (renders only visible rows)
- Server-side pagination and filtering (never loads full dataset to browser)
- API client deduplicates in-flight requests to prevent duplicate concurrent calls
- Dashboard endpoint runs 6 queries in `Promise.all()` for parallel aggregation
- HMM training runs in Web Worker to keep UI responsive
- Dynamic page size adapts to container height via ResizeObserver
