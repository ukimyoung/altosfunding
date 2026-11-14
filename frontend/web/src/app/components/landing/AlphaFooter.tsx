import { useState } from 'react';
import { CheckCircle, X, MessageSquare } from 'lucide-react';
import { Link } from 'react-router';
import { AppBrand } from '../shared/AppBrand';
import { AnimatePresence, motion } from 'motion/react';
import { ContactForm } from '../shared/ContactForm';
import { useOptionalMeQuery } from '@/app/queries/profile';
import { useSubmitContactMutation } from '@/app/queries/support';
import { useLocale } from '../../i18n/LocaleContext';

export function AlphaFooter() {
  const { T } = useLocale();
  const footerText = T.footer;
  const contactText = T.contactUs;
  const currentYear = new Date().getFullYear();
  const [contactOpen, setContactOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const { data: me } = useOptionalMeQuery();
  const { mutateAsync: submitContact } = useSubmitContactMutation();
  const contactName = [me?.first_name, me?.last_name].filter(Boolean).join(' ');

  const handleContactSuccess = () => {
    setContactOpen(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  };

  return (
    <footer className="bg-[#0a0a0f] border-t border-[#2a2a3a]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <AppBrand />
            </div>
            <p className="text-gray-400 mb-6 max-w-sm">{footerText.brand}</p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white mb-4">{footerText.legalCol}</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/disclaimer"
                  className="text-gray-400 hover:text-[#00FF94] transition-colors"
                >
                  {footerText.disclaimer}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-gray-400 hover:text-[#00FF94] transition-colors"
                >
                  {footerText.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-400 hover:text-[#00FF94] transition-colors">
                  {footerText.terms}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white mb-4">{footerText.resourcesCol}</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/help-center"
                  className="text-gray-400 hover:text-[#00FF94] transition-colors"
                >
                  {footerText.helpCenter}
                </Link>
              </li>
              <li>
                <Link
                  to="/help-center/faq"
                  className="text-gray-400 hover:text-[#00FF94] transition-colors"
                >
                  {footerText.faqLink}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white mb-4">{footerText.companyCol}</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/about-us"
                  className="text-gray-400 hover:text-[#00FF94] transition-colors"
                >
                  {footerText.aboutUs}
                </Link>
              </li>
              <li>
                <button
                  onClick={() => setContactOpen(true)}
                  className="text-gray-400 hover:text-[#00FF94] transition-colors"
                >
                  {footerText.contactUs}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[#2a2a3a]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <p className="text-gray-400 text-sm">
                © {currentYear} KORVEX LTD. {footerText.allRights}
              </p>
              <span className="hidden sm:inline text-gray-600 text-xs">·</span>
              <p className="text-gray-600 text-xs">
                Chrysanthou Mylona 1, PANAYIDES BUILDING, 2nd floor, Flat/Office 1,  3030, Limassol,
                Cyprus
              </p>
            </div>
            {/* <div className="flex gap-6 text-sm">
              <Link
                to="/privacy-policy"
                className="text-gray-400 hover:text-[#00FF94] transition-colors"
              >
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-[#00FF94] transition-colors">
                Terms of Service
              </Link>
              <Link
                to="/disclaimer"
                className="text-gray-400 hover:text-[#00FF94] transition-colors"
              >
                Risk Disclosure
              </Link>
            </div> */}
          </div>

          {/* Risk Warning */}
          <div className="mt-6 p-5 bg-[#1a1a24]/50 border border-[#2a2a3a] rounded-lg">
            <p className="text-xs text-gray-500 mb-1">
              <span className="text-gray-400">{footerText.riskWarningTitle}</span>
            </p>
            <p className="text-xs text-gray-500 leading-[1.7]">{footerText.riskWarningBody}</p>
          </div>
        </div>
      </div>

      {/* Success Toast — top-right on desktop, top-centre on mobile */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-6 right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-auto sm:max-w-sm"
          >
            <div className="bg-[#0f0f1a] border border-[#00FF94]/30 rounded-xl shadow-2xl shadow-black/40 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#00FF94] flex items-center justify-center shrink-0">
                <CheckCircle size={18} className="text-[#0a0a0f]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{contactText.toastTitle}</p>
                <p className="text-gray-400 text-xs leading-relaxed mt-0.5">
                  {contactText.toastMessage}
                </p>
              </div>
              <button
                onClick={() => setToastVisible(false)}
                className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 mt-0.5"
                aria-label={contactText.dismiss}
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Us Modal */}
      <AnimatePresence>
        {contactOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setContactOpen(false)}
            />

            {/* Modal panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-lg bg-[#0f0f1a] border border-[#2a2a3a] rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[90vh]">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a3a] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
                      <MessageSquare size={18} className="text-[#0052FF]" />
                    </div>
                    <div>
                      <h2 className="text-white text-base">{footerText.contactUs}</h2>
                      <p className="text-gray-500 text-xs">{contactText.modalSubtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setContactOpen(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#1a1a28] transition-colors"
                    aria-label={contactText.close}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable form body */}
                <div className="overflow-y-auto p-6">
                  <ContactForm
                    initialValues={{
                      name: contactName,
                      email: me?.email ?? '',
                    }}
                    onSubmit={submitContact}
                    onSuccess={handleContactSuccess}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </footer>
  );
}
