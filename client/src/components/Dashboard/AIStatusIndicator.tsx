import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Info } from 'lucide-react';

interface AIStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

interface AIHealthStatus {
  status: string;
  message: string;
  capabilities: string[];
  services?: {
    document_processing: string;
    proposal_generation: string;
    file_upload: string;
    database: string;
  };
}

const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({ 
  showDetails = false, 
  className = "" 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const { data: healthData, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-health'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5013/api/ai-rfp/health');
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      return response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 2
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'degraded':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getCapabilityStatus = (capability: string) => {
    const statusMap: Record<string, string> = {
      'document_analysis': '📄 Document Analysis',
      'proposal_generation': '📝 Proposal Generation',
      'bid_analysis': '📊 Bid Analysis',
      'summarization': '📋 Text Summarization',
      'fallback_analysis': '⚡ Basic Analysis (Fallback)',
      'fallback_generation': '📝 Template Generation (Fallback)',
      'fallback_only': '⚠️ Limited Functionality'
    };
    return statusMap[capability] || capability;
  };

  if (isLoading) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
        <span className="text-xs text-gray-500">Checking AI status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-xs text-red-600">AI status unknown</span>
        <button 
          onClick={() => refetch()}
          className="text-xs text-red-500 hover:text-red-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const aiStatus = healthData?.ai_service?.status || 'unknown';
  const message = healthData?.ai_service?.message || 'Unknown status';
  const capabilities = healthData?.ai_service?.capabilities || [];
  const services = healthData?.services || {};

  if (!showDetails) {
    return (
      <div 
        className={`relative inline-flex items-center gap-2 ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {getStatusIcon(aiStatus)}
        <span className="text-xs font-medium">
          {aiStatus === 'healthy' ? 'AI Ready' : 
           aiStatus === 'degraded' ? 'AI Limited' : 
           aiStatus === 'error' ? 'AI Offline' : 'AI Unknown'}
        </span>
        
        {showTooltip && (
          <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            <div className="text-sm font-medium text-gray-900 mb-1">AI Service Status</div>
            <div className="text-xs text-gray-600 mb-2">{message}</div>
            <div className="text-xs">
              <div className="font-medium text-gray-700 mb-1">Available Features:</div>
              {capabilities.map((cap: string, index: number) => (
                <div key={index} className="text-gray-600">
                  • {getCapabilityStatus(cap)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-lg ${getStatusColor(aiStatus)} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(aiStatus)}
          <span className="font-medium">AI Service Status</span>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1 hover:bg-black hover:bg-opacity-10 rounded"
          title="Refresh status"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      
      <p className="text-sm mb-3">{message}</p>
      
      {Object.keys(services).length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-medium mb-2">Service Components:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(services).map(([service, status]) => (
              <div key={service} className="flex items-center gap-1">
                {status === 'available' || status === 'connected' ? 
                  <CheckCircle className="h-3 w-3 text-green-500" /> :
                  status === 'degraded' ?
                  <AlertTriangle className="h-3 w-3 text-yellow-500" /> :
                  <XCircle className="h-3 w-3 text-red-500" />
                }
                <span className="capitalize">{service.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {capabilities.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">Available Capabilities:</div>
          <div className="space-y-1">
            {capabilities.map((cap: string, index: number) => (
              <div key={index} className="text-xs flex items-center gap-1">
                <Info className="h-3 w-3" />
                {getCapabilityStatus(cap)}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-2 pt-2 border-t border-current border-opacity-20">
        <div className="text-xs opacity-75">
          Last checked: {new Date(healthData?.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default AIStatusIndicator;