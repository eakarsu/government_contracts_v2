import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  RefreshCw,
  FolderOpen,
  FileText,
  HardDrive,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ClipboardList,
  FlaskConical
} from 'lucide-react';
import { apiService } from '../../services/api';
import Card from '../UI/Card';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
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

const DocumentDownload: React.FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
  const [downloadOptions, setDownloadOptions] = useState({
    limit: 1000,
    download_folder: 'downloaded_documents',
    concurrency: 10,
    contract_id: ''
  });

  // Track previous job state to detect completion
  const previousActiveJobRef = useRef<DownloadJob | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDownloadStatus = useCallback(async () => {
    try {
      const response = await apiService.getDownloadStatus();
      if (response.success) {
        setDownloadStatus(response as any);
      }
    } catch (error) {
      console.error('Error fetching download status:', error);
    }
  }, []);

  // Start polling with faster interval
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll every 3 seconds during active downloads
    pollingIntervalRef.current = setInterval(() => {
      fetchDownloadStatus();
    }, 3000);
  }, [fetchDownloadStatus]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchDownloadStatus();

    return () => {
      stopPolling();
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [fetchDownloadStatus, stopPolling]);

  // Detect active job and manage polling
  const activeJob = downloadStatus?.download_jobs?.find(job => job.status === 'running');

  useEffect(() => {
    const previousJob = previousActiveJobRef.current;

    if (activeJob) {
      // Job is running - start polling and set downloading state
      setIsDownloading(true);
      startPolling();
    } else if (previousJob && !activeJob) {
      // Job just completed - do final refreshes and show completion
      setIsDownloading(false);

      // Do a few more refreshes to ensure we have the latest data
      fetchDownloadStatus();

      // Keep polling for 10 more seconds after completion to update stats
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
      completionTimeoutRef.current = setTimeout(() => {
        stopPolling();
        // One final fetch after stopping
        fetchDownloadStatus();
      }, 10000);

      toast.success('Download completed! Stats have been updated.');
    }

    // Update ref to current job
    previousActiveJobRef.current = activeJob || null;
  }, [activeJob, startPolling, stopPolling, fetchDownloadStatus]);

  const handleFetchContracts = async () => {
    try {
      const fetchOptions = {
        start_date: '',
        end_date: '',
        limit: downloadOptions.limit,
        offset: 0
      };

      const response = await apiService.fetchContractsFromDocuments(fetchOptions);

      if (response.success) {
        toast.success(`Successfully fetched contracts: ${response.message}`);
      } else {
        toast.error(response.message || 'Failed to fetch contracts');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch contracts');
    }
  };

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
        // Start polling immediately and fetch initial status
        startPolling();
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="md">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary-50">
            <Download className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-secondary-900">
              Bulk Document Download
            </h2>
            <p className="text-sm text-secondary-500">
              Download all contract documents to a local folder
            </p>
          </div>
        </div>

        {/* Download Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Max Contracts
            </label>
            <input
              type="number"
              value={downloadOptions.limit}
              onChange={(e) => setDownloadOptions(prev => ({
                ...prev,
                limit: parseInt(e.target.value) || 1000
              }))}
              className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              min="1"
              max="10000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Download Folder
            </label>
            <input
              type="text"
              value={downloadOptions.download_folder}
              onChange={(e) => setDownloadOptions(prev => ({
                ...prev,
                download_folder: e.target.value
              }))}
              className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              placeholder="downloaded_documents"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Concurrency
            </label>
            <input
              type="number"
              value={downloadOptions.concurrency}
              onChange={(e) => setDownloadOptions(prev => ({
                ...prev,
                concurrency: parseInt(e.target.value) || 10
              }))}
              className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              min="1"
              max="50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Contract ID (Optional)
            </label>
            <input
              type="text"
              value={downloadOptions.contract_id}
              onChange={(e) => setDownloadOptions(prev => ({
                ...prev,
                contract_id: e.target.value
              }))}
              className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              placeholder="Leave empty for all"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="success"
            onClick={handleFetchContracts}
            leftIcon={ClipboardList}
          >
            Fetch Contracts
          </Button>

          <Button
            variant="primary"
            onClick={handleStartDownload}
            isLoading={isDownloading}
            leftIcon={Download}
          >
            {isDownloading ? 'Downloading...' : 'Start Download'}
          </Button>

          <Button
            variant="outline"
            onClick={fetchDownloadStatus}
            leftIcon={RefreshCw}
          >
            Refresh Status
          </Button>
        </div>

        {/* Active Download Progress */}
        {activeJob && (
          <div className="mt-6 p-4 rounded-xl bg-info-50 border border-info-200">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="h-4 w-4 text-info-600 animate-spin" />
              <h3 className="font-medium text-info-900">
                Download in Progress (Job #{activeJob.id})
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-info-700">Downloaded:</span>
                <span className="font-medium text-info-900 ml-1">{activeJob.records_processed}</span>
              </div>
              <div>
                <span className="text-info-700">Errors:</span>
                <span className="font-medium text-info-900 ml-1">{activeJob.errors_count}</span>
              </div>
              <div>
                <span className="text-info-700">Duration:</span>
                <span className="font-medium text-info-900 ml-1">{activeJob.duration_minutes}m</span>
              </div>
              <div>
                <span className="text-info-700">Started:</span>
                <span className="font-medium text-info-900 ml-1">{formatDate(activeJob.started_at)}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Download Statistics */}
      {downloadStatus?.folder_stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card padding="md" className="text-center">
            <FileText className="h-8 w-8 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-secondary-900">
              {downloadStatus.folder_stats.total_files}
            </p>
            <p className="text-sm text-secondary-500">Total Files</p>
          </Card>
          <Card padding="md" className="text-center">
            <HardDrive className="h-8 w-8 text-success-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-secondary-900">
              {formatFileSize(downloadStatus.folder_stats.total_size_bytes)}
            </p>
            <p className="text-sm text-secondary-500">Total Size</p>
          </Card>
          <Card padding="md" className="text-center">
            <FolderOpen className="h-8 w-8 text-accent-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-secondary-900 truncate">
              {downloadStatus.download_path.split('/').pop() || 'N/A'}
            </p>
            <p className="text-sm text-secondary-500">Download Path</p>
          </Card>
        </div>
      )}

      {/* Recent Download Jobs */}
      {downloadStatus?.download_jobs && downloadStatus.download_jobs.length > 0 && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-secondary-900">Recent Download Jobs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Downloaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {downloadStatus.download_jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-secondary-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">
                      #{job.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusVariant(job.status) as any} size="sm">
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                      {job.records_processed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                      {job.errors_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                      {job.duration_minutes}m
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {formatDate(job.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent Files */}
      {downloadStatus?.folder_stats?.files && downloadStatus.folder_stats.files.length > 0 && (
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-secondary-900">
              Recent Downloaded Files
            </h3>
            <p className="text-sm text-secondary-500">Showing first 20 files</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">
                    Modified
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {downloadStatus.folder_stats.files.slice(0, 20).map((file, index) => (
                  <tr key={index} className="hover:bg-secondary-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">
                      {file.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                      {formatDate(file.modified)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DocumentDownload;
