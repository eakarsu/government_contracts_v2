import React, { useState } from 'react';
import { downloadRFPResponse, getDownloadFormats } from '../../utils/downloadHelpers';
import LoadingSpinner from '../UI/LoadingSpinner';

interface DownloadButtonsProps {
  rfpResponseId: number;
  title: string;
  className?: string;
}

const DownloadButtons: React.FC<DownloadButtonsProps> = ({ 
  rfpResponseId, 
  title, 
  className = '' 
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formats = getDownloadFormats();

  const handleDownload = async (format: 'txt' | 'pdf' | 'docx') => {
    try {
      setDownloading(format);
      setError(null);
      setSuccess(null);

      const result = await downloadRFPResponse(rfpResponseId, format);
      
      setSuccess(`Successfully downloaded ${result.filename}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || `Failed to download ${format.toUpperCase()} file`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">📄 Download RFP Response</h3>
        <p className="text-sm text-gray-600 mb-4">
          Download "{title}" in your preferred format:
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {formats.map((formatInfo) => (
          <button
            key={formatInfo.format}
            onClick={() => handleDownload(formatInfo.format)}
            disabled={downloading !== null}
            className={`
              relative p-4 border rounded-lg text-left transition-all duration-200
              ${downloading === formatInfo.format 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }
              ${downloading !== null && downloading !== formatInfo.format 
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
