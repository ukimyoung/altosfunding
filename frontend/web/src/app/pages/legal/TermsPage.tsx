import { AlphaNavigation } from '../../components/landing/AlphaNavigation';
import { AlphaFooter } from '../../components/landing/AlphaFooter';

interface TermsSection {
  article: string;
  heading: string;
  clauses: string[];
}

const sections: TermsSection[] = [
  {
    article: 'Article 1',
    heading: 'General Provisions and Formation of Contract',
    clauses: [
      '1.1. These Terms govern the rights and obligations between KORVEX LTD, a company registered in Cyprus under registration number [HE 496046], with its registered office at Chrysanthou Mylona 1, PANAYIDES BUILDING, 2nd floor, Flat/Office 1, 3030, Limassol, Cyprus (the "Company") and the user (the "User") in connection with the use of the website and services provided by the Company.',
      '1.2. By accessing or registering on the website, purchasing any product, or using the Services, the User is deemed to have agreed to these Terms, forming a legally binding contract.',
      '1.3. These Terms apply together with the Privacy Policy, Disclaimer (Risk Disclosure), AML/KYC Policy, and other policies published by the Company, all of which form an integral part of these Terms.',
      '1.4. If the User does not agree to these Terms, the User must immediately cease using the Services.',
    ],
  },
  {
    article: 'Article 2',
    heading: 'Nature of the Services',
    clauses: [
      '2.1. The Services consist of trading skill evaluation programs (Challenges), a simulated trading environment, educational and analytical tools, and ancillary services.',
      '2.2. All trading activities performed by the User take place exclusively in a simulated environment using virtual funds; no orders are executed in real markets.',
      '2.3. The Company is not: (a) a broker or brokerage firm; (b) a financial institution or investment firm; (c) an asset manager; (d) a market intermediary; or (e) a custodian.',
      '2.4. The Company does not receive or manage User funds for investment purposes. Amounts paid by the User constitute participation fees for the evaluation service and shall not, under any circumstances, be deemed margin deposits, capital contributions, investments, or custodial deposits.',
      '2.5. No statement of any employee or representative of the Company shall be construed as investment advice or recommendation, and the Company shall not be responsible for any such interpretation.',
      "2.6. Performance Rewards are amounts paid by the Company based on simulated performance, subject to the User's compliance with these Terms and the Trading Rules and completion of verifications including KYC/AML. Performance Rewards do not constitute guaranteed remuneration, salary, investment profit, or vested rights.",
    ],
  },
  {
    article: 'Article 3',
    heading: 'Eligibility',
    clauses: [
      '3.1. The Services are available only to persons who are at least 18 years of age (or the higher age of majority in their jurisdiction) and have full legal capacity.',
      '3.2. The Services are not provided to: (a) residents of restricted jurisdictions; (b) persons subject to international sanctions; or (c) persons with a criminal record related to financial crime or terrorism.',
      "3.3. The list of restricted jurisdictions is available on the Company's website and may be updated from time to time.",
      '3.4. The User warrants not to circumvent geographical, technical, or legal controls by means of VPNs, proxies, location spoofing, third-party identities, or document falsification.',
      '3.5. The Company may require KYC/AML procedures, additional documentation, and IP/geolocation/device verification as a condition of account activation, phase migration, or payment of rewards.',
    ],
  },
  {
    article: 'Article 4',
    heading: 'Account',
    clauses: [
      '4.1. The User must create a single account in their own name with accurate and current information and is responsible for its accuracy.',
      '4.2. The account is personal and non-transferable, and may not be sold, assigned, shared, or sublicensed.',
      '4.3. The User is responsible for maintaining the confidentiality of login credentials and for all activities under the account, and must immediately notify the Company of any unauthorized use.',
      '4.4. Account management by third parties, credential sharing, and the use of unauthorized bots, scripts, or automated systems are prohibited.',
    ],
  },
  {
    article: 'Article 5',
    heading: 'Purchases, Fees, and Payments',
    clauses: [
      '5.1. To use products such as Challenges, the User must pay the participation fee disclosed at the time of purchase. Fees and applicable conditions (discounts, promotions) are displayed prior to order confirmation.',
      '5.2. Fees are paid for access to the evaluation program and are non-refundable if the program is not successfully completed.',
      '5.3. Payments may be processed through payment processors designated by the Company, and billing descriptors may differ from the brand name.',
      "5.4. Before initiating any dispute or chargeback, the User must first contact the Company's official support channels and attempt resolution in good faith. Chargebacks initiated in breach of this obligation may be treated as abuse and may result in account suspension or other measures.",
    ],
  },
  {
    article: 'Article 6',
    heading: 'Challenge / Funded Stages and Trading Rules',
    clauses: [
      '6.1. The Services consist of the Challenge (evaluation) stage and the Funded stage, and the Trading Rules for each stage and product (profit targets, loss limits, trading periods, prohibited conduct) are published on the website.',
      '6.2. The Funded stage is a simulated environment granted upon passing the Challenge, provided exclusively for evaluation purposes for the calculation of Performance Rewards.',
      '6.3. Breaching loss limits or using prohibited trading strategies may result in account termination and forfeiture of rewards.',
      "6.4. The detailed list of prohibited trading practices is published on the Company's website.",
    ],
  },
  {
    article: 'Article 7',
    heading: 'Performance Rewards and Payouts',
    clauses: [
      '7.1. The profit split ratio, payout conditions, and payout cycle follow the criteria published on the website. The current policy provides an 80% share of simulated profits to the trader.',
      '7.2. Prior to payment, the Company may review KYC/AML verification and compliance with the Trading Rules, and may refuse, withhold, or reclaim payment if violations are confirmed.',
      '7.3. Rewards are paid by means determined by the Company (e.g., cryptocurrency transfer); network fees may apply and are displayed before confirmation.',
      '7.4. Payout processing typically takes 1–3 business days from the date of an approved request.',
    ],
  },
  {
    article: 'Article 8',
    heading: 'Restriction, Suspension, and Termination',
    clauses: [
      '8.1. The Company may restrict, suspend, or terminate accounts upon confirmation of breaches, abuse, or suspicious activity.',
      '8.2. Accounts found engaging in prohibited practices may be terminated immediately, with rewards forfeited.',
      '8.3. Final determinations regarding violations are made by the Company and are binding.',
    ],
  },
  {
    article: 'Article 9',
    heading: 'Limitation of Liability',
    clauses: [
      '9.1. Trading (including simulated trading) involves significant risk of loss. The Company does not guarantee profits or uninterrupted access to the Services.',
      '9.2. The Company is not responsible for failures or errors of third-party services, including trading platforms (MT4), data feeds, liquidity providers, and payment processors.',
      "9.3. Should the Company's liability be established by a court or other competent authority, the Company's aggregate liability shall be limited to the total participation fees paid by the User in the preceding 12 months.",
    ],
  },
  {
    article: 'Article 10',
    heading: 'Intellectual Property',
    clauses: [
      '10.1. All rights to the website, platform, content, trademarks, and logos belong to the Company or their rightful owners. Reproduction, distribution, or derivative use without prior written consent is prohibited.',
    ],
  },
  {
    article: 'Article 11',
    heading: 'Governing Law and Jurisdiction',
    clauses: [
      '11.1. These Terms shall be governed by applicable laws, and any disputes shall be subject to the exclusive jurisdiction of the competent courts or arbitration body designated by the Company.',
    ],
  },
  {
    article: 'Article 12',
    heading: 'Amendments',
    clauses: [
      '12.1. The Company may amend these Terms, with notice given via website announcement or email. Continued use of the Services after amendment constitutes acceptance of the amended Terms.',
    ],
  },
];

export function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <AlphaNavigation />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Page title */}
          <h1 className="text-4xl text-white mb-3">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-12 border-b border-[#2a2a3a] pb-8">
            Last updated: June 2026
          </p>

          {/* Intro */}
          <p className="text-gray-300 leading-[1.7] mb-12">
            Please read these Terms of Service carefully before using the KORVEX LTD website or
            services. By accessing or registering, you agree to be bound by these Terms. If you do
            not agree, please discontinue use immediately.
          </p>

          {/* Articles */}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.article}>
                <h2 className="text-xl text-white mb-4 pb-2 border-b border-[#2a2a3a]">
                  {section.article}: {section.heading}
                </h2>
                <div className="space-y-3">
                  {section.clauses.map((clause, i) => (
                    <p key={i} className="text-gray-300 leading-[1.7]">
                      {clause}
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
