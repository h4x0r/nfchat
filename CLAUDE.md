# Project Instructions for Claude

## Test-Driven Development (TDD) - MANDATORY

**ALWAYS use TDD for all implementation work. No exceptions.**

### TDD Workflow

1. **RED** - Write a failing test first
   - Test must fail before writing implementation
   - Test describes the expected behavior

2. **GREEN** - Write minimal code to pass the test
   - Only write enough code to make the test pass
   - No extra features or "while I'm here" changes

3. **REFACTOR** - Clean up while tests pass
   - Improve code quality
   - All tests must remain green

### Rules

- Never write implementation code without a failing test first
- Run tests after each change to verify RED → GREEN → REFACTOR cycle
- If adding a feature, write the test first
- If fixing a bug, write a test that reproduces it first
- Commit tests separately or with their implementation

### Test Commands

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Git Workflow

After every commit, always push to trigger Vercel deployment, then check deployment status:

```bash
git push && vercel --prod
```

Or check status manually: `vercel ls` or visit the Vercel dashboard for build errors.
