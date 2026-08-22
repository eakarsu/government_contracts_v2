import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../../services/api';
import LoadingSpinner from '../UI/LoadingSpinner';

type PipelineStageId = 'fetch' | 'index' | 'download' | 'process';
type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed';

const INITIAL_PIPELINE_STAGES: Array<{ id: PipelineStageId; label: string; status: PipelineStageStatus }> = [
  { id: 'fetch', label: 'Store complete SAM.gov records and queue every attachment', status: 'pending' },
  { id: 'index', label: 'Vector-index all pending opportunity metadata', status: 'pending' },
  { id: 'download', label: 'Download every queued solicitation attachment', status: 'pending' },
  { id: 'process', label: 'Extract, OCR, and index every downloaded attachment', status: 'pending' },
];

const QuickActions: React.FC = () => {
  const queryClient = useQueryClient();
  const [pipelineStages, setPipelineStages] = useState(INITIAL_PIPELINE_STAGES);

  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['api-status'] });
    queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
  };

  const updatePipelineStage = (id: PipelineStageId, status: PipelineStageStatus) => {
    setPipelineStages(stages => stages.map(stage => stage.id === id ? { ...stage, status } : stage));
  };

  const runPipelineStage = async <T,>(id: PipelineStageId, action: () => Promise<T>): Promise<T> => {
    updatePipelineStage(id, 'running');
    try {
      const result = await action();
      updatePipelineStage(id, 'completed');
      refreshDashboard();
      return result;
    } catch (error) {
      updatePipelineStage(id, 'failed');
      throw error;
    }
  };

  const waitForJob = async (jobId?: number) => {
    if (!jobId) return;
    const deadline = Date.now() + 30 * 60 * 1000;
    while (Date.now() < deadline) {
      const job = await apiService.getJob(jobId);
      if (job.status === 'completed' || job.status === 'completed_with_errors') return;
      if (job.status === 'failed') throw new Error(job.error_details || `Job ${jobId} failed`);
      refreshDashboard();
      await new Promise(resolve => window.setTimeout(resolve, 15000));
    }
    throw new Error(`Job ${jobId} did not finish within 30 minutes`);
  };

  const fullPipelineMutation = useMutation({
    mutationFn: async () => {
      setPipelineStages(INITIAL_PIPELINE_STAGES);

      await runPipelineStage('fetch', () => apiService.fetchContracts({ limit: 100, offset: 0 }));
      await runPipelineStage('index', async () => {
        let totalIndexed = 0;
        for (let batch = 0; batch < 100; batch++) {
          const result = await apiService.indexContracts(100) as any;
          const indexedCount = Number(result.indexed_count) || 0;
          const errorsCount = Number(result.errors_count) || 0;
          totalIndexed += indexedCount;
          refreshDashboard();

          if (indexedCount === 0) {
            if (errorsCount > 0) throw new Error(`${errorsCount} contracts could not be indexed`);
            return { success: true, indexed_count: totalIndexed };
          }
        }
        throw new Error('Contract indexing exceeded 100 batches');
      });

      await runPipelineStage('download', async () => {
        let downloaded = 0;
        let retryRounds = 0;
        for (let batch = 0; batch < 100; batch++) {
          const queue = await apiService.getQueueStatus();
          if ((queue.queue_status.awaiting_download ?? queue.queue_status.queued) === 0) {
            if (queue.queue_status.failed > 0 && retryRounds < 3) {
              const retry = await apiService.retryFailedDocuments() as any;
              if (Number(retry.retried_count) > 0) {
                retryRounds += 1;
                refreshDashboard();
                continue;
              }
            }
            return { success: true, downloaded_count: downloaded };
          }
          const result = await apiService.downloadAllDocuments({
            limit: 1000,
            download_folder: 'downloaded_documents',
            concurrency: 10,
          }) as any;
          if (result.success === false) throw new Error(result.message || result.error || 'Document download failed');
          if (!result.job_id) return { success: true, downloaded_count: downloaded };
          await waitForJob(result.job_id);
          downloaded += Number((await apiService.getJob(result.job_id)).records_processed) || 0;
          refreshDashboard();
        }
        throw new Error('Attachment download exceeded 100 resumable batches');
      });

      await runPipelineStage('process', async () => {
        let completed = 0;
        let retryRounds = 0;
        for (let batch = 0; batch < 100; batch++) {
          const queue = await apiService.getQueueStatus();
          if (queue.queue_status.queued === 0) {
            if (queue.queue_status.failed > 0 && retryRounds < 3) {
              const retry = await apiService.retryFailedDocuments() as any;
              if (Number(retry.retried_count) > 0) {
                retryRounds += 1;
                refreshDashboard();
                continue;
              }
            }
            if (queue.queue_status.failed > 0) {
              throw new Error(`${queue.queue_status.failed} attachments remain failed after all retry attempts`);
            }
            return { success: true, completed_count: completed };
          }
          const result = await apiService.processDocuments(
            undefined,
            1000,
            { autoQueue: false, concurrency: 2, testMode: false }
          ) as any;
          if (result.success === false) throw new Error(result.message || result.error || 'Document processing failed');
          if (!result.job_id) return { success: true, completed_count: completed };
          await waitForJob(result.job_id);
          completed += Number((await apiService.getJob(result.job_id)).records_processed) || 0;
          refreshDashboard();
        }
        throw new Error('Attachment processing exceeded 100 resumable batches');
      });

      return { success: true };
    },
    onSuccess: refreshDashboard,
    onError: (error: any) => console.error('Full pipeline error:', error),
  });

  const fetchContractsMutation = useMutation({
    mutationFn: () => apiService.fetchContracts({ limit: 100, offset: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const indexContractsMutation = useMutation({
    mutationFn: () => apiService.indexContracts(100),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
  });

  const processDocumentsMutation = useMutation({
    mutationFn: () => apiService.processDocuments(
      undefined,
      1000,
      { autoQueue: false, concurrency: 2, testMode: false }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
    onError: (error: any) => {
      console.error('Process documents error:', error);
    },
  });

  const queueDocumentsMutation = useMutation({
    mutationFn: () => apiService.queueDocuments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
  });

  const processQueueMutation = useMutation({
    mutationFn: () => apiService.processQueuedDocuments({ test_limit: 3 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
    },
    onError: (error: any) => {
      console.error('Process queue error:', error);
    },
  });

  const downloadDocumentsMutation = useMutation({
    mutationFn: () => apiService.downloadAllDocuments({
      limit: 1000,
      download_folder: 'downloaded_documents'
    }),
    onSuccess: async (response) => {
      // Invalidate queries to refresh the data from the server
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
    },
    onError: (error: any) => {
      console.error('Download documents error:', error);
    },
  });

  const manualActionPending = [
    fetchContractsMutation,
    indexContractsMutation,
    downloadDocumentsMutation,
    processQueueMutation,
    processDocumentsMutation,
  ].some(mutation => mutation.isPending);

  return (
    <div className="bg-white shadow rounded-lg p-6 h-fit">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Quick Actions</h3>
      <div className="space-y-4">
        <button
          onClick={() => fullPipelineMutation.mutate()}
          disabled={fullPipelineMutation.isPending || manualActionPending}
          className="w-full flex items-center justify-center px-4 py-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
        >
          {fullPipelineMutation.isPending ? <><LoadingSpinner size="sm" color="white" /><span className="ml-2">Running Full Pipeline…</span></> : 'Run Full Pipeline'}
        </button>

        <p className="text-xs text-gray-500">
          Stores 100 complete SAM.gov opportunity records per run, then fully indexes, downloads, and processes every attachment those records add to the queue.
        </p>

        {(fullPipelineMutation.isPending || fullPipelineMutation.isSuccess || fullPipelineMutation.isError) && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            {pipelineStages.map(stage => (
              <div key={stage.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{stage.label}</span>
                <span className={stage.status === 'completed' ? 'text-green-600' : stage.status === 'failed' ? 'text-red-600' : stage.status === 'running' ? 'text-indigo-600' : 'text-gray-400'}>
                  {stage.status === 'running' ? 'Running…' : stage.status.charAt(0).toUpperCase() + stage.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}

        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Advanced / Manual Actions
          </summary>
          <div className="space-y-3 border-t border-gray-200 p-4">
            <button
              onClick={() => fetchContractsMutation.mutate()}
              disabled={fetchContractsMutation.isPending || fullPipelineMutation.isPending}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {fetchContractsMutation.isPending ? <LoadingSpinner size="sm" color="white" /> : 'Fetch Contracts'}
            </button>
            <button
              onClick={() => indexContractsMutation.mutate()}
              disabled={indexContractsMutation.isPending || fullPipelineMutation.isPending}
              className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {indexContractsMutation.isPending ? <LoadingSpinner size="sm" color="white" /> : 'Index Contracts'}
            </button>
            <button
              onClick={() => downloadDocumentsMutation.mutate()}
              disabled={downloadDocumentsMutation.isPending || fullPipelineMutation.isPending}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {downloadDocumentsMutation.isPending ? <LoadingSpinner size="sm" color="white" /> : 'Download Documents'}
            </button>
            <button
              onClick={() => processQueueMutation.mutate()}
              disabled={processQueueMutation.isPending || fullPipelineMutation.isPending}
              className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {processQueueMutation.isPending ? <LoadingSpinner size="sm" color="white" /> : '🧪 Process Queue (3 docs)'}
            </button>
            <button
              onClick={() => processDocumentsMutation.mutate()}
              disabled={processDocumentsMutation.isPending || fullPipelineMutation.isPending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {processDocumentsMutation.isPending ? <LoadingSpinner size="sm" color="white" /> : 'Process All Downloaded Documents'}
            </button>
          </div>
        </details>

      </div>

      {/* Success Messages */}
      {fullPipelineMutation.isSuccess ? (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
          <div className="text-sm text-green-800">Full pipeline completed successfully.</div>
        </div>
      ) : null}

      {fullPipelineMutation.error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <div className="text-sm text-red-800">
            Full pipeline stopped: {fullPipelineMutation.error instanceof Error ? fullPipelineMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {fetchContractsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Contracts fetched successfully!</div>
        </div>
      ) : null}

      {indexContractsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Contracts indexed successfully!</div>
        </div>
      ) : null}


      {processQueueMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">🧪 Test queue processing started! (Limited to 3 downloaded documents)</div>
        </div>
      ) : null}

      {downloadDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-purple-800 text-sm">Documents download started! Check the downloaded_documents folder.</div>
        </div>
      ) : null}

      {processDocumentsMutation.isSuccess ? (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="text-green-800 text-sm">Auto queue & process started!</div>
        </div>
      ) : null}

      {/* Error Messages */}
      {fetchContractsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error fetching contracts: {fetchContractsMutation.error instanceof Error ? fetchContractsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {indexContractsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error indexing contracts: {indexContractsMutation.error instanceof Error ? indexContractsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}


      {processQueueMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error processing queue: {processQueueMutation.error instanceof Error ? processQueueMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {downloadDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error downloading documents: {downloadDocumentsMutation.error instanceof Error ? downloadDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

      {processDocumentsMutation.error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-800 text-sm">
            Error with auto process: {processDocumentsMutation.error instanceof Error ? processDocumentsMutation.error.message : 'Unknown error'}
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default QuickActions;
