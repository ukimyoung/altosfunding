import { ReactNode, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';

export interface Column<T> {
  header: ReactNode;
  accessor: keyof T | ((item: T, index: number) => ReactNode);
  align?: 'left' | 'center' | 'right';
  className?: string;
}

type DataTableVariant = 'default' | 'legacy';

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  renderMobileCard: (item: T, index: number) => ReactNode;
  desktopWrapperClassName?: string;
  desktopScrollWrapperClassName?: string;
  desktopHeaderRowClassName?: string;
  desktopHeaderCellClassName?: string;
  desktopCellClassName?: string;
  desktopEmptyCellClassName?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
  keyExtractor: (item: T) => string | number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  summaryLabel?: string;
  endOfResultsLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  showingRangeLabel?: string;
  rowCursor?: 'default' | 'pointer';
  variant?: DataTableVariant;
  getRowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  renderMobileCard,
  desktopWrapperClassName,
  desktopScrollWrapperClassName,
  desktopHeaderRowClassName,
  desktopHeaderCellClassName,
  desktopCellClassName,
  desktopEmptyCellClassName,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  keyExtractor,
  onLoadMore,
  hasMore,
  isLoading,
  emptyMessage = 'No results found.',
  summaryLabel = 'results',
  endOfResultsLabel = 'End of Results',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  showingRangeLabel,
  rowCursor = 'default',
  variant = 'default',
  getRowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const { ref, inView } = useInView({ threshold: 0.1 });

  const getAlignClassName = (align?: Column<T>['align']) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  const isLegacy = variant === 'legacy';
  const pageData = data;

  const defaultDesktopHeaderRowClassName = isLegacy
    ? 'border-b border-[#1a1a24]'
    : 'border-b border-[#2a2a3a] bg-[#16161f]';
  const defaultDesktopHeaderCellClassName = isLegacy
    ? 'px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400'
    : 'px-6 py-4 text-xs font-medium uppercase tracking-wider text-gray-400';
  const desktopBodyClassName = isLegacy ? '' : 'divide-y divide-white/10';
  const desktopRowClassName = isLegacy
    ? `border-b border-[#1a1a24] bg-transparent hover:bg-[#1a1a24]/50 transition-colors ${rowCursor === 'pointer' ? 'cursor-pointer' : 'cursor-default'}`
    : `hover:bg-[#1a1a24]/80 transition-colors ${rowCursor === 'pointer' ? 'cursor-pointer' : 'cursor-default'} ${''}`;
  const defaultDesktopCellClassName = isLegacy ? 'px-4 py-4' : 'px-6 py-5';
  const defaultDesktopEmptyCellClassName = isLegacy
    ? 'px-4 py-12 text-center text-gray-500 text-sm'
    : 'px-6 py-12 text-center text-gray-500 text-sm';
  const desktopPaginationClassName = isLegacy
    ? 'p-6 border-t border-[#1a1a24]'
    : 'p-6 border-t border-[#2a2a3a]';
  const mobileListClassName = isLegacy ? 'lg:hidden p-4 space-y-4' : 'lg:hidden p-4 space-y-4';

  useEffect(() => {
    if (inView && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [inView, hasMore, isLoading, onLoadMore]);

  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, totalItems);
  const showingText =
    showingRangeLabel
      ?.replace('{from}', String(startIdx))
      .replace('{to}', String(endIdx))
      .replace('{total}', String(totalItems)) ?? null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="w-full">
      {/* Desktop View */}
      <div className="hidden lg:block">
        <div className={desktopWrapperClassName || ''}>
          <div className={desktopScrollWrapperClassName || 'overflow-x-auto'}>
            <table className="w-full">
              <thead>
                <tr className={desktopHeaderRowClassName || defaultDesktopHeaderRowClassName}>
                  {columns.map((col, idx) => (
                    <th
                      key={`h-${idx}`}
                      className={`${
                        desktopHeaderCellClassName || defaultDesktopHeaderCellClassName
                      } ${getAlignClassName(col.align)}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={desktopBodyClassName}>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className={desktopEmptyCellClassName || defaultDesktopEmptyCellClassName}
                    >
                      <div className="flex min-h-28 items-center justify-center">
                        <Loader2 className="animate-spin text-[#0052FF]" size={32} />
                      </div>
                    </td>
                  </tr>
                ) : pageData.length > 0 ? (
                  pageData.map((item, index) => (
                    <motion.tr
                      key={keyExtractor(item)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: (index % itemsPerPage) * 0.05 }}
                      onClick={() => onRowClick?.(item)}
                      className={`${desktopRowClassName} ${
                        !isLegacy ? (index % 2 === 0 ? 'bg-[#0f0f17]' : 'bg-[#1a1a24]/30') : ''
                      } ${getRowClassName?.(item, index) ?? ''}`}
                    >
                      {columns.map((col, cIdx) => (
                        <td
                          key={`c-${cIdx}`}
                          className={`${
                            desktopCellClassName || defaultDesktopCellClassName
                          } ${getAlignClassName(col.align)} ${col.className || ''}`}
                        >
                          {typeof col.accessor === 'function'
                            ? col.accessor(item, index)
                            : (item[col.accessor] as ReactNode)}
                        </td>
                      ))}
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className={desktopEmptyCellClassName || defaultDesktopEmptyCellClassName}
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desktop Pagination */}
        <div className={desktopPaginationClassName}>
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              {showingText ?? (
                <>
                  Showing <span className="text-white">{startIdx}</span>-
                  <span className="text-white">{endIdx}</span> of{' '}
                  <span className="text-white">{totalItems}</span> {summaryLabel}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#24243a] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} /> {previousLabel}
              </button>
              <div className="flex items-center gap-2">
                {getPageNumbers().map((page, i) => (
                  <button
                    key={i}
                    onClick={() => typeof page === 'number' && onPageChange(page)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${currentPage === page ? 'bg-[#0052FF] text-white shadow-lg shadow-[#0052FF]/30' : 'bg-[#1a1a24] text-gray-400 hover:text-white'}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#24243a] disabled:opacity-30 transition-colors"
              >
                {nextLabel} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View */}
      <div className={mobileListClassName}>
        {pageData.map((item, index) => renderMobileCard(item, index))}
        <div ref={ref} className="py-6 flex justify-center items-center">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="animate-spin text-[#0052FF]" size={18} />
            </div>
          ) : hasMore ? (
            <div className="h-4" />
          ) : data.length > 0 ? (
            <div className="flex items-center gap-4 w-full px-8">
              <div className="h-[1px] flex-1 bg-white/5" />
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                {endOfResultsLabel}
              </p>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
