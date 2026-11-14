import { Zap, Monitor, Shield, Headphones } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale } from '../../i18n/LocaleContext';

const FEATURE_ICONS = [Zap, Monitor, Shield, Headphones];

export function AlphaFeatures() {
  const { T } = useLocale();
  const text = T.features;

  return (
    <section className="py-32 bg-[#12121a] relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(#0052FF 1px, transparent 1px), linear-gradient(90deg, #0052FF 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      ></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl mb-6 text-white">{text.title}</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">{text.subtitle}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {text.items.map((feature, index) => {
            const Icon = FEATURE_ICONS[index];

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative"
              >
                {/* Card */}
                <div className="h-full bg-gradient-to-br from-[#1a1a24] to-[#0f0f18] p-8 rounded-2xl border border-[#2a2a3a] hover:border-[#0052FF] transition-all relative overflow-hidden">
                  {/* Hover gradient effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0052FF]/0 to-[#00FF94]/0 group-hover:from-[#0052FF]/10 group-hover:to-[#00FF94]/5 transition-all duration-500"></div>

                  {/* Glow effect on hover */}
                  <div className="absolute -inset-[1px] bg-gradient-to-br from-[#0052FF] to-[#00FF94] opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500"></div>

                  <div className="relative z-10">
                    {/* Icon container */}
                    <div className="w-16 h-16 bg-gradient-to-br from-[#0052FF]/20 to-[#00FF94]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <Icon className="w-8 h-8 text-[#0052FF] group-hover:text-[#00FF94] transition-colors" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl mb-4 text-white group-hover:text-[#00FF94] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">{feature.description}</p>

                    {/* Corner accent */}
                    <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-[#0052FF]/0 group-hover:border-[#0052FF]/50 rounded-tr-2xl transition-all duration-500"></div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom accent */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16 h-[1px] bg-gradient-to-r from-transparent via-[#0052FF] to-transparent"
        ></motion.div>
      </div>
    </section>
  );
}

