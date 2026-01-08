import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Play,
  BarChart3,
  FileText,
  Sparkles
} from 'lucide-react';
import { apiService } from '../../services/api';
import Button from '../UI/Button';
import Card from '../UI/Card';

interface ActionStatus {
  type: 'success' | 'error';
  message: string;
}

const QuickActions: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ActionStatus | null>(null);

  // Clear status after 5 seconds
  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 5000);
  };

  const fetchContractsMutation = useMutation({
    mutationFn: () => apiService.fetchContracts({ limit: 100, offset: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
      showStatus('success', 'Contracts fetched successfully');
    },
    onError: (error: Error) => showStatus('error', error.message),
  });

  const indexContractsMutation = useMutation({
    mutationFn: () => apiService.indexContracts(100),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-status'] });
      showStatus('success', 'Contracts indexed successfully');
    },
    onError: (error: Error) => showStatus('error', error.message),
  });

  const downloadDocumentsMutation = useMutation({
    mutationFn: () => apiService.downloadAllDocuments({
      limit: 50,
      download_folder: 'downloaded_documents'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      showStatus('success', 'Document download started');
    },
    onError: (error: Error) => showStatus('error', error.message),
  });

  const processQueueMutation = useMutation({
    mutationFn: () => apiService.startParallelProcessing(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      showStatus('success', 'Processing started');
    },
    onError: (error: Error) => showStatus('error', error.message),
  });

  const actions = [
    {
      title: 'Fetch Contracts',
      description: 'Pull latest contracts from SAM.gov',
      icon: Download,
      variant: 'primary' as const,
      isLoading: fetchContractsMutation.isPending,
      onClick: () => fetchContractsMutation.mutate(),
    },
    {
      title: 'Index Contracts',
      description: 'Index contracts for AI search',
      icon: Play,
      variant: 'primary' as const,
      isLoading: indexContractsMutation.isPending,
      onClick: () => indexContractsMutation.mutate(),
    },
    {
      title: 'Search Contracts',
      description: 'Find matching opportunities',
      icon: Search,
      variant: 'secondary' as const,
      onClick: () => navigate('/search'),
    },
    {
      title: 'AI Search',
      description: 'Natural language queries',
      icon: Sparkles,
      variant: 'accent' as const,
      onClick: () => navigate('/nlp-search'),
    },
    {
      title: 'Download Documents',
      description: 'Fetch contract documents',
      icon: FileText,
      variant: 'secondary' as const,
      isLoading: downloadDocumentsMutation.isPending,
      onClick: () => downloadDocumentsMutation.mutate(),
    },
    {
      title: 'Process Queue',
      description: 'Start document processing',
      icon: BarChart3,
      variant: 'secondary' as const,
      isLoading: processQueueMutation.isPending,
      onClick: () => processQueueMutation.mutate(),
    },
  ];

  return (
    <Card padding="md" className="h-fit">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-900">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={action.onClick}
            disabled={action.isLoading}
            className={`
              group relative flex items-start gap-3 p-4 rounded-xl border text-left
              transition-all duration-200
              ${action.variant === 'primary'
                ? 'border-primary-200 bg-primary-50/50 hover:bg-primary-50 hover:border-primary-300'
                : action.variant === 'accent'
                ? 'border-accent-200 bg-accent-50/50 hover:bg-accent-50 hover:border-accent-300'
                : 'border-secondary-200 bg-secondary-50/50 hover:bg-secondary-100 hover:border-secondary-300'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <div className={`
              flex-shrink-0 p-2 rounded-lg
              ${action.variant === 'primary'
                ? 'bg-primary-100 text-primary-600'
                : action.variant === 'accent'
                ? 'bg-accent-100 text-accent-600'
                : 'bg-secondary-200 text-secondary-600'
              }
            `}>
              {action.isLoading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <action.icon className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 group-hover:text-secondary-800">
                {action.title}
              </p>
              <p className="text-xs text-secondary-500 mt-0.5">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`
            mt-4 p-3 rounded-lg text-sm font-medium animate-fade-in
            ${status.type === 'success'
              ? 'bg-success-50 text-success-700 border border-success-200'
              : 'bg-danger-50 text-danger-700 border border-danger-200'
            }
          `}
        >
          {status.message}
        </div>
      )}
    </Card>
  );
};

export default QuickActions;
