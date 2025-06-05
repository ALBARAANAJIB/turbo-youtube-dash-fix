
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App.tsx';
import { Toaster } from "sonner";
import './index.css';

try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  
  createRoot(rootElement).render(
    <StrictMode>
      <App />
      <Toaster position="top-right" richColors />
    </StrictMode>
  );
} catch (error) {
  console.error("Failed to render application:", error);
}
