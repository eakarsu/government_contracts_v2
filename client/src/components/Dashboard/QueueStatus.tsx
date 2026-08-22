import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import LoadingSpinner from '../UI/LoadingSpinner';

const QueueStatus: React.FC = () => {
  const { data: queueData, isLoading, error } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => apiService.getQueueStatus(),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Queue</h3>
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Queue</h3>
        <div className="text-red-600 text-sm">
          Error loading queue status: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  const queueStatus = queueData?.queue_status;

  if (!queueStatus) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Queue</h3>
        <div className="text-gray-500 text-sm">No queue data available</div>
      </div>
    );
  }

  const terminalCount = queueStatus.completed + queueStatus.failed;
  const progressPercentage = queueStatus.total > 0 
    ? (terminalCount / queueStatus.total) * 100
    : 0;

  return (
    <div className="bg-white shadow rounded-lg p-6 h-fit">
      <div className="flex justify-between items-start mb-6 gap-3">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Document Processing Status</h3>
          <p className="mt-1 text-xs text-gray-500">
            PostgreSQL stores opportunity records. This panel tracks solicitation attachments through download, extraction, and AI analysis.
          </p>
        </div>
        {queueStatus.is_processing && (
          <div className="flex items-center text-sm text-yellow-600">
            <LoadingSpinner size="sm" />
            <span className="ml-2">Processing...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-blue-600">{queueStatus.awaiting_download ?? queueStatus.queued}</div>
          <div className="text-xs text-blue-600">Awaiting Download</div>
        </div>
        <div className="bg-indigo-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-indigo-600">{queueStatus.ready_to_process ?? 0}</div>
          <div className="text-xs text-indigo-600">Ready to Process</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-yellow-600">{queueStatus.processing}</div>
          <div className="text-xs text-yellow-600">Processing</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-green-600">{queueStatus.completed}</div>
          <div className="text-xs text-green-600">Completed</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="text-xl font-bold text-red-600">{queueStatus.failed}</div>
          <div className="text-xs text-red-600">Failed</div>
        </div>
      </div>

      {queueStatus.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{terminalCount} / {queueStatus.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {progressPercentage.toFixed(1)}% handled ({queueStatus.completed} completed, {queueStatus.failed} failed)
          </div>
        </div>
      )}

      {queueStatus.recent_completed && queueStatus.recent_completed.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Completions</h4>
          <div className="space-y-2">
            {queueStatus.recent_completed.slice(0, 3).map((doc: { filename: string; completed_at: string }, index: number) => (
              <div key={index} className="flex justify-between items-center text-xs">
                <span className="text-gray-600 truncate">{doc.filename}</span>
                <span className="text-gray-500">
                  {new Date(doc.completed_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueStatus;
