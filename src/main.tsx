import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { dataService } from './services/dataService';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

const renderApp = (): void => {
  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
};

const bootstrap = async (): Promise<void> => {
  try {
    await dataService.pullFromFirestore();
  } catch {
    // fallback to localStorage when Firestore is unreachable or rules deny access
  }

  dataService.startRealtimeSync();
  renderApp();
};

void bootstrap();
