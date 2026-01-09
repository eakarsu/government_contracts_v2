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
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { apiService } from '../services/api';
import { contractsApi } from '../services/contractsApi';
import WinProbabilityPanel from '../components/Dashboard/WinProbabilityPanel';
import StatsCard from '../components/Dashboard/StatsCard';

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
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Dashboard
              </h1>
            </div>
            <p className="text-sm text-gray-500 ml-[52px]">
              Government contract opportunities and analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-sm transition-all ${
              status?.status === 'healthy'
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200'
                : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                status?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {status?.status === 'healthy' ? 'System Online' : 'System Error'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Contracts"
          value={stats?.contracts_in_db || 0}
          icon={FileText}
          variant="primary"
          gradient
          animationDelay={0}
          subtitle="Available opportunities"
          onClick={() => navigate('/search')}
        />
        <StatsCard
          title="Indexed for AI"
          value={stats?.contracts_indexed || 0}
          icon={Database}
          variant="success"
          gradient
          animationDelay={100}
          subtitle="Ready for analysis"
          onClick={() => navigate('/documents')}
        />
        <StatsCard
          title="Avg Win Rate"
          value="68%"
          icon={TrendingUp}
          variant="info"
          gradient
          animationDelay={200}
          trend={{ value: 5.2, isPositive: true }}
          onClick={() => navigate('/ai/bid-analyzer')}
        />
        <StatsCard
          title="Active Bids"
          value={12}
          icon={CheckCircle}
          variant="warning"
          gradient
          animationDelay={300}
          subtitle="In progress"
          onClick={() => navigate('/rfp/responses')}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Contracts - Takes 2 columns */}
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Contracts</h2>
                </div>
                <button
                  onClick={() => navigate('/search')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {contractsLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading contracts...
                </div>
              ) : contracts.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-2">No contracts found</p>
                  <p className="text-sm text-gray-400">Click "Fetch Contracts" to get started.</p>
                </div>
              ) : (
                contracts.slice(0, 6).map((contract: any, index: number) => (
                  <div
                    key={contract.noticeId}
                    onClick={() => navigate(`/contracts/${contract.noticeId}`)}
                    className="px-6 py-4 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-l-blue-500 group"
                    style={{ animationDelay: `${500 + index * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                          {contract.title || 'Untitled Contract'}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            {contract.agency?.split('.')[0] || 'Unknown Agency'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {contract.postedDate ? formatDate(contract.postedDate) : 'No date'}
                          </span>
                        </div>
                      </div>
                      {contract.naicsCode && (
                        <span className="flex-shrink-0 px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-600 text-xs font-medium rounded-md border border-indigo-100">
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
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <WinProbabilityPanel />
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
