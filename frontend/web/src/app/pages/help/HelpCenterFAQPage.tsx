import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router';
import { useFAQCategoriesQuery, useFAQsQuery } from '@/app/queries/support';
import { useLocale } from '@/app/i18n/LocaleContext';
import type { FAQItem } from '@/api/support';

const grouped = (items: FAQItem[]) => {
  const map: Record<string, FAQItem[]> = {};
  items.forEach(item => {
    if (!map[item.category]) map[item.category] = [];
    map[item.category].push(item);
  });
  return map;
};

const parseCategoryIdParam = (value: string | null) => {
  if (!value) {
    return null;
  }

  const categoryId = Number(value);

  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
};

export function HelpCenterFAQPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale } = useLocale();
  const categoryIdParam = searchParams.get('category_id');
  const initialCategoryId = parseCategoryIdParam(categoryIdParam);
  const {
    data: faqCategories = [],
    isLoading: isLoadingCategories,
    isError: isCategoriesError,
  } = useFAQCategoriesQuery(locale);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(initialCategoryId);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: faqItems = [], isLoading: isLoadingFAQs, isError: isFAQsError } = useFAQsQuery({
    category_id: activeCategoryId,
  }, locale);

  const categoryOptions = useMemo(() => {
    const sortedCategories = [...faqCategories].sort((a, b) => a.sort_order - b.sort_order);
    const totalCount = sortedCategories.reduce((sum, category) => sum + category.faq_count, 0);

    return [
      { id: null, name: 'All', faq_count: totalCount },
      ...sortedCategories.map((category) => ({
        id: category.id,
        name: category.name,
        faq_count: category.faq_count,
      })),
    ];
  }, [faqCategories]);

  useEffect(() => {
    setActiveCategoryId(parseCategoryIdParam(categoryIdParam));
  }, [categoryIdParam]);

  useEffect(() => {
    if (categoryIdParam && parseCategoryIdParam(categoryIdParam) === null) {
      const next = new URLSearchParams(searchParams);
      next.delete('category_id');
      setSearchParams(next, { replace: true });
    }
  }, [categoryIdParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (faqCategories.length === 0) {
      return;
    }

    const hasActiveCategory = faqCategories.some((category) => category.id === activeCategoryId);

    if (activeCategoryId !== null && !hasActiveCategory) {
      setActiveCategoryId(null);

      const next = new URLSearchParams(searchParams);
      next.delete('category_id');
      setSearchParams(next, { replace: true });
    }
  }, [activeCategoryId, faqCategories, searchParams, setSearchParams]);

  const faqItemsKey = faqItems.map((item) => item.id).join(',');
  const firstFAQId = faqItems[0] ? String(faqItems[0].id) : null;

  useEffect(() => {
    setOpenId(firstFAQId);
  }, [faqItemsKey, firstFAQId]);

  const groups = grouped(faqItems);
  const selectedCategory = faqCategories.find((category) => category.id === activeCategoryId);
  const categoryOrder = activeCategoryId === null
    ? [
      ...categoryOptions
        .filter((category) => category.id !== null)
        .map((category) => category.name),
      ...Object.keys(groups).filter(
        (categoryName) => !categoryOptions.some((category) => category.name === categoryName),
      ),
    ]
    : [selectedCategory?.name ?? faqItems[0]?.category].filter((categoryName): categoryName is string =>
      Boolean(categoryName),
    );
  const isLoading = isLoadingCategories || isLoadingFAQs;
  const hasError = isCategoriesError || isFAQsError;

  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);
  const updateCategory = (categoryId: number | null) => {
    setActiveCategoryId(categoryId);

    const next = new URLSearchParams(searchParams);

    if (categoryId === null) {
      next.delete('category_id');
    } else {
      next.set('category_id', String(categoryId));
    }

    setSearchParams(next, { replace: true });
  };

  return (
    <div className="max-w-3xl">
      <p className="text-gray-600 text-xs mb-5">{faqItems.length} questions</p>

      {/* Category Bubbles */}
      <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-1">
        {categoryOptions.map(category => {
          const active = activeCategoryId === category.id;
          return (
            <button
              key={category.id ?? 'all'}
              onClick={() => updateCategory(category.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                active
                  ? 'bg-[#0052FF] text-white shadow-lg shadow-[#0052FF]/30'
                  : 'bg-[#1a1a28] border border-[#2a2a3a] text-gray-300 hover:border-[#0052FF]/50 hover:text-white'
                }`}
            >
              <span>{category.name}</span>
              <span className={`text-xs ${active ? 'text-blue-200' : 'text-gray-500'}`}>
                {category.faq_count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && <p className="text-gray-500 text-sm mb-6">Loading FAQs...</p>}
      {hasError && (
        <p className="text-red-400 text-sm mb-6">
          Failed to load FAQs. Please try again later.
        </p>
      )}
      {!isLoading && !hasError && faqItems.length === 0 && (
        <p className="text-gray-500 text-sm mb-6">No FAQs found.</p>
      )}

      {/* Accordion groups */}
      <div className="space-y-8">
        {categoryOrder.map(cat => {
          const items = groups[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#2a2a3a]">
                <span className="text-xs text-gray-500 uppercase tracking-widest">{cat}</span>
                <span className="text-xs text-[#0052FF]">{items.length}</span>
              </div>

              {/* Accordion items */}
              <div className="space-y-2">
                {items.map(item => {
                  const itemId = String(item.id);
                  const isOpen = openId === itemId;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${
                        isOpen
                          ? 'border-[#0052FF]/60 bg-[#0d0d1a] shadow-lg shadow-[#0052FF]/10'
                          : 'border-[#1a1a28] bg-[#0f0f17] hover:border-[#2a2a3a]'
                      }`}
                    >
                      {/* Question row */}
                      <button
                        onClick={() => toggle(itemId)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                      >
                        <span className={`min-w-0 flex-1 text-sm leading-snug whitespace-pre-line break-words [overflow-wrap:anywhere] ${isOpen ? 'text-white' : 'text-gray-200'}`}>
                          {item.question}
                        </span>
                        <span className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                          isOpen ? 'text-[#0052FF]' : 'text-gray-600'
                        }`}>
                          {isOpen ? <X size={14} /> : <Plus size={14} />}
                        </span>
                      </button>

                      {/* Answer */}
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <p className="px-5 pb-5 text-gray-400 text-sm leading-[1.7] whitespace-pre-line break-words [overflow-wrap:anywhere]">
                              {item.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
