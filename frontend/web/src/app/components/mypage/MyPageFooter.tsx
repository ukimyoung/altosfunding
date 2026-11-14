import { Link } from 'react-router';
import { useLocale } from '@/app/i18n/LocaleContext';

export function MyPageFooter() {
  const { T } = useLocale();
  const footerText = T.footer;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0a0f] border-t border-[#2a2a3a]">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8">
        {/* Bottom bar */}
        <div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © {currentYear} KORVEX LTD. {footerText.allRights}
              <span className="mx-2 text-gray-600">|</span>
              <span className="inline-block align-top">
                <span className="block">
                  Chrysanthou Mylona 1, PANAYIDES BUILDING, 2nd floor, Flat/Office 1,
                </span>
                <span className="block">3030, Limassol, Cyprus</span>
              </span>
            </p>
            <div className="flex gap-6 text-sm">
              <Link
                to="/disclaimer"
                className="text-gray-400 hover:text-[#00FF94] transition-colors"
              >
                {footerText.disclaimer}
              </Link>
              <Link
                to="/privacy-policy"
                className="text-gray-400 hover:text-[#00FF94] transition-colors"
              >
                {footerText.privacyPolicy}
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-[#00FF94] transition-colors">
                {footerText.terms}
              </Link>
            </div>
          </div>

          {/* Risk Warning */}
          <div className="mt-5 p-4 bg-[#1a1a24]/50 border border-[#2a2a3a] rounded-lg">
            <p className="text-xs text-gray-500 mb-1">
              <span className="text-gray-400">{footerText.riskWarningTitle}</span>
            </p>
            <p className="text-xs text-gray-500 leading-[1.7]">{footerText.riskWarningBody}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
