import { motion } from 'motion/react';
import { Cpu, Eye, TrendingUp } from 'lucide-react';
import { AlphaNavigation } from '../components/landing/AlphaNavigation';
import { AlphaFooter } from '../components/landing/AlphaFooter';

const pillars = [
  {
    icon: <Eye size={28} className="text-[#0052FF]" />,
    accent: 'bg-[#0052FF]/10 border-[#0052FF]/20',
    heading: 'Transparency First',
    body: 'No hidden rules. Our evaluation metrics, including real-time Max Drawdown (MDD) tracking, are clear and straightforward.',
  },
  {
    icon: <Cpu size={28} className="text-[#00FF94]" />,
    accent: 'bg-[#00FF94]/10 border-[#00FF94]/20',
    heading: 'Advanced Infrastructure',
    body: 'Trade on cutting-edge platforms with ultra-low latency, deep liquidity, and institutional-grade spreads.',
  },
  {
    icon: <TrendingUp size={28} className="text-[#FFB800]" />,
    accent: 'bg-[#FFB800]/10 border-[#FFB800]/20',
    heading: 'Trader-Centric Profit Split',
    body: 'We offer a highly competitive profit split model, ensuring that you are fully rewarded for your skills and discipline.',
  },
];

export function AboutUsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <AlphaNavigation />

      <main className="flex-1 pt-20">
        <section className="relative overflow-hidden py-28 px-4 sm:px-6">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-[#0052FF]/10 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-[#00FF94]/8 blur-[120px]" />
          </div>

          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          <div className="relative max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <span className="inline-block text-[#00FF94] text-sm tracking-widest uppercase mb-5">
                Our Story
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-8">
                About{' '}
                <span className="bg-gradient-to-r from-[#0052FF] to-[#00FF94] bg-clip-text text-transparent">
                  Altos Funding
                </span>
              </h1>
              <p className="text-gray-300 text-lg sm:text-xl leading-[1.8] max-w-2xl mx-auto">
                At Altos Funding, our mission is simple: to democratize access to institutional
                trading capital. We believe that financial constraints should never limit
                exceptional trading talent. By providing robust capital, premium trading
                infrastructure, and a transparent evaluation process, we empower retail traders
                worldwide to transition into full-time professional prop traders.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 border-t border-[#1a1a28]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl sm:text-4xl text-white mb-4">Why Partner with Us?</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-base">
                Everything we build is designed with one goal: putting the best traders in the best
                possible position to succeed.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pillars.map((pillar, index) => (
                <motion.div
                  key={pillar.heading}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.12 }}
                  className="bg-[#0f0f1a] border border-[#1a1a28] rounded-2xl p-8 hover:border-[#2a2a3a] transition-colors"
                >
                  <div
                    className={`w-14 h-14 rounded-xl ${pillar.accent} border flex items-center justify-center mb-6`}
                  >
                    {pillar.icon}
                  </div>
                  <h3 className="text-white text-xl mb-3">{pillar.heading}</h3>
                  <p className="text-gray-400 text-sm leading-[1.7]">{pillar.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 border-t border-[#1a1a28]">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl text-white mb-8">Our Commitment</h2>
              <div className="bg-[#0f0f1a] border border-[#2a2a3a] rounded-2xl p-8 sm:p-10 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0052FF] to-[#00FF94] rounded-l-2xl" />
                <p className="text-gray-200 text-base sm:text-lg leading-[1.8] pl-2">
                  Founded by financial technology veterans and risk management experts, Altos
                  Funding is built on stability and trust. We do not just fund traders; we protect
                  our community with advanced risk engines and ensuring reliable, lightning-fast
                  payouts. Your trading journey deserves a partner you can rely on.
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <AlphaFooter />
    </div>
  );
}
