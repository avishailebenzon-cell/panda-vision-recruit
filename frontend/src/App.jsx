import { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar          from './components/layout/Sidebar';
import Dashboard        from './pages/Dashboard';
import AgentView        from './pages/AgentView';
import OrchestratorView from './pages/OrchestratorView';
import Matches          from './pages/Matches';
import Candidates       from './pages/Candidates';
import Jobs             from './pages/Jobs';
import Settings         from './pages/Settings';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="panda-card p-6 max-w-lg w-full border-red-500/40">
            <p className="text-red-400 font-semibold mb-2">שגיאת רינדור</p>
            <pre className="text-xs text-surface-300 bg-surface-900 p-3 rounded-lg overflow-auto">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack?.split('\n').slice(0,6).join('\n')}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-surface-950 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ErrorBoundary>
            <Routes>
              <Route path="/"             element={<Dashboard />} />
              <Route path="/agents/:agentType" element={<AgentView />} />
              <Route path="/orchestrator" element={<OrchestratorView />} />
              <Route path="/matches"      element={<Matches />} />
              <Route path="/inbox"        element={<Matches />} />
              <Route path="/candidates"   element={<Candidates />} />
              <Route path="/jobs"         element={<Jobs />} />
              <Route path="/settings"     element={<Settings />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </div>
    </BrowserRouter>
  );
}
