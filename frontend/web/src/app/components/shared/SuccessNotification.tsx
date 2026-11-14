import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';

interface SuccessNotificationProps {
  isVisible: boolean;
  title: string;
  message: string;
  placement?: 'top' | 'center';
  variant?: 'panel' | 'compact';
  minWidth?: boolean;
}

export function SuccessNotification({
  isVisible,
  title,
  message,
  placement = 'top',
  variant = 'panel',
  minWidth = false,
}: SuccessNotificationProps) {
  const isCenter = placement === 'center';
  const isCompact = variant === 'compact';
  const notificationClassName = isCenter
    ? 'fixed left-1/2 top-1/2 z-[70] mx-4 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#00FF94] bg-[#0f0f17] p-6 shadow-2xl'
    : isCompact
      ? `fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-[#0f0f17] border border-[#00FF94] rounded-xl shadow-2xl p-4 flex items-center gap-3 ${
          minWidth ? 'min-w-[400px]' : ''
        }`
      : 'fixed left-1/2 top-8 z-[60] mx-4 w-full max-w-md -translate-x-1/2 rounded-xl border border-[#00FF94] bg-[#0f0f17] p-6 shadow-2xl';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: isCenter ? 20 : -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isCenter ? 20 : -50 }}
          className={notificationClassName}
        >
          {isCompact ? (
            <>
              <div className="w-10 h-10 rounded-full bg-[#00FF94]/10 flex items-center justify-center">
                <CheckCircle size={24} className="text-[#00FF94]" />
              </div>
              <div>
                <p className="text-white font-semibold">{title}</p>
                <p className="text-gray-400 text-sm">{message}</p>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#00FF94]/10">
                <CheckCircle size={24} className="text-[#00FF94]" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-white">{title}</h3>
                <p className="text-sm text-gray-400">{message}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
