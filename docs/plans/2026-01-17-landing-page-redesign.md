# Landing Page Redesign: CRT Terminal Aesthetic

## Summary

Redesign nfchat landing page with Security Ronin branding, user-first file upload flow, and green CRT terminal aesthetic. Single-page design that transforms from dropzone to loading state.

## Target Audience

Security analysts who want to analyze their own NetFlow data quickly. Technical users comfortable with terminal interfaces. Goal: file dropped to dashboard in <5 seconds of interaction.

## Design Decisions

### User Flow
1. User lands on page → sees dropzone immediately
2. Drops CSV/Parquet file → dropzone morphs into loading log
3. Loading completes → auto-transition to dashboard
4. Demo data is secondary escape hatch, not primary CTA

### Visual Aesthetic: Green CRT Terminal
- Background: `#0a0a0a` (near black)
- Primary text: `#00ff00` (phosphor green)
- Dimmed text: `#00aa00` (darker green)
- Error text: `#ff3333` (red)
- Text glow: `text-shadow: 0 0 5px #00ff00`
- Font: Monospace (JetBrains Mono or Fira Code)
- Optional: Faint scanline overlay

### File Support
- CSV: Auto-detect columns via DuckDB `read_csv_auto()`
- Parquet: Current implementation, no changes
- Column mapping: Auto-detect common NetFlow column names, fallback to manual mapper if ambiguous

### Column Auto-Detection Map
```
IPV4_SRC_ADDR: ['sa', 'sIP', 'src_ip', 'source_ip', 'srcaddr']
IPV4_DST_ADDR: ['da', 'dIP', 'dst_ip', 'dest_ip', 'dstaddr']
L4_SRC_PORT:   ['sp', 'srcport', 'src_port', 'source_port']
L4_DST_PORT:   ['dp', 'dstport', 'dst_port', 'dest_port']
PROTOCOL:      ['pr', 'proto', 'protocol']
IN_BYTES:      ['ibyt', 'in_bytes', 'bytes_in', 'inbytes']
OUT_BYTES:     ['obyt', 'out_bytes', 'bytes_out', 'outbytes']
```

## Page States

### State 1: Ready (Dropzone)
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│     [SECURITY RONIN LOGO]                                    │
│     (clickable → securityronin.com)                          │
│                                                              │
│     > Interrogate your NetFlow data_                         │
│                                                              │
│     ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                       │
│       DROP FILE HERE                                         │
│       csv, parquet                                           │
│     └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                       │
│                                                              │
│     > or try demo dataset (2.4M flows)_                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### State 2: Loading
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│     [SECURITY RONIN LOGO]                                    │
│                                                              │
│     > Loading flows.csv_                                     │
│                                                              │
│     [████████████████░░░░░░░░] 65%                           │
│                                                              │
│     [OK] Connected to MotherDuck                             │
│     [OK] Parsed 1,532,000 rows                               │
│     [..] Building dashboard_                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### State 3: Error
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│     [SECURITY RONIN LOGO]                                    │
│                                                              │
│     > ERROR_                                                 │
│                                                              │
│     [FAIL] Could not parse flows.csv                         │
│            Missing required column: IPV4_SRC_ADDR            │
│                                                              │
│     > Expected: IPV4_SRC_ADDR, IPV4_DST_ADDR, ...            │
│     > Found: src, dst, bytes, packets                        │
│                                                              │
│     [RETRY]  [MAP COLUMNS]                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### State 4: Complete
Auto-transition to ForensicDashboard (no user action needed).

## Components to Create/Modify

| Component | Action | Notes |
|-----------|--------|-------|
| `App.tsx` | Modify | Replace card-based landing with CRT layout |
| `LandingPage.tsx` | Create | New component with dropzone + states |
| `CRTDropzone.tsx` | Create | Styled dropzone with drag states |
| `CRTLoadingLog.tsx` | Create | Terminal-style loading output |
| `crt.css` | Create | CRT glow effects, scanlines, animations |
| `useFileUpload.ts` | Create | Hook for drag/drop + file parsing |
| `columnMapper.ts` | Create | Auto-detect CSV column mappings |

## CSS Utilities Needed

```css
.crt-glow {
  text-shadow: 0 0 5px #00ff00;
}

.crt-scanlines {
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
}

.crt-flicker {
  animation: flicker 0.15s infinite;
}
```

## Out of Scope

- Full column mapping UI (fallback only, can enhance later)
- Multiple file upload
- Drag-and-drop reordering
- File history/recent files

## Success Criteria

- [ ] Security Ronin logo prominent and clickable
- [ ] Dropzone accepts CSV and Parquet
- [ ] CSV columns auto-detected for common formats
- [ ] Loading state shows progress with terminal aesthetic
- [ ] <5 seconds from file drop to dashboard (for small files)
- [ ] Green CRT glow effect visible
- [ ] Responsive on mobile
