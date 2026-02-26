import { Component, useState } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Sessions } from './components/Sessions/Sessions';
import { Analytics } from './components/Analytics/Analytics';
import { TaxReport } from './components/TaxReport/TaxReport';
import { Cards } from './components/Cards/Cards';
import { Settings } from './components/Settings/Settings';
import './App.css';

type Tab = 'dashboard' | 'sessions' | 'analytics' | 'taxReport' | 'cards' | 'settings';

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
          <h1>Something went wrong</h1>
          <p style={{ color: '#888', marginBottom: '1rem' }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ErrorBanner() {
  const { loadError, saveError, clearError, retrySave } = useApp();

  if (loadError) {
    return (
      <div className="error-banner">
        <strong>Connection Error:</strong> {loadError}
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (saveError) {
    return (
      <div className="error-banner error-banner--save">
        <div>
          <strong>Save Error:</strong> {saveError}
          <div className="error-hint">Your changes are safe in memory and will be saved when the connection resumes.</div>
        </div>
        <div className="error-banner-actions">
          <button onClick={retrySave}>Retry Save</button>
          <button className="error-banner-dismiss" onClick={clearError}>Dismiss</button>
        </div>
      </div>
    );
  }

  return null;
}

function SaveStatusIndicator() {
  const { saveStatus, connectionStatus } = useApp();

  // Offline takes priority
  if (connectionStatus === 'disconnected') {
    return (
      <div className="save-status save-status--offline">
        <span className="save-status-dot" />
        Offline
      </div>
    );
  }

  if (saveStatus === 'saving') {
    return (
      <div className="save-status save-status--saving">
        <span className="save-status-dot" />
        Saving...
      </div>
    );
  }

  if (saveStatus === 'saved') {
    return (
      <div className="save-status save-status--saved">
        <span className="save-status-dot" />
        Saved
      </div>
    );
  }

  if (saveStatus === 'error') {
    return (
      <div className="save-status save-status--error">
        <span className="save-status-dot" />
        Save failed
      </div>
    );
  }

  // idle + connected — hidden
  return null;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <AppErrorBoundary>
    <AppProvider>
      <ErrorBanner />
      <div className="app">
        <nav className="sidebar">
          <div className="app-title">SC Tracker</div>
          <ul className="nav-list">
            <li>
              <button
                className={activeTab === 'dashboard' ? 'active' : ''}
                onClick={() => setActiveTab('dashboard')}
              >
                <span className="nav-icon">📊</span>
                Dashboard
              </button>
            </li>
            <li>
              <button
                className={activeTab === 'sessions' ? 'active' : ''}
                onClick={() => setActiveTab('sessions')}
              >
                <span className="nav-icon">📝</span>
                Sessions
              </button>
            </li>
            <li>
              <button
                className={activeTab === 'analytics' ? 'active' : ''}
                onClick={() => setActiveTab('analytics')}
              >
                <span className="nav-icon">📈</span>
                Analytics
              </button>
            </li>
            <li>
              <button
                className={activeTab === 'taxReport' ? 'active' : ''}
                onClick={() => setActiveTab('taxReport')}
              >
                <span className="nav-icon">📋</span>
                Tax Report
              </button>
            </li>
            <li>
              <button
                className={activeTab === 'cards' ? 'active' : ''}
                onClick={() => setActiveTab('cards')}
              >
                <span className="nav-icon">💳</span>
                Cards
              </button>
            </li>
            <li>
              <button
                className={activeTab === 'settings' ? 'active' : ''}
                onClick={() => setActiveTab('settings')}
              >
                <span className="nav-icon">⚙️</span>
                Settings
              </button>
            </li>
          </ul>
          <div className="sidebar-footer">
            <SaveStatusIndicator />
          </div>
        </nav>
        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'sessions' && <Sessions />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'taxReport' && <TaxReport />}
          {activeTab === 'cards' && <Cards />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </AppProvider>
    </AppErrorBoundary>
  );
}

export default App;
