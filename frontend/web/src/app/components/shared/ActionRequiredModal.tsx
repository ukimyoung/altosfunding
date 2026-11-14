import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface ActionRequiredModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  message: string;
  importantTitle?: string;
  importantMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ActionRequiredModal({
  isOpen,
  title,
  subtitle,
  message,
  importantTitle = 'Important',
  importantMessage,
  confirmLabel = 'Understood',
  cancelLabel,
  onConfirm,
  onClose,
}: ActionRequiredModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0f0f17] shadow-2xl shadow-amber-500/20">
              <div className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-600/10 px-8 py-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/20">
                      <AlertCircle size={24} className="text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-white">{title}</h2>
                      {subtitle && <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <p className="mb-4 text-sm leading-relaxed text-gray-300">{message}</p>

                {importantMessage && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
                      <div>
                        <p className="mb-1 text-xs font-medium text-amber-300">
                          {importantTitle}
                        </p>
                        <p className="text-xs leading-relaxed text-amber-200/80">
                          {importantMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-3 border-t border-amber-500/20 bg-gradient-to-r from-[#0f0f17] to-[#12121a] px-8 py-6">
                {cancelLabel && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-lg bg-[#1a1a24] px-6 py-3 font-medium text-white transition-colors hover:bg-[#2a2a3a]"
                  >
                    {cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-8 py-3 font-medium text-white transition-colors hover:bg-amber-600"
                >
                  <CheckCircle size={18} />
                  <span>{confirmLabel}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
