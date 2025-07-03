import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { StatsCard } from './StatsCard';
import toast from 'react-hot-toast';

interface DownloadJob {
  id: number;
  status: string;
  started_at: string;
  completed_at?: string;
  records_processed: number;
  errors_count: number;
  duration_minutes: number;
}

interface FolderStats {
  total_files: number;
  total_size_bytes: number;
  files: Array<{
    name: string;
    size: number;
    modified: string;
  }>;
}

interface DownloadStatus {
  download_jobs: DownloadJob[];
  folder_stats: FolderStats | null;
  download_path: string;
}

export const DocumentDownload: React.FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
  const [downloadOptions, setDownloadOptions] = useState({
    limit: 1000,
    download_folder: 'downloaded_documents',
    concurrency: 10,
    contract_id: ''
  });

  const fetchDownloadStatus = async () => {
    try {
      const response = await apiService.getDownloadStatus();
      if (response.success) {
        setDownloadStatus(response as any);
      }
    } catch (error) {
      console.error('Error fetching download status:', error);
    }
  };

  useEffect(() => {
    fetchDownloadStatus();
    
    // Refresh status every 10 seconds if downloading
    const interval = setInterval(() => {
      if (isDownloading) {
        fetchDownloadStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isDownloading]);

  const handleStartDownload = async () => {
    try {
      setIsDownloading(true);
      
      const options = {
        ...downloadOptions,
        contract_id: downloadOptions.contract_id || undefined
      };

      const response = await apiService.downloadAllDocuments(options);
      
      if (response.success) {
        toast.success(`Started downloading documents to ${downloadOptions.download_folder}`);
        fetchDownloadStatus();
      } else {
        toast.error(response.message || 'Failed to start download');
        setIsDownloading(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start download');
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const activeJob = downloadStatus?.download_jobs.find(job => job.status === 'running');

  useEffect(() => {
    if (activeJob) {
      setIsDownloading(true);
    } else {
      setIsDownloading(false);
    }
  }, [activeJob]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          📥 Bulk Document Download
        </h2>
        <p className="text-gray-600 mb-6">
          Download all contract documents to a local folder without AI processing. 
          This is useful for creating a local archive of all government contract documents.
        </p>

        {/* Download Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Contracts
            </label>
            <input
              type="number"
              value={downloadOptions.limit}
              onChange={(e) => setDownloadOptions(prev => ({ 
                ...prev, 
                limit: parseInt(e.target.value) || 1000 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="10000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Download Folder
            </label>
            <input
              type="text"
              value={downloadOptions.download_folder}
              onChange={(e) => setDownloadOptions(prev => ({ 
                ...prev, 
                download_folder: e.target.value 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="downloaded_documents"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Concurrency
            </label>
            <input
              type="number"
              value={downloadOptions.concurrency}
              onChange={(e) => setDownloadOptions(prev => ({ 
                ...prev, 
                concurrency: parseInt(e.target.value) || 10 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract ID (Optional)
            </label>
            <input
              type="text"
              value={downloadOptions.contract_id}
              onChange={(e) => setDownloadOptions(prev => ({ 
                ...prev, 
                contract_id: e.target.value 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave empty for all"
            />
          </div>
        </div>

        {/* Download Button */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleStartDownload}
            disabled={isDownloading}
            className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
              isDownloading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isDownloading ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                Downloading...
              </>
            ) : (
              <>
                📥 Start Download
              </>
            )}
          </button>

          <button
            onClick={fetchDownloadStatus}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            🔄 Refresh Status
          </button>
        </div>

        {/* Active Download Progress */}
        {activeJob && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">
              📥 Download in Progress (Job #{activeJob.id})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Downloaded:</span>
                <span className="font-medium ml-1">{activeJob.records_processed}</span>
              </div>
              <div>
                <span className="text-blue-700">Errors:</span>
                <span className="font-medium ml-1">{activeJob.errors_count}</span>
              </div>
              <div>
                <span className="text-blue-700">Duration:</span>
                <span className="font-medium ml-1">{activeJob.duration_minutes}m</span>
              </div>
              <div>
                <span className="text-blue-700">Started:</span>
                <span className="font-medium ml-1">{formatDate(activeJob.started_at)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Download Statistics */}
      {downloadStatus?.folder_stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Total Files"
            value={downloadStatus.folder_stats.total_files}
            icon="📄"
            color="blue"
          />
          <StatsCard
            title="Total Size"
            value={formatFileSize(downloadStatus.folder_stats.total_size_bytes)}
            icon="💾"
            color="green"
          />
          <StatsCard
            title="Download Path"
            value={downloadStatus.download_path.split('/').pop() || 'N/A'}
            icon="📁"
            color="purple"
          />
        </div>
      )}

      {/* Recent Download Jobs */}
      {downloadStatus?.download_jobs && downloadStatus.download_jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Download Jobs
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Downloaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {downloadStatus.download_jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{job.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.records_processed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.errors_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.duration_minutes}m
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(job.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Files */}
      {downloadStatus?.folder_stats?.files && downloadStatus.folder_stats.files.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Downloaded Files (showing first 20)
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modified
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {downloadStatus.folder_stats.files.map((file, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {file.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.modified)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
