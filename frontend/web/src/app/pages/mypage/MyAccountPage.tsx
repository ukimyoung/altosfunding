import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { useMeQuery } from '@/app/queries/profile';
import { useCreateDemoAccountMutation, useDemoOptionsQuery } from '@/app/queries/demo';
import { accountsQueryKeys, useAccountsQuery } from '@/app/queries/accounts';
import { getApiErrorMessage } from '@altosfunding/shared/api/errors';
import { useQueryClient } from '@tanstack/react-query';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  CheckCircle,
  Plus,
} from 'lucide-react';
import { Toast } from '../../components/shared/Toast';
// Live 계정 생성 미지원으로 Trading Account Information 영역을 숨김. 다시 표시할 때 아래 import와 JSX 주석을 함께 해제한다.
// import { TradingAccountSection } from '../../components/shared/TradingAccountSection';
import { EditProfileModal } from './EditProfilePage';
import type { MeResponse } from '@/api/user';
import { formatGmtDate } from '@/app/utils/date';
import { hasRequiredProfileName } from '@/app/utils/profile';
import { useLocale } from '@/app/i18n/LocaleContext';

type AccountData = {
  name: string;
  email: string;
  phone: string;
  address: string;
  joinedDate: string;
  accountId: string;
  referralLink: string;
  referralCode: string;
  totalReferrals: number;
  referrerCode: string;
  avatar_url: string;
};

const emptyAccountData: AccountData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  joinedDate: '',
  accountId: '',
  referralLink: '',
  referralCode: '',
  totalReferrals: 0,
  referrerCode: '',
  avatar_url: '',
};

const joinAddress = (parts: string[]) => parts.filter(Boolean).join(', ');

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 1)
    .toUpperCase() || 'U';

const buildFallbackReferralCode = (value: string) =>
  value
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 12)
    .toUpperCase();

const getAccountData = (me: MeResponse): AccountData => {
  const firstName = me.first_name || '';
  const lastName = me.last_name || '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || '-';
  const referralCode = me.referral_code || buildFallbackReferralCode(me.uid || me.id || '');

  return {
    name,
    email: me.email || '',
    phone: me.phone || '',
    address: joinAddress([
      me.address_line1 || '',
      me.address_line2 || '',
      me.city || '',
      me.state_province || '',
      me.zip_code || '',
      me.country || '',
    ]),
    joinedDate: formatGmtDate(me.created_at || ''),
    accountId: me.uid || me.id || '',
    referralLink:
      typeof me.referral_link === 'string'
        ? me.referral_link
        : referralCode
          ? `${window.location.origin}/signup?ref=${referralCode}`
          : '',
    referralCode,
    totalReferrals: me.total_referrals || 0,
    referrerCode: me.referrer_code || '',
    avatar_url: me.avatar_url || '',
  };
};

const displayValue = (value: string) => value || '-';

export function MyAccountPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { T } = useLocale();
  const text = T.myAccount;
  const demoServer = 'MexnLimited-Demo';
  const { data: me, error: meError, isLoading: isLoadingAccount } = useMeQuery();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastTitle, setToastTitle] = useState(text.copiedSuccessTitle);
  const [toastMessage, setToastMessage] = useState(text.copiedSuccessMessage);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [hasAvatarImageError, setHasAvatarImageError] = useState(false);
  const accountData = useMemo(() => (me ? getAccountData(me) : emptyAccountData), [me]);
  const shouldShowAvatarImage = !!accountData.avatar_url && !hasAvatarImageError;
  const isKycApproved = me?.kyc_status === 'APPROVED';

  const [isCreateDemoModalOpen, setIsCreateDemoModalOpen] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState<Record<string, boolean>>({});
  const [demoFormData, setDemoFormData] = useState({
    platform: 'MT4',
    balance: '50000',
    leverage: '1:100',
  });
  const { data: demoOptions } = useDemoOptionsQuery(isCreateDemoModalOpen);
  const createDemoAccountMutation = useCreateDemoAccountMutation();
  const demoAccountsParams = useMemo(
    () =>
      ({
        tier: 'DEMO' as const,
        page: 1,
        size: 20,
      }) as const,
    [],
  );
  const { data: demoAccountsResponse } = useAccountsQuery(demoAccountsParams);
  const demoAccounts = useMemo(
    () =>
      (demoAccountsResponse?.items ?? []).map((item, index) => ({
        id: String(item.account_id ?? item.mt4_login ?? index + 1),
        type: 'MT4',
        account: String(item.mt4_login ?? '-'),
        password: item.mt4_password ?? '-',
        leverage: typeof item.leverage_override === 'number' ? `1:${item.leverage_override}` : '-',
        balance: item.balance ?? item.capital ?? 0,
      })),
    [demoAccountsResponse],
  );

  const handleCopy = async (copyText: string, fieldName: string) => {
    if (!copyText) {
      return;
    }

    try {
      // Use textarea fallback method as primary approach (works in more contexts)
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        textArea.remove();

        if (successful) {
          setCopiedField(fieldName);
          setToastType('success');
          setToastTitle(text.copiedSuccessTitle);
          setToastMessage(text.copiedSuccessMessage);
          setShowToast(true);

          setTimeout(() => {
            setCopiedField(null);
          }, 2000);
        }
      } catch (err) {
        textArea.remove();
        console.error('Failed to copy:', err);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard', error);
    }
  };

  useEffect(() => {
    if (!meError) {
      return;
    }

    if (axios.isAxiosError(meError) && meError.response?.status === 401) {
      navigate('/login', { replace: true });
      return;
    }

    setToastType('error');
    setToastTitle(text.errorTitle);
    setToastMessage(text.accountLoadFailed);
    setShowToast(true);
  }, [meError, navigate, text.accountLoadFailed, text.errorTitle]);

  useEffect(() => {
    setHasAvatarImageError(false);
  }, [accountData.avatar_url]);

  const handleCreateDemoAccount = () => {
    if (createDemoAccountMutation.isPending) {
      return;
    }

    if (!hasRequiredProfileName(me)) {
      setToastType('error');
      setToastTitle(text.requestFailed);
      setToastMessage(text.profileNameRequired);
      setShowToast(true);
      return;
    }

    const leverage = Number(demoFormData.leverage.replace('1:', ''));
    const capital = Number(demoFormData.balance);

    createDemoAccountMutation.mutate(
      {
        product_id: 'DEMO_STD',
        capital,
        leverage,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: accountsQueryKeys.list(demoAccountsParams),
          });
          void queryClient.refetchQueries({
            queryKey: accountsQueryKeys.list(demoAccountsParams),
          });
          setIsCreateDemoModalOpen(false);
          setDemoFormData({
            platform: 'MT4',
            balance: String(demoOptions?.default_capital ?? 10000),
            leverage: `1:${demoOptions?.default_leverage ?? 100}`,
          });
          setToastType('success');
          setToastTitle(text.successTitle);
          setToastMessage(text.demoAccountCreated);
          setShowToast(true);
        },
        onError: (error) => {
          const message = getApiErrorMessage(error, text.demoAccountCreateFailed);
          setToastType('error');
          setToastTitle(text.errorTitle);
          setToastMessage(message);
          setShowToast(true);
        },
      },
    );
  };

  useEffect(() => {
    if (!isCreateDemoModalOpen || !demoOptions) {
      return;
    }

    setDemoFormData((prev) => ({
      ...prev,
      balance: String(demoOptions.default_capital),
      leverage: `1:${demoOptions.default_leverage}`,
    }));
  }, [isCreateDemoModalOpen, demoOptions]);

  const toggleDemoPassword = (accountId: string) => {
    setShowDemoPassword((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  return (
    <>
      {/* Toast Notification */}
      <Toast
        type={toastType}
        title={toastTitle}
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2000}
        position="top"
      />

      <div className="p-8 max-w-7xl mx-auto">
        {/* Account Information Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-8 mb-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl text-white font-medium mb-2">{text.accountInformation}</h2>
              <p className="text-gray-400 text-sm">{text.accountInformationSub}</p>
            </div>
            <button
              onClick={() => setIsEditProfileModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0052FF] text-white rounded-lg hover:bg-[#0052FF]/90 transition-colors"
            >
              <Edit size={18} />
              <span className="text-sm font-medium">{text.editProfile}</span>
            </button>
          </div>

          {isLoadingAccount ? (
            <p className="text-gray-400 text-sm mb-6">{text.loadingAccountInformation}</p>
          ) : null}

          {/* Profile Section */}
          <div className="flex items-start gap-6 mb-8 pb-8 border-b border-[#1a1a24]">
            {isLoadingAccount ? (
              <div className="w-24 h-24 rounded-full bg-[#1a1a24] animate-pulse flex-shrink-0" />
            ) : shouldShowAvatarImage ? (
              <img
                src={accountData.avatar_url}
                alt={accountData.name}
                onError={() => setHasAvatarImageError(true)}
                className="w-24 h-24 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0052FF] to-[#00FF94] flex items-center justify-center text-white text-3xl font-medium flex-shrink-0">
                {getInitials(accountData.name)}
              </div>
            )}
            <div className="flex-1 flex flex-col justify-center">
              <h3 className="text-xl text-white font-medium mb-3">
                {displayValue(accountData.name)}
              </h3>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg w-fit ${
                  isKycApproved
                    ? 'bg-[#00FF94]/10 border-[#00FF94]/30'
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isKycApproved ? 'bg-[#00FF94]' : 'bg-gray-500'
                  }`}
                ></span>
                <span
                  className={`text-sm font-medium ${
                    isKycApproved ? 'text-[#00FF94]' : 'text-gray-500'
                  }`}
                >
                  {isKycApproved ? text.verifiedAccount : text.unverifiedAccount}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.fullName}</p>
                <p className="text-white text-sm font-medium">{displayValue(accountData.name)}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                <Mail size={20} className="text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.emailAddress}</p>
                <p className="text-white text-sm font-medium">{displayValue(accountData.email)}</p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                <Phone size={20} className="text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.phoneNumber}</p>
                <p className="text-white text-sm font-medium">{displayValue(accountData.phone)}</p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                <MapPin size={20} className="text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.address}</p>
                <p className="text-white text-sm font-medium">
                  {displayValue(accountData.address)}
                </p>
              </div>
            </div>

            {/* Account ID */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#00FF94]/10 flex items-center justify-center flex-shrink-0">
                <Calendar size={20} className="text-[#00FF94]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.accountId}</p>
                <p className="text-white text-sm font-medium font-mono">
                  {displayValue(accountData.accountId)}
                </p>
              </div>
            </div>

            {/* Referrer Code */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.referrerCode}</p>
                <p className="text-white text-sm font-medium font-mono">
                  {accountData.referrerCode}
                </p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#00FF94]/10 flex items-center justify-center flex-shrink-0">
                <Calendar size={20} className="text-[#00FF94]" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs mb-1">{text.memberSince}</p>
                <p className="text-white text-sm font-medium">
                  {displayValue(accountData.joinedDate)}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Trading Account Information Section
            Live 계정 생성을 더 이상 지원하지 않아 일단 숨김 처리. 추후 다시 표시할 수 있으므로 삭제하지 않는다.
        <TradingAccountSection />
        */}

        {/* Demo Accounts Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-8 mt-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl text-white font-medium mb-2">{text.demoAccounts}</h2>
              <p className="text-gray-400 text-sm">{text.demoAccountsSub}</p>
              <p className="text-gray-500 text-xs mt-2">{text.demoAccountsLimit}</p>
            </div>
            <button
              onClick={() => demoAccounts.length < 10 && setIsCreateDemoModalOpen(true)}
              disabled={demoAccounts.length >= 10}
              title={demoAccounts.length >= 10 ? text.demoMaxReached : ''}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                demoAccounts.length >= 10
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-[#00FF94] text-[#0a0a0f] hover:bg-[#00FF94]/90'
              }`}
            >
              <Plus size={18} />
              <span>{text.createDemoAccount}</span>
            </button>
          </div>

          {/* Demo Accounts Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-[#1a1a24] lg:block">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1a1a24]">
                  <th className="text-left py-4 px-6 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {text.colType}
                  </th>
                  <th className="text-left py-4 px-6 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {text.colAccount}
                  </th>
                  <th className="text-left py-4 px-6 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {text.colPassword}
                  </th>
                  <th className="text-left py-4 px-6 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {text.colLeverage}
                  </th>
                  <th className="text-right py-4 px-6 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {text.colBalance}
                  </th>
                  <th className="text-left py-4 px-6 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {text.colServer}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a24]">
                {demoAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-[#1a1a24]/50 transition-colors">
                    <td className="py-5 px-6">
                      <span className="inline-flex items-center px-3 py-1.5 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-lg text-[#0052FF] text-sm font-semibold">
                        {account.type}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-mono">{account.account}</span>
                        <button
                          onClick={() => handleCopy(account.account, `Account-${account.id}`)}
                          className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group"
                          title={text.copyAccount}
                        >
                          {copiedField === `Account-${account.id}` ? (
                            <Check size={14} className="text-[#00FF94]" />
                          ) : (
                            <Copy
                              size={14}
                              className="text-gray-400 group-hover:text-white transition-colors"
                            />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-mono">
                          {showDemoPassword[account.id] ? account.password : '••••••••••'}
                        </span>
                        <button
                          onClick={() => toggleDemoPassword(account.id)}
                          className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group"
                          title={
                            showDemoPassword[account.id] ? text.hidePassword : text.showPassword
                          }
                        >
                          {showDemoPassword[account.id] ? (
                            <EyeOff
                              size={14}
                              className="text-gray-400 group-hover:text-white transition-colors"
                            />
                          ) : (
                            <Eye
                              size={14}
                              className="text-gray-400 group-hover:text-white transition-colors"
                            />
                          )}
                        </button>
                        <button
                          onClick={() => handleCopy(account.password, `Password-${account.id}`)}
                          className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group"
                          title={text.copyPassword}
                        >
                          {copiedField === `Password-${account.id}` ? (
                            <Check size={14} className="text-[#00FF94]" />
                          ) : (
                            <Copy
                              size={14}
                              className="text-gray-400 group-hover:text-white transition-colors"
                            />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-white text-sm">{account.leverage}</span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <span className="text-white text-sm font-semibold">
                        $
                        {account.balance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-mono whitespace-nowrap">
                          {demoServer}
                        </span>
                        <button
                          onClick={() => handleCopy(demoServer, `Server-${account.id}`)}
                          className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group shrink-0"
                          title={text.copyServer}
                        >
                          {copiedField === `Server-${account.id}` ? (
                            <Check size={14} className="text-[#00FF94]" />
                          ) : (
                            <Copy
                              size={14}
                              className="text-gray-400 group-hover:text-white transition-colors"
                            />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Demo Accounts Cards */}
          <div className="mt-4 space-y-4 lg:hidden">
            {demoAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-xl border border-[#1a1a24] bg-[#0f0f17] p-4 shadow-lg shadow-black/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="inline-flex items-center px-3 py-1.5 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-lg text-[#0052FF] text-xs font-semibold">
                      {account.type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{text.colAccount}</span>
                      <span className="text-white text-sm font-mono">{account.account}</span>
                      <button
                        onClick={() => handleCopy(account.account, `Account-${account.id}`)}
                        className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group"
                        title={text.copyAccount}
                      >
                        {copiedField === `Account-${account.id}` ? (
                          <Check size={14} className="text-[#00FF94]" />
                        ) : (
                          <Copy
                            size={14}
                            className="text-gray-400 group-hover:text-white transition-colors"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-[#1a1a24]/70 p-3">
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">
                      {text.colPassword}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">
                        {showDemoPassword[account.id] ? account.password : '••••••••••'}
                      </span>
                      <button
                        onClick={() => toggleDemoPassword(account.id)}
                        className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group"
                        title={showDemoPassword[account.id] ? text.hidePassword : text.showPassword}
                      >
                        {showDemoPassword[account.id] ? (
                          <EyeOff
                            size={14}
                            className="text-gray-400 group-hover:text-white transition-colors"
                          />
                        ) : (
                          <Eye
                            size={14}
                            className="text-gray-400 group-hover:text-white transition-colors"
                          />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(account.password, `Password-${account.id}`)}
                        className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group"
                        title={text.copyPassword}
                      >
                        {copiedField === `Password-${account.id}` ? (
                          <Check size={14} className="text-[#00FF94]" />
                        ) : (
                          <Copy
                            size={14}
                            className="text-gray-400 group-hover:text-white transition-colors"
                          />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#1a1a24]/70 p-3">
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">
                      {text.colLeverage}
                    </p>
                    <p className="text-white text-sm">{account.leverage}</p>
                  </div>

                  <div className="rounded-lg bg-[#1a1a24]/70 p-3">
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">
                      {text.colBalance}
                    </p>
                    <p className="text-white text-sm font-semibold">
                      $
                      {account.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#1a1a24]/70 p-3">
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider mb-1">
                      {text.colServer}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm truncate">{demoServer}</span>
                      <button
                        onClick={() => handleCopy(demoServer, `Server-${account.id}`)}
                        className="p-1.5 hover:bg-[#1a1a24] rounded transition-colors group shrink-0"
                        title={text.copyServer}
                      >
                        {copiedField === `Server-${account.id}` ? (
                          <Check size={14} className="text-[#00FF94]" />
                        ) : (
                          <Copy
                            size={14}
                            className="text-gray-400 group-hover:text-white transition-colors"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Create Demo Account Modal */}
        <AnimatePresence>
          {isCreateDemoModalOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={() => setIsCreateDemoModalOpen(false)}
              />

              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl shadow-black/50 max-w-md w-full">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-8 py-6 border-b border-[#1a1a24] bg-gradient-to-r from-[#0f0f17] to-[#12121a]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00FF94] to-[#00CC75] flex items-center justify-center">
                        <Plus size={20} className="text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl text-white font-medium">
                          {text.createNewDemoAccount}
                        </h2>
                        <p className="text-gray-400 text-sm mt-0.5">
                          {text.createNewDemoAccountSub}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsCreateDemoModalOpen(false)}
                      className="w-10 h-10 rounded-lg bg-[#1a1a24] hover:bg-[#2a2a3a] flex items-center justify-center text-gray-400 hover:text-white transition-all group"
                      aria-label={text.closeModal}
                    >
                      <X
                        size={20}
                        className="group-hover:rotate-90 transition-transform duration-300"
                      />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-8 space-y-6">
                    {/* Platform/Type (Fixed) */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-2 font-medium">
                        {text.platformType}
                      </label>
                      <div className="w-full bg-[#16161f] border border-[#1a1a24] rounded-lg px-4 py-3 text-gray-300 text-sm cursor-not-allowed">
                        MetaTrader 4 (MT4)
                      </div>
                    </div>

                    {/* Initial Balance */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-2 font-medium">
                        {text.initialBalance}
                      </label>
                      <select
                        value={demoFormData.balance}
                        onChange={(e) =>
                          setDemoFormData({ ...demoFormData, balance: e.target.value })
                        }
                        className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                      >
                        {(
                          demoOptions?.allowed_capitals ?? [10000, 25000, 50000, 100000, 200000]
                        ).map((capital) => (
                          <option key={capital} value={String(capital)}>
                            ${capital.toLocaleString('en-US')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Leverage Selection */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-2 font-medium">
                        {text.leverageLabel}
                      </label>
                      <select
                        value={demoFormData.leverage}
                        onChange={(e) =>
                          setDemoFormData({ ...demoFormData, leverage: e.target.value })
                        }
                        className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                      >
                        {(demoOptions?.allowed_leverages ?? [50, 100, 200]).map((leverage) => (
                          <option key={leverage} value={`1:${leverage}`}>
                            1:{leverage}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Info Box */}
                    <div className="p-4 bg-gradient-to-r from-[#0052FF]/10 to-[#00FF94]/10 border border-[#0052FF]/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle size={14} className="text-white" />
                        </div>
                        <div>
                          <h4 className="text-white text-sm font-medium mb-1">
                            {text.demoAccountBenefitsTitle}
                          </h4>
                          <p className="text-gray-400 text-xs leading-relaxed">
                            {text.demoAccountBenefitsBody}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-8 py-6 border-t border-[#1a1a24] bg-gradient-to-r from-[#0f0f17] to-[#12121a] flex justify-end gap-3">
                    <button
                      onClick={() => setIsCreateDemoModalOpen(false)}
                      className="px-6 py-2.5 bg-[#1a1a24] text-gray-400 rounded-lg hover:bg-[#2a2a3a] hover:text-white transition-colors font-medium"
                    >
                      {text.cancel}
                    </button>
                    <button
                      onClick={handleCreateDemoAccount}
                      disabled={createDemoAccountMutation.isPending}
                      className="px-6 py-2.5 bg-[#00FF94] text-[#0a0a0f] rounded-lg hover:bg-[#00FF94]/90 transition-colors font-medium flex items-center gap-2"
                    >
                      <Plus size={18} />
                      <span>
                        {createDemoAccountMutation.isPending ? text.creating : text.createAccount}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
      />
    </>
  );
}
