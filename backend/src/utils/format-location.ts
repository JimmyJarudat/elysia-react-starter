export const formatLocation = (value: string | null) => {
  if (!value) return null;
  if (value === "private network" || value === "geolocation unavailable") return value;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return value;

    const location = parsed as Record<string, unknown>;
    const city = location.city || location.region || "";
    const country = location.country || location.country_code || "";

    return [city, country].filter(Boolean).join(", ") || value;
  } catch {
    return value;
  }
};
