# Test Structure

Tests are organized by product area first, then by test type. This keeps new tests close to the feature they protect and lets CI run fast suites without loading database-heavy tests.

## Layout

```text
test/
  backend/
    auth/
      unit/
    logs/
      unit/
    shared/
      unit/
  frontend/
    shared/
      unit/
    system-setting/
      unit/
  integration/
    backend/
  helpers/
  fixtures/
  uat/
```

`test/integration` is still in the legacy location while it is migrated gradually. New integration tests should use the domain-first structure:

```text
test/backend/<domain>/integration/<name>.integration.test.ts
test/backend/<domain>/integration/<name>.http.integration.test.ts
test/frontend/<domain>/integration/<name>.integration.test.ts
```

## Naming

- Unit tests: `<subject>.unit.test.ts`
- Integration tests: `<subject>.integration.test.ts`
- HTTP integration tests: `<subject>.http.integration.test.ts`
- UAT tests: `<flow>.uat.test.ts`

## Commands

```bash
bun run test
bun run test:unit
bun run test:unit:backend
bun run test:unit:frontend
bun run test:integration
```

`bun run test` intentionally runs unit tests only. Integration tests use real database state and should be run explicitly in local development or in a dedicated CI job.

## Test Type Rules

- Unit tests must avoid real DB, network, Redis, SMTP, and filesystem side effects unless the test subject is a filesystem utility.
- Integration tests may use the real Prisma database through `test/helpers/db.ts`.
- HTTP integration tests should use `test/helpers/app.ts` so they do not open a port.
- Shared `system_config` values must be saved and restored with `test/helpers/settings.ts`.
- Any production code change should add or update a focused test in the same domain.
