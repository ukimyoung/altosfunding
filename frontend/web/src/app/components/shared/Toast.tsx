import { motion, AnimatePresence } from 'motion/react';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import { useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  title: string;
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
  position?: 'top' | 'bottom';
  showCloseButton?: boolean;
  showProgressBar?: boolean;
}

export function Toast({ 
  type, 
  title, 
  message, 
  isVisible, 
  onClose, 
  duration = 5000,
  position = 'top',
  showCloseButton = true,
  showProgressBar = true,
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const icons = {
    success: <Check size={24} />,
    error: <X size={24} />,
    warning: <AlertCircle size={24} />,
    info: <Info size={24} />,
  };

  const colors = {
    success: {
      bg: 'bg-[#00FF94]/10',
      border: 'border-[#00FF94]/30',
      icon: 'bg-[#00FF94]',
      text: 'text-[#00FF94]',
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'bg-red-500',
      text: 'text-red-400',
    },
    warning: {
      bg: 'bg-[#FFB800]/10',
      border: 'border-[#FFB800]/30',
      icon: 'bg-[#FFB800]',
      text: 'text-[#FFB800]',
    },
    info: {
      bg: 'bg-[#0052FF]/10',
      border: 'border-[#0052FF]/30',
      icon: 'bg-[#0052FF]',
      text: 'text-[#0052FF]',
    },
  };

  const colorScheme = colors[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <div className={`fixed ${position === 'top' ? 'top-6' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[9999] pointer-events-none`}>
          <motion.div
            initial={{ opacity: 0, y: position === 'top' ? -20 : 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position === 'top' ? -20 : 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="pointer-events-auto"
          >
            <div className={`min-w-[400px] max-w-md ${colorScheme.bg} border ${colorScheme.border} rounded-xl shadow-2xl backdrop-blur-sm`}>
              <div className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full ${colorScheme.icon} flex items-center justify-center text-white flex-shrink-0`}>
                  {icons[type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-white font-medium mb-1">{title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
                </div>

                {/* Close Button */}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors flex-shrink-0 p-1"
                    aria-label="Close notification"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              {showProgressBar && duration > 0 && (
                <div className="h-1 bg-[#1a1a24]/50 rounded-b-xl overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: duration / 1000, ease: 'linear' }}
                    className={`h-full ${colorScheme.icon}`}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
