import prisma from "./db";

/**
 * Temporarily overrides a system_config value for the duration of `run()`, then restores the
 * original value (or removes the row if it didn't exist before). Used for settings the app
 * reads live and that this test suite must never leave mutated — e.g. self_registration_enabled,
 * force_single_session. See planning/Task-unit.md for why this save/restore pattern is required
 * instead of just skipping these tests.
 */
export async function withSettingOverride(id: string, tempValue: string, run: () => Promise<void>) {
  const original = await prisma.system_config.findUnique({ where: { id } });

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
    if (original) {
      await prisma.system_config.update({ where: { id }, data: { value: original.value } });
    } else {
      await prisma.system_config.delete({ where: { id } }).catch(() => {});
    }
  }
}
