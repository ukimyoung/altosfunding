"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableColumn {
  key: string;
  label: React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn[];
  rows: T[];
  rowRenderer: (row: T, index: number, isHovered: boolean) => React.ReactNode;
  rowKey?: (row: T, index: number) => React.Key;
  onRowClick?: (row: T, index: number) => void;
  rowStyle?: (row: T, index: number, isHovered: boolean) => React.CSSProperties;
  containerStyle?: React.CSSProperties;
  shellStyle?: React.CSSProperties;
  tableStyle?: React.CSSProperties;
  headerRowStyle?: React.CSSProperties;
  headerCellStyle?: React.CSSProperties;
  footer?: React.ReactNode;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  loadingState?: React.ReactNode;
}

interface TablePaginationItem {
  key: React.Key;
  label: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface TablePaginationProps {
  summary: React.ReactNode;
  items: readonly TablePaginationItem[];
  containerStyle?: React.CSSProperties;
  borderColor?: string;
  textColor?: string;
  activeBackground?: string;
  inactiveBackground?: string;
  inactiveBorderColor?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowRenderer,
  rowKey,
  onRowClick,
  rowStyle,
  containerStyle,
  shellStyle,
  tableStyle,
  headerRowStyle,
  headerCellStyle,
  footer,
  emptyState,
  isLoading = false,
  loadingState,
}: DataTableProps<T>) {
  const [hoveredRow, setHoveredRow] = React.useState<number | null>(null);
  const tableState = isLoading ? (loadingState ?? <TableLoadingState />) : emptyState;

  return (
    <div style={containerStyle}>
      <div style={shellStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={column.width ? { width: column.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr style={headerRowStyle}>
                {columns.map((column) => (
                  <th key={column.key} style={headerCellStyle}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: 24 }}>
                    {tableState ?? null}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const isHovered = hoveredRow === index;

                  return (
                    <tr
                      key={rowKey ? rowKey(row, index) : index}
                      onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                      onMouseEnter={() => setHoveredRow(index)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={rowStyle ? rowStyle(row, index, isHovered) : undefined}
                    >
                      {rowRenderer(row, index, isHovered)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {footer}
      </div>
    </div>
  );
}

function TableLoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "3px solid rgba(124,106,247,0.2)",
          borderTopColor: "#7C6AF7",
          animation: "data-table-spin 0.8s linear infinite",
          display: "inline-block",
        }}
      />
      <style>{`@keyframes data-table-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function TablePagination({
  summary,
  items,
  containerStyle,
  borderColor,
  textColor,
  activeBackground,
  inactiveBackground,
  inactiveBorderColor,
}: TablePaginationProps) {
  const showItems = items.length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderTop: `1px solid ${borderColor ?? "#e2e8f0"}`,
        ...containerStyle,
      }}
    >
      <span style={{ fontSize: 11, color: textColor ?? "#64748b", fontFamily: "'Noto Sans KR',sans-serif" }}>
        {summary}
      </span>
      {showItems ? (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {items.map((item) => {
            const isActive = Boolean(item.active);

            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                disabled={item.disabled}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: isActive ? "none" : `1px solid ${inactiveBorderColor ?? "#cbd5e1"}`,
                  background: isActive ? activeBackground ?? "#4f46e5" : inactiveBackground ?? "#f8fafc",
                  color: isActive ? "#fff" : textColor ?? "#475569",
                  fontSize: 12,
                  fontFamily: "'DM Sans',sans-serif",
                  cursor: item.disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  opacity: item.disabled ? 0.35 : 1,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function buildChevronPaginationItem(
  key: React.Key,
  direction: "left" | "right",
  onClick?: () => void,
  disabled?: boolean,
) {
  return {
    key,
    label: direction === "left" ? <ChevronLeft size={13} /> : <ChevronRight size={13} />,
    onClick,
    disabled,
  } satisfies TablePaginationItem;
}

export function buildPagePaginationItem(
  key: React.Key,
  label: React.ReactNode,
  active?: boolean,
  onClick?: () => void,
  disabled?: boolean,
) {
  return {
    key,
    label,
    active,
    onClick,
    disabled,
  } satisfies TablePaginationItem;
}

interface BuildPaginationItemsParams {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

interface PaginationRangeParams {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  currentPageItemCount: number;
}

interface PaginationSummaryParams {
  totalItems: number;
  start: number;
  end: number;
  unit?: string;
}

export function getPaginationRange({
  totalItems,
  currentPage,
  pageSize,
  currentPageItemCount,
}: PaginationRangeParams) {
  if (totalItems <= 0 || currentPageItemCount <= 0) {
    return { start: 0, end: 0 };
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(start + currentPageItemCount - 1, totalItems);

  return { start, end };
}

export function buildPaginationSummary({
  totalItems,
  start,
  end,
  unit = "개",
}: PaginationSummaryParams) {
  return `총 ${totalItems.toLocaleString()}${unit} 중 ${start} - ${end}${unit} 표시`;
}

export function buildPaginationItems({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
}: BuildPaginationItemsParams) {
  if (totalPages <= 1) {
    return [
      buildPagePaginationItem("page-1", "1", true, () => onPageChange(1), true),
    ];
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  for (let offset = 1; offset <= siblingCount; offset += 1) {
    if (currentPage - offset > 1) {
      pages.add(currentPage - offset);
    }
    if (currentPage + offset < totalPages) {
      pages.add(currentPage + offset);
    }
  }

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: TablePaginationItem[] = [
    buildChevronPaginationItem("prev", "left", () => onPageChange(currentPage - 1), currentPage === 1),
  ];

  sortedPages.forEach((page, index) => {
    const prev = sortedPages[index - 1];

    if (typeof prev === "number" && page - prev > 1) {
      items.push(buildPagePaginationItem(`ellipsis-${prev}-${page}`, "…", false, undefined, true));
    }

    items.push(
      buildPagePaginationItem(
        `page-${page}`,
        String(page),
        page === currentPage,
        () => onPageChange(page),
      ),
    );
  });

  items.push(
    buildChevronPaginationItem("next", "right", () => onPageChange(currentPage + 1), currentPage === totalPages),
  );

  return items;
}
