import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Layout Components
import Layout from './components/Layout/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import NLPSearch from './pages/NLPSearch';
import ContractDetail from './pages/ContractDetail';
import Jobs from './pages/Jobs';
import Documents from './pages/Documents';
import ApiDocs from './pages/ApiDocs';
import NotFound from './pages/NotFound';

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
import ProposalDrafter from './components/Proposals/ProposalDrafter';
import BidProbabilityAnalyzer from './components/Bidding/BidProbabilityAnalyzer';
import AIAnalysisResults from './pages/AIAnalysisResults';
import AIQuickActionsPage from './pages/AIQuickActionsPage';

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
        <div className="min-h-screen bg-gray-50">
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/search" element={<Search />} />
              <Route path="/nlp-search" element={<NLPSearch />} />
              <Route path="/contracts/:noticeId" element={<ContractDetail />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              
              {/* RFP System Routes */}
              <Route path="/rfp" element={<RFPDashboard />} />
              <Route path="/rfp/dashboard" element={<RFPDashboard />} />
              <Route path="/rfp/generate" element={<RFPGenerator />} />
              <Route path="/rfp/templates" element={<RFPTemplates />} />
              <Route path="/rfp/company-profiles" element={<CompanyProfiles />} />
              <Route path="/rfp/analytics" element={<RFPAnalytics />} />
              <Route path="/rfp/responses" element={<RFPResponses />} />
              <Route path="/rfp/responses/:id" element={<RFPResponseDetail />} />
              <Route path="/rfp/responses/:id/edit" element={<RFPResponseEdit />} />
              
              {/* AI Enhancement Routes */}
              <Route path="/ai/quick-actions" element={<AIQuickActionsPage />} />
              <Route path="/ai/proposal-drafter" element={<ProposalDrafter />} />
              <Route path="/ai/bid-analyzer" element={<BidProbabilityAnalyzer />} />
              <Route path="/ai/analysis-results/:contractId" element={<AIAnalysisResults />} />
              <Route path="/ai/win-probability/:contractId" element={<AIAnalysisResults type="probability" />} />
              <Route path="/ai/similar-contracts/:contractId" element={<AIAnalysisResults type="similarity" />} />
              <Route path="/ai/bid-strategy/:contractId" element={<AIAnalysisResults type="strategy" />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
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
      </Router>
    </QueryClientProvider>
  );
}

export default App;
