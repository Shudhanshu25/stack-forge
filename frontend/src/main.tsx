import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { CommandPaletteProvider } from './commands/CommandPalette';
import { CommandRegistryProvider } from './commands/registry';
import { ToastProvider } from './components/feedback/Toaster';
import { ErrorBoundary, initMonitoring } from './lib/monitoring';
import { OnboardingProvider } from './onboarding/Onboarding';
import { ThemeProvider } from './theme/ThemeContext';
import './styles.css';

initMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary
        fallback={
          <main className="card narrow">
            <h1>Something went wrong</h1>
            <p>The error has been reported. Reload the page to continue.</p>
          </main>
        }
      >
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <CommandRegistryProvider>
                <CommandPaletteProvider>
                  <OnboardingProvider>
                    <App />
                  </OnboardingProvider>
                </CommandPaletteProvider>
              </CommandRegistryProvider>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
