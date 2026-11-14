import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Tag, Pin, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useMemo } from 'react';
import { useAnnouncementCategoriesQuery, useAnnouncementQuery } from '@/app/queries/announcements';
import { formatAnnouncementDate, getCategoryConfig } from './AnnouncementsPage';
import { useLocale } from '@/app/i18n/LocaleContext';

export function AnnouncementDetailPage() {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const { locale, T } = useLocale();
  const text = T.announcements;
  const listSearch = (state as { listSearch?: string } | null)?.listSearch;
  const listPath = listSearch ? `/my-page/announcements?${listSearch}` : '/my-page/announcements';

  // Extract the numeric ID from the tail of the URL path.
  const idFromPath = pathname.split('/').filter(Boolean).pop();
  const id = Number(idFromPath);
  const { data: announcement, isLoading, isError } = useAnnouncementQuery(id, locale);
  const { data: announcementCategories } = useAnnouncementCategoriesQuery(locale);
  const categoriesById = useMemo(
    () => new Map((announcementCategories ?? []).map((category) => [category.id, category])),
    [announcementCategories],
  );

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-12 text-center">
          <p className="text-gray-400">{text.loading}</p>
        </div>
      </div>
    );
  }

  if (isError || !announcement) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-12 text-center">
          <h2 className="text-white text-xl font-medium mb-2">{text.notFound}</h2>
          <p className="text-gray-400 mb-6">{text.notFoundDesc}</p>
          <button
            onClick={() => navigate('/my-page/announcements')}
            className="px-6 py-3 bg-[#0052FF] text-white rounded-lg hover:bg-[#0052FF]/90 transition-colors font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            {text.backToAnnouncements}
          </button>
        </div>
      </div>
    );
  }

  const categoryConfig = getCategoryConfig(
    announcement.category,
    announcement.category_id,
    categoriesById,
  );
  const authorName = announcement.author_name || announcement.created_by || '-';
  const previousAnnouncement =
    announcement.previous_id && announcement.previous_title
      ? {
          id: announcement.previous_id,
          title: announcement.previous_title,
        }
      : null;
  const nextAnnouncement =
    announcement.next_id && announcement.next_title
      ? {
          id: announcement.next_id,
          title: announcement.next_title,
        }
      : null;

  const navigateToAnnouncement = (announcementId: number) => {
    navigate(`/my-page/announcements/${announcementId}`, {
      state: {
        listSearch,
      },
    });
  };

  const navigateBackToList = () => {
    navigate(listPath);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <button
          onClick={navigateBackToList}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium"
        >
          <ArrowLeft size={18} />
          {text.backToAnnouncements}
        </button>
      </motion.div>

      {/* Announcement Detail Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`bg-[#0f0f17] border rounded-xl overflow-hidden ${
          announcement.is_pinned
            ? 'border-[#FFB800]/30 bg-gradient-to-r from-[#FFB800]/5 to-transparent'
            : 'border-[#1a1a24]'
        }`}
      >
        {/* Header */}
        <div className="p-8 border-b border-[#1a1a24]">
          <div className="flex items-start gap-4 mb-4">
            {announcement.is_pinned && (
              <div className="flex-shrink-0 mt-1">
                <Pin size={20} className="text-[#FFB800]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl text-white mb-5 leading-tight [overflow-wrap:anywhere]">
                {announcement.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex max-w-full items-center gap-1.5 px-3 py-1.5 ${categoryConfig.bgColor} border ${categoryConfig.borderColor} rounded-full`}
                >
                  <Tag size={13} className={`${categoryConfig.textColor} shrink-0`} />
                  <span
                    className={`break-words text-xs font-semibold ${categoryConfig.textColor} [overflow-wrap:anywhere]`}
                  >
                    {categoryConfig.label}
                  </span>
                </span>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <Calendar size={14} />
                  <span>{formatAnnouncementDate(announcement.created_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <User size={14} />
                  <span>{authorName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div
            className="break-words text-base text-gray-300 leading-[1.7] [overflow-wrap:anywhere] [&_*]:max-w-full [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_a]:text-[#6699FF] [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_p]:my-2 [&_pre]:overflow-x-auto [&_strong]:text-white [&_table]:block [&_table]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />
        </div>

        {/* Footer with Previous/Next Navigation */}
        <div className="px-8 py-6 border-t border-[#1a1a24] bg-[#0f0f17]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {previousAnnouncement && (
                <button
                  onClick={() => navigateToAnnouncement(previousAnnouncement.id)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium"
                >
                  <ChevronLeft size={18} />
                  <div className="text-left">
                    <div className="text-xs text-gray-400">{text.previousPost}</div>
                    <div className="max-w-[200px] truncate text-sm">{previousAnnouncement.title}</div>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={navigateBackToList}
              className="px-6 py-2.5 bg-[#0052FF] text-white rounded-lg hover:bg-[#0052FF]/90 transition-colors font-medium inline-flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              {text.backToList}
            </button>
            <div className="flex-1 flex justify-end">
              {nextAnnouncement && (
                <button
                  onClick={() => navigateToAnnouncement(nextAnnouncement.id)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium"
                >
                  <div className="text-right">
                    <div className="text-xs text-gray-400">{text.nextPost}</div>
                    <div className="max-w-[200px] truncate text-sm">{nextAnnouncement.title}</div>
                  </div>
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

