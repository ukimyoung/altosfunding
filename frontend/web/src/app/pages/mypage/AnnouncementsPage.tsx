import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Bell, Search, X, Pin } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { type Column, DataTable } from '@/app/components/shared/DataTable';
import {
  useAnnouncementCategoriesQuery,
  useAnnouncementsQuery,
} from '@/app/queries/announcements';
import type { AnnouncementCategory, AnnouncementItem } from '@/api/announcements';
import { useLocale } from '@/app/i18n/LocaleContext';

type CategoryConfig = {
  label: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
};

const itemsPerPage = 20;

const categoryStylePalette: Omit<CategoryConfig, 'label'>[] = [
  {
    textColor: 'text-[#0052FF]',
    borderColor: 'border-[#0052FF]/30',
    bgColor: 'bg-[#0052FF]/10',
  },
  {
    textColor: 'text-purple-200',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
  },
  {
    textColor: 'text-[#FFB800]',
    borderColor: 'border-[#FFB800]/30',
    bgColor: 'bg-[#FFB800]/10',
  },
  {
    textColor: 'text-[#00FF94]',
    borderColor: 'border-[#00FF94]/30',
    bgColor: 'bg-[#00FF94]/10',
  },
];

const getCategoryStyle = (categoryId?: number | null, category = '') => {
  if (typeof categoryId === 'number' && Number.isFinite(categoryId)) {
    return categoryStylePalette[Math.abs(categoryId - 1) % categoryStylePalette.length];
  }

  const hash = Array.from(category).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return categoryStylePalette[hash % categoryStylePalette.length];
};

export const getCategoryConfig = (
  category: string,
  categoryId?: number | null,
  categoriesById?: Map<number, AnnouncementCategory>,
): CategoryConfig => {
  const categoryFromApi =
    typeof categoryId === 'number' && Number.isFinite(categoryId)
      ? categoriesById?.get(categoryId)
      : undefined;
  const label = categoryFromApi?.name || category || '-';
  const config = getCategoryStyle(categoryId, category);

  return { ...config, label };
};

export const formatAnnouncementDate = (date: string) => {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
};

export const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getAnnouncementPreview = (content: string) => {
  const plainText = stripHtml(content);

  if (plainText.length <= 100) {
    return plainText;
  }

  return `${plainText.slice(0, 100)}...`;
};

type AnnouncementRow = AnnouncementItem & {
  no: number;
  date: string;
  preview: string;
};

const toAnnouncementRow = (announcement: AnnouncementItem, index: number): AnnouncementRow => ({
  ...announcement,
  no: index + 1,
  date: formatAnnouncementDate(announcement.created_at),
  preview: getAnnouncementPreview(announcement.content),
});

export function AnnouncementsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale, T } = useLocale();
  const text = T.announcements;
  const keywordParam = searchParams.get('keyword') ?? '';
  const pageParam = Number(searchParams.get('page') ?? '1');
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const [searchQuery, setSearchQuery] = useState(keywordParam);
  const {
    data: announcementsResponse,
    isLoading,
    isError,
  } = useAnnouncementsQuery(
    {
      keyword: keywordParam || undefined,
      page: currentPage,
      size: itemsPerPage,
    },
    locale,
  );
  const { data: announcementCategories } = useAnnouncementCategoriesQuery(locale);
  const categoriesById = useMemo(
    () => new Map((announcementCategories ?? []).map((category) => [category.id, category])),
    [announcementCategories],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextKeyword = searchQuery.trim();

      if (nextKeyword === keywordParam) {
        return;
      }

      const next = new URLSearchParams(searchParams);

      if (nextKeyword) {
        next.set('keyword', nextKeyword);
      } else {
        next.delete('keyword');
      }

      next.delete('page');
      setSearchParams(next, { replace: true });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [keywordParam, searchParams, searchQuery, setSearchParams]);

  useEffect(() => {
    setSearchQuery(keywordParam);
  }, [keywordParam]);

  const announcements = announcementsResponse?.items ?? [];
  const totalCount = announcementsResponse?.total ?? 0;
  const totalPages = announcementsResponse?.pages ?? 1;
  const announcementRows = announcements.map((announcement, index) =>
    toAnnouncementRow(announcement, (currentPage - 1) * itemsPerPage + index),
  );

  const handlePageChange = (page: number) => {
    const next = new URLSearchParams(searchParams);

    if (page > 1) {
      next.set('page', String(page));
    } else {
      next.delete('page');
    }

    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnnouncementClick = (announcementId: number) => {
    navigate(`/my-page/announcements/${announcementId}`, {
      state: {
        listSearch: searchParams.toString(),
      },
    });
  };

  const columns: Column<AnnouncementRow>[] = [
    {
      header: text.colNo,
      align: 'center',
      className: 'w-20',
      accessor: (announcement) => (
        <span className="text-gray-400 text-sm font-mono">#{announcement.no}</span>
      ),
    },
    {
      header: text.colCategory,
      align: 'center',
      className: 'w-40',
      accessor: (announcement) => {
        const categoryConfig = getCategoryConfig(
          announcement.category,
          announcement.category_id,
          categoriesById,
        );

        return (
          <div className="flex items-center justify-center gap-2">
            {announcement.is_pinned && <Pin size={14} className="text-[#FFB800]" />}
            <span
              className={`inline-flex min-w-12 shrink-0 items-center justify-center whitespace-nowrap px-3 py-1 ${categoryConfig.bgColor} border ${categoryConfig.borderColor} rounded-full ${categoryConfig.textColor} text-xs font-semibold`}
            >
              {categoryConfig.label}
            </span>
          </div>
        );
      },
    },
    {
      header: text.colTitle,
      className: 'max-w-0',
      accessor: (announcement) => (
        <span className="block whitespace-normal break-words text-white text-sm leading-6 transition-colors hover:text-[#0052FF] hover:underline [overflow-wrap:anywhere]">
          {announcement.title}
        </span>
      ),
    },
    {
      header: text.colDate,
      align: 'center',
      className: 'w-40',
      accessor: (announcement) => (
        <span className="text-gray-400 text-sm">{announcement.date}</span>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
            <Bell size={24} className="text-[#0052FF]" />
          </div>
          <div>
            <h1 className="text-2xl text-white font-medium">{text.sectionTitle}</h1>
            <p className="text-gray-400 text-sm mt-1">{text.sectionSubtitle}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={text.searchPlaceholder}
            className="w-full pl-12 pr-4 py-3 bg-[#0f0f17] border border-[#1a1a24] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams);

                next.delete('keyword');
                next.delete('page');
                setSearchQuery('');
                setSearchParams(next, { replace: true });
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Announcements Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
      >
        {isLoading ? (
          <div className="p-12 text-center">
            <p className="text-gray-400">{text.loading}</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <p className="text-gray-400">{text.loadFailed}</p>
          </div>
        ) : announcementRows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400">{text.noResults}</p>
          </div>
        ) : (
          <DataTable
            data={announcementRows}
            columns={columns}
            keyExtractor={(announcement) => announcement.id}
            currentPage={currentPage}
            totalPages={Math.max(1, totalPages)}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            rowCursor="pointer"
            onRowClick={(announcement) => handleAnnouncementClick(announcement.id)}
            emptyMessage={text.noResults}
            summaryLabel={text.resultPlural}
            endOfResultsLabel={text.sectionTitle}
            showingRangeLabel={text.showingPagination}
            previousLabel={text.prev}
            nextLabel={text.next}
            getRowClassName={(announcement) =>
              announcement.is_pinned
                ? '!bg-gradient-to-r !from-[#FFB800]/5 !to-transparent hover:!from-[#FFB800]/10'
                : ''
            }
            renderMobileCard={(announcement, index) => {
              const categoryConfig = getCategoryConfig(
                announcement.category,
                announcement.category_id,
                categoriesById,
              );

              return (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index % itemsPerPage) * 0.05 }}
                  onClick={() => handleAnnouncementClick(announcement.id)}
                  className={`rounded-lg border border-[#2a2a3a] p-4 cursor-pointer ${
                    announcement.is_pinned
                      ? 'bg-gradient-to-r from-[#FFB800]/5 to-transparent'
                      : 'bg-[#16161f]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-gray-400 text-sm font-mono">#{announcement.no}</span>
                    <span className="text-gray-400 text-xs">{announcement.date}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {announcement.is_pinned && <Pin size={14} className="text-[#FFB800]" />}
                    <span
                      className={`inline-flex min-w-12 shrink-0 items-center justify-center whitespace-nowrap px-3 py-1 ${categoryConfig.bgColor} border ${categoryConfig.borderColor} rounded-full ${categoryConfig.textColor} text-xs font-semibold`}
                    >
                      {categoryConfig.label}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium leading-6 break-words [overflow-wrap:anywhere]">
                    {announcement.title}
                  </p>
                </motion.div>
              );
            }}
          />
        )}
      </motion.div>

      {/* Results Count */}
      {searchQuery && (
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            {text.foundPrefix} {totalCount}{' '}
            {totalCount === 1 ? text.resultSingular : text.resultPlural}
          </p>
        </div>
      )}
    </div>
  );
}
