import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../UI/LoadingSpinner';

const RecentJobs: React.FC = () => {
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => apiService.getJobs(1, 10),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Jobs</h3>
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Jobs</h3>
        <div className="text-red-600 text-sm">
          Error loading jobs: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  const jobs = jobsData?.jobs || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'completed_with_errors':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <LoadingSpinner size="sm" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'completed_with_errors':
        return 'text-amber-700 bg-amber-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'running':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  const formatJobType = (type: string) => {
    const labels: Record<string, string> = {
      contracts: 'SAM Records Stored in PostgreSQL',
      contracts_indexing: 'Contract Vector Index',
      document_download: 'Solicitation Attachment Download',
      queue_processing: 'Attachment Extraction and AI Analysis',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const processedLabel = (type: string) => {
    if (type === 'contracts') return 'opportunities stored';
    if (type === 'contracts_indexing') return 'contracts vector-indexed';
    if (type === 'document_download') return 'attachments downloaded';
    if (type === 'queue_processing') return 'attachments completed';
    return 'records processed';
  };

  const formatJobTimestamp = (value?: string) => {
    if (!value) return 'Unknown';
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return 'Unknown';
    return timestamp.toLocaleString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Recent Jobs</h3>
        <span className="text-sm text-gray-500">
          {jobs.length} of {jobsData?.total || 0} jobs
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start by fetching contracts or processing documents.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job: any) => (
            <div key={job.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {formatJobType(job.type)}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Job #{job.id}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatJobTimestamp(job.created_at)}
                  </p>
                </div>
              </div>
              
              {(job.records_processed || job.errors_count) && (
                <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                  {job.records_processed && (
                    <span>
                      ✅ {job.records_processed} {processedLabel(job.type)}
                    </span>
                  )}
                  {job.errors_count > 0 && (
                    <span className="text-red-600">
                      ❌ {job.errors_count} errors
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentJobs;
