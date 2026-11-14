import { Quote, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../../i18n/LocaleContext';
import { ImageWithFallback } from '../shared/figma/ImageWithFallback';

// Static data: names, avatars, profit badges, locations stay in English
const TESTIMONIAL_META = [
  {
    name: 'Marcus Johnson',
    avatar: 'https://images.unsplash.com/photo-1579009120139-f41119c5e2ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB0cmFkZXIlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyMzE5NDd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    profit: '+127%',
    location: 'New York, USA',
  },
  {
    name: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90fGVufDF8fHx8MTc3MzIwOTc3OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    profit: '+243%',
    location: 'Singapore',
  },
  {
    name: 'David Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1769636929245-427d4e365716?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRyZXByZW5ldXIlMjBjb25maWRlbnQlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyMzE5NDd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    profit: '+189%',
    location: 'London, UK',
  },
  {
    name: 'Emily Thompson',
    avatar: 'https://images.unsplash.com/photo-1660854088062-c178a98550cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW0lMjBzdWNjZXNzfGVufDF8fHx8MTc3MzE4ODA2NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    profit: '+156%',
    location: 'Toronto, Canada',
  },
];

export function AlphaTestimonials() {
  const { T } = useLocale();
  const text = T.testimonials;

  return (
    <section id="testimonials" className="py-32 bg-[#0a0a0f] relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle, #0052FF 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl mb-6 text-white">
            {text.title}
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            {text.subtitle}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {TESTIMONIAL_META.map((meta, index) => {
            const item = text.items[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full bg-gradient-to-br from-[#1a1a24] to-[#12121a] p-8 rounded-2xl border border-[#2a2a3a] hover:border-[#0052FF]/50 transition-all relative overflow-hidden">
                  <Quote className="absolute top-4 right-4 w-16 h-16 text-[#0052FF]/10" />

                  <div className="relative z-10">
                    {/* User info */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#0052FF]">
                          <ImageWithFallback
                            src={meta.avatar}
                            alt={meta.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* Profit badge */}
                        <div className="absolute -bottom-2 -right-2 px-2 py-1 bg-gradient-to-r from-[#00FF94] to-[#00DD7F] rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-[#0a0a0f]" />
                          <span className="text-xs text-[#0a0a0f] font-semibold">{meta.profit}</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-white mb-1 truncate">{meta.name}</div>
                        <div className="text-sm text-gray-400">{meta.location}</div>
                      </div>
                    </div>

                    {/* Quote */}
                    <p className="text-gray-300 leading-relaxed mb-6 italic">
                      "{item.quote}"
                    </p>

                    {/* Rating stars */}
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className="w-5 h-5 text-[#00FF94] fill-current" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      ))}
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-br from-[#0052FF]/0 to-[#00FF94]/0 group-hover:from-[#0052FF]/5 group-hover:to-[#00FF94]/5 transition-all duration-500"></div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-full">
            <div className="flex -space-x-2">
              {TESTIMONIAL_META.slice(0, 3).map((t, i) => (
                <div key={i} className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#0a0a0f]">
                  <ImageWithFallback src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <span className="text-gray-400 text-sm">
              {text.trustBadge.split('{count}').map((part, i) =>
                i === 0 ? (
                  <span key={i}>
                    {part}<span className="text-[#00FF94]">10,000+</span>
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

