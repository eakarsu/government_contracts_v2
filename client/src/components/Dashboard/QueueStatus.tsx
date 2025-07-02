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

  const progressPercentage = queueStatus.total > 0 
    ? (queueStatus.completed / queueStatus.total) * 100 
    : 0;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Processing Queue</h3>
        {queueStatus.is_processing && (
          <div className="flex items-center text-sm text-yellow-600">
            <LoadingSpinner size="sm" />
            <span className="ml-2">Processing...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{queueStatus.queued}</div>
          <div className="text-sm text-blue-600">Queued</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{queueStatus.processing}</div>
          <div className="text-sm text-yellow-600">Processing</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{queueStatus.completed}</div>
          <div className="text-sm text-green-600">Completed</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{queueStatus.failed}</div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
      </div>

      {queueStatus.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{queueStatus.completed} / {queueStatus.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {progressPercentage.toFixed(1)}% complete
          </div>
        </div>
      )}

      {queueStatus.recent_documents && queueStatus.recent_documents.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Completions</h4>
          <div className="space-y-2">
            {queueStatus.recent_documents.slice(0, 3).map((doc, index) => (
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

  const progressPercentage = queueStatus.total > 0 
    ? (queueStatus.completed / queueStatus.total) * 100 
    : 0;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Processing Queue</h3>
        {queueStatus.is_processing && (
          <div className="flex items-center text-sm text-yellow-600">
            <LoadingSpinner size="sm" />
            <span className="ml-2">Processing...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{queueStatus.queued}</div>
          <div className="text-sm text-blue-600">Queued</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{queueStatus.processing}</div>
          <div className="text-sm text-yellow-600">Processing</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{queueStatus.completed}</div>
          <div className="text-sm text-green-600">Completed</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{queueStatus.failed}</div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
      </div>

      {queueStatus.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{queueStatus.completed} / {queueStatus.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {progressPercentage.toFixed(1)}% complete
          </div>
        </div>
      )}

      {queueStatus.recent_documents && queueStatus.recent_documents.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Completions</h4>
          <div className="space-y-2">
            {queueStatus.recent_documents.slice(0, 3).map((doc, index) => (
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
