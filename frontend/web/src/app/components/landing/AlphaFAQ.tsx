import { ArrowRight, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import * as Accordion from '@radix-ui/react-accordion';
import { Link } from 'react-router';
import { useFAQsQuery } from '@/app/queries/support';
import { useLocale } from '../../i18n/LocaleContext';

export function AlphaFAQ() {
  const { locale, T } = useLocale();
  const text = T.faqSection;
  const { data: faqs = [], isLoading, isError } = useFAQsQuery(undefined, locale);
  const landingFaqs = faqs.slice(0, 10);

  return (
    <section
      id="faq"
      className="py-32 bg-gradient-to-b from-[#0a0a0f] to-[#12121a] relative overflow-hidden"
    >
      {/* Background accent */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#0052FF] to-transparent"></div>

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl mb-6 text-white">{text.title}</h2>
          <p className="text-xl text-gray-400">{text.subtitle}</p>
        </motion.div>

        {isLoading && <p className="text-center text-gray-400">Loading FAQs...</p>}
        {isError && (
          <p className="text-center text-red-400">Failed to load FAQs. Please try again later.</p>
        )}
        {!isLoading && !isError && faqs.length === 0 && (
          <p className="text-center text-gray-400">No FAQs found.</p>
        )}
        {!isLoading && !isError && faqs.length > 0 && (
          <Accordion.Root type="single" collapsible className="space-y-4">
            {landingFaqs.map((faq, index) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Accordion.Item
                  value={`item-${faq.id}`}
                  className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] rounded-xl border border-[#2a2a3a] overflow-hidden hover:border-[#0052FF]/50 transition-all"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="w-full flex items-center justify-between p-6 text-left group">
                      <span className="min-w-0 flex-1 text-lg text-white group-hover:text-[#00FF94] transition-colors pr-4 whitespace-pre-line break-words [overflow-wrap:anywhere]">
                        {faq.question}
                      </span>
                      <ChevronDown className="w-5 h-5 text-[#0052FF] flex-shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                    <div className="px-6 pb-6 pt-0">
                      <div className="h-px bg-gradient-to-r from-[#0052FF]/50 to-transparent mb-4"></div>
                      <p className="text-gray-400 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">
                        {faq.answer}
                      </p>
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              </motion.div>
            ))}
          </Accordion.Root>
        )}

        {/* See More link */}
        <div className="mt-10 text-center">
          <Link
            to="/help-center/faq"
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-[#0052FF] transition-colors group text-sm"
          >
            {text.seeMore}
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

