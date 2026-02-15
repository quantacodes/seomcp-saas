import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Docs from './pages/Docs';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Refund from './pages/Refund';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import './index.css';

// Protected route wrapper using Clerk
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/" replace />
      </SignedOut>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Landing page with React - keep the beautiful design */}
        <Route path="/" element={<LandingPage />} />

        {/* Documentation */}
        <Route path="/docs" element={<Docs />} />

        {/* Legal pages - React in dev, static HTML in production */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refund" element={<Refund />} />

        {/* Dashboard */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
