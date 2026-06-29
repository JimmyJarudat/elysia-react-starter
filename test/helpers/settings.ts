import prisma from "./db";

const NOT_FOUND = Symbol("system_config row did not exist before the override");
const pendingRestores = new Map<string, string | typeof NOT_FOUND>();

async function restoreOne(id: string, original: string | typeof NOT_FOUND) {
  if (original === NOT_FOUND) {
    await prisma.system_config.delete({ where: { id } }).catch(() => {});
  } else {
    await prisma.system_config.update({ where: { id }, data: { value: original } }).catch(() => {});
  }
}

/**
 * Temporarily overrides a system_config value for the duration of `run()`, then restores the
 * original value (or removes the row if it didn't exist before). Used for settings the app
 * reads live and that this test suite must never leave mutated — e.g. self_registration_enabled,
 * force_single_session. See planning/Task-unit.md for why this save/restore pattern is required
 * instead of just skipping these tests.
 *
 * Also registers the pending restore in a module-level map so `restorePendingSettingOverrides()`
 * can clean it up as a safety net (call it from that test file's `afterAll`) in case this
 * function's own `finally` never gets to run — e.g. a per-test timeout aborting the test before
 * the restore completes. A leaked override here is a real live system_config row, not a disposable
 * test fixture, so this file deliberately has a second line of defense.
 */
export async function withSettingOverride(id: string, tempValue: string, run: () => Promise<void>) {
  const existing = await prisma.system_config.findUnique({ where: { id } });
  const original = existing ? existing.value : NOT_FOUND;
  pendingRestores.set(id, original);

  await prisma.system_config.upsert({
    where: { id },
    update: { value: tempValue },
    create: {
      id,
      value: tempValue,
      display_name: id,
      description: "Temporary override for an integration test",
      category: "TEST",
    },
  });

  try {
    await run();
  } finally {
    await restoreOne(id, original);
    pendingRestores.delete(id);
  }
}

/** Safety-net cleanup — call from `afterAll` in any file that uses withSettingOverride. */
export async function restorePendingSettingOverrides() {
  const entries = Array.from(pendingRestores.entries());
  pendingRestores.clear();
  await Promise.all(entries.map(([id, original]) => restoreOne(id, original)));
}
