
import { toast as sonnerToast, ToastT, ExternalToast } from "sonner";
import { ReactNode } from "react";

type Toast = {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "default" | "destructive";
};

export type ToasterToast = Toast;

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterProps = {
  toasts: ToasterToast[];
};

// State to track active toasts
let toasts: ToasterToast[] = [];

// Create a toast function that mirrors sonner's API but also maintains state for our custom toaster
const toast = (message: ReactNode, data?: ExternalToast) => {
  const id = sonnerToast(message, data);
  
  // Add to our internal state
  toasts = [
    ...toasts.filter(t => t.id !== id),
    { id: String(id), title: message as string }
  ].slice(0, TOAST_LIMIT);
  
  return id;
};

// Add all the sonner toast methods
Object.keys(sonnerToast).forEach(key => {
  if (typeof sonnerToast[key as keyof typeof sonnerToast] === 'function') {
    (toast as any)[key] = sonnerToast[key as keyof typeof sonnerToast];
  }
});

// Create a hook that returns both toast function and current toast state
const useToast = () => {
  return {
    toast,
    toasts,
    dismiss: (toastId?: string) => {
      sonnerToast.dismiss(toastId);
      if (toastId) {
        toasts = toasts.filter(t => t.id !== toastId);
      } else {
        toasts = [];
      }
    }
  };
};

export { useToast, toast };
