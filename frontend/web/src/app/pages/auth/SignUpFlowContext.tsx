import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { type SignUpStep1Data, type SignUpStep2Data } from '@/api/signup';

const STEP1_INITIAL_STATE: SignUpStep1Data = {
  email: '',
  password: '',
  agreeToTerms: false,
  subscribeNewsletter: false,
};

const STEP2_INITIAL_STATE: SignUpStep2Data = {
  firstName: '',
  lastName: '',
  country: 'United States',
  address: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  phoneNumber: '',
  agreeToMarketing: false,
  confirmIdMatch: false,
};

type SignUpFlowContextValue = {
  resetSignUpFlow: () => void;
  step1Data: SignUpStep1Data;
  setStep1Data: (data: SignUpStep1Data) => void;
  step2Data: SignUpStep2Data;
  setStep2Data: (data: SignUpStep2Data) => void;
  referralCode: string;
  setReferralCode: (value: string) => void;
};

const SignUpFlowContext = createContext<SignUpFlowContextValue | undefined>(undefined);

export function SignUpFlowProvider({ children }: { children: ReactNode }) {
  const [step1Data, setStep1Data] = useState<SignUpStep1Data>(STEP1_INITIAL_STATE);
  const [step2Data, setStep2Data] = useState<SignUpStep2Data>(STEP2_INITIAL_STATE);
  const [referralCode, setReferralCode] = useState('');

  const resetSignUpFlow = useCallback(() => {
    setStep1Data(STEP1_INITIAL_STATE);
    setStep2Data(STEP2_INITIAL_STATE);
    setReferralCode('');
  }, []);

  const value = useMemo(
    () => ({
      resetSignUpFlow,
      step1Data,
      setStep1Data,
      step2Data,
      setStep2Data,
      referralCode,
      setReferralCode,
    }),
    [referralCode, resetSignUpFlow, step1Data, step2Data],
  );

  return (
    <SignUpFlowContext.Provider value={value}>{children}</SignUpFlowContext.Provider>
  );
}

export function useSignUpFlow() {
  const context = useContext(SignUpFlowContext);

  if (!context) {
    throw new Error('useSignUpFlow must be used within a SignUpFlowProvider.');
  }

  return context;
}
