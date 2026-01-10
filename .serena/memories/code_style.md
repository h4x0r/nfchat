# Code Style & Conventions

## TDD Mandatory
All implementation MUST follow TDD: RED → GREEN → REFACTOR
- Write failing test first
- Minimal implementation to pass
- Refactor while green

## TypeScript
- Strict mode enabled
- Prefer explicit types over `any`
- Use interfaces for object shapes

## React
- Functional components only
- Custom hooks in `src/hooks/`
- Components in `src/components/`

## File Organization
```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── lib/            # Utilities (duckdb.ts, progress.ts)
├── App.tsx         # Main app component
└── main.tsx        # Entry point
```

## Naming
- Components: PascalCase
- Hooks: camelCase with `use` prefix
- Files: kebab-case or match export name
