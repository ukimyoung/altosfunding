import { useEffect, useState } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiErrorMessage } from '@/app/queries/errors';
import { useLocale } from '@/app/i18n/LocaleContext';

interface ContactFormData {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export type ContactFormSubmitPayload = ContactFormData & {
  recaptcha_token: string;
};

const MESSAGE_MAX_LENGTH = 1000;
const SUBJECT_MAX_LENGTH = 500;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

interface ContactFormProps {
  onSuccess?: () => void;
  initialValues?: Partial<Pick<ContactFormData, 'name' | 'email'>>;
  onSubmit?: (payload: ContactFormSubmitPayload) => Promise<unknown> | unknown;
}

export function ContactForm({ onSuccess, initialValues, onSubmit }: ContactFormProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { T } = useLocale();
  const text = T.contactUs;
  const inquiryCategories = [
    { value: '', label: text.placeholderCategoryDefault },
    { value: 'billing', label: text.catBillingPayments },
    { value: 'technical', label: text.catTechnicalSupport },
    { value: 'account', label: text.catAccountManagement },
    { value: 'verification', label: text.catKycVerification },
    { value: 'trading', label: text.catTradingQuestions },
    { value: 'payout', label: text.catPayoutRequests },
    { value: 'general', label: text.catGeneralInquiry },
  ];
  const [formData, setFormData] = useState<ContactFormData>({
    name: initialValues?.name ?? '',
    email: initialValues?.email ?? '',
    category: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      name: prev.name || initialValues?.name || '',
      email: prev.email || initialValues?.email || '',
    }));
  }, [initialValues?.email, initialValues?.name]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setErrorMessage('');
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'message'
          ? value.slice(0, MESSAGE_MAX_LENGTH)
          : name === 'subject'
            ? value.slice(0, SUBJECT_MAX_LENGTH)
            : value,
    }));
  };

  const getRecaptchaToken = async () => {
    if (!executeRecaptcha) {
      throw new Error(text.recaptchaNotReady);
    }

    const token = await executeRecaptcha('contact_us');

    if (!token) {
      throw new Error(text.recaptchaFailed);
    }

    return token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const recaptchaToken = await getRecaptchaToken();
      const payload: ContactFormSubmitPayload = {
        ...formData,
        recaptcha_token: recaptchaToken,
      };

      if (onSubmit) {
        await onSubmit(payload);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, text.submitFailed));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmailInvalid = formData.email.trim() !== '' && !isValidEmail(formData.email);
  const isFormValid =
    formData.name.trim() !== '' &&
    formData.email.trim() !== '' &&
    !isEmailInvalid &&
    formData.category !== '' &&
    formData.subject.trim() !== '' &&
    formData.message.trim() !== '';

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#00FF94]/10 border border-[#00FF94]/30 flex items-center justify-center">
          <CheckCircle size={32} className="text-[#00FF94]" />
        </div>
        <h3 className="text-white text-xl">{text.successTitle}</h3>
        <p className="text-gray-400 text-sm leading-relaxed max-w-sm">{text.successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Name and Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="cf-name" className="block text-sm text-gray-400 mb-1.5">
            {text.labelName} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="cf-name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder={text.placeholderName}
            className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
            required
          />
        </div>
        <div>
          <label htmlFor="cf-email" className="block text-sm text-gray-400 mb-1.5">
            {text.labelEmail} <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="cf-email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder={text.placeholderEmail}
            className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
            required
          />
          {isEmailInvalid && (
            <p className="text-red-400 text-xs mt-1">{text.invalidEmail}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="cf-category" className="block text-sm text-gray-400 mb-1.5">
          {text.labelCategory} <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <select
            id="cf-category"
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white appearance-none focus:outline-none focus:border-[#0052FF] transition-colors cursor-pointer"
            required
          >
            {inquiryCategories.map((cat) => (
              <option key={cat.value} value={cat.value} disabled={cat.value === ''}>
                {cat.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="text-gray-400">
              <path
                d="M1 1L6 6L11 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="cf-subject" className="block text-sm text-gray-400 mb-1.5">
          {text.labelSubject} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="cf-subject"
          name="subject"
          value={formData.subject}
          onChange={handleInputChange}
          maxLength={SUBJECT_MAX_LENGTH}
          placeholder={text.placeholderSubject}
          className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
          required
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="cf-message" className="block text-sm text-gray-400 mb-1.5">
          {text.labelMessage} <span className="text-red-400">*</span>
        </label>
        <textarea
          id="cf-message"
          name="message"
          value={formData.message}
          onChange={handleInputChange}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={5}
          placeholder={text.placeholderMessage}
          className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors resize-none"
          required
        />
        <p className="text-gray-600 text-xs mt-1">
          {formData.message.length} / {MESSAGE_MAX_LENGTH} {text.characters}
        </p>
      </div>

      {/* Submit */}
      {errorMessage && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} />
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!isFormValid || isSubmitting}
        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
          isFormValid && !isSubmitting
            ? 'bg-gradient-to-r from-[#0052FF] to-[#00FF94] text-white hover:shadow-lg hover:shadow-[#0052FF]/30'
            : 'bg-[#1a1a24] text-gray-500 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {text.sending}
          </>
        ) : (
          <>
            <Send size={16} />
            {text.sendMessage}
          </>
        )}
      </button>

      <p className="text-gray-600 text-xs text-center">
        {text.footerNoticePrefix}
        {text.footerPrivacyPolicy}
        {text.footerNoticeAnd}
        {text.footerTermsOfService}
        {text.footerNoticeSuffix}
      </p>
    </form>
  );
}
