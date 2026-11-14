import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMeQuery,
  useUpdateProfileMutation,
  useWithdrawAccountMutation,
} from '@/app/queries/profile';
import { getApiErrorMessage } from '@/app/queries/errors';
import { Edit, User, Mail, Phone, MapPin, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Toast } from '../../components/shared/Toast';
import { type MeResponse, type UpdateProfileRequest } from '@/api/user';
import { useLocale } from '@/app/i18n/LocaleContext';
import { clearAccessToken } from '@/app/utils/auth/tokenStore';

type ProfileFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  stateProvince: string;
  zipCode: string;
  addressLine1: string;
  addressLine2: string;
  referrerCode: string;
};

const getProfileFormData = (me: MeResponse): ProfileFormData => {
  return {
    firstName: me.first_name || '',
    lastName: me.last_name || '',
    email: me.email || '',
    phone: me.phone || '',
    country: me.country || '',
    city: me.city || '',
    stateProvince: me.state_province || '',
    zipCode: me.zip_code || '',
    addressLine1: me.address_line1 || '',
    addressLine2: me.address_line2 || '',
    referrerCode: me.referrer_code || '',
  };
};

const getRegistrationDate = (me?: MeResponse) => {
  const value = me?.registration_date || me?.created_at;

  if (!value) {
    return '';
  }

  return value.split('T')[0];
};

const getUpdateProfilePayload = (
  formData: ProfileFormData,
  // 현재 프로필 수정 화면에서는 avatar_url을 수정하지 않음.
  // avatarUrl: string,
  currentReferrerCode: string,
): UpdateProfileRequest => {
  const payload: UpdateProfileRequest = {
    first_name: formData.firstName.trim(),
    last_name: formData.lastName.trim(),
    country: formData.country.trim(),
    city: formData.city.trim(),
    state_province: formData.stateProvince.trim(),
    address_line1: formData.addressLine1.trim(),
    address_line2: formData.addressLine2.trim(),
    zip_code: formData.zipCode.trim(),
    phone: formData.phone.trim(),
    // 현재 사용 안함: 프로필 수정 시 기존 Google avatar_url을 덮어쓰지 않도록 전송하지 않음.
    // avatar_url: avatarUrl,
  };
  const nextReferrerCode = formData.referrerCode.trim();

  if (!currentReferrerCode && nextReferrerCode) {
    payload.referrer_code = nextReferrerCode;
  }

  return payload;
};

type EditProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { T } = useLocale();
  const text = T.myAccount;
  const { data: me, error: meError, isLoading: isLoadingProfile } = useMeQuery();
  const { mutateAsync: saveProfile, isPending: isSavingProfile } = useUpdateProfileMutation();
  const { mutateAsync: withdrawAccount, isPending: isWithdrawingAccount } =
    useWithdrawAccountMutation();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Deactivation modal states
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deactivateButtonEnabled, setDeactivateButtonEnabled] = useState(false);

  // Profile form state
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    stateProvince: '',
    zipCode: '',
    addressLine1: '',
    addressLine2: '',
    referrerCode: '',
  });
  const [savedReferrerCode, setSavedReferrerCode] = useState('');
  const hasSavedReferrerCode = !!savedReferrerCode;

  useEffect(() => {
    if (!isOpen || !me) {
      return;
    }

    setFormData(getProfileFormData(me));
    setSavedReferrerCode(me.referrer_code || '');
  }, [isOpen, me]);

  useEffect(() => {
    if (!meError) {
      return;
    }

    if (axios.isAxiosError(meError) && meError.response?.status === 401) {
      navigate('/login', { replace: true });
      return;
    }

    setToastType('error');
    setToastMessage(text.profileLoadFailed);
    setShowToast(true);
  }, [meError, navigate, text.profileLoadFailed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    if (isSavingProfile) {
      return;
    }

    try {
      const updatedProfile = await saveProfile(
        getUpdateProfilePayload(
          formData,
          // 현재 사용 안함: avatar_url은 표시용으로만 사용하고 프로필 수정 payload에서는 제외.
          // me?.avatar_url || '',
          savedReferrerCode,
        ),
      );

      setFormData(getProfileFormData(updatedProfile));
      setSavedReferrerCode(updatedProfile.referrer_code || '');
      setToastType('success');
      setToastMessage(text.profileUpdated);
      setShowToast(true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      const message = getApiErrorMessage(error, text.profileUpdateFailed);

      setToastType('error');
      setToastMessage(message);
      setShowToast(true);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const moveToLoginAfterWithdrawal = () => {
    clearAccessToken();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  const handleDeactivate = async () => {
    if (!deactivateButtonEnabled || isWithdrawingAccount) {
      return;
    }

    try {
      await withdrawAccount();

      setDeactivateButtonEnabled(false);
      setShowDeactivateModal(false);
      setShowSuccessModal(true);

      setTimeout(() => {
        moveToLoginAfterWithdrawal();
      }, 2000);
    } catch (error) {
      const message = getApiErrorMessage(error, text.requestFailed);

      setToastType('error');
      setToastMessage(message);
      setShowToast(true);
    }
  };

  const handleOpenDeactivateModal = () => {
    setShowDeactivateModal(true);
    setDeactivateButtonEnabled(false);

    setTimeout(() => {
      setDeactivateButtonEnabled(true);
    }, 1000);
  };

  return (
    <>
      {/* Toast Notification */}
      <Toast
        type={toastType}
        title={toastType === 'success' ? text.successTitle : text.errorTitle}
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2000}
        position="top"
      />

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={handleCancel}
            />

            {/* Edit Profile Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl shadow-black/50 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 flex items-center justify-between px-8 py-6 border-b border-[#1a1a24] bg-gradient-to-r from-[#0f0f17] to-[#12121a] z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0052FF] to-[#0041CC] flex items-center justify-center">
                      <Edit size={20} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl text-white font-medium">{text.editProfileTitle}</h2>
                      <p className="text-gray-400 text-sm mt-0.5">{text.editProfileSub}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancel}
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
                <div className="p-8 space-y-8">
                  {/* Personal Information Section */}
                  <div>
                    <h3 className="text-white text-lg font-medium mb-4 flex items-center gap-2">
                      <User size={18} className="text-[#0052FF]" />
                      {text.personalInformation}
                    </h3>

                    {isLoadingProfile ? (
                      <p className="text-gray-400 text-sm mb-4">
                        {text.loadingProfileInformation}
                      </p>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* First Name */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.firstName}
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.firstNamePlaceholder}
                        />
                      </div>

                      {/* Last Name */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.lastName}
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.lastNamePlaceholder}
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.emailAddress}
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          readOnly
                          className="w-full bg-[#16161f] border border-[#1a1a24] rounded-lg px-4 py-3 text-gray-400 text-sm cursor-not-allowed"
                          placeholder={text.emailPlaceholder}
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.phoneNumber}
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.phonePlaceholder}
                        />
                      </div>

                      {/* Referrer Code */}
                      <div className="md:col-span-2">
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.referrerCode}
                          {hasSavedReferrerCode && (
                            <span className="ml-2 text-xs text-gray-500">
                              {text.cannotBeChanged}
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          name="referrerCode"
                          value={formData.referrerCode}
                          onChange={handleInputChange}
                          readOnly={hasSavedReferrerCode}
                          className={`w-full rounded-lg px-4 py-3 text-sm ${
                            hasSavedReferrerCode
                              ? 'bg-[#16161f] border border-[#1a1a24] text-gray-400 cursor-not-allowed'
                              : 'bg-[#1a1a24] border border-[#2a2a3a] text-white focus:outline-none focus:border-[#0052FF] transition-colors'
                          }`}
                          placeholder={
                            hasSavedReferrerCode
                              ? ''
                              : text.referrerCodePlaceholder
                          }
                          title={
                            hasSavedReferrerCode
                              ? text.referrerCodeLockedTitle
                              : ''
                          }
                        />
                      </div>

                      {/* Registration Date */}
                      <div className="md:col-span-2">
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.registrationDate}
                        </label>
                        <input
                          type="date"
                          value={getRegistrationDate(me)}
                          readOnly
                          className="w-full bg-[#16161f] border border-[#1a1a24] rounded-lg px-4 py-3 text-gray-400 text-sm cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Information Section */}
                  <div className="pt-6 border-t border-[#1a1a24]">
                    <h3 className="text-white text-lg font-medium mb-4 flex items-center gap-2">
                      <MapPin size={18} className="text-[#0052FF]" />
                      {text.addressInformation}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Country */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.country}
                        </label>
                        <input
                          type="text"
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.countryPlaceholder}
                        />
                      </div>

                      {/* City */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.city}
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.cityPlaceholder}
                        />
                      </div>

                      {/* State / Province */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.stateProvince}
                        </label>
                        <input
                          type="text"
                          name="stateProvince"
                          value={formData.stateProvince}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.stateProvincePlaceholder}
                        />
                      </div>

                      {/* Postal Code */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.postalCode}
                        </label>
                        <input
                          type="text"
                          name="zipCode"
                          value={formData.zipCode}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.postalCodePlaceholder}
                        />
                      </div>

                      {/* Main Address */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.mainAddress}
                        </label>
                        <input
                          type="text"
                          name="addressLine1"
                          value={formData.addressLine1}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.mainAddressPlaceholder}
                        />
                      </div>

                      {/* Detailed Address */}
                      <div>
                        <label className="block text-gray-400 text-sm mb-2 font-medium">
                          {text.detailedAddress}
                        </label>
                        <input
                          type="text"
                          name="addressLine2"
                          value={formData.addressLine2}
                          onChange={handleInputChange}
                          className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                          placeholder={text.detailedAddressPlaceholder}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 px-8 py-6 border-t border-[#1a1a24] bg-gradient-to-r from-[#0f0f17] to-[#12121a] flex justify-end gap-3">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-2.5 bg-[#1a1a24] text-gray-400 rounded-lg hover:bg-[#2a2a3a] hover:text-white transition-colors font-medium"
                  >
                    {text.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoadingProfile || isSavingProfile}
                    className="px-6 py-2.5 bg-[#0052FF] text-white rounded-lg hover:bg-[#0052FF]/90 transition-colors font-medium flex items-center gap-2"
                  >
                    <CheckCircle size={18} />
                    <span>{isSavingProfile ? text.saving : text.updateProfile}</span>
                  </button>
                </div>

                {/* Deactivate Account Section */}
                <div className="px-8 py-6 border-t border-red-500/20 bg-gradient-to-r from-red-500/5 to-red-600/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-red-400 font-medium mb-1">{text.deactivateAccount}</h4>
                      <p className="text-gray-400 text-sm">{text.deactivateAccountDesc}</p>
                    </div>
                    <button
                      onClick={handleOpenDeactivateModal}
                      className="px-6 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                    >
                      <AlertCircle size={18} />
                      <span>{text.deactivateAccountBtn}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Deactivate Account Confirmation Modal */}
      <AnimatePresence>
        {showDeactivateModal && (
          <>
            {/* Deactivate Confirmation Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
              onClick={() => setShowDeactivateModal(false)}
            />

            {/* Deactivate Confirmation Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#0f0f17] border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/20 max-w-md w-full">
                {/* Confirmation Header */}
                <div className="px-8 py-6 border-b border-red-500/20 bg-gradient-to-r from-red-500/10 to-red-600/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                      <AlertCircle size={24} className="text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-xl text-white font-medium">{text.areYouSure}</h2>
                      <p className="text-gray-400 text-sm mt-0.5">
                        {text.actionCannotBeUndone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirmation Body */}
                <div className="p-8">
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    {text.deactivateConfirmQuestion}
                  </p>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-300 text-sm leading-relaxed">
                      {text.deactivateDataWarning}
                    </p>
                  </div>
                </div>

                {/* Confirmation Footer */}
                <div className="px-8 py-6 border-t border-red-500/20 bg-gradient-to-r from-[#0f0f17] to-[#12121a] flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeactivateModal(false)}
                    className="px-6 py-2.5 bg-[#1a1a24] text-gray-300 rounded-lg hover:bg-[#2a2a3a] hover:text-white transition-colors font-medium"
                  >
                    {text.keepMyAccount}
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={!deactivateButtonEnabled || isWithdrawingAccount}
                    className="px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <AlertCircle size={18} />
                    <span>{text.yesDeactivate}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessModal && (
          <>
            {/* Success Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />

            {/* Success Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            >
              <div className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl shadow-black/50 max-w-lg w-full overflow-hidden">
                <div className="px-8 py-6 border-b border-[#1a1a24] bg-gradient-to-r from-[#00FF94]/10 to-[#0052FF]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#00FF94]/20 border border-[#00FF94]/30 flex items-center justify-center">
                      <CheckCircle size={24} className="text-[#00FF94]" />
                    </div>
                    <div>
                      <h2 className="text-2xl text-white font-bold">
                        {text.accountDeactivatedTitle}
                      </h2>
                      <p className="text-gray-400 text-sm mt-0.5">
                        {text.accountDeactivatedSub}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  <p className="text-gray-300 text-base leading-relaxed mb-6">
                    {text.accountDeactivatedBody}
                  </p>

                  <p className="text-gray-400 text-sm mb-6">
                    {text.redirectingToLogin}
                  </p>

                  <button
                    onClick={moveToLoginAfterWithdrawal}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0052FF] text-white rounded-xl hover:bg-[#0052FF]/90 transition-all shadow-xl hover:shadow-2xl hover:shadow-[#0052FF]/30 font-semibold group"
                  >
                    <CheckCircle size={18} className="group-hover:scale-110 transition-transform" />
                    <span>{text.goToLogin}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function EditProfilePage() {
  const navigate = useNavigate();

  return <EditProfileModal isOpen={true} onClose={() => navigate('/my-page/my-account')} />;
}
