# Legacy Integration Test Folder

Integration tests have moved to the domain-first structure:

```text
test/backend/<domain>/integration/
test/frontend/<domain>/integration/
```

Do not add new tests directly under `test/integration`. Keep this folder only as a migration marker for historical context.
