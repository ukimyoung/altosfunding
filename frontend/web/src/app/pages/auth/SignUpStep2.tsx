import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type SelectHTMLAttributes,
} from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import 'react-phone-number-input/style.css';
import PhoneInput, { getCountryCallingCode } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import { allCountries } from 'country-region-data';
import { AppBrand } from '../../components/shared/AppBrand';
import { ImageWithFallback } from '../../components/shared/figma/ImageWithFallback';
import { useSignUpFlow } from './SignUpFlowContext';
import { useLocale } from '@/app/i18n/LocaleContext';
import { LanguageSelector } from '../../components/shared/LanguageSelector';
import { COUNTRY_LABELS, COUNTRY_OPTIONS } from '@altosfunding/shared/countries';

type PhoneCountrySelectOption = {
  value?: Country;
  label: string;
  divider?: boolean;
};

type PhoneCountrySelectProps = {
  value?: Country;
  options: PhoneCountrySelectOption[];
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  iconComponent?: ElementType;
  ariaLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onChange: (value?: Country) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>;

function PhoneCountrySelect({
  value,
  options,
  disabled,
  readOnly,
  className,
  iconComponent: Icon,
  ariaLabel,
  searchPlaceholder,
  emptyMessage,
  onChange,
}: PhoneCountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectableOptions = useMemo(
    () => options.filter((option) => !option.divider && option.value),
    [options],
  );

  const selectedOption =
    selectableOptions.find((option) => option.value === value) ?? selectableOptions[0];

  const selectedCountry = selectedOption?.value;
  const countryName = selectedCountry ? (COUNTRY_LABELS[selectedCountry] ?? selectedCountry) : '';

  const filteredOptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return selectableOptions;
    }

    return selectableOptions.filter((option) => {
      const optionCountry = option.value;
      const optionCallingCode = optionCountry ? `+${getCountryCallingCode(optionCountry)}` : '';
      const optionName = option.label.toLowerCase();
      const countryCode = optionCountry?.toLowerCase() ?? '';

      return (
        optionName.includes(normalizedQuery) ||
        optionCallingCode.includes(normalizedQuery) ||
        countryCode.includes(normalizedQuery)
      );
    });
  }, [searchQuery, selectableOptions]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className={`PhoneInputCountry relative flex-shrink-0 h-full w-16 ${className ?? ''}`}
    >
      <button
        type="button"
        disabled={disabled || readOnly}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className="relative flex h-full w-full items-center justify-start rounded-lg border border-[#2a2a3a] bg-[#1a1a24] px-2 pr-8 text-left outline-none transition-colors hover:border-[#3a3a4a] focus:border-[#0052FF]"
        onClick={() => {
          if (disabled || readOnly) {
            return;
          }

          setIsOpen((current) => !current);
        }}
      >
        <span className="flex h-7 w-10 items-center justify-center overflow-hidden rounded-[2px]">
          {selectedCountry && Icon ? (
            <Icon country={selectedCountry} label={countryName} aria-hidden />
          ) : null}
        </span>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && !disabled && !readOnly && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[18rem] overflow-hidden rounded-xl border border-[#2a2a3a] bg-[#11111a] shadow-2xl">
          <div className="border-b border-[#1a1a24] p-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a24] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#0052FF] focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-2">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500">{emptyMessage}</div>
            ) : (
              filteredOptions.map((option) => {
                const optionCountry = option.value;
                const optionCallingCode = optionCountry
                  ? `+${getCountryCallingCode(optionCountry)}`
                  : '';
                const optionName = optionCountry
                  ? (COUNTRY_LABELS[optionCountry] ?? option.label)
                  : option.label;
                const isSelected = optionCountry === selectedCountry;

                return (
                  <button
                    key={optionCountry ?? option.label}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1a1a24] ${
                      isSelected ? 'bg-[#1a1a24]' : ''
                    }`}
                    onClick={() => {
                      if (!optionCountry) {
                        return;
                      }

                      onChange(optionCountry);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-5 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[#2a2a3a] bg-[#11111a]">
                        {Icon && optionCountry ? (
                          <Icon country={optionCountry} label={optionName} aria-hidden />
                        ) : null}
                      </span>
                      <span className="truncate text-sm font-medium text-white">{optionName}</span>
                    </span>
                    <span className="flex-shrink-0 text-sm text-gray-400">{optionCallingCode}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SignUpStep2() {
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.signup;
  // Step1에서 입력한 값과 Step2 입력값을 공통 컨텍스트에서 이어서 사용한다.
  const { step1Data, step2Data, setStep2Data } = useSignUpFlow();
  const selectedPhoneCountryCode = (COUNTRY_OPTIONS.find(
    (option) => option.label === step2Data.country,
  )?.code ?? 'US') as Country;
  const stateOptions = useMemo(
    () =>
      allCountries
        .find(([, countryShortCode]) => countryShortCode === selectedPhoneCountryCode)
        ?.[2].map((region) => region[0])
        .filter(Boolean) ?? [],
    [selectedPhoneCountryCode],
  );
  const hasStateOptions = stateOptions.length > 0;

  // Step1을 거치지 않고 직접 접근한 경우를 막기 위한 최소 조건이다.
  const hasStep1Data =
    step1Data.email.trim() !== '' &&
    step1Data.password.trim() !== '';

  // Step2의 필수 입력값이 모두 채워졌는지 확인해 버튼 활성화와 제출 가능 여부를 제어한다.
  const isStep2Valid =
    step2Data.firstName.trim() !== '' &&
    step2Data.lastName.trim() !== '' &&
    step2Data.country.trim() !== '' &&
    step2Data.address.trim() !== '' &&
    step2Data.city.trim() !== '' &&
    (!hasStateOptions || step2Data.state.trim() !== '') &&
    step2Data.postalCode.trim() !== '' &&
    step2Data.phoneNumber.trim() !== '' &&
    step2Data.confirmIdMatch;

  useEffect(() => {
    // Step1 데이터가 없으면 정상적인 플로우가 아니므로 다시 첫 단계로 보낸다.
    if (!hasStep1Data) {
      navigate('/signup', { replace: true });
    }
  }, [hasStep1Data, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Step2 필수값이 부족하면 다음 단계로 넘기지 않는다.
    if (!isStep2Valid) {
      return;
    }

    // Step2 값도 컨텍스트에 저장되고 있으므로 화면 이동만 수행한다.
    navigate('/signup/step-3');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#0a0a1f] to-[#0a0a0f]">
        <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
          <Link to="/" className="flex items-center gap-2">
            <AppBrand />
          </Link>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1693344047149-2eefd915ddfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHwzRCUyMGdlb21ldHJpYyUyMGFic3RyYWN0JTIwZGFyayUyMGZpbnRlY2h8ZW58MXx8fHwxNzczMzA1MTA1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="3D Background"
            className="w-full h-full object-cover opacity-40"
          />
        </div>

        <motion.div
          animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 opacity-60 blur-xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, 10, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 opacity-50 blur-2xl"
        />
        <motion.div
          animate={{ y: [0, -15, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/3 right-1/3 w-28 h-28 rounded-full bg-gradient-to-br from-[#0052FF] to-[#00FF94] opacity-40 blur-2xl"
        />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="flex justify-end mb-6">
            <LanguageSelector />
          </div>

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-2">
              <AppBrand />
            </Link>
          </div>

          <div className="flex items-center gap-2 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm">
                1
              </div>
              <div className="w-12 h-0.5 bg-[#0052FF]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-sm border-2 border-[#0052FF]">
                2
              </div>
              <div className="w-12 h-0.5 bg-[#2a2a3a]" />
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center text-gray-500 text-sm">
              3
            </div>
          </div>

          <h1 className="text-4xl text-white mb-2">{text.step2Title}</h1>
          <p className="text-gray-400 text-sm mb-8">{text.step2Subtitle}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder={text.placeholderFirstName}
                value={step2Data.firstName}
                onChange={(e) => setStep2Data({ ...step2Data, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
                required
              />
              <input
                type="text"
                placeholder={text.placeholderLastName}
                value={step2Data.lastName}
                onChange={(e) => setStep2Data({ ...step2Data, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
                required
              />
            </div>

            <div className="relative">
              <select
                value={step2Data.country}
                onChange={(e) =>
                  setStep2Data({
                    ...step2Data,
                    country: e.target.value,
                    phoneNumber: '',
                    state: '',
                  })
                }
                className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white focus:outline-none focus:border-[#0052FF] transition-colors appearance-none cursor-pointer"
                required
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            <input
              type="text"
              placeholder={text.placeholderAddress}
              value={step2Data.address}
              onChange={(e) => setStep2Data({ ...step2Data, address: e.target.value })}
              className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
              required
            />

            <input
              type="text"
              placeholder={text.placeholderAddressLine2}
              value={step2Data.addressLine2}
              onChange={(e) => setStep2Data({ ...step2Data, addressLine2: e.target.value })}
              className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
            />

            <div className={`grid grid-cols-1 gap-4 ${hasStateOptions ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <input
                type="text"
                placeholder={text.placeholderCity}
                value={step2Data.city}
                onChange={(e) => setStep2Data({ ...step2Data, city: e.target.value })}
                className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
                required
              />

              {hasStateOptions ? (
                <div className="relative">
                  <select
                    value={step2Data.state}
                    onChange={(e) => setStep2Data({ ...step2Data, state: e.target.value })}
                    className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white focus:outline-none focus:border-[#0052FF] transition-colors appearance-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>
                      {text.placeholderSelectState}
                    </option>
                    {stateOptions.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              ) : null}

              <input
                type="text"
                placeholder={text.placeholderPostalCode}
                value={step2Data.postalCode}
                onChange={(e) => setStep2Data({ ...step2Data, postalCode: e.target.value })}
                className="w-full px-4 py-3 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors"
                required
              />
            </div>

            <PhoneInput
              key={selectedPhoneCountryCode}
              className="phone-input-dark"
              addInternationalOption={false}
              countrySelectComponent={PhoneCountrySelect}
              countrySelectProps={{
                ariaLabel: text.phoneCountryAria,
                searchPlaceholder: text.searchCountries,
                emptyMessage: text.noCountriesFound,
              }}
              countryCallingCodeEditable={false}
              defaultCountry={selectedPhoneCountryCode}
              international
              withCountryCallingCode
              labels={COUNTRY_LABELS}
              value={step2Data.phoneNumber || undefined}
              onChange={(value) => setStep2Data({ ...step2Data, phoneNumber: value ?? '' })}
              placeholder={text.placeholderPhoneNumber}
              autoComplete="tel"
              type="tel"
              required
            />

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={step2Data.agreeToMarketing}
                  onChange={(e) =>
                    setStep2Data({ ...step2Data, agreeToMarketing: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-300">
                    {text.agreeMarketing}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {text.agreeMarketingNote}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={step2Data.confirmIdMatch}
                  onChange={(e) => setStep2Data({ ...step2Data, confirmIdMatch: e.target.checked })}
                  className="mt-1 w-4 h-4 bg-[#1a1a24] border border-[#2a2a3a] rounded accent-[#0052FF]"
                  required
                />
                <span className="text-sm text-gray-300">
                  {text.confirmIdMatch}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!isStep2Valid}
              className={`w-full px-6 py-3 text-white rounded-lg transition-all mt-6 ${
                isStep2Valid
                  ? 'bg-gradient-to-r from-[#FFB800] via-[#0052FF] to-[#0052FF] hover:shadow-lg hover:shadow-[#0052FF]/50'
                  : 'bg-[#2a2a3a] text-gray-500 cursor-not-allowed'
              }`}
            >
              {text.nextBtn}
            </button>

            <div className="text-center">
              <Link
                to="/signup"
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                {text.backToStep1}
              </Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
