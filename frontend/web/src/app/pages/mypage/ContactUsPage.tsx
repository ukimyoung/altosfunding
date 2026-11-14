import { useState } from 'react';
import { motion } from 'motion/react';
import { MessageSquare } from 'lucide-react';
import { Toast } from '../../components/shared/Toast';
import { ContactForm } from '../../components/shared/ContactForm';
import { useMeQuery } from '@/app/queries/profile';
import { useSubmitContactMutation } from '@/app/queries/support';
import { useLocale } from '@/app/i18n/LocaleContext';

export function ContactUsPage() {
  const [showToast, setShowToast] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { T } = useLocale();
  const text = T.contactUs;
  const { data: me } = useMeQuery();
  const { mutateAsync: submitContact } = useSubmitContactMutation();
  const contactName = [me?.first_name, me?.last_name].filter(Boolean).join(' ');

  return (
    <>
      <Toast
        type="success"
        title={text.toastTitle}
        message={text.toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={5000}
        position="top"
      />

      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
              <MessageSquare size={24} className="text-[#0052FF]" />
            </div>
            <div>
              <h1 className="text-2xl text-white font-medium">{text.pageTitle}</h1>
              <p className="text-gray-400 text-sm mt-1">{text.pageSubtitle}</p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-8"
        >
          {!isSubmitted && (
            <div className="mb-6">
              <h2 className="text-white text-xl font-medium mb-2">{text.formTitle}</h2>
              <p className="text-gray-400 text-sm">{text.formSubtitle}</p>
            </div>
          )}
          <ContactForm
            initialValues={{
              name: contactName,
              email: me?.email ?? '',
            }}
            onSubmit={submitContact}
            onSuccess={() => {
              setIsSubmitted(true);
              setShowToast(true);
            }}
          />
        </motion.div>
      </div>
    </>
  );
}

