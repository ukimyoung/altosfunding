import { useState, useEffect, useRef } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  X,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Shield,
  Wallet,
  Trophy,
  Users,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowUp,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { AlphaNavigation } from '../../components/landing/AlphaNavigation';
import { HelpCenterFAQPage } from './HelpCenterFAQPage';
import gettingStartedSignUp from '@/app/assets/help/getting-started-1.png';
import gettingStartedMyAsset from '@/app/assets/help/getting-started-2.png';
import gettingStartedDeposit from '@/app/assets/help/getting-started-3.png';
import gettingStartedChallenge from '@/app/assets/help/getting-started-4.png';
import gettingStartedEmail from '@/app/assets/help/getting-started-5.png';
import gettingStartedAccountDetail from '@/app/assets/help/getting-started-6.png';
import gettingStartedMt4 from '@/app/assets/help/getting-started-7.png';

/* MARKER-MAKE-KIT-INVOKED */

interface Article {
  id: string;
  title: string;
  content: ArticleSection[];
}

interface ArticleSection {
  id: string;
  type:
    | 'h2'
    | 'h3'
    | 'p'
    | 'ul'
    | 'ol'
    | 'notice'
    | 'code'
    | 'tip'
    | 'warning'
    | 'image'
    | 'cta'
    | 'faq'
    | 'table';
  heading?: string;
  text?: string;
  items?: Array<string | { text: string; items: string[] }>;
  columns?: string[];
  rows?: string[][];
  src?: string;
  alt?: string;
  caption?: string;
  narrow?: boolean;
  buttonLabel?: string;
  href?: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  articles: Article[];
  expanded?: boolean;
}

type ArticleFeedback = 'yes' | 'no';

const HELP_FEEDBACK_STORAGE_KEY = 'altos_help_article_feedback';

const ARTICLE_SLUGS: Record<string, string> = {
  'qs-getting-started': 'getting-started',
  'qs-platform-setup': 'platform-setup',
  'qs-first-trade': 'first-trade',
  'rules-challenge': 'challenge-rules',
  'rules-funded': 'funded-rules',
  'rules-account-reset': 'account-reset-retry-policy',
  'acc-kyc': 'kyc-verification',
  'acc-security': 'two-factor-authentication',
  'acc-demo': 'demo-account-usage',
  'acc-lost-mt4-credentials': 'lost-mt4-login-credentials',
  'pay-withdraw': 'how-to-withdraw',
  'pay-internal': 'internal-transfers',
  'pay-withdrawal-processing-time': 'withdrawal-processing-time',
  'pay-usdt-deposit-network-warnings': 'usdt-deposit-network-warnings',
  'ref-overview': 'referral-overview',
  'sup-contact': 'contact-support',
  'sup-faq': 'faq',
};

const ARTICLE_IDS_BY_SLUG = Object.entries(ARTICLE_SLUGS).reduce<Record<string, string>>(
  (acc, [articleId, slug]) => {
    acc[slug] = articleId;
    return acc;
  },
  {},
);

const readStoredArticleFeedback = (): Record<string, ArticleFeedback> => {
  try {
    const stored = window.localStorage.getItem(HELP_FEEDBACK_STORAGE_KEY);

    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, ArticleFeedback>>((acc, [key, value]) => {
      if (value === 'yes' || value === 'no') {
        acc[key] = value;
      }

      return acc;
    }, {});
  } catch {
    return {};
  }
};

const getStoredArticleFeedback = (articleId: string) =>
  readStoredArticleFeedback()[articleId] ?? null;

const storeArticleFeedback = (articleId: string, feedback: ArticleFeedback) => {
  try {
    const next = {
      ...readStoredArticleFeedback(),
      [articleId]: feedback,
    };

    window.localStorage.setItem(HELP_FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Feedback persistence is a UX enhancement, so storage failures should not block the UI.
  }
};

const helpData: Category[] = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    icon: <BookOpen size={16} />,
    articles: [
      {
        id: 'qs-getting-started',
        title: 'Getting Started with Altos Funding',
        content: [
          {
            id: 's1',
            type: 'p',
            text: 'Altos Funding lets you start your trading challenge in just a few steps, with no complicated setup. Follow the guide below — from sign-up to your first trade.',
          },
          { id: 's2', type: 'h2', heading: '1. Create Your Account' },
          {
            id: 's3',
            type: 'p',
            text: 'Go to the Altos Funding login page and click Sign Up. You can register quickly with your Google account, or sign up directly with your email and password.',
          },
          {
            id: 's4',
            type: 'image',
            src: gettingStartedSignUp,
            alt: 'Sign up screen',
            caption: 'altosfunding.com — Sign In / Sign Up',
          },
          {
            id: 's5',
            type: 'notice',
            text: "After signing up, click the verification link in the confirmation email to activate your account. If you don't see it, check your spam folder.",
          },
          { id: 's6', type: 'h2', heading: '2. Deposit USDT' },
          {
            id: 's7',
            type: 'p',
            text: 'Before purchasing a challenge, add funds to your account. Go to My Profile > My Asset and click the Deposit button on the Total Asset card.',
          },
          {
            id: 's8',
            type: 'image',
            src: gettingStartedMyAsset,
            alt: 'My Asset page',
            caption: 'Dashboard — My Asset',
          },
          {
            id: 's9',
            type: 'p',
            text: 'In the Deposit window: 1) enter the amount (min 10 USDT), 2) select the network (e.g. TRC-20), 3) send USDT to the address shown, then 4) paste your Transaction ID (TxID) and click Deposit.',
          },
          {
            id: 's10',
            type: 'image',
            src: gettingStartedDeposit,
            alt: 'Deposit modal',
            caption: 'Dashboard — Deposit USDT',
            narrow: true,
          },
          {
            id: 's11',
            type: 'warning',
            text: 'Only send USDT via the selected network. Using the wrong network may result in permanent loss. Deposits are credited after network confirmations.',
          },
          { id: 's12', type: 'h2', heading: '3. Purchase a Challenge' },
          {
            id: 's13',
            type: 'p',
            text: 'Click Start New Challenge in the dashboard sidebar, then choose your account type: Starter ($100), Professional ($300), or Elite ($500). Pay with your USDT balance.',
          },
          {
            id: 's14',
            type: 'image',
            src: gettingStartedChallenge,
            alt: 'Challenge selection',
            caption: 'Dashboard — Start New Challenge',
          },
          { id: 's15', type: 'h2', heading: '4. Receive Your MT4 Credentials' },
          {
            id: 's16',
            type: 'p',
            text: 'Once your purchase is complete, your MT4 login credentials are sent to your email, including login, password, server, and challenge start/end times.',
          },
          {
            id: 's17',
            type: 'image',
            src: gettingStartedEmail,
            alt: 'Account email',
            caption: 'Email — Your Challenge Account is Ready',
            narrow: true,
          },
          {
            id: 's18',
            type: 'p',
            text: 'You can also view account details anytime from the Challenge menu in your dashboard.',
          },
          {
            id: 's19',
            type: 'image',
            src: gettingStartedAccountDetail,
            alt: 'Account detail',
            caption: 'Dashboard — Account Detail',
            narrow: true,
          },
          {
            id: 's20',
            type: 'notice',
            text: 'Check your Challenge Start time. Trading is only available after the start time, and you must reach your target before the end time.',
          },
          { id: 's21', type: 'h2', heading: '5. Install & Log In to MT4' },
          {
            id: 's22',
            type: 'p',
            text: 'Download MetaTrader 4 from Download Platform in the sidebar. Launch MT4, select the Altos server, and enter your login and password to connect.',
          },
          {
            id: 's23',
            type: 'tip',
            text: "Once your balance appears under the Trade tab at the bottom of MT4, you're connected.",
          },
          { id: 's24', type: 'h2', heading: '6. Place Your First Trade' },
          {
            id: 's25',
            type: 'p',
            text: 'Before placing an order, review your challenge rules (profit target and max drawdown). Select a symbol from Market Watch, then use New Order or one-click trading to Buy or Sell.',
          },
          {
            id: 's26',
            type: 'image',
            src: gettingStartedMt4,
            alt: 'MT4 terminal',
            caption: 'MetaTrader 4 — Trading Terminal',
          },
          {
            id: 's27',
            type: 'warning',
            text: 'Holding a position overnight may incur a rollover (swap) fee. Positions held over Wednesday are charged a triple (3-day) swap.',
          },
          { id: 's28', type: 'h2', heading: 'Frequently Asked Questions' },
          {
            id: 's29',
            type: 'faq',
            heading: 'What happens if I fail the challenge?',
            text: 'If you breach a challenge rule, that account is closed. You can purchase a new challenge and try again anytime.',
          },
          {
            id: 's30',
            type: 'faq',
            heading: "My deposit hasn't arrived yet.",
            text: 'Deposits are credited after the network confirms your transaction. Make sure you used the correct network and TxID.',
          },
          {
            id: 's31',
            type: 'faq',
            heading: "I didn't receive my account email.",
            text: "First, check your spam folder. If you still can't find it, you can view your account details directly from the Challenge menu in your dashboard.",
          },
          {
            id: 's32',
            type: 'faq',
            heading: 'I forgot my MT4 password.',
            text: 'Find your account number and password again in the Account Detail view under the Challenge menu.',
          },
          {
            id: 's33',
            type: 'faq',
            heading: 'Do I pass immediately when I hit the profit target?',
            text: 'Once you reach the profit target, your account is automatically reviewed after the challenge end time. Based on the result, you advance to the next stage or your funded account.',
          },
          {
            id: 's34',
            type: 'cta',
            heading: 'Ready to begin?',
            text: 'Start your trading challenge with Altos Funding today.',
            buttonLabel: 'Start New Challenge',
            href: '/my-page/start-new-challenge',
          },
        ],
      },
      {
        id: 'qs-platform-setup',
        title: 'Setting Up Your Trading Platform',
        content: [
          { id: 's1', type: 'h2', heading: 'Supported Platforms' },
          {
            id: 's2',
            type: 'p',
            text: 'Altos Funding exclusively supports MetaTrader 4 (MT4). MT4 is an industry-standard platform offering advanced charting, automated trading via Expert Advisors, and institutional-grade execution.',
          },
          { id: 's3', type: 'h2', heading: 'Downloading MT4' },
          {
            id: 's4',
            type: 'ol',
            items: [
              'Visit the Download Platform section in your dashboard.',
              'Select your operating system (Windows, macOS, iOS, Android).',
              'Install the platform using the provided installer.',
              'Use the credentials sent to your registered email to log in.',
            ],
          },
          { id: 's5', type: 'h2', heading: 'Connecting to Our Server' },
          {
            id: 's6',
            type: 'code',
            text: 'Server: AltosFunding-Live\nLogin: [Your Account Number]\nPassword: [Your MT4 Password]',
          },
          {
            id: 's7',
            type: 'warning',
            text: 'Never share your MT4 credentials with anyone. Altos Funding support staff will never ask for your password.',
          },
          { id: 's8', type: 'h2', heading: 'Account Credentials' },
          {
            id: 's9',
            type: 'p',
            text: 'Your MT4 login credentials are separate from your Altos Funding dashboard credentials. MT4 credentials are sent via email after your account is approved. You can reset your MT4 password from within the dashboard at any time.',
          },
        ],
      },
      {
        id: 'qs-first-trade',
        title: 'Placing Your First Trade',
        content: [
          { id: 's1', type: 'h2', heading: 'Before You Trade' },
          {
            id: 's2',
            type: 'p',
            text: 'Before placing your first trade, make sure you have reviewed all trading rules for your account stage. Rules differ between the Challenge Stage and the Funded Stage.',
          },
          {
            id: 's3',
            type: 'notice',
            text: 'You must understand and agree to all trading rules before executing any live trades.',
          },
          { id: 's4', type: 'h2', heading: 'Placing a Market Order' },
          {
            id: 's5',
            type: 'ol',
            items: [
              'Open the Market Watch panel (Ctrl+M)',
              'Right-click an instrument and select "New Order"',
              'Set your volume (lot size), stop loss, and take profit',
              'Click "Buy" or "Sell" to execute the order',
            ],
          },
          { id: 's6', type: 'h2', heading: 'Risk Management Essentials' },
          {
            id: 's7',
            type: 'ul',
            items: [
              'Never risk more than 1-2% of account equity per trade',
              'Always use a stop loss — it protects both your capital and your account status',
              'Monitor your daily drawdown throughout each trading session',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'rules',
    label: 'Rules & Guidelines',
    icon: <Shield size={16} />,
    articles: [
      {
        id: 'rules-challenge',
        title: 'Challenge Stage Rules',
        content: [
          { id: 's1', type: 'h2', heading: 'Challenge Stage Overview' },
          {
            id: 's2',
            type: 'p',
            text: 'The Challenge Stage is an evaluation phase designed to assess your trading skills before you become eligible for a Funded Account.\n\nTo successfully pass the Challenge, your trading performance must rank within the top 10% of all participants during the Challenge period.',
          },
          { id: 's3', type: 'h2', heading: 'Challenge Targets' },
          {
            id: 's4',
            type: 'ul',
            items: [
              'Profit Target: Rank within the top 10%',
              'Maximum Daily Loss: -100% of account balance',
              'Maximum Total Drawdown: -100% of account balance',
              'Minimum Trading Days: None',
            ],
          },
          { id: 's7', type: 'h2', heading: 'Allowed Trading Styles' },
          {
            id: 's8',
            type: 'p',
            text: 'Altos Funding is style-agnostic. We allow all legitimate trading approaches.',
          },
          {
            id: 's9',
            type: 'ul',
            items: [
              'Scalping',
              'Day Trading',
              'Swing Trading',
              'Algorithmic Trading / EAs',
              'News Trading',
              'Overnight and Weekend Positions',
            ],
          },
          {
            id: 's10',
            type: 'warning',
            text: 'Copy trading using external signal services that violate our one-account-per-strategy rule may result in account termination.',
          },
          { id: 's11', type: 'h2', heading: 'Prohibited Activities' },
          {
            id: 's12',
            type: 'ul',
            items: [
              'Tick scalping exploiting platform latency',
              'Hedging across multiple Altos Funding accounts',
              'Coordinated group trading to artificially pass evaluations',
              'Use of delayed data feeds or arbitrage strategies',
            ],
          },
        ],
      },
      {
        id: 'rules-funded',
        title: 'Funded Stage Rules',
        content: [
          { id: 's1', type: 'h2', heading: 'Funded Account Rules' },
          {
            id: 's2',
            type: 'p',
            text: 'Once you successfully pass the Challenge, you will become eligible to receive a Funded Account.\n\nThere is no fixed time limit on the use of your Funded Account. Rather than focusing on maximizing short-term profits, we encourage you to adopt a disciplined and sustainable trading approach aimed at achieving consistent long-term performance.',
          },
          { id: 's3', type: 'h2', heading: 'Ongoing Performance Requirements' },
          {
            id: 's4',
            type: 'ul',
            items: [
              'Maximum Daily Loss: None',
              {
                text: 'Maximum Total Drawdown:',
                items: [
                  'Starter: -16% of initial funded balance',
                  'Professional: -8% of initial funded balance',
                  'Elite: -4% of initial funded balance',
                ],
              },
              'No minimum profit target — trade at your own pace',
              'No time limits on funded accounts',
            ],
          },
          { id: 's5', type: 'h2', heading: 'Payout Eligibility' },
          {
            id: 's6',
            type: 'p',
            text: 'Once your account is active and your net profit exceeds the minimum payout threshold, you may submit a withdrawal request at any time.\n\nAll withdrawal requests are subject to a compliance review and are typically processed within 24 hours after submission.',
          },
        ],
      },
      {
        id: 'rules-account-reset',
        title: 'Account Reset & Retry Policy',
        content: [
          { id: 's1', type: 'h2', heading: 'What happens if you fail a challenge?' },
          {
            id: 's2',
            type: 'p',
            text: 'If you breach a challenge rule, such as the maximum drawdown or daily loss limit, that challenge account is automatically closed. You can no longer trade on a closed account.',
          },
          { id: 's3', type: 'h2', heading: 'How to Retry' },
          {
            id: 's4',
            type: 'p',
            text: 'Even if you fail, you can purchase a new challenge and try again at any time.',
          },
          {
            id: 's5',
            type: 'ol',
            items: [
              'Go to Start New Challenge in your dashboard',
              'Choose your account type',
              'Pay with USDT and start your new challenge',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: <Trophy size={16} />,
    articles: [
      {
        id: 'acc-kyc',
        title: 'KYC Verification Process',
        content: [
          { id: 's1', type: 'h2', heading: 'What is KYC?' },
          {
            id: 's2',
            type: 'p',
            text: 'KYC (Know Your Customer) is an identity verification step required before using key features such as funded account withdrawals. It confirms your identity to keep your account and funds secure.',
          },
          { id: 's3', type: 'h2', heading: 'Accepted Documents' },
          {
            id: 's4',
            type: 'ul',
            items: ['ID Card', 'Passport', "Driver's License"],
          },
          { id: 's5', type: 'h2', heading: "How It's Processed" },
          {
            id: 's6',
            type: 'p',
            text: 'Your submitted documents are reviewed and processed automatically by a dedicated verification solution. There is no separate manual admin review, and in most cases the result is available shortly after submission.',
          },
          { id: 's7', type: 'h2', heading: 'Verification Statuses' },
          {
            id: 's8',
            type: 'ul',
            items: [
              'Approved — Your identity has been successfully verified.',
              'Rejected — There was an issue with your documents. You can review the reason and resubmit.',
              'Unverified — Your documents have been submitted and are being reviewed.',
              "None — You haven't started KYC verification yet.",
            ],
          },
          { id: 's9', type: 'h2', heading: "If You're Rejected" },
          {
            id: 's10',
            type: 'p',
            text: 'If your verification is rejected, you can view the reason in the KYC menu of your dashboard. The most common reasons are:',
          },
          {
            id: 's11',
            type: 'ul',
            items: [
              'The document image is blurry or hard to read due to glare',
              "The document details don't match your registration information",
              'The submitted document has expired',
            ],
          },
          {
            id: 's12',
            type: 'p',
            text: 'Please retake a clear photo of the full document in a well-lit environment and resubmit.',
          },
        ],
      },
      {
        id: 'acc-security',
        title: 'Two-Factor Authentication (2FA)',
        content: [
          { id: 's1', type: 'h2', heading: 'Why Enable 2FA' },
          {
            id: 's2',
            type: 'p',
            text: '2FA adds a critical second layer of security to your Altos Funding account. Even if someone obtains your password, they cannot access your account or request withdrawals without your 2FA code.',
          },
          { id: 's3', type: 'h2', heading: 'Supported 2FA Methods' },
          {
            id: 's4',
            type: 'ul',
            items: [
              'Email OTP: A one-time code sent to your registered email address.',
              'Google Authenticator: A time-based one-time password (TOTP) generated by the Authenticator app.',
            ],
          },
          { id: 's5', type: 'h2', heading: 'Setting Up Google Authenticator' },
          {
            id: 's6',
            type: 'ol',
            items: [
              'Go to Dashboard > Security > Two-Factor Authentication',
              'Click "Enable Google Authenticator"',
              'Download Google Authenticator on your phone',
              'Scan the QR code displayed on screen',
              'Enter the 6-digit code from the app to confirm setup',
            ],
          },
          {
            id: 's7',
            type: 'warning',
            text: 'Save your backup codes in a secure location. If you lose access to your authenticator app without backup codes, account recovery will require identity re-verification.',
          },
        ],
      },
      {
        id: 'acc-demo',
        title: 'Demo Account Usage',
        content: [
          { id: 's1', type: 'h2', heading: 'About Demo Accounts' },
          {
            id: 's2',
            type: 'p',
            text: 'Demo accounts allow you to practice trading strategies in a risk-free environment using simulated capital. All live market conditions are replicated in the demo environment.',
          },
          { id: 's3', type: 'h2', heading: 'Demo Account Limits' },
          {
            id: 's4',
            type: 'ul',
            items: [
              'Maximum of 10 demo accounts per user',
              'Demo accounts do not count toward any evaluation or funded status',
              'Demo performance is not considered in payout eligibility assessments',
            ],
          },
          {
            id: 's5',
            type: 'tip',
            text: 'Use demo accounts to validate your automated EA strategies before deploying them on your live challenge or funded account.',
          },
        ],
      },
      {
        id: 'acc-lost-mt4-credentials',
        title: 'Lost MT4 Login Credentials',
        content: [
          { id: 's1', type: 'h2', heading: 'Forgot your MT4 password?' },
          {
            id: 's2',
            type: 'p',
            text: "Your MT4 login credentials, including account number and password, for a challenge or funded account are sent by email when the account is issued. If you've lost them, you can retrieve them in the ways below.",
          },
          { id: 's3', type: 'h2', heading: 'Check in Your Dashboard' },
          {
            id: 's4',
            type: 'ol',
            items: [
              'Go to the Challenge menu in your dashboard',
              'Open the Account Detail view for that account',
              'Your MT4 Login and Password are shown there',
            ],
          },
          { id: 's5', type: 'h2', heading: 'Check your Email' },
          {
            id: 's6',
            type: 'p',
            text: 'You can also find your login details in the "Your Challenge Account is Ready" email sent when your account was issued. If you can\'t find it, please check your spam folder.',
          },
          { id: 's7', type: 'h2', heading: 'MT4 Server Info' },
          {
            id: 's8',
            type: 'ul',
            items: [
              {
                text: 'Server name:',
                items: [
                  'Challenge Account & Demo Account: MexnLimited-Demo',
                  'Funded Account & Live Account: MexnLimited-Live',
                ],
              },
              'Select this server, then enter your account number and password to log in.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'payouts',
    label: 'Payouts & Assets',
    icon: <Wallet size={16} />,
    articles: [
      {
        id: 'pay-withdraw',
        title: 'How to Request a Withdrawal',
        content: [
          { id: 's1', type: 'h2', heading: 'Withdrawal Eligibility' },
          {
            id: 's2',
            type: 'p',
            text: 'Once your net profits have been credited to your Total Assets and your KYC verification has been successfully completed, you may submit a withdrawal request.\n\nAt this time, USDT (Tether) is the only supported withdrawal method.',
          },
          { id: 's3', type: 'h2', heading: 'Supported Networks' },
          {
            id: 's4',
            type: 'ul',
            items: [
              'USDT TRC20 (TRON Network)',
              'USDT ERC20 (Ethereum Network)',
              'USDT BEP20 (BNB Smart Chain)',
              'USDT Polygon',
              'USDT SOL (Solana)',
              'USDT Aptos',
            ],
          },
          { id: 's5', type: 'h2', heading: 'Withdrawal Process' },
          {
            id: 's6',
            type: 'ol',
            items: [
              'Navigate to Dashboard > My Asset',
              'Click "Withdraw" and select "External Wallet"',
              'Choose your preferred blockchain network',
              'Enter the destination wallet address',
              'Enter the withdrawal amount',
              'Confirm with your 2FA code (Email OTP or Google Authenticator)',
              'Await processing — typically under 24 hours',
            ],
          },
          {
            id: 's7',
            type: 'notice',
            text: 'Double-check your wallet address before confirming. Blockchain transactions are irreversible. Altos Funding is not responsible for funds sent to incorrect addresses.',
          },
          { id: 's8', type: 'h2', heading: 'Fees' },
          {
            id: 's9',
            type: 'p',
            text: 'A network transaction fee applies to all external withdrawals. The fee varies by blockchain network and is displayed clearly before you confirm the transaction. The net amount you receive after the fee is shown on the confirmation screen.',
          },
        ],
      },
      {
        id: 'pay-internal',
        title: 'Internal Transfers & Deposits',
        content: [
          { id: 's1', type: 'h2', heading: 'Internal Balance' },
          {
            id: 's2',
            type: 'p',
            text: 'Your Altos Funding account has an internal USDT balance that is used to pay for challenge fees and can hold funds between transactions. Internal transfers between your own accounts incur no fees.',
          },
          { id: 's3', type: 'h2', heading: 'Depositing to Internal Balance' },
          {
            id: 's4',
            type: 'ol',
            items: [
              'Go to Dashboard > My Asset > Deposit',
              'Select "Deposit to Internal Balance"',
              'Choose your blockchain network and generate a deposit address',
              'Send USDT to the generated address from your external wallet',
              'Funds typically arrive within 10–30 minutes after network confirmation',
            ],
          },
          {
            id: 's5',
            type: 'tip',
            text: 'TRC20 deposits tend to have the lowest fees and fastest confirmation times for USDT transfers.',
          },
        ],
      },
      {
        id: 'pay-withdrawal-processing-time',
        title: 'Withdrawal Processing Time',
        content: [
          { id: 's1', type: 'h2', heading: 'Processing Timeline' },
          {
            id: 's2',
            type: 'p',
            text: "Here's how long each stage of the withdrawal process typically takes after you submit a request.",
          },
          {
            id: 's3',
            type: 'table',
            columns: ['Stage', 'Estimated Time'],
            rows: [
              ['Withdrawal request received', 'Immediate'],
              ['Internal review & approval', '1–2 business days (24–48 hours)'],
              ['Blockchain network transfer', 'A few to several dozen minutes after approval'],
            ],
          },
          {
            id: 's4',
            type: 'p',
            text: 'These are general estimates. Actual times may vary depending on when you request, such as weekends or holidays, and network congestion.',
          },
          { id: 's5', type: 'h2', heading: 'Important Notes' },
          {
            id: 's6',
            type: 'ul',
            items: [
              'KYC verification must be completed before requesting a withdrawal.',
              'Double-check your withdrawal address and network. Losses from incorrect details cannot be recovered.',
              'For funded accounts, the first payout is available after a set period following account issuance.',
            ],
          },
        ],
      },
      {
        id: 'pay-usdt-deposit-network-warnings',
        title: 'USDT Deposit — Network Warnings',
        content: [
          { id: 's1', type: 'h2', heading: 'Before You Deposit' },
          {
            id: 's2',
            type: 'p',
            text: 'When depositing USDT, the network selection is very important. If you send funds on the wrong network, your assets may be permanently lost and cannot be recovered.',
          },
          { id: 's3', type: 'h2', heading: 'Correct Deposit Steps' },
          {
            id: 's4',
            type: 'ol',
            items: [
              'Select the network first on the deposit screen, such as TRC-20.',
              'A deposit address is generated for that specific network.',
              'Send USDT using the same network only.',
              'Send USDT only — never other assets such as BTC or ETH.',
            ],
          },
          { id: 's5', type: 'h2', heading: 'Disclaimer' },
          {
            id: 's6',
            type: 'ul',
            items: [
              'Assets sent on the wrong network cannot be recovered, and the company is not responsible for such losses.',
              'Sending assets other than USDT also cannot be recovered.',
              'Always copy the deposit address from the deposit screen or scan the QR code — never type it manually.',
              'Deposits are credited after network confirmations are complete.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'referral',
    label: 'Referral Program',
    icon: <Users size={16} />,
    articles: [
      {
        id: 'ref-overview',
        title: 'Referral Program Overview',
        content: [
          { id: 's1', type: 'h2', heading: 'Earn by Referring Friends' },
          {
            id: 's2',
            type: 'p',
            text: "Altos Funding's referral program lets you earn commissions someone signs up and purchases a challenge using your unique referral code. There is no limit to how much you can earn.",
          },
          { id: 's3', type: 'h2', heading: 'Commission Structure' },
          {
            id: 's4',
            type: 'p',
            text: 'Earn a $50 reward when a user you referred purchases a Challenge ticket for the first time.',
          },
          { id: 's5', type: 'h2', heading: 'How to Share Your Link' },
          {
            id: 's6',
            type: 'ol',
            items: [
              'Go to Dashboard > Referral',
              'Copy your unique referral code or share link',
              'Share with your network via social media, email, or messaging',
              'Track your referral performance and commission history in the Referral dashboard',
            ],
          },
          {
            id: 's7',
            type: 'notice',
            text: 'Referral commissions are credited to your internal balance and can be withdrawn to an external wallet at any time.',
          },
        ],
      },
    ],
  },
  {
    id: 'support',
    label: 'Support & Contact',
    icon: <HelpCircle size={16} />,
    articles: [
      {
        id: 'sup-contact',
        title: 'How to Contact Support',
        content: [
          { id: 's1', type: 'h2', heading: 'Support Channels' },
          {
            id: 's2',
            type: 'p',
            text: 'Altos Funding support is available around the clock to help with any issue you encounter. Response times vary by channel.',
          },
          {
            id: 's3',
            type: 'ul',
            items: [
              'Contact Us : If you have any questions or need assistance, please submit an inquiry through the "Contact Us" menu located at the bottom of your dashboard. Our support team is available 24 hours a day, 7 days a week, and we strive to provide the fastest possible response—typically within 5 minutes.',
              'Email : support@altosfunding.com — expect a response within 24 hours.',
            ],
          },
          { id: 's4', type: 'h2', heading: 'What to Include in Your Request' },
          {
            id: 's5',
            type: 'ul',
            items: [
              'Your registered email address',
              'A clear description of the issue',
              'Screenshots or recordings if applicable',
              'Your account ID (found in Dashboard > My Account)',
            ],
          },
          {
            id: 's6',
            type: 'tip',
            text: 'For faster resolution, always include your account ID and relevant screenshots in the first message. This eliminates back-and-forth and speeds up resolution.',
          },
        ],
      },
    ],
  },
  {
    id: 'faq',
    label: 'FAQ',
    icon: <HelpCircle size={16} />,
    articles: [
      {
        id: 'sup-faq',
        title: 'Frequently Asked Questions',
        // Rendered by HelpCenterFAQPage — content array intentionally empty
        content: [],
      },
    ],
  },
];

function renderSection(section: ArticleSection) {
  switch (section.type) {
    case 'h2':
      return (
        <h2
          key={section.id}
          id={section.id}
          className={`text-xl font-bold text-white first:border-t-0 first:mt-0 ${
            section.heading === 'Frequently Asked Questions'
              ? 'mt-10 mb-4 border-t border-[#2a2a3a] pt-[26px]'
              : 'mt-8 mb-3 border-t border-[#2a2a3a] pt-2'
          }`}
        >
          {section.heading}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={section.id} id={section.id} className="text-lg text-white mt-6 mb-2">
          {section.heading}
        </h3>
      );
    case 'p':
      return (
        <p key={section.id} className="text-gray-300 leading-relaxed mb-4 whitespace-pre-line">
          {section.text}
        </p>
      );
    case 'ul':
      return (
        <ul key={section.id} className="space-y-2 mb-4 pl-1">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] mt-2 shrink-0" />
              {typeof item === 'string' ? (
                <span className="leading-relaxed">{item}</span>
              ) : (
                <span className="leading-relaxed">
                  {item.text}
                  <ul className="mt-2 space-y-1.5 pl-4">
                    {item.items.map((subItem, subIndex) => (
                      <li key={subIndex} className="flex items-start gap-3 text-gray-300">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full border border-[#0052FF] shrink-0" />
                        <span>{subItem}</span>
                      </li>
                    ))}
                  </ul>
                </span>
              )}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={section.id} className="space-y-2 mb-4 pl-1">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-300">
              <span className="w-5 h-5 rounded-full bg-[#0052FF]/20 text-[#0052FF] text-xs flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {typeof item === 'string' ? (
                <span className="leading-relaxed">{item}</span>
              ) : (
                <span className="leading-relaxed">
                  {item.text}
                  <ul className="mt-2 space-y-1.5 pl-4">
                    {item.items.map((subItem, subIndex) => (
                      <li key={subIndex} className="flex items-start gap-3 text-gray-300">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full border border-[#0052FF] shrink-0" />
                        <span>{subItem}</span>
                      </li>
                    ))}
                  </ul>
                </span>
              )}
            </li>
          ))}
        </ol>
      );
    case 'notice':
      return (
        <div
          key={section.id}
          className="flex gap-3 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-xl p-4 mb-4"
        >
          <Info size={18} className="text-[#0052FF] shrink-0 mt-0.5" />
          <p className="text-gray-200 text-sm leading-relaxed">{section.text}</p>
        </div>
      );
    case 'tip':
      return (
        <div
          key={section.id}
          className="flex gap-3 bg-[#00FF94]/10 border border-[#00FF94]/30 rounded-xl p-4 mb-4"
        >
          <CheckCircle size={18} className="text-[#00FF94] shrink-0 mt-0.5" />
          <p className="text-gray-200 text-sm leading-relaxed">{section.text}</p>
        </div>
      );
    case 'warning':
      return (
        <div
          key={section.id}
          className="flex gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4"
        >
          <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-gray-200 text-sm leading-relaxed">{section.text}</p>
        </div>
      );
    case 'faq':
      return (
        <div key={section.id} className="border-b border-[#2a2a3a] py-[18px]">
          <div className="mb-[7px] flex gap-[9px] text-[15px] font-semibold text-white">
            <span className="font-mono font-bold text-[#00FF94]">Q</span>
            <h3>{section.heading}</h3>
          </div>
          <p className="pl-[22px] text-sm leading-[1.6] text-gray-400">{section.text}</p>
        </div>
      );
    case 'table':
      return (
        <div key={section.id} className="mb-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {section.columns?.map((column) => (
                  <th
                    key={column}
                    className="border border-[#2a2a3a] bg-[#1a1a24] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.05em] text-gray-500"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows?.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="border border-[#2a2a3a] px-4 py-3 text-gray-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return (
        <pre
          key={section.id}
          className="bg-[#0d0d14] border border-[#2a2a3a] rounded-xl p-4 mb-4 text-sm text-[#00FF94] overflow-x-auto whitespace-pre-wrap font-mono"
        >
          {section.text}
        </pre>
      );
    case 'image':
      return (
        <figure
          key={section.id}
          className={`mb-5 overflow-hidden rounded-xl border border-[#2a2a3a] bg-[#12121c] ${
            section.narrow ? 'max-w-sm' : 'max-w-full'
          }`}
        >
          <img src={section.src} alt={section.alt ?? ''} className="w-full object-cover" />
          {section.caption && (
            <figcaption className="border-t border-[#2a2a3a] bg-[#1a1a24] px-4 py-2 text-xs text-gray-500">
              {section.caption}
            </figcaption>
          )}
        </figure>
      );
    case 'cta':
      return (
        <div
          key={section.id}
          className="mt-10 rounded-2xl border border-[#2a2a3a] bg-gradient-to-br from-[#0052FF]/10 to-[#00FF94]/10 p-8 text-center"
        >
          <h3 className="mb-2 text-xl font-bold text-white">{section.heading}</h3>
          <p className="mb-5 text-sm text-gray-300">{section.text}</p>
          {section.href && section.buttonLabel && (
            <Link
              to={section.href}
              className="inline-flex rounded-xl bg-gradient-to-r from-[#0052FF] to-[#00FF94] px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-[#0052FF]/30"
            >
              {section.buttonLabel}
            </Link>
          )}
        </div>
      );
    default:
      return null;
  }
}

export function HelpCenterPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'quick-start': true,
  });
  const [activeArticleId, setActiveArticleId] = useState<string>('qs-getting-started');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [feedbackGiven, setFeedbackGiven] = useState<ArticleFeedback | null>(() =>
    getStoredArticleFeedback('qs-getting-started'),
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const GNB_HEIGHT = 80; // AlphaNavigation is h-20
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [searchBarHeight, setSearchBarHeight] = useState(0);
  // Total sticky offset: GNB + search bar — used for sidebars and scroll-spy
  const STICKY_TOP = GNB_HEIGHT + searchBarHeight;

  const activeArticle =
    helpData.flatMap((c) => c.articles).find((a) => a.id === activeArticleId) ||
    helpData[0].articles[0];

  useEffect(() => {
    const articleId = slug ? ARTICLE_IDS_BY_SLUG[slug] : undefined;

    if (!articleId) {
      return;
    }

    const category = helpData.find((cat) =>
      cat.articles.some((article) => article.id === articleId),
    );

    if (!category) {
      return;
    }

    setActiveArticleId(articleId);
    setExpandedCategories((prev) => ({ ...prev, [category.id]: true }));
    setFeedbackGiven(getStoredArticleFeedback(articleId));
  }, [slug]);

  const tocItems = activeArticle.content.filter((s) => s.type === 'h2' || s.type === 'h3');

  // Debounce: update debouncedQuery 300ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectArticle = (articleId: string, categoryId: string) => {
    const nextSlug = ARTICLE_SLUGS[articleId];

    setActiveArticleId(articleId);
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: true }));
    setFeedbackGiven(getStoredArticleFeedback(articleId));
    setMobileDrawerOpen(false);
    if (nextSlug) {
      navigate(`/help-center/${nextSlug}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleArticleFeedback = (feedback: ArticleFeedback) => {
    storeArticleFeedback(activeArticleId, feedback);
    setFeedbackGiven(feedback);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - STICKY_TOP - 16;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowBackToTop(scrollY > 300);
      const sectionEls = tocItems.map((t) => ({ id: t.id, el: document.getElementById(t.id) }));
      let current = '';
      for (const { id, el } of sectionEls) {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= STICKY_TOP + 32) current = id;
        }
      }
      setActiveSectionId(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeArticleId, tocItems, STICKY_TOP]);

  // Keep STICKY_TOP in sync as the search bar resizes (e.g. mobile button appears)
  useEffect(() => {
    const el = searchBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSearchBarHeight(el.offsetHeight));
    ro.observe(el);
    setSearchBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Fuzzy-tolerant token search: split query into words, require all words to
  // appear somewhere in the article (title OR any content field OR bullet items).
  const tokenSearch = (article: Article, q: string): boolean => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = [
      article.title,
      ...article.content.flatMap((s) => [s.heading ?? '', s.text ?? '', ...(s.items ?? [])]),
    ]
      .join(' ')
      .toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  };

  const filteredData = debouncedQuery
    ? helpData
        .map((cat) => ({
          ...cat,
          articles: cat.articles.filter((a) => tokenSearch(a, debouncedQuery)),
        }))
        .filter((cat) => cat.articles.length > 0)
    : helpData;

  const searchResultArticles: Article[] = debouncedQuery
    ? filteredData.flatMap((c) => c.articles)
    : [];

  // When search results appear, auto-expand matching categories and jump to first hit
  useEffect(() => {
    if (!debouncedQuery) return;
    if (searchResultArticles.length === 0) return;
    const newExpanded: Record<string, boolean> = {};
    filteredData.forEach((cat) => {
      newExpanded[cat.id] = true;
    });
    setExpandedCategories((prev) => ({ ...prev, ...newExpanded }));
    // Navigate to first result automatically
    const first = searchResultArticles[0];
    const cat = filteredData.find((c) => c.articles.some((a) => a.id === first.id));
    if (cat) {
      setActiveArticleId(first.id);
      setFeedbackGiven(getStoredArticleFeedback(first.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const LeftSidebar = (
    <nav className="space-y-1">
      {filteredData.map((cat) => (
        <div key={cat.id}>
          <button
            onClick={() => toggleCategory(cat.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#1a1a28] transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-[#0052FF] group-hover:text-[#00FF94] transition-colors">
                {cat.icon}
              </span>
              <span className="text-gray-200 text-sm">{cat.label}</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-gray-500 transition-transform duration-200 ${expandedCategories[cat.id] ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {expandedCategories[cat.id] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pl-3 mt-0.5 space-y-0.5">
                  {cat.articles.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => selectArticle(article.id, cat.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start gap-2 ${
                        activeArticleId === article.id
                          ? 'bg-[#0052FF]/15 text-[#6699FF] border-l-2 border-[#0052FF]'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a28]'
                      }`}
                    >
                      <ChevronRight size={12} className="mt-0.5 shrink-0 opacity-60" />
                      <span className="leading-snug">{article.title}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Global Navigation Bar */}
      <AlphaNavigation />

      {/* Mobile Help Center Category Drawer */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#0f0f1a] border-r border-[#2a2a3a] z-50 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-[#2a2a3a]">
                <span className="text-white text-sm">Categories</span>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{LeftSidebar}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 pt-20">
        {/* Search Bar — sticky below GNB */}
        <div
          ref={searchBarRef}
          className="sticky z-40 border-b border-[#2a2a3a] bg-[#0d0d14]/95 backdrop-blur-xl"
          style={{ top: `${GNB_HEIGHT}px` }}
        >
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-center text-white text-2xl mb-4">How can we help you?</h1>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles, topics, or keywords..."
                  className="w-full bg-[#12121c] border border-[#2a2a3a] focus:border-[#0052FF] rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {/* Mobile category browse button */}
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#2a2a3a] text-gray-400 hover:text-white hover:border-[#0052FF]/50 transition-colors text-sm"
              >
                <Search size={14} />
                Browse categories
              </button>
            </div>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="max-w-screen-2xl mx-auto flex items-start">
          {/* Column 1: Left Sidebar — sticky, scrolls independently if content overflows */}
          <aside
            className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-[#2a2a3a] bg-[#0d0d14] sticky overflow-y-auto"
            style={{ top: `${STICKY_TOP}px`, height: `calc(100vh - ${STICKY_TOP}px)` }}
          >
            <div className="p-4 border-b border-[#2a2a3a] shrink-0">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Categories</p>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">{LeftSidebar}</div>
          </aside>

          {/* Column 2: Main Article Panel — natural flow, no scroll container */}
          <div className="flex-1 min-w-0">
            {/* No-results zero state */}
            {debouncedQuery && searchResultArticles.length === 0 && (
              <div className="max-w-3xl mx-auto px-4 sm:px-8 py-20 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#1a1a28] flex items-center justify-center mb-2">
                  <Search size={24} className="text-gray-500" />
                </div>
                <h2 className="text-white text-xl">No results for "{debouncedQuery}"</h2>
                <p className="text-gray-400 text-sm max-w-sm">
                  Try a different keyword or browse a category from the left panel. Popular
                  searches:
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {['Payout', 'Rules', 'KYC', 'Withdrawal', '2FA', 'Challenge'].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSearchQuery(s);
                        setDebouncedQuery(s);
                      }}
                      className="px-3 py-1.5 text-xs rounded-full border border-[#2a2a3a] text-gray-400 hover:border-[#0052FF]/60 hover:text-white transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Article view — shown when not in a zero-results state */}
            {(!debouncedQuery || searchResultArticles.length > 0) && (
              <article className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
                  <span>Help Center</span>
                  <ChevronRight size={12} />
                  <span className="text-gray-400">{activeArticle.title}</span>
                </div>

                {/* Article Header */}
                <header className="mb-8">
                  <h1 className="text-2xl sm:text-3xl text-white mb-4 leading-tight">
                    {activeArticle.title}
                  </h1>
                </header>

                {/* Article Body */}
                <div className="prose-custom">
                  {activeArticle.id === 'sup-faq' ? (
                    <HelpCenterFAQPage />
                  ) : (
                    activeArticle.content.map((section) => renderSection(section))
                  )}
                </div>

                {activeArticle.id !== 'sup-faq' && (
                  <>
                    {/* Feedback */}
                    <div className="mt-12 pt-8 border-t border-[#2a2a3a]">
                      {feedbackGiven === null ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <p className="text-gray-400 text-sm">Was this article helpful?</p>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleArticleFeedback('yes')}
                              className="flex items-center gap-2 px-4 py-2 border border-[#2a2a3a] rounded-lg text-sm text-gray-300 hover:border-[#00FF94] hover:text-[#00FF94] transition-colors"
                            >
                              <ThumbsUp size={14} /> Yes
                            </button>
                            <button
                              onClick={() => handleArticleFeedback('no')}
                              className="flex items-center gap-2 px-4 py-2 border border-[#2a2a3a] rounded-lg text-sm text-gray-300 hover:border-red-400 hover:text-red-400 transition-colors"
                            >
                              <ThumbsDown size={14} /> No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <CheckCircle size={16} className="text-[#00FF94]" />
                          <span className="text-gray-300">
                            {feedbackGiven === 'yes'
                              ? 'Thank you for your feedback!'
                              : "We'll work on improving this article."}
                          </span>
                        </motion.div>
                      )}
                    </div>

                    {/* Related Articles */}
                    <div className="mt-10">
                      <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-4">
                        More in this category
                      </h3>
                      <div className="space-y-2">
                        {helpData
                          .find((c) => c.articles.some((a) => a.id === activeArticleId))
                          ?.articles.filter((a) => a.id !== activeArticleId)
                          .slice(0, 3)
                          .map((related) => (
                            <button
                              key={related.id}
                              onClick={() => {
                                const cat = helpData.find((c) =>
                                  c.articles.some((a) => a.id === related.id),
                                );
                                if (cat) selectArticle(related.id, cat.id);
                              }}
                              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2a2a3a] hover:border-[#0052FF]/50 hover:bg-[#0052FF]/5 transition-all group"
                            >
                              <BookOpen
                                size={14}
                                className="text-gray-500 group-hover:text-[#0052FF] shrink-0"
                              />
                              <span className="text-gray-300 group-hover:text-white text-sm transition-colors">
                                {related.title}
                              </span>
                              <ChevronRight
                                size={14}
                                className="ml-auto text-gray-600 group-hover:text-[#0052FF]"
                              />
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </article>
            )}
          </div>

          {/* Column 3: Right TOC — sticky, scrolls independently if TOC is long */}
          <aside
            className="hidden xl:flex flex-col w-56 shrink-0 border-l border-[#2a2a3a] bg-[#0d0d14] sticky overflow-y-auto"
            style={{ top: `${STICKY_TOP}px`, height: `calc(100vh - ${STICKY_TOP}px)` }}
          >
            <div className="p-4 shrink-0 border-b border-[#2a2a3a]">
              <p className="text-xs text-gray-500 uppercase tracking-widest">On This Page</p>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left text-xs leading-snug px-2 py-1.5 rounded transition-colors ${
                    item.type === 'h3' ? 'pl-4' : ''
                  } ${
                    activeSectionId === item.id
                      ? 'text-[#6699FF] bg-[#0052FF]/10'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {item.heading}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a2a3a] bg-[#0a0a0f] py-6">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-xs">© 2026 KORVEX LTD. All rights reserved</p>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
              Home
            </Link>
            <Link
              to="/login"
              className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="fixed z-[99] bottom-5 right-5 sm:bottom-8 sm:right-8 w-11 h-11 rounded-full bg-[#1a1a28] border border-[#2a2a3a] text-gray-400 flex items-center justify-center shadow-lg hover:bg-[#0052FF] hover:border-[#0052FF] hover:text-white transition-colors duration-200"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
