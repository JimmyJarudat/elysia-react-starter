# Legacy Unit Test Folder

Unit tests have moved to the domain-first structure:

```text
test/backend/<domain>/unit/
test/frontend/<domain>/unit/
```

Do not add new tests directly under `test/unit`. Keep this folder only as a migration marker until the remaining legacy integration layout is cleaned up.
