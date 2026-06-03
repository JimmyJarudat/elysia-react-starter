// Pagination.tsx
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  /** Current page number (1-based) */
  currentPage: number;

  /** Total number of pages */
  totalPages: number;

  /** Number of items per page */
  pageSize: number;

  /** Total number of items */
  totalItems: number;

  /** Callback when page changes (receives new page number) */
  onPageChange: (page: number) => void;

  /** Callback when page size changes (receives new page size) */
  onPageSizeChange: (pageSize: number) => void;

  /** Available page size options */
  pageSizeOptions?: number[];

  /** Additional CSS class for the component */
  className?: string;
}

/**
 * Pagination component for navigating through multi-page data
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 200, 500],
  className = '',
}) => {
  // Handle page size change
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    onPageSizeChange(newSize);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    // Ensure the page is within valid range
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  // Calculate the range of items being displayed
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate array of page numbers to display
  const getPageNumbers = (): number[] => {
    // Logic to show intelligent pagination
    const pages: number[] = [];

    // Calculate the range of page numbers to display (max 15)
    let startPage: number, endPage: number;

    if (totalPages <= 15) {
      // If 15 or fewer pages, show all
      startPage = 1;
      endPage = totalPages;
    } else {
      // If more than 15 pages, calculate intelligently
      if (currentPage <= 8) {
        // Near the start - show first 15 pages
        startPage = 1;
        endPage = 15;
      } else if (currentPage >= totalPages - 7) {
        // Near the end - show last 15 pages
        startPage = totalPages - 14;
        endPage = totalPages;
      } else {
        // In the middle - center around current page
        startPage = currentPage - 7;
        endPage = currentPage + 7;
      }
    }

    // Generate the array of page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Left: Items per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-secondary">แสดง</span>
        <select
          className="px-3 py-1.5 border border-light-border dark:border-dark-border rounded-md text-sm
          bg-light-background-card dark:bg-dark-background-card text-primary
          focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary focus:border-light-primary dark:focus:border-dark-primary
          shadow-sm transition-colors duration-200 min-w-[80px]"
          value={pageSize}
          onChange={handlePageSizeChange}
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="text-sm text-secondary">รายการต่อหน้า</span>
      </div>

      {/* Center: Items range display with page count */}
      <div className="text-sm text-secondary text-center">
        {totalItems > 0 ? (
          <div className="space-y-1">
            <div>
              แสดง <span className="font-medium text-primary">{startItem}</span> ถึง <span className="font-medium text-primary">{endItem}</span> จากทั้งหมด <span className="font-medium text-primary">{totalItems}</span> รายการ
            </div>
            <div className="text-xs text-subtle">
              หน้าที่ <span className="font-medium text-primary">{currentPage}</span> จาก <span className="font-medium text-primary">{totalPages}</span> หน้า
            </div>
          </div>
        ) : (
          <div>ไม่พบรายการ</div>
        )}
      </div>

      {/* Right: Pagination controls */}
      <div className="flex items-center gap-1">
        {/* First page button */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1 || totalPages === 0}
          className="p-2 rounded-md bg-light-background-card dark:bg-dark-background-card border border-light-border dark:border-dark-border 
          hover:bg-ocean-50 dark:hover:bg-slate-blue-800/50 
          disabled:opacity-50 disabled:cursor-not-allowed
          text-secondary hover:text-light-primary dark:hover:text-dark-primary
          transition-colors duration-200 shadow-sm"
          title="หน้าแรก"
          aria-label="ไปที่หน้าแรก"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Previous page button */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || totalPages === 0}
          className="p-2 rounded-md bg-light-background-card dark:bg-dark-background-card border border-light-border dark:border-dark-border 
          hover:bg-ocean-50 dark:hover:bg-slate-blue-800/50 
          disabled:opacity-50 disabled:cursor-not-allowed
          text-secondary hover:text-light-primary dark:hover:text-dark-primary
          transition-colors duration-200 shadow-sm"
          title="หน้าก่อนหน้า"
          aria-label="ไปที่หน้าก่อนหน้า"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page number buttons */}
        {/* Page number buttons */}
        {pageNumbers.map(pageNum => (
          <button
            key={pageNum}
            onClick={() => handlePageChange(pageNum)}
            className={`${pageNum > 999 ? 'w-12 h-9' : 'w-9 h-9'  // ขยายความกว้างถ้าเกิน 3 หลัก
              } flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 ${currentPage === pageNum
                ? 'bg-light-primary dark:bg-dark-primary text-white shadow-md'
                : 'bg-light-background-card dark:bg-dark-background-card text-primary border border-light-border dark:border-dark-border hover:bg-ocean-50 dark:hover:bg-slate-blue-800/50 hover:text-light-primary dark:hover:text-dark-primary'
              }`}
            aria-label={`ไปที่หน้า ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
          >
            {pageNum}
          </button>
        ))}

        {/* Next page button */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-2 rounded-md bg-light-background-card dark:bg-dark-background-card border border-light-border dark:border-dark-border 
          hover:bg-ocean-50 dark:hover:bg-slate-blue-800/50 
          disabled:opacity-50 disabled:cursor-not-allowed
          text-secondary hover:text-light-primary dark:hover:text-dark-primary
          transition-colors duration-200 shadow-sm"
          title="หน้าถัดไป"
          aria-label="ไปที่หน้าถัดไป"
        >
          <ChevronRight size={16} />
        </button>

        {/* Last page button */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-2 rounded-md bg-light-background-card dark:bg-dark-background-card border border-light-border dark:border-dark-border 
          hover:bg-ocean-50 dark:hover:bg-slate-blue-800/50 
          disabled:opacity-50 disabled:cursor-not-allowed
          text-secondary hover:text-light-primary dark:hover:text-dark-primary
          transition-colors duration-200 shadow-sm"
          title="หน้าสุดท้าย"
          aria-label="ไปที่หน้าสุดท้าย"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;