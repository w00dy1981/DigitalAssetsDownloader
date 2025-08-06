import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

console.log('[Renderer] Starting React application initialization');

// Hide loading screen after React mounts
const hideLoadingScreen = () => {
  console.log('[Renderer] Hiding loading screen');
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 300);
  }
};

try {
  console.log('[Renderer] Creating React root');
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  console.log('[Renderer] Rendering React app');
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Hide loading screen after React has rendered
  setTimeout(() => {
    console.log('[Renderer] React should be mounted, hiding loading screen');
    hideLoadingScreen();
  }, 100);
} catch (error) {
  console.error('[Renderer] Failed to initialize React app:', error);
  // Show error on loading screen
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `<div style="color: red; padding: 20px;">Failed to start application: ${error}</div>`;
  }
}
