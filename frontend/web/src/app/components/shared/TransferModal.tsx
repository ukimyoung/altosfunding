import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowDown, ArrowRight, Calendar, X } from 'lucide-react';

interface TransferModalLabels {
  title?: string;
  subtitle?: string;
  transferDirection?: string;
  from?: string;
  to?: string;
  sourceBalanceLabel?: string;
  destinationBalanceLabel?: string;
  available?: string;
  currentBalance?: string;
  transferAmount?: string;
  enterAmount?: string;
  minimumAmount?: string;
  useMax?: string;
  transferInformation?: string;
  transferInfoSourceToAsset?: string;
  transferInfoInstantFree?: string;
  transferInfoMinimum?: string;
  transferInfoBalanceUpdate?: string;
  cancel?: string;
  confirmTransfer?: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceLabel: string;
  sourceBalance: number;
  destinationBalance: number;
  transferAmount: string;
  transferError: string;
  onTransferAmountChange: (value: string) => void;
  onUseMax: () => void;
  onTransferSubmit: () => void;
  labels?: TransferModalLabels;
}

export function TransferModal({
  isOpen,
  onClose,
  sourceLabel,
  sourceBalance,
  destinationBalance,
  transferAmount,
  transferError,
  onTransferAmountChange,
  onUseMax,
  onTransferSubmit,
  labels,
}: TransferModalProps) {
  const transferAmountNum = parseFloat(transferAmount) || 0;
  const sourceBalanceLabel = labels?.sourceBalanceLabel ?? `Total ${sourceLabel} Balance`;
  const destinationBalanceLabel = labels?.destinationBalanceLabel ?? 'Total Asset';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-[#0f0f17] border border-[#1a1a24] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#0f0f17] border-b border-[#1a1a24] px-8 py-6 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                    <ArrowRight size={24} className="text-[#0052FF]" />
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-semibold">
                      {labels?.title ?? 'Transfer to Total Asset'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {labels?.subtitle ?? 'Move funds to your main account'}
                    </p>
                  </div>
                </div>
                <button
                  className="w-10 h-10 rounded-lg bg-[#1a1a24] hover:bg-[#2a2a3a] text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-8 py-6">
                <div className="mb-6">
                  <label className="block text-white text-sm font-semibold mb-3">
                    {labels?.transferDirection ?? 'Transfer Direction'}
                  </label>
                  <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-6">
                    <div className="p-4 rounded-xl border-2 border-[#0052FF] bg-[#0052FF]/5 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">{labels?.from ?? 'From'}</p>
                          <p className="text-white font-semibold">{sourceBalanceLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-xs mb-1">
                            {labels?.available ?? 'Available'}
                          </p>
                          <p className="text-white font-bold">
                            $
                            {sourceBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center -my-2 relative z-10">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0041CC] border-4 border-[#1a1a24] text-white shadow-xl flex items-center justify-center">
                        <ArrowDown size={20} />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-[#00FF94] bg-[#00FF94]/5 mt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">{labels?.to ?? 'To'}</p>
                          <p className="text-white font-semibold">{destinationBalanceLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-xs mb-1">
                            {labels?.currentBalance ?? 'Current Balance'}
                          </p>
                          <p className="text-white font-bold">
                            $
                            {destinationBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-white text-sm font-semibold mb-3">
                    {labels?.transferAmount ?? 'Transfer Amount'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder={labels?.enterAmount ?? 'Enter amount'}
                      className={`w-full px-4 py-4 bg-[#1a1a24] text-white rounded-xl border ${
                        transferError ? 'border-red-500' : 'border-[#2a2a3a]'
                      } text-lg focus:outline-none focus:border-[#0052FF] transition-colors pr-20`}
                      value={transferAmount}
                      onChange={(e) => onTransferAmountChange(e.target.value)}
                      min="1"
                      max={sourceBalance}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                      $
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {transferError ? (
                      <div className="flex items-center gap-1 text-red-400 text-xs">
                        <AlertCircle size={12} />
                        <span>{transferError}</span>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs">
                        {labels?.minimumAmount ?? 'Minimum: $1.00'}
                      </p>
                    )}
                    <button
                      className="text-[#0052FF] text-xs font-medium hover:text-[#0052FF]/80 transition-colors"
                      onClick={onUseMax}
                    >
                      {labels?.useMax ?? 'Use Max'}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl p-4">
                  <div className="flex gap-3">
                    <AlertCircle size={20} className="text-[#0052FF] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white text-sm font-medium mb-1">
                        {labels?.transferInformation ?? 'Transfer Information'}
                      </p>
                      <ul className="text-gray-400 text-xs space-y-1">
                        <li>
                          •{' '}
                          {labels?.transferInfoSourceToAsset ??
                            `Transfers from ${sourceLabel} Balance to Total Asset only`}
                        </li>
                        <li>• {labels?.transferInfoInstantFree ?? 'Instant and free of charge'}</li>
                        <li>
                          • {labels?.transferInfoMinimum ?? 'Minimum transfer amount: $1.00'}
                        </li>
                        <li>
                          • {labels?.transferInfoBalanceUpdate ?? 'Balances will update immediately'}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-[#0f0f17] border-t border-[#1a1a24] px-8 py-6 flex items-center justify-between gap-4">
                <button
                  className="flex-1 px-6 py-4 bg-[#1a1a24] text-white rounded-xl font-medium hover:bg-[#2a2a3a] transition-colors"
                  onClick={onClose}
                >
                  {labels?.cancel ?? 'Cancel'}
                </button>
                <button
                  className="flex-1 px-6 py-4 bg-[#0052FF] text-white rounded-xl font-semibold hover:bg-[#0052FF]/90 transition-all hover:shadow-lg hover:shadow-[#0052FF]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={onTransferSubmit}
                  disabled={
                    !transferAmount ||
                    transferAmountNum < 1 ||
                    transferAmountNum > sourceBalance ||
                    !!transferError
                  }
                >
                  <ArrowRight size={20} />
                  {labels?.confirmTransfer ?? 'Confirm Transfer'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
