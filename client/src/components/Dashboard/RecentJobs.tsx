import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api';
import { IndexingJob } from '../../types';
import LoadingSpinner from '../UI/LoadingSpinner';

const RecentJobs: React.FC = () => {
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['recentJobs'],
    queryFn: () => apiService.getJobs(1, 5),
    refetchInterval: 30000,
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Recent Jobs</h3>
        <Link
          to="/jobs"
          className="text-sm text-primary-600 hover:text-primary-900"
        >
          View all
        </Link>
      </div>

      {jobsData?.jobs && jobsData.jobs.length > 0 ? (
        <div className="space-y-3">
          {jobsData.jobs.map((job: IndexingJob) => (
            <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-900">
                    Job #{job.id}
                  </span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
                      job.status
                    )}`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {job.records_processed?.toLocaleString() || 0} records processed
                </div>
                {job.started_at && (
                  <div className="text-xs text-gray-400">
                    Started: {formatDate(job.started_at)}
                  </div>
                )}
              </div>
              {job.status === 'running' && (
                <div className="ml-3">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-sm text-center py-4">
          No recent jobs found
        </div>
      )}
    </div>
  );
};

export default RecentJobs;
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api';
import { IndexingJob } from '../../types';
import LoadingSpinner from '../UI/LoadingSpinner';

const RecentJobs: React.FC = () => {
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['recentJobs'],
    queryFn: () => apiService.getJobs(1, 5),
    refetchInterval: 30000,
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Recent Jobs</h3>
        <Link
          to="/jobs"
          className="text-sm text-primary-600 hover:text-primary-900"
        >
          View all
        </Link>
      </div>

      {jobsData?.jobs && jobsData.jobs.length > 0 ? (
        <div className="space-y-3">
          {jobsData.jobs.map((job: IndexingJob) => (
            <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-900">
                    Job #{job.id}
                  </span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
                      job.status
                    )}`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {job.records_processed?.toLocaleString() || 0} records processed
                </div>
                {job.started_at && (
                  <div className="text-xs text-gray-400">
                    Started: {formatDate(job.started_at)}
                  </div>
                )}
              </div>
              {job.status === 'running' && (
                <div className="ml-3">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-sm text-center py-4">
          No recent jobs found
        </div>
      )}
    </div>
  );
};

export default RecentJobs;
