import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

// Layout Components
import Layout from '@/components/Layout/Layout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Search from '@/pages/Search';
import Contracts from '@/pages/Contracts';
import ContractDetail from '@/pages/ContractDetail';
import Jobs from '@/pages/Jobs';
import Documents from '@/pages/Documents';
import ApiDocs from '@/pages/ApiDocs';
import NotFound from '@/pages/NotFound';

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
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/contracts/:noticeId" element={<ContractDetail />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/api-docs" element={<ApiDocs />} />
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
