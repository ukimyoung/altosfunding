import { AlphaNavigation } from '../../components/landing/AlphaNavigation';
import { AlphaFooter } from '../../components/landing/AlphaFooter';

interface PolicySection {
  number: string;
  heading: string;
  body?: string;
  bullets?: string[];
  footer?: string;
}

const sections: PolicySection[] = [
  {
    number: '1',
    heading: 'Information We Collect',
    bullets: [
      'Account information: name, email, password, country, phone number, address',
      'KYC/identity verification: ID document copies, date of birth, selfie (facial matching), proof of address',
      'Payment information: payment method details (card / crypto wallet address), transaction history',
      'Trading activity: simulated trading records, account performance data',
      'Technical information: IP address, device information, cookies, access logs, geolocation',
    ],
  },
  {
    number: '2',
    heading: 'Purposes of Collection and Use',
    bullets: [
      'Registration, account management, and provision of the Services',
      'Compliance with legal obligations including KYC/AML and fraud prevention',
      'Processing of participation fees and Performance Reward payouts',
      'Customer support and delivery of notices and email notifications',
      'Service improvement, statistical analysis, and (with consent) marketing',
    ],
  },
  {
    number: '3',
    heading: 'Disclosure and Processing by Third Parties',
    body: 'The Company may entrust processing to the following categories of processors: payment processors, KYC/AML verification providers, trading platform providers, cloud/hosting providers, and email delivery services.',
    footer:
      'Personal data may be disclosed to competent authorities where required by law (e.g., requests from law enforcement, court orders).',
  },
  {
    number: '4',
    heading: 'Retention and Deletion',
    body: 'Personal data is retained until the purpose of collection and use is achieved. Where retention is required by applicable law, data is retained for the required period and then deleted without delay.',
  },
  {
    number: '5',
    heading: 'Your Rights',
    body: 'Users may request access to, correction of, deletion of, or suspension of processing of their personal data. Requests may be submitted to support@altosfunding.com.',
  },
  {
    number: '6',
    heading: 'Cookies',
    body: 'The website uses cookies to improve service quality and for analytics. Users may refuse cookies via browser settings; however, some features may be limited.',
  },
  {
    number: '7',
    heading: 'Data Protection Officer',
    body: 'For any data protection enquiries, please contact our Data Protection Officer via support@altosfunding.com.',
  },
];

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <AlphaNavigation />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Page title */}
          <h1 className="text-4xl text-white mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mb-12 border-b border-[#2a2a3a] pb-8">
            Last updated: June 2026
          </p>

          {/* Intro */}
          <p className="text-gray-300 leading-[1.7] mb-12">
            KORVEX LTD (registration number [HE 496046]), with its registered office at Chrysanthou
            Mylona 1, PANAYIDES BUILDING, 2nd floor, Flat/Office 1, 3030, Limassol, Cyprus, is the
            data controller responsible for your personal data. This Privacy Policy explains what
            information we collect, how we use it, and your rights in relation to it. By using our
            services, you agree to the collection and use of information in accordance with this
            policy.
          </p>

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.number}>
                <h2 className="text-xl text-white mb-4 pb-2 border-b border-[#2a2a3a]">
                  {section.number}. {section.heading}
                </h2>

                {section.body && <p className="text-gray-300 leading-[1.7] mb-4">{section.body}</p>}

                {section.bullets && (
                  <ul className="space-y-3 mb-4">
                    {section.bullets.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-300 leading-[1.7]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] mt-2.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.footer && <p className="text-gray-300 leading-[1.7]">{section.footer}</p>}
              </section>
            ))}
          </div>
        </div>
      </main>

      <AlphaFooter />
    </div>
  );
}
