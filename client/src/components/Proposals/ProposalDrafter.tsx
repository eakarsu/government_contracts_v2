import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { FileText, Wand2, RefreshCw, CheckCircle, AlertCircle, Building2, Calendar, ChevronRight, ArrowLeft, ChevronLeft, Search, Download, Sparkles } from 'lucide-react';
import type { Contract } from '../../types';

interface ProposalSection {
  id: string;
  title: string;
  content: string;
}

interface GeneratedProposal {
  id: string;
  contractId: string;
  contractTitle: string;
  sections: ProposalSection[];
  generatedAt: string;
}

const ProposalDrafter: React.FC = () => {
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [generatedProposal, setGeneratedProposal] = useState<GeneratedProposal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Contracts state with pagination
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractPage, setContractPage] = useState(1);
  const [totalContracts, setTotalContracts] = useState(0);
  const contractsPerPage = 10;

  useEffect(() => {
    loadContracts(contractPage);
  }, [contractPage]);

  const loadContracts = async (page: number) => {
    setContractsLoading(true);
    try {
      const offset = (page - 1) * contractsPerPage;
      const response = await fetch(`/api/bid-prediction/contracts?limit=${contractsPerPage}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setTotalContracts(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setContractsLoading(false);
    }
  };

  const searchContracts = async (query: string) => {
    if (query.length < 2) {
      loadContracts(1);
      setContractPage(1);
      return;
    }

    setContractsLoading(true);
    try {
      const response = await fetch(`/api/bid-prediction/contracts?search=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setTotalContracts(data.total || 0);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setContractsLoading(false);
    }
  };

  // Generate proposal mutation
  const generateMutation = useMutation({
    mutationFn: async (contract: Contract) => {
      const response = await fetch('/api/ai/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.noticeId,
          contractTitle: contract.title,
          agency: contract.agency,
          description: contract.description,
          naicsCode: contract.naicsCode
        })
      });
      if (!response.ok) throw new Error('Failed to generate proposal');
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedProposal(data.proposal);
    }
  });

  const handleGenerateProposal = (contract: Contract) => {
    setSelectedContract(contract);
    setGeneratedProposal(null);
    generateMutation.mutate(contract);
  };

  const downloadProposal = (format: 'pdf' | 'doc' | 'txt') => {
    if (!generatedProposal) return;

    if (format === 'pdf') {
      fetch('/api/ai/export-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal: generatedProposal, format: 'pdf' })
      })
        .then(response => response.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `proposal-${generatedProposal.contractId}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
        .catch(err => {
          console.error('PDF download failed:', err);
          alert('PDF download failed. Try Word or Text format.');
        });
      return;
    }

    let content = '';

    if (format === 'doc') {
      content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Proposal - ${generatedProposal.contractTitle}</title>
<style>
body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
h2 { color: #2c5282; margin-top: 30px; }
p { margin: 10px 0; }
</style>
</head>
<body>
<h1>PROPOSAL</h1>
<p><strong>Contract:</strong> ${generatedProposal.contractTitle}</p>
<p><strong>Generated:</strong> ${new Date(generatedProposal.generatedAt).toLocaleString()}</p>
`;
      generatedProposal.sections.forEach((section, index) => {
        content += `<h2>${index + 1}. ${section.title}</h2>
<p>${section.content.replace(/\n/g, '</p><p>')}</p>
`;
      });
      content += '</body></html>';

      const blob = new Blob([content], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${generatedProposal.contractId}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      content = `PROPOSAL: ${generatedProposal.contractTitle}
Generated: ${new Date(generatedProposal.generatedAt).toLocaleString()}
${'='.repeat(60)}

`;
      generatedProposal.sections.forEach((section, index) => {
        content += `${index + 1}. ${section.title.toUpperCase()}
${'-'.repeat(40)}
${section.content}

`;
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${generatedProposal.contractId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const totalPages = Math.ceil(totalContracts / contractsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
          <Wand2 className="h-7 w-7 text-indigo-600" />
          AI Proposal Drafter
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a contract and generate an AI-powered proposal using OpenRouter
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Contract Selection */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Select Contract</h2>
              <span className="text-xs text-gray-500">{totalContracts} contracts</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchContracts(e.target.value);
                }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[450px] overflow-y-auto">
            {contractsLoading ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading contracts...
              </div>
            ) : contracts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p>No contracts found</p>
              </div>
            ) : (
              contracts.map((contract: Contract) => (
                <div
                  key={contract.noticeId}
                  onClick={() => setSelectedContract(contract)}
                  className={`px-5 py-4 cursor-pointer transition-colors ${
                    selectedContract?.noticeId === contract.noticeId
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {contract.title || 'Untitled Contract'}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {contract.agency?.split('.')[0] || 'Unknown'}
                        </span>
                        {contract.postedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(contract.postedDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {!searchQuery && totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setContractPage(Math.max(1, contractPage - 1))}
                disabled={contractPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3 w-3" />
                Previous
              </button>

              <span className="text-xs text-gray-500">
                Page {contractPage} of {totalPages}
              </span>

              <button
                onClick={() => setContractPage(Math.min(totalPages, contractPage + 1))}
                disabled={contractPage >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Generate Proposal */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Generate Proposal
            </h2>
          </div>

          <div className="p-5">
            {!selectedContract ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a contract from the left to generate a proposal</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Contract Info */}
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
                  <h3 className="font-medium text-gray-900 text-sm mb-2">
                    {selectedContract.title || 'Untitled Contract'}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    {selectedContract.agency || 'Unknown Agency'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedContract.naicsCode && (
                      <span className="inline-block px-2 py-1 bg-white text-gray-600 text-xs rounded border">
                        NAICS: {selectedContract.naicsCode}
                      </span>
                    )}
                    {selectedContract.postedDate && (
                      <span className="inline-block px-2 py-1 bg-white text-gray-600 text-xs rounded border">
                        Posted: {formatDate(selectedContract.postedDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={() => handleGenerateProposal(selectedContract)}
                  disabled={generateMutation.isPending}
                  className="w-full px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating proposal with AI...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate AI Proposal
                    </>
                  )}
                </button>

                {/* Error */}
                {generateMutation.isError && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-sm text-red-700">Failed to generate proposal. Try again.</p>
                  </div>
                )}

                {/* Generated Proposal */}
                {generatedProposal && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold text-gray-900">Proposal Generated</h3>
                    </div>

                    <div className="space-y-4 max-h-[350px] overflow-y-auto">
                      {generatedProposal.sections.map((section, index) => (
                        <div key={section.id} className="p-4 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            {index + 1}. {section.title}
                          </h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {section.content}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        Download proposal:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => downloadProposal('pdf')}
                          className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </button>
                        <button
                          onClick={() => downloadProposal('doc')}
                          className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Word
                        </button>
                        <button
                          onClick={() => downloadProposal('txt')}
                          className="px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Text
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalDrafter;
