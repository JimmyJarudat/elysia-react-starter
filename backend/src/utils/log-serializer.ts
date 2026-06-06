export function serializeLogValue(value: unknown, maxLength?: number): string | null {
  if (value == null) return null;

  try {
    const seen = new WeakSet<object>();
    const serialized = JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      if (item instanceof Error) {
        return { name: item.name, message: item.message, stack: item.stack };
      }
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    });

    if (serialized == null) return String(value);
    return maxLength && serialized.length > maxLength
      ? `${serialized.slice(0, maxLength - 15)}...[truncated]`
      : serialized;
  } catch {
    return "[Unserializable log value]";
  }
}
