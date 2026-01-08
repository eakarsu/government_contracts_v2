import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Database,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Calendar,
  Building2,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import { contractsApi } from '../services/contractsApi';
import WinProbabilityPanel from '../components/Dashboard/WinProbabilityPanel';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => apiService.getStatus(),
    refetchInterval: 30000,
  });

  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['recent-contracts'],
    queryFn: () => contractsApi.getContracts(1, 8),
    staleTime: 60000,
  });

  const stats = status?.database_stats;
  const contracts = (contractsData as any)?.contracts || [];

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-secondary-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
          <p className="text-gray-500 max-w-md">
            Unable to connect to the API server.
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Government contract opportunities and analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              status?.status === 'healthy'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {status?.status === 'healthy' ? 'System Online' : 'System Error'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Contracts</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {stats?.contracts_in_db?.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Indexed for AI</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {stats?.contracts_indexed?.toLocaleString() || 0}
              </p>
            </div>
            <div className="p-2.5 bg-green-50 rounded-lg">
              <Database className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Win Rate</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">68%</p>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Bids</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">12</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Contracts - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Recent Contracts</h2>
                <button
                  onClick={() => navigate('/search')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {contractsLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading contracts...
                </div>
              ) : contracts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No contracts found. Click "Fetch Contracts" to get started.
                </div>
              ) : (
                contracts.slice(0, 6).map((contract: any) => (
                  <div
                    key={contract.noticeId}
                    onClick={() => navigate(`/contracts/${contract.noticeId}`)}
                    className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {contract.title || 'Untitled Contract'}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {contract.agency?.split('.')[0] || 'Unknown Agency'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {contract.postedDate ? formatDate(contract.postedDate) : 'No date'}
                          </span>
                        </div>
                      </div>
                      {contract.naicsCode && (
                        <span className="flex-shrink-0 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {contract.naicsCode}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Win Probability Panel - Takes 1 column */}
        <div className="lg:col-span-1">
          <WinProbabilityPanel />
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
