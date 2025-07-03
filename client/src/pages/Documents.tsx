import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { QueueStatus, ApiResponse } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import DocumentDownload from '../components/Dashboard/DocumentDownload';

const Documents: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [model, setModel] = useState('');
  const [activeTab, setActiveTab] = useState<'download' | 'upload' | 'queue'>('download');
  const queryClient = useQueryClient();

  const { data: queueStatus, isLoading: queueLoading } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => apiService.getQueueStatus(),
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { files: FileList; customPrompt?: string; model?: string }) =>
      apiService.uploadMultipleDocuments(data.files, data.customPrompt, data.model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
      setSelectedFiles(null);
      setCustomPrompt('');
      setModel('');
    },
  });

  const processQueueMutation = useMutation({
    mutationFn: () => apiService.processQueueAsync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate({ files: selectedFiles, customPrompt, model });
    }
  };

  const handleProcessQueue = () => {
    processQueueMutation.mutate();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
        <p className="mt-2 text-gray-600">
          Download, upload, and process documents with AI analysis
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('download')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'download'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📥 Download Documents
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📤 Upload Documents
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ⚙️ Processing Queue
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'download' && (
        <DocumentDownload />
      )}

      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Documents</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Files
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Prompt (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter custom analysis prompt..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model (Optional)
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., gpt-4"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!selectedFiles || uploadMutation.isPending}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {uploadMutation.isPending ? <LoadingSpinner size="sm" /> : 'Upload Files'}
            </button>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Processing Queue</h2>
            <button
              onClick={handleProcessQueue}
              disabled={processQueueMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {processQueueMutation.isPending ? <LoadingSpinner size="sm" /> : 'Process Queue'}
            </button>
          </div>

          {queueLoading ? (
            <LoadingSpinner />
          ) : queueStatus?.queue_status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {queueStatus.queue_status.queued}
                  </div>
                  <div className="text-sm text-blue-600">Queued</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {queueStatus.queue_status.processing}
                  </div>
                  <div className="text-sm text-yellow-600">Processing</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {queueStatus.queue_status.completed}
                  </div>
                  <div className="text-sm text-green-600">Completed</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {queueStatus.queue_status.failed}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        queueStatus.queue_status.total > 0
                          ? (queueStatus.queue_status.completed / queueStatus.queue_status.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="ml-3 text-sm text-gray-600">
                  {queueStatus.queue_status.completed} / {queueStatus.queue_status.total}
                </span>
              </div>

              {queueStatus.queue_status.is_processing && (
                <div className="flex items-center text-sm text-yellow-600">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Processing in progress...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No queue data available</div>
          )}
        </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Processing Queue</h2>
            <button
              onClick={handleProcessQueue}
              disabled={processQueueMutation.isPending}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {processQueueMutation.isPending ? <LoadingSpinner size="sm" /> : 'Process Queue'}
            </button>
          </div>

          {queueLoading ? (
            <LoadingSpinner />
          ) : queueStatus?.queue_status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {queueStatus.queue_status.queued}
                  </div>
                  <div className="text-sm text-blue-600">Queued</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {queueStatus.queue_status.processing}
                  </div>
                  <div className="text-sm text-yellow-600">Processing</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {queueStatus.queue_status.completed}
                  </div>
                  <div className="text-sm text-green-600">Completed</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {queueStatus.queue_status.failed}
                  </div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        queueStatus.queue_status.total > 0
                          ? (queueStatus.queue_status.completed / queueStatus.queue_status.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="ml-3 text-sm text-gray-600">
                  {queueStatus.queue_status.completed} / {queueStatus.queue_status.total}
                </span>
              </div>

              {queueStatus.queue_status.is_processing && (
                <div className="flex items-center text-sm text-yellow-600">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Processing in progress...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No queue data available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Documents;
