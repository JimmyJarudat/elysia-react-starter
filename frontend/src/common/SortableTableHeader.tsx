import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SortOrder = "asc" | "desc";

interface SortableTableHeaderProps<TField extends string> {
  field: TField;
  sortBy: TField;
  sortOrder: SortOrder;
  onSort: (field: TField) => void;
  children: ReactNode;
  className?: string;
}

const SortableTableHeader = <TField extends string>({
  field,
  sortBy,
  sortOrder,
  onSort,
  children,
  className = "",
}: SortableTableHeaderProps<TField>) => {
  const active = sortBy === field;
  const Icon = active ? (sortOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      className={`px-4 py-3 font-semibold transition-colors hover:bg-light-primary/10 dark:hover:bg-dark-primary/10 ${className}`}
      aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        className="inline-flex items-center gap-2 uppercase"
        type="button"
        onClick={() => onSort(field)}
      >
        {children}
        <Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-45"}`} />
      </button>
    </th>
  );
};

export default SortableTableHeader;
