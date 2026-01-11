declare const __COMMIT_HASH__: string
declare const __BUILD_TIME__: string

/**
 * Displays the build version: commit hash @ timestamp
 * Format: e363920 @ 2026-01-11 11:16Z
 */
export function Version() {
  const hash = __COMMIT_HASH__
  const buildTime = new Date(__BUILD_TIME__)

  // Format: YYYY-MM-DD HH:MMZ
  const formatted = buildTime.toISOString().replace('T', ' ').slice(0, 16) + 'Z'

  return (
    <span data-testid="version" className="text-xs text-muted-foreground font-mono">
      {hash} @ {formatted}
    </span>
  )
}
