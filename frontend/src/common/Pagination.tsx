import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const Pagination = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) => {
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) onPageChange(page);
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = (): number[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) return [1, 2, 3, 4, 5, -1, totalPages];
    if (currentPage >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, currentPage - 1, currentPage, currentPage + 1, -2, totalPages];
  };

  const navBtn =
    "grid h-9 w-9 place-items-center rounded-md border border-theme bg-light-background-card text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:cursor-not-allowed disabled:opacity-40 dark:bg-dark-background-card dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${className}`}>
      {/* Items per page */}
      <div className="flex items-center gap-2 text-sm text-light-text-muted dark:text-dark-text-muted">
        <span>แสดง</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border border-theme bg-light-background-card px-2 py-1.5 text-sm text-light-text focus:outline-none focus:ring-2 focus:ring-light-primary dark:bg-dark-background-card dark:text-dark-text dark:focus:ring-dark-primary"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>รายการ/หน้า</span>
      </div>

      {/* Info */}
      <div className="text-center text-sm text-light-text-muted dark:text-dark-text-muted">
        {totalItems > 0 ? (
          <>
            <span className="font-semibold text-light-text dark:text-dark-text">{startItem.toLocaleString()}</span>
            {" – "}
            <span className="font-semibold text-light-text dark:text-dark-text">{endItem.toLocaleString()}</span>
            {" จาก "}
            <span className="font-semibold text-light-text dark:text-dark-text">{totalItems.toLocaleString()}</span>
            {" รายการ · หน้า "}
            <span className="font-semibold text-light-text dark:text-dark-text">{currentPage}</span>
            {"/"}
            <span className="font-semibold text-light-text dark:text-dark-text">{totalPages}</span>
          </>
        ) : (
          "ไม่พบรายการ"
        )}
      </div>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        <button type="button" className={navBtn} onClick={() => handlePageChange(1)} disabled={currentPage === 1} title="หน้าแรก">
          <ChevronsLeft size={15} />
        </button>
        <button type="button" className={navBtn} onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} title="ก่อนหน้า">
          <ChevronLeft size={15} />
        </button>

        {getPageNumbers().map((num, i) =>
          num < 0 ? (
            <span key={num + '_' + i} className="grid h-9 w-9 place-items-center text-sm text-light-text-muted dark:text-dark-text-muted">
              …
            </span>
          ) : (
            <button
              key={num}
              type="button"
              onClick={() => handlePageChange(num)}
              className={`grid h-9 min-w-9 place-items-center rounded-md px-1.5 text-sm font-medium transition-colors ${
                currentPage === num
                  ? "bg-light-primary text-white shadow-sm dark:bg-dark-primary dark:text-dark-background"
                  : "border border-theme bg-light-background-card text-light-text hover:bg-light-primary/10 hover:text-light-primary dark:bg-dark-background-card dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              }`}
              aria-current={currentPage === num ? "page" : undefined}
            >
              {num}
            </button>
          )
        )}

        <button type="button" className={navBtn} onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} title="ถัดไป">
          <ChevronRight size={15} />
        </button>
        <button type="button" className={navBtn} onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages || totalPages === 0} title="หน้าสุดท้าย">
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
