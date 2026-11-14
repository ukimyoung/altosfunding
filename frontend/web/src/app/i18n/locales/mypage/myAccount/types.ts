export interface MyAccountTranslations {
  // Page header (topBar subtitle)
  pageSubtitle: string;

  // Account Information card
  accountInformation: string;
  accountInformationSub: string;
  editProfile: string;
  loadingAccountInformation: string;
  loadingProfileInformation: string;
  verifiedAccount: string;
  unverifiedAccount: string;
  fullName: string;
  emailAddress: string;
  phoneNumber: string;
  address: string;
  accountId: string;
  referrerCode: string;
  memberSince: string;

  // Trading Account Information card
  tradingAccountInformation: string;
  tradingAccountSubPrefix: string;
  tradingAccountSub: string;           // "Manage your MT4 trading [LIVE] account credentials"
  accountActive: string;
  accountPending: string;
  accountInactive: string;
  accountStatusUnknown: string;
  accountStatusTemplate: string;
  mt4AccountId: string;
  mt4Password: string;
  mt4Server: string;
  needToUpdatePassword: string;
  changePassword: string;
  cancelChangePassword: string;
  changeMt4Password: string;
  newPassword: string;
  newPasswordPlaceholder: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  passwordRequirementsTitle: string;
  pwReqLength: string;
  pwReqNumber: string;
  pwReqSymbol: string;
  pwReqCase: string;
  updatePassword: string;
  updating: string;
  // Password strength labels
  strengthWeak: string;
  strengthMedium: string;
  strengthStrong: string;
  // Password validation errors
  errorPasswordLength: string;
  errorPasswordFormat: string;
  errorPasswordMatch: string;
  liveAccountIdMissing: string;
  tradingPasswordUpdated: string;
  tradingPasswordUpdateFailed: string;
  // No-account empty state
  noTradingAccountYet: string;
  noTradingAccountDescPrefix: string;
  noTradingAccountDesc: string;      // "Create your MT4 trading [LIVE] account to start trading…"
  tradingAccountCreationLive: string;
  creatingAccount: string;
  // Success modal
  tradingAccountCreatedTitle: string;
  tradingAccountCreatedBody: string;
  confirm: string;

  // Demo Accounts card
  demoAccounts: string;
  demoAccountsSub: string;
  demoAccountsLimit: string;
  createDemoAccount: string;
  demoMaxReached: string;
  colType: string;
  colAccount: string;
  colPassword: string;
  colLeverage: string;
  colBalance: string;
  colServer: string;
  colActions: string;
  copyAccount: string;
  copyPassword: string;
  copyServer: string;
  showPassword: string;
  hidePassword: string;
  deleteAccount: string;

  // Create Demo Account modal
  createNewDemoAccount: string;
  createNewDemoAccountSub: string;
  closeModal: string;
  platformType: string;
  initialBalance: string;
  leverageLabel: string;
  demoAccountBenefitsTitle: string;
  demoAccountBenefitsBody: string;
  cancel: string;
  createAccount: string;

  // Edit Profile modal
  editProfileTitle: string;
  editProfileSub: string;
  personalInformation: string;
  firstName: string;
  firstNamePlaceholder: string;
  lastName: string;
  lastNamePlaceholder: string;
  cannotBeChanged: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  registrationDate: string;
  addressInformation: string;
  country: string;
  countryPlaceholder: string;
  city: string;
  cityPlaceholder: string;
  stateProvince: string;
  stateProvincePlaceholder: string;
  detailedAddress: string;
  detailedAddressPlaceholder: string;
  mainAddress: string;
  mainAddressPlaceholder: string;
  postalCode: string;
  postalCodePlaceholder: string;
  updateProfile: string;
  saving: string;
  deactivateAccount: string;
  deactivateAccountDesc: string;
  deactivateAccountBtn: string;
  referrerCodePlaceholder: string;
  referrerCodeLockedTitle: string;

  // Deactivate confirmation modal
  areYouSure: string;
  actionCannotBeUndone: string;
  deactivateConfirmQuestion: string;
  deactivateDataWarning: string;
  keepMyAccount: string;
  yesDeactivate: string;
  accountDeactivatedTitle: string;
  accountDeactivatedSub: string;
  accountDeactivatedBody: string;
  redirectingToLogin: string;
  goToLogin: string;

  // Toast messages
  successTitle: string;
  errorTitle: string;
  copiedSuccessTitle: string;
  copiedSuccessMessage: string;
  accountLoadFailed: string;
  profileLoadFailed: string;
  profileUpdated: string;
  profileUpdateFailed: string;
  demoAccountCreated: string;
  demoAccountCreateFailed: string;
  creating: string;
  requestFailed: string;
  profileNameRequired: string;
}
