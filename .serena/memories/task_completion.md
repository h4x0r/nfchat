# Task Completion Checklist

Before marking any task complete:

1. **Tests Pass**
   ```bash
   npm run test:run
   ```

2. **Lint Clean**
   ```bash
   npm run lint
   ```

3. **Build Succeeds**
   ```bash
   npm run build
   ```

4. **TDD Followed**
   - Test written before implementation
   - Test failed first (RED)
   - Minimal code to pass (GREEN)
   - Refactored if needed

5. **E2E Tests (if UI changed)**
   ```bash
   npm run test:e2e
   ```
