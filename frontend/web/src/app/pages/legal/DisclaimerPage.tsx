import { AlphaNavigation } from '../../components/landing/AlphaNavigation';
import { AlphaFooter } from '../../components/landing/AlphaFooter';

const sections = [
  {
    heading: 'Standard Disclaimer',
    paragraphs: [
      'All information provided on this website is intended solely for educational purposes related to trading on financial markets and does not serve in any way as a specific investment recommendation, business recommendation, investment opportunity analysis, or similar general recommendation regarding the trading of investment instruments.',
      'KORVEX LTD only provides simulated trading services and educational tools for traders. The information on this site is not directed at residents of any country or jurisdiction where such distribution or use would be contrary to local laws or regulations.',
      'KORVEX LTD does not act as a broker and does not accept any deposits. Amounts paid by users are limited to evaluation program participation fees. The offered technical solution for the trading platforms and data feed is powered by liquidity providers.',
    ],
  },
  {
    heading: 'Simulated Performance Disclaimer',
    paragraphs: [
      'All accounts provided are simulated accounts with virtual funds, and all trading takes place in a simulated environment only. Simulated results do not represent actual trading. Because the trades have not actually been executed, the results may have under- or over-compensated for the impact, if any, of certain market factors, such as lack of liquidity. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.',
    ],
  },
  {
    heading: 'Risk Disclosure',
    paragraphs: [
      'Trading in financial markets involves a high degree of risk and may not be suitable for everyone. Past performance is not indicative of future results. Performance in the simulated environment of this service likewise does not represent performance in actual markets.',
      "Performance Rewards are paid by the Company subject to simulated performance and compliance with the Trading Rules. No profit is guaranteed, and payment may be refused or reclaimed following the Company's review.",
    ],
  },
  {
    heading: 'No Investment Advice',
    paragraphs: [
      'Should any information or statement of any employee, staff member, or representative of the Company be interpreted as investment advice or recommendation, the Company explicitly disclaims that the same constitutes investment advice or recommendation and shall not be responsible for it.',
    ],
  },
];

export function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <AlphaNavigation />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Page title */}
          <h1 className="text-4xl text-white mb-3">Disclaimer</h1>
          <p className="text-gray-500 text-sm mb-12 border-b border-[#2a2a3a] pb-8">
            Last updated: June 2026
          </p>

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg text-white mb-4 pb-2 border-b border-[#2a2a3a]">
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.paragraphs.map((p, i) => (
                    <p key={i} className="text-gray-300 leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <AlphaFooter />
    </div>
  );
}
