import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Play
} from 'lucide-react';
import { apiService } from '../services/api';
import { IndexingJob } from '../types';

const Jobs: React.FC = () => {
  const { data: jobsData, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiService.getJobs(),
    refetchInterval: 10000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const jobs = jobsData?.jobs || [];

  // Calculate stats
  const stats = {
    total: jobs.length,
    completed: jobs.filter((j: IndexingJob) => j.status === 'completed').length,
    running: jobs.filter((j: IndexingJob) => j.status === 'running').length,
    failed: jobs.filter((j: IndexingJob) => j.status === 'failed').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Indexing Jobs</h1>
          </div>
          <p className="text-sm text-gray-500">
            Track contract indexing and processing jobs
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-gray-600" />
            <span className="text-xs text-gray-500 font-medium">Total Jobs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-gray-500 font-medium">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Play className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-gray-500 font-medium">Running</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-gray-500 font-medium">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Jobs</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">
                Error loading jobs: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        ) : jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job: IndexingJob) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-gray-900">#{job.id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusStyle(job.status)}`}>
                        {getStatusIcon(job.status)}
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-900">{job.records_processed?.toLocaleString() || 0}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500">
                        {job.start_date ? formatDate(job.start_date) : '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500">
                        {job.end_date ? formatDate(job.end_date) : '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {job.error_details ? (
                        <span className="text-sm text-red-600 max-w-xs truncate block" title={job.error_details}>
                          {job.error_details}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-16 text-center">
            <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Found</h3>
            <p className="text-gray-500">Start an indexing job to see it here</p>
          </div>
        )}

        {jobsData?.total && jobsData.total > jobs.length && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-600 text-center">
              Showing {jobs.length} of {jobsData.total} jobs
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Jobs;
