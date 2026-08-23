import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Layout Components
import Layout from './components/Layout/Layout';

import AuthGate from './components/AuthGate';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Search = lazy(() => import('./pages/Search'));
const NLPSearch = lazy(() => import('./pages/NLPSearch'));
const ContractDetail = lazy(() => import('./pages/ContractDetail'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Documents = lazy(() => import('./pages/Documents'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const NotFound = lazy(() => import('./pages/NotFound'));
const RFPDashboard = lazy(() => import('./pages/RFPDashboard'));
const RFPTemplates = lazy(() => import('./pages/RFPTemplates'));
const CompanyProfiles = lazy(() => import('./pages/CompanyProfiles'));
const RFPAnalytics = lazy(() => import('./pages/RFPAnalytics'));
const RFPResponses = lazy(() => import('./pages/RFPResponses'));
const RFPResponseDetail = lazy(() => import('./pages/RFPResponseDetail'));
const RFPResponseEdit = lazy(() => import('./pages/RFPResponseEdit'));
const AIAnalysisResults = lazy(() => import('./pages/AIAnalysisResults'));
const AIQuickActionsPage = lazy(() => import('./pages/AIQuickActionsPage'));
const LifecycleWorkspace = lazy(() => import('./pages/LifecycleWorkspace'));
const GovernanceWorkspace = lazy(() => import('./pages/GovernanceWorkspace'));
const ContractSuiteWorkspace = lazy(() => import('./pages/ContractSuiteWorkspace'));
const ProductionOperations = lazy(() => import('./pages/ProductionOperations'));

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthGate>
          <div className="min-h-screen bg-gray-50">
            <Layout>
            <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="loading-spinner" /></div>}>
              <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/search" element={<Search />} />
              <Route path="/nlp-search" element={<NLPSearch />} />
              <Route path="/contracts/:noticeId" element={<ContractDetail />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="/operations" element={<ProductionOperations />} />
              <Route path="/lifecycle" element={<LifecycleWorkspace />} />
              <Route path="/lifecycle/:resource" element={<LifecycleWorkspace />} />
              <Route path="/governance" element={<GovernanceWorkspace />} />
              <Route path="/contract-suite" element={<ContractSuiteWorkspace />} />
              <Route path="/contract-suite/:domain" element={<ContractSuiteWorkspace />} />
              
              {/* RFP System Routes */}
              <Route path="/rfp" element={<RFPDashboard />} />
              <Route path="/rfp/dashboard" element={<RFPDashboard />} />
              <Route path="/rfp/generate" element={<Navigate to="/rfp" replace />} />
              <Route path="/rfp/templates" element={<RFPTemplates />} />
              <Route path="/rfp/company-profiles" element={<CompanyProfiles />} />
              <Route path="/rfp/analytics" element={<RFPAnalytics />} />
              <Route path="/rfp/responses" element={<RFPResponses />} />
              <Route path="/rfp/responses/:id" element={<RFPResponseDetail />} />
              <Route path="/rfp/responses/:id/edit" element={<RFPResponseEdit />} />
              
              {/* AI Enhancement Routes */}
              <Route path="/ai/quick-actions" element={<AIQuickActionsPage />} />
              <Route path="/ai/proposal-drafter" element={<Navigate to="/rfp" replace />} />
              <Route path="/ai/bid-analyzer" element={<Navigate to="/rfp" replace />} />
              <Route path="/ai/analysis-results/:contractId" element={<AIAnalysisResults />} />
              <Route path="/ai/win-probability/:contractId" element={<AIAnalysisResults type="probability" />} />
              <Route path="/ai/similar-contracts/:contractId" element={<AIAnalysisResults type="similarity" />} />
              <Route path="/ai/bid-strategy/:contractId" element={<AIAnalysisResults type="strategy" />} />
              
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </Layout>
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
          </div>
        </AuthGate>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
