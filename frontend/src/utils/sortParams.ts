export type SortOrder = "asc" | "desc";

export const getSortOrderFromParams = (params: URLSearchParams): SortOrder => (
  params.get("sortOrder") === "asc" ? "asc" : "desc"
);

export const getSortByFromParams = <TField extends string>(
  params: URLSearchParams,
  fields: readonly TField[],
  fallback: TField,
) => {
  const value = params.get("sortBy");
  return fields.includes(value as TField) ? value as TField : fallback;
};

export const nextSortParams = <TField extends string>(
  params: URLSearchParams,
  field: TField,
  currentSortBy: TField,
  currentSortOrder: SortOrder,
  defaultSortBy: TField,
  defaultSortOrder: SortOrder = "desc",
) => {
  const next = new URLSearchParams(params);
  const nextOrder: SortOrder = currentSortBy === field && currentSortOrder === "asc" ? "desc" : "asc";

  if (field === defaultSortBy) next.delete("sortBy");
  else next.set("sortBy", field);

  if (nextOrder === defaultSortOrder) next.delete("sortOrder");
  else next.set("sortOrder", nextOrder);

  next.delete("page");
  return next;
};
