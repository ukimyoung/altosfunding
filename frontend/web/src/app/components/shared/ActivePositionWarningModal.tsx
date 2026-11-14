import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useLocale } from '@/app/i18n/LocaleContext';

interface ActivePositionWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivePositionWarningModal({
  isOpen,
  onClose,
}: ActivePositionWarningModalProps) {
  const { T } = useLocale();
  const text = T.funded;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Warning Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0f0f17] border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/20 max-w-md w-full">
              {/* Warning Header */}
              <div className="px-8 py-6 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-600/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <AlertCircle size={24} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl text-white font-medium">{text.unableToRequestPayout}</h2>
                    <p className="text-gray-400 text-sm mt-0.5">{text.activePositionsDetected}</p>
                  </div>
                </div>
              </div>

              {/* Warning Body */}
              <div className="p-8">
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                  {text.activePositionsMsg}
                </p>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-300 text-xs font-medium mb-1">
                        {text.importantLabel}
                      </p>
                      <p className="text-amber-200/80 text-xs leading-relaxed">
                        {text.activePositionsNote}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Footer */}
              <div className="px-8 py-6 border-t border-amber-500/20 bg-gradient-to-r from-[#0f0f17] to-[#12121a] flex justify-center">
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  <span>{text.understood}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

