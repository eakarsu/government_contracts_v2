import React, { useState } from 'react';
import { downloadRFPResponse, getDownloadFormats, saveProposalDraft, exportProposal } from '../../utils/downloadHelpers';
import LoadingSpinner from '../UI/LoadingSpinner';

interface DownloadButtonsProps {
  rfpResponseId?: number;
  proposalId?: number;
  title: string;
  className?: string;
  sections?: any[];
  onSaveDraft?: () => void;
  mode?: 'rfp' | 'proposal';
}

const DownloadButtons: React.FC<DownloadButtonsProps> = ({ 
  rfpResponseId, 
  proposalId,
  title, 
  className = '',
  sections = [],
  onSaveDraft,
  mode = 'rfp'
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formats = getDownloadFormats();

  const handleDownload = async (format: 'txt' | 'pdf' | 'docx') => {
    try {
      setDownloading(format);
      setError(null);
      setSuccess(null);

      console.log(`🔄 [DEBUG] Download attempt: mode=${mode}, rfpResponseId=${rfpResponseId}, proposalId=${proposalId}, format=${format}`);

      let result;
      if (mode === 'rfp' && rfpResponseId) {
        console.log(`📄 [DEBUG] Downloading RFP response ${rfpResponseId} as ${format}`);
        result = await downloadRFPResponse(rfpResponseId, format);
      } else if (mode === 'proposal' && proposalId) {
        console.log(`📄 [DEBUG] Exporting proposal ${proposalId} as ${format}`);
        result = await exportProposal(proposalId, format);
      } else {
        console.error(`❌ [DEBUG] Invalid configuration: mode=${mode}, rfpResponseId=${rfpResponseId}, proposalId=${proposalId}`);
        throw new Error('Invalid configuration for download');
      }
      
      setSuccess(`Successfully downloaded ${result.filename}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || `Failed to download ${format.toUpperCase()} file`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDownloading(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!proposalId || !sections) {
      setError('Cannot save draft: missing proposal data');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveProposalDraft(proposalId, title, sections);
      
      setSuccess('Draft saved successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      if (onSaveDraft) {
        onSaveDraft();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          {mode === 'proposal' ? '📄 Proposal Actions' : '📄 Download RFP Response'}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {mode === 'proposal' 
            ? 'Save or export in your preferred format:'
            : `Download "${title}" in your preferred format:`
          }
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="text-green-800 text-sm">{success}</div>
        </div>
      )}

      {mode === 'proposal' && (
        <div className="mb-4">
          <button
            onClick={handleSaveDraft}
            disabled={saving || downloading !== null}
            className={`
              w-full p-4 border rounded-lg text-left transition-all duration-200
              ${saving 
                ? 'border-green-300 bg-green-50' 
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }
              ${saving || downloading !== null 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">💾</span>
                <div>
                  <div className="font-medium text-gray-900">Save Draft</div>
                  <div className="text-sm text-gray-500">Save current progress</div>
                </div>
              </div>
              
              {saving && (
                <LoadingSpinner size="sm" />
              )}
            </div>
            
            {saving && (
              <div className="mt-2 text-xs text-green-600">
                Saving draft...
              </div>
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {formats.map((formatInfo) => (
          <button
            key={formatInfo.format}
            onClick={() => handleDownload(formatInfo.format)}
            disabled={downloading !== null || saving}
            className={`
              relative p-4 border rounded-lg text-left transition-all duration-200
              ${downloading === formatInfo.format 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }
              ${(downloading !== null && downloading !== formatInfo.format) || saving
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{formatInfo.icon}</span>
                <div>
                  <div className="font-medium text-gray-900">{formatInfo.label}</div>
                  <div className="text-sm text-gray-500">{formatInfo.description}</div>
                </div>
              </div>
              
              {downloading === formatInfo.format && (
                <LoadingSpinner size="sm" />
              )}
            </div>
            
            {downloading === formatInfo.format && (
              <div className="mt-2 text-xs text-blue-600">
                Generating {formatInfo.format.toUpperCase()} file...
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-4">
        <p><strong>💡 Tip:</strong> PDF format is recommended for official submissions, while Word format allows for further editing.</p>
      </div>
    </div>
  );
};

export default DownloadButtons;
