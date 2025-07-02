import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  Database, 
  Zap, 
  TrendingUp, 
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import StatsCard from '../components/Dashboard/StatsCard';
import RecentJobs from '../components/Dashboard/RecentJobs';
import QueueStatus from '../components/Dashboard/QueueStatus';
import QuickActions from '../components/Dashboard/QuickActions';

const Dashboard: React.FC = () => {
  // Fetch API status
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['api-status'],
    queryFn: () => apiService.getStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch queue status
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => apiService.getQueueStatus(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Connection Error</h3>
        <p className="mt-1 text-sm text-gray-500">
          Unable to connect to the API server. Please check your connection.
        </p>
      </div>
    );
  }

  const stats = status?.database_stats;
  const queueStatus = queueData?.queue_status;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Monitor contract indexing, document processing, and system status
        </p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-lg p-4 ${
        status?.status === 'healthy' 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center">
          {status?.status === 'healthy' ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${
              status?.status === 'healthy' ? 'text-green-800' : 'text-red-800'
            }`}>
              System Status: {status?.status === 'healthy' ? 'Healthy' : 'Error'}
            </h3>
            <p className={`text-sm ${
              status?.status === 'healthy' ? 'text-green-700' : 'text-red-700'
            }`}>
              Last updated: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Contracts"
          value={stats?.contracts_in_db || 0}
          icon={<FileText className="h-6 w-6" />}
          color="blue"
        />
        <StatsCard
          title="Indexed Contracts"
          value={stats?.contracts_indexed || 0}
          icon={<Database className="h-6 w-6" />}
          color="green"
        />
        <StatsCard
          title="Indexed Documents"
          value={stats?.documents_indexed || 0}
          icon={<Zap className="h-6 w-6" />}
          color="purple"
        />
        <StatsCard
          title="Processing Queue"
          value={queueStatus?.total || 0}
          icon={<Clock className="h-6 w-6" />}
          color="yellow"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Recent Jobs - Takes up more space */}
        <div className="xl:col-span-2">
          <RecentJobs />
        </div>

        {/* Queue Status */}
        <div className="xl:col-span-1">
          <QueueStatus />
        </div>

        {/* Quick Actions */}
        <div className="xl:col-span-1">
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
