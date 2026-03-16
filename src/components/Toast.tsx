import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastOptions {
  action?: ToastAction;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerMapRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const toast = useCallback((message: string, type: ToastType = "success", options?: ToastOptions) => {
    const id = Date.now();
    const duration = options?.duration ?? 3500;
    setToasts((prev) => [...prev, { id, message, type, action: options?.action }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timerMapRef.current.delete(id);
    }, duration);
    timerMapRef.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: number) => {
    clearTimeout(timerMapRef.current.get(id));
    timerMapRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto ${
                t.type === "error"
                  ? "bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800/50 text-red-700 dark:text-red-300"
                  : t.type === "info"
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300"
                  : "bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800/50 text-green-700 dark:text-green-300"
              }`}
            >
              {t.type === "error" ? (
                <XCircle className="w-4 h-4 flex-shrink-0" />
              ) : t.type === "info" ? (
                <Info className="w-4 h-4 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="ml-2 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide bg-current/10 hover:bg-current/20 transition-colors border border-current/20 shrink-0"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="ml-1 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
