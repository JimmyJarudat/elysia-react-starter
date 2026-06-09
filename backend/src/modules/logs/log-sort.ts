export type LogSortOrder = "asc" | "desc";

export const normalizeLogSortOrder = (value?: string): LogSortOrder => (
  value === "asc" ? "asc" : "desc"
);

export const buildLogOrderBy = <TField extends string>(
  sortBy: string | undefined,
  sortOrder: string | undefined,
  fields: Record<TField, string>,
  defaultField: TField,
) => {
  const order = normalizeLogSortOrder(sortOrder);
  const field = sortBy && sortBy in fields ? fields[sortBy as TField] : fields[defaultField];

  return [
    { [field]: order },
    { id: "desc" as const },
  ];
};
