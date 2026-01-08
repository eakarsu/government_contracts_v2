import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';
import Card from '../UI/Card';
import Badge from '../UI/Badge';
import Skeleton from '../UI/Skeleton';

const RecentJobs: React.FC = () => {
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => apiService.getJobs(1, 10),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <Card padding="md">
        <div className="flex items-center justify-between mb-6">
          <Skeleton width={120} height={24} />
          <Skeleton width={80} height={20} />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton width={20} height={20} variant="circular" />
                  <div>
                    <Skeleton width={140} height={16} className="mb-2" />
                    <Skeleton width={80} height={14} />
                  </div>
                </div>
                <Skeleton width={70} height={24} variant="rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="md">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Recent Jobs</h3>
        <div className="p-4 rounded-lg bg-danger-50 border border-danger-200">
          <p className="text-sm text-danger-700">
            Error loading jobs: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </Card>
    );
  }

  const jobs = jobsData?.jobs || [];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          variant: 'success' as const,
          label: 'Completed'
        };
      case 'failed':
        return {
          icon: XCircle,
          variant: 'danger' as const,
          label: 'Failed'
        };
      case 'running':
        return {
          icon: Loader2,
          variant: 'info' as const,
          label: 'Running',
          animate: true
        };
      default:
        return {
          icon: AlertCircle,
          variant: 'warning' as const,
          label: 'Pending'
        };
    }
  };

  const formatJobType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-900">Recent Jobs</h3>
        <span className="text-sm text-secondary-500">
          {jobs.length} of {jobsData?.total || 0}
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary-100 mb-4">
            <Clock className="h-6 w-6 text-secondary-400" />
          </div>
          <h4 className="text-sm font-medium text-secondary-900 mb-1">No jobs yet</h4>
          <p className="text-sm text-secondary-500">
            Start by fetching contracts or processing documents
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => {
            const statusConfig = getStatusConfig(job.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={job.id}
                className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-secondary-50/50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon
                      className={`h-5 w-5 flex-shrink-0 ${
                        statusConfig.variant === 'success' ? 'text-success-500' :
                        statusConfig.variant === 'danger' ? 'text-danger-500' :
                        statusConfig.variant === 'info' ? 'text-info-500 animate-spin' :
                        'text-warning-500'
                      }`}
                    />
                    <div>
                      <h4 className="text-sm font-medium text-secondary-900">
                        {formatJobType(job.type)}
                      </h4>
                      <p className="text-xs text-secondary-500">
                        Job #{job.id} • {formatDate(job.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusConfig.variant} size="sm">
                    {statusConfig.label}
                  </Badge>
                </div>

                {(job.records_processed || job.errors_count > 0) && (
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    {job.records_processed > 0 && (
                      <span className="flex items-center gap-1 text-success-600">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {job.records_processed} processed
                      </span>
                    )}
                    {job.errors_count > 0 && (
                      <span className="flex items-center gap-1 text-danger-600">
                        <XCircle className="h-3.5 w-3.5" />
                        {job.errors_count} errors
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default RecentJobs;
