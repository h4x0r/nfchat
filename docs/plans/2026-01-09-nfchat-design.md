# NFChat - Netflow Analysis Chat Interface

## Overview

NFChat is a dashboard application that enables IR (Incident Response) analysts to investigate netflow data through natural language queries. The app combines traditional dashboard visualizations with an AI-powered chat interface for intuitive threat hunting.

**Target Users**: Incident Response analysts investigating network traffic patterns

**Data Source**: NF-UNSW-NB15-v3 dataset (~2.3M netflow records, 54 features, 10 attack labels)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React App)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │   Chat UI   │◄─┼─────── Bidirectional Sync ─────────►│   │
│  │             │  │         Dashboard Panel             │   │
│  │  - Input    │  │  - Timeline (Recharts)              │   │
│  │  - History  │  │  - Top Talkers (Bar)                │   │
│  │  - Results  │  │  - Protocol Dist (Pie)              │   │
│  └──────┬──────┘  │  - Flow Table (TanStack Table)      │   │
│         │         │  - Network Graph (react-force-graph)│   │
│         │         │  - Geo Map (react-simple-maps)      │   │
│         │         │  - Attack Breakdown (Bar)           │   │
│         │         └─────────────────────────────────────┘   │
│         │                        ▲                          │
│         │                        │                          │
│         ▼                        ▼                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              DuckDB-WASM + Parquet Data              │   │
│  │         (All queries execute locally)                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Only NL query + SQL sent
                           ▼
              ┌─────────────────────────┐
              │   Serverless Function   │
              │   (Vercel Edge)         │
              │                         │
              │   Anthropic Opus 4.5    │
              │   - NL → SQL generation │
              │   - Result explanation  │
              └─────────────────────────┘
```

### Key Design Principles

1. **Data stays local**: Raw netflow data never leaves the browser. Only natural language queries and generated SQL are sent to the LLM endpoint.

2. **Hybrid query approach**: LLM generates precise SQL for structured queries, plus conversational explanations and investigation suggestions.

3. **Bidirectional sync**: Chat queries filter the dashboard, dashboard interactions add context to chat.

## Data Pipeline

### Dataset Preparation

- **Source**: NF-UNSW-NB15-v3.csv (551 MB, ~2.3M rows)
- **Format**: Convert to Parquet with ZSTD compression (~60-100 MB)
- **Loading**: DuckDB-WASM loads Parquet in browser (5-10s on modern machines)

### Schema

| Column | Type | Description |
|--------|------|-------------|
| FLOW_START_MILLISECONDS | INT64 | Flow start timestamp |
| FLOW_END_MILLISECONDS | INT64 | Flow end timestamp |
| IPV4_SRC_ADDR | VARCHAR | Source IP address |
| IPV4_DST_ADDR | VARCHAR | Destination IP address |
| L4_SRC_PORT | INT | Source port |
| L4_DST_PORT | INT | Destination port |
| PROTOCOL | INT | IP protocol (6=TCP, 17=UDP, etc.) |
| L7_PROTO | FLOAT | Layer 7 protocol (5=DNS, 7=HTTP, etc.) |
| IN_BYTES | INT | Incoming bytes |
| OUT_BYTES | INT | Outgoing bytes |
| IN_PKTS | INT | Incoming packets |
| OUT_PKTS | INT | Outgoing packets |
| TCP_FLAGS | INT | Cumulative TCP flags |
| FLOW_DURATION_MILLISECONDS | INT | Flow duration |
| Label | VARCHAR | Binary label (Benign/Attack) |
| Attack | VARCHAR | Attack type (Benign, Exploits, Fuzzers, etc.) |
| ... | ... | 38 additional features (see NetFlow_v3_Features.csv) |

### Attack Distribution

| Attack Type | Count | Percentage |
|-------------|-------|------------|
| Benign | 2,237,731 | 94.6% |
| Exploits | 42,748 | 1.8% |
| Fuzzers | 33,816 | 1.4% |
| Generic | 19,651 | 0.8% |
| Reconnaissance | 17,074 | 0.7% |
| DoS | 5,980 | 0.3% |
| Backdoor | 4,659 | 0.2% |
| Shellcode | 2,381 | 0.1% |
| Analysis | 1,226 | 0.05% |
| Worms | 158 | <0.01% |

## Query Flow

```
User: "Show me all DNS exfiltration attempts over 1KB"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Chat Input → Serverless Function                        │
│     POST /api/query                                         │
│     { question: "...", schema: [...columns...] }            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Opus 4.5 generates SQL + explanation                    │
│                                                             │
│  Response:                                                  │
│  {                                                          │
│    sql: "SELECT * FROM flows WHERE L7_PROTO = 5            │
│          AND IN_BYTES > 1024 AND Attack != 'Benign'",      │
│    explanation: "Looking for DNS flows (L7_PROTO=5) with   │
│                  outbound data >1KB that are labeled as     │
│                  attacks - potential exfiltration...",      │
│    suggestedPivots: ["Group by destination IP",            │
│                      "Show timeline of these flows"]        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Browser executes SQL against DuckDB-WASM                │
│     - Query runs locally                                    │
│     - Results never sent to server                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Update UI                                               │
│     - Chat shows explanation + result table                 │
│     - Dashboard filters to matching flows                   │
│     - Suggested pivots shown as clickable buttons           │
└─────────────────────────────────────────────────────────────┘
```

## UI Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  NFChat - Netflow Analysis                       [Load Data] [Export]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Timeline (Attack Activity)                    │   │
│  │  ████ Benign  ░░░ Exploits  ▓▓▓ Recon  ▒▒▒ DoS                 │   │
│  │  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁                          │   │
│  │  |-------- Feb 17 --------|-------- Feb 18 --------|            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Top Talkers  │ │  Protocols   │ │Attack Types  │ │ Network Graph│  │
│  │              │ │              │ │              │ │    ○──○      │  │
│  │ 59.166.0.2 ▓▓│ │   DNS  ▓▓▓  │ │ Benign  ████ │ │   /│\│      │  │
│  │ 149.171.1 ▓  │ │   HTTP ▓▓   │ │ Exploits ▓▓  │ │  ○ ○ ○      │  │
│  │ 59.166.0.4 ▓ │ │   TCP  ▓    │ │ Recon    ▓   │ │              │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Flow Table                                    [Columns▼] 🔍    │   │
│  ├─────────┬─────────┬───────┬───────┬──────┬────────┬────────────┤   │
│  │ Src IP  │ Dst IP  │ SPort │ DPort │ Proto│ Bytes  │ Attack     │   │
│  ├─────────┼─────────┼───────┼───────┼──────┼────────┼────────────┤   │
│  │59.166.0.│149.171. │ 4894  │  53   │ DNS  │  146   │ Benign     │   │
│  │59.166.0.│149.171. │ 52671 │ 31992 │ TCP  │  4704  │ Benign     │   │
│  └─────────┴─────────┴───────┴───────┴──────┴────────┴────────────┘   │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  💬 Chat                                                    [─] [□]   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ You: Show reconnaissance attacks targeting port 22              │   │
│  │                                                                 │   │
│  │ NFChat: Found 847 reconnaissance flows targeting SSH (port 22). │   │
│  │ Top sources: 59.166.0.8 (412 flows), 59.166.0.2 (203 flows)    │   │
│  │                                                                 │   │
│  │ [View in Timeline] [Pivot: Show dest IPs] [Export Results]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐ [⏎]  │
│  │ Ask about these flows...                                     │      │
│  └─────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────┘
```

### Interactions

- **Click chart element** → Filters flow table + adds context to chat
- **Chat query** → Filters all dashboard components
- **Suggested pivots** → Clickable buttons for follow-up queries
- **Chat panel** → Collapsible, resizable

## Tech Stack

| Component | Library | Rationale |
|-----------|---------|-----------|
| UI Framework | React 18 + Vite | Fast HMR, modern tooling |
| Styling | Tailwind + shadcn/ui | Polished components, dark mode |
| Data Grid | TanStack Table | Virtual scrolling for 2M+ rows |
| Charts | Recharts | Timeline, bar charts, pie charts |
| Network Graph | react-force-graph | Interactive node-link visualization |
| Geo Map | react-simple-maps | Lightweight (GeoIP later) |
| Database | DuckDB-WASM | In-browser SQL, Parquet support |
| State | Zustand | Lightweight filter sync |
| Serverless | Vercel Functions | Simple deployment |
| LLM | Anthropic SDK | Opus 4.5 for query generation |

## Project Structure

```
nfchat/
├── public/
│   └── data/
│       └── NF-UNSW-NB15-v3.parquet    # Pre-converted dataset
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx          # Main chat container
│   │   │   ├── MessageList.tsx        # Chat history display
│   │   │   ├── ChatInput.tsx          # User input + submit
│   │   │   └── SuggestedPivots.tsx    # Clickable follow-ups
│   │   ├── dashboard/
│   │   │   ├── Timeline.tsx           # Attack activity over time
│   │   │   ├── TopTalkers.tsx         # IP volume bar chart
│   │   │   ├── ProtocolDist.tsx       # Protocol pie chart
│   │   │   ├── AttackBreakdown.tsx    # Attack type distribution
│   │   │   ├── FlowTable.tsx          # Virtual scrolling table
│   │   │   ├── NetworkGraph.tsx       # Force-directed graph
│   │   │   └── GeoMap.tsx             # Geographic visualization
│   │   ├── layout/
│   │   │   ├── Header.tsx             # App header + actions
│   │   │   └── DashboardGrid.tsx      # Responsive grid layout
│   │   └── ui/                        # shadcn/ui components
│   ├── lib/
│   │   ├── duckdb.ts                  # DuckDB-WASM init + queries
│   │   ├── query.ts                   # Query execution logic
│   │   ├── store.ts                   # Zustand filter state
│   │   └── schema.ts                  # Column definitions
│   ├── hooks/
│   │   ├── useDuckDB.ts               # DuckDB hook
│   │   ├── useFilters.ts              # Filter state hook
│   │   └── useChat.ts                 # Chat state + API hook
│   ├── api/
│   │   └── query/
│   │       └── route.ts               # Vercel serverless function
│   ├── App.tsx                        # Main app component
│   ├── main.tsx                       # Entry point
│   └── index.css                      # Tailwind imports
├── scripts/
│   └── convert-parquet.py             # CSV → Parquet conversion
├── datasets/                          # Source data (gitignored)
├── docs/
│   └── plans/
│       └── 2026-01-09-nfchat-design.md
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

## Implementation Phases

### Phase 1: Core Foundation

- Project setup (Vite + React + Tailwind + shadcn/ui)
- DuckDB-WASM initialization with Parquet loading
- Basic dashboard layout with placeholder panels
- Flow table with TanStack Table virtual scrolling

**Deliverable**: App loads Parquet, displays sortable/filterable flow table

### Phase 2: Visualizations

- Timeline chart (Recharts AreaChart, stacked by attack type)
- Top talkers bar chart (horizontal, by bytes or flow count)
- Protocol distribution pie chart
- Attack breakdown bar chart
- Network graph (react-force-graph, top N connections)
- Geo map placeholder (static map, GeoIP integration later)

**Deliverable**: Full dashboard with interactive visualizations

### Phase 3: Chat Integration

- Chat UI panel (collapsible, resizable via CSS resize)
- Vercel serverless endpoint for Anthropic API
- System prompt with schema + netflow context
- NL → SQL generation with response parsing
- Query execution and inline result display
- Suggested pivots as clickable buttons

**Deliverable**: Working chat that generates and executes queries

### Phase 4: Bidirectional Sync

- Zustand store for global filter state
- Chart click handlers → filter updates
- Filter changes → dashboard component re-renders
- Chat context awareness (current filters in prompt)
- Selection highlighting across components

**Deliverable**: Fully synchronized chat + dashboard experience

### Phase 5: Polish

- Dark mode toggle (Tailwind dark variant)
- Export functionality (filtered CSV, JSON)
- Loading states and error boundaries
- Query history persistence (localStorage)
- Responsive design for smaller screens

**Deliverable**: Production-ready application

## LLM System Prompt

```
You are NFChat, an AI assistant helping IR analysts investigate netflow data.

## Dataset Schema
Table: flows
Columns:
- FLOW_START_MILLISECONDS (INT64): Unix timestamp in ms
- IPV4_SRC_ADDR (VARCHAR): Source IP
- IPV4_DST_ADDR (VARCHAR): Destination IP
- L4_SRC_PORT (INT): Source port
- L4_DST_PORT (INT): Destination port
- PROTOCOL (INT): IP protocol (6=TCP, 17=UDP, 1=ICMP)
- L7_PROTO (FLOAT): Layer 7 protocol (5=DNS, 7=HTTP, 91=SSH, etc.)
- IN_BYTES, OUT_BYTES (INT): Byte counts
- IN_PKTS, OUT_PKTS (INT): Packet counts
- Attack (VARCHAR): Benign, Exploits, Fuzzers, Generic, Reconnaissance, DoS, Backdoor, Shellcode, Analysis, Worms
[... full schema ...]

## Response Format
Return valid JSON:
{
  "sql": "SELECT ... FROM flows WHERE ... LIMIT 1000",
  "explanation": "Brief explanation of what this query finds and why it matters for investigation",
  "suggestedPivots": ["Follow-up query 1", "Follow-up query 2"]
}

## Guidelines
- Always include LIMIT clause (max 10000 rows)
- Use appropriate aggregations for large result sets
- Explain findings in IR analyst terms
- Suggest relevant follow-up investigations
- Flag potentially malicious patterns
```

## Security Considerations

1. **Data Privacy**: Raw netflow data never leaves browser
2. **SQL Injection**: LLM output is parameterized where possible; DuckDB-WASM runs in browser sandbox
3. **API Key**: Anthropic key stored as Vercel environment variable, never exposed to client
4. **Rate Limiting**: Implement rate limiting on serverless endpoint

## Future Enhancements

- GeoIP enrichment for geographic visualization
- Custom dataset upload (drag-and-drop Parquet/CSV)
- Saved investigations / bookmarks
- Collaborative features (share investigation URLs)
- PCAP integration (link flows to packet captures)
- Threat intelligence enrichment (IP reputation)
