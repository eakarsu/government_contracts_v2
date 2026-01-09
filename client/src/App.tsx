import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Auth Provider
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layout Components
import Layout from './components/Layout/Layout';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

// Public Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import About from './pages/About';
import Blog from './pages/Blog';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Legal from './pages/Legal';
import Security from './pages/Security';
import Careers from './pages/Careers';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
// NLPSearch is now integrated into Search with mode=nlp parameter
import ContractDetail from './pages/ContractDetail';
import Jobs from './pages/Jobs';
import Documents from './pages/Documents';
import ApiDocs from './pages/ApiDocs';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
import SettingsPage from './pages/Settings';

// RFP Pages
import RFPDashboard from './pages/RFPDashboard';
import RFPGenerator from './pages/RFPGenerator';
import RFPTemplates from './pages/RFPTemplates';
import CompanyProfiles from './pages/CompanyProfiles';
import RFPAnalytics from './pages/RFPAnalytics';
import RFPResponses from './pages/RFPResponses';
import RFPResponseDetail from './pages/RFPResponseDetail';
import RFPResponseEdit from './pages/RFPResponseEdit';

// AI Enhancement Components
import OpportunityDashboard from './components/Opportunities/OpportunityDashboard';
import BidProbabilityAnalyzer from './components/Bidding/BidProbabilityAnalyzer';
import AIAnalysisResults from './pages/AIAnalysisResults';
import AICenter from './pages/AICenter';

// AI Navigation Context
import { AINavigationProvider } from './contexts/AINavigationContext';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected Route wrapper - requires authentication
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <AINavigationProvider>
              <div className="min-h-screen bg-gray-50">
              <Routes>
                {/* Public Pages - No Layout */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/about" element={<About />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/security" element={<Security />} />
                <Route path="/careers" element={<Careers />} />

                {/* Protected Pages - With Layout */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                <Route path="/nlp-search" element={<Navigate to="/search?mode=nlp" replace />} />
                <Route path="/contracts/:noticeId" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />
                <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
                <Route path="/api-docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

                {/* RFP System Routes */}
                <Route path="/rfp" element={<ProtectedRoute><RFPDashboard /></ProtectedRoute>} />
                <Route path="/rfp/dashboard" element={<ProtectedRoute><RFPDashboard /></ProtectedRoute>} />
                <Route path="/rfp/generate" element={<ProtectedRoute><RFPGenerator /></ProtectedRoute>} />
                <Route path="/rfp/templates" element={<ProtectedRoute><RFPTemplates /></ProtectedRoute>} />
                <Route path="/rfp/company-profiles" element={<ProtectedRoute><CompanyProfiles /></ProtectedRoute>} />
                <Route path="/rfp/analytics" element={<ProtectedRoute><RFPAnalytics /></ProtectedRoute>} />
                <Route path="/rfp/responses" element={<ProtectedRoute><RFPResponses /></ProtectedRoute>} />
                <Route path="/rfp/responses/:id" element={<ProtectedRoute><RFPResponseDetail /></ProtectedRoute>} />
                <Route path="/rfp/responses/:id/edit" element={<ProtectedRoute><RFPResponseEdit /></ProtectedRoute>} />

                {/* AI Enhancement Routes */}
                <Route path="/ai/center" element={<ProtectedRoute><AICenter /></ProtectedRoute>} />
                <Route path="/ai/proposal-drafter" element={<ProtectedRoute><AICenter /></ProtectedRoute>} />
                <Route path="/ai/bid-analyzer" element={<ProtectedRoute><BidProbabilityAnalyzer /></ProtectedRoute>} />
                <Route path="/ai/analysis-results/:contractId" element={<ProtectedRoute><AIAnalysisResults /></ProtectedRoute>} />
                <Route path="/ai/win-probability/:contractId" element={<ProtectedRoute><AIAnalysisResults type="probability" /></ProtectedRoute>} />
                <Route path="/ai/similar-contracts/:contractId" element={<ProtectedRoute><AIAnalysisResults type="similarity" /></ProtectedRoute>} />
                <Route path="/ai/bid-strategy/:contractId" element={<ProtectedRoute><AIAnalysisResults type="strategy" /></ProtectedRoute>} />
                <Route path="/opportunities" element={<ProtectedRoute><OpportunityDashboard /></ProtectedRoute>} />

                {/* 404 Page */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </AINavigationProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
