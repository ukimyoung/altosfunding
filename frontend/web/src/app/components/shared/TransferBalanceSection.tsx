import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, DollarSign, Wallet } from 'lucide-react';
import { SuccessNotification } from './SuccessNotification';

interface TransferBalanceSectionProps {
  balanceLabel: string;
  balance: number;
  totalAssetBalance: number;
  showTransferSuccess: boolean;
  onTransferClick: () => void;
}

export function TransferBalanceSection({
  balanceLabel,
  balance,
  totalAssetBalance,
  showTransferSuccess,
  onTransferClick,
}: TransferBalanceSectionProps) {
  return (
    <div className="mb-8">
      <SuccessNotification
        isVisible={showTransferSuccess}
        title="Transfer Successful!"
        message="Balances updated instantly"
        variant="compact"
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-gradient-to-br from-[#00FF94] to-[#00CC75] rounded-2xl p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-black/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-black/10 backdrop-blur-sm flex items-center justify-center">
                <Wallet size={24} className="text-[#0a0a0f]" />
              </div>
              <div>
                <p className="text-[#0a0a0f] text-sm font-medium">{balanceLabel}</p>
                <p className="text-[#0a0a0f]/60 text-xs">Available for withdrawal</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[#0a0a0f] text-5xl font-bold mb-2">
                $ {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-xs ml-3 text-gray-500">USDT</span>
              </p>
            </div>

            <div className="bg-black/10 backdrop-blur-sm border border-black/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight size={16} className="text-[#0a0a0f]/70" />
                <p className="text-[#0a0a0f] text-xs font-semibold">Quick Transfer</p>
              </div>
              <p className="text-[#0a0a0f]/60 text-xs leading-relaxed">
                <>
                  Use the transfer button to move your <span className="font-bold">payouts</span>{' '}
                  into your <span className="font-bold">Total Asset</span> account instantly.
                </>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="bg-gradient-to-br from-[#0052FF] to-[#0052FF]/70 rounded-2xl p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#00FF94]/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <DollarSign size={24} className="text-white" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">Total Asset</p>
                <p className="text-white/60 text-xs">Main account balance</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-white text-5xl font-bold mb-2">
                $ {totalAssetBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-xs ml-3 text-white">USDT</span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-white/70" />
                <p className="text-white text-xs font-semibold">Asset Information</p>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">
                Receive rewards directly into your Total Asset account. Use for trading or
                deposits.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden lg:block"
        >
          <button
            onClick={onTransferClick}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0041CC] border-4 border-[#0a0a0f] text-white shadow-2xl hover:shadow-[#0052FF]/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
          >
            <ArrowRight
              size={24}
              className="group-hover:translate-x-1 transition-transform duration-300"
            />
          </button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7 }}
        className="lg:hidden mt-6"
      >
        <button
          onClick={onTransferClick}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#0052FF] to-[#0041CC] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all"
        >
          <ArrowRight size={20} />
          <span>Transfer to Total Asset</span>
        </button>
      </motion.div>
    </div>
  );
}
