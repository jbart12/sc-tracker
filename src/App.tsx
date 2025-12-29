import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Sessions } from './components/Sessions/Sessions';
import { TaxReport } from './components/TaxReport/TaxReport';
import { Settings } from './components/Settings/Settings';
import './App.css';

type Tab = 'dashboard' | 'sessions' | 'taxReport' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <AppProvider>
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
                className={activeTab === 'taxReport' ? 'active' : ''}
                onClick={() => setActiveTab('taxReport')}
              >
                <span className="nav-icon">📋</span>
                Tax Report
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
        </nav>
        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'sessions' && <Sessions />}
          {activeTab === 'taxReport' && <TaxReport />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
