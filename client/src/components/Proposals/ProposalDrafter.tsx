import React, { useState, useEffect } from 'react';
import { FileText, Upload, Wand2, Download, Save, Eye, CheckCircle, AlertCircle, Trash2, HelpCircle, Info, Clock } from 'lucide-react';
import DownloadButtons from '../RFP/DownloadButtons';
import { useAINavigation } from '../../contexts/AINavigationContext';

interface RFPDocument {
  id: string;
  filename: string;
  contractId?: string;
  requirements: any;
  sections: any[];
  uploadedAt: string;
  hasAnalysis: boolean;
}

interface ProposalSection {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  wordCount: number;
  status: 'generated' | 'reviewed' | 'approved';
  compliance: {
    wordLimit: {
      current: number;
      maximum?: number;
      compliant: boolean;
    };
    requirementCoverage: {
      covered: string[];
      missing: string[];
      percentage: number;
    };
  };
  lastModified: string;
  modifiedBy: string;
}

interface Proposal {
  id: string;
  title: string;
  sections: ProposalSection[];
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const ProposalDrafter: React.FC = () => {
  const { setParentRoute } = useAINavigation();
  const [rfpDocuments, setRfpDocuments] = useState<RFPDocument[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedRfp, setSelectedRfp] = useState<string>('');
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    setParentRoute('/ai/proposal-drafter');
    loadRfpDocuments();
    loadProposals();
  }, [setParentRoute]);

  // Auto-load first proposal when proposals are loaded and no current proposal is set
  useEffect(() => {
    if (proposals.length > 0 && !currentProposal) {
      loadProposal(proposals[0].id);
    }
  }, [proposals, currentProposal]);

  // Auto-load first proposal when switching to edit tab
  useEffect(() => {
    if (activeTab === 'edit' && proposals.length > 0 && !currentProposal) {
      loadProposal(proposals[0].id);
    }
  }, [activeTab, proposals, currentProposal]);

  const loadRfpDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-rfp/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRfpDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to load RFP documents:', error);
    }
  };

  const loadProposals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-rfp/proposals', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProposals(data.proposals);
      }
    } catch (error) {
      console.error('Failed to load proposals:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('rfpDocument', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-rfp/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert('RFP document uploaded and analyzed successfully!');
        loadRfpDocuments();
        setActiveTab('generate');
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const generateProposal = async () => {
    if (!selectedRfp) {
      alert('Please select an RFP document first');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai-rfp/generate-proposal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rfpDocumentId: selectedRfp,
          title: `Proposal for ${rfpDocuments.find(doc => doc.id === selectedRfp)?.filename}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentProposal(data.proposal);
        loadProposals();
        setActiveTab('edit');
        alert('Proposal generated successfully!');
      } else {
        const error = await response.json();
        alert(`Generation failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const deleteRfpDocument = async (documentId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ai-rfp/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('RFP document deleted successfully!');
        loadRfpDocuments();
        // Clear selection if the deleted document was selected
        if (selectedRfp === documentId) {
          setSelectedRfp('');
        }
      } else {
        const error = await response.json();
        alert(`Delete failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed');
    }
  };

  const loadProposal = async (proposalId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ai-rfp/proposals/${proposalId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentProposal(data.proposal);
        setActiveTab('edit');
      }
    } catch (error) {
      console.error('Failed to load proposal:', error);
    }
  };

  const updateSectionContent = (sectionId: string, content: string) => {
    if (!currentProposal) return;

    const updatedSections = currentProposal.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          content,
          wordCount: content.split(/\s+/).length,
          lastModified: new Date().toISOString()
        };
      }
      return section;
    });

    setCurrentProposal({
      ...currentProposal,
      sections: updatedSections
    });
  };

  const getComplianceStatus = (section: ProposalSection) => {
    const { wordLimit, requirementCoverage } = section.compliance;
    
    if (!wordLimit.compliant) {
      return { status: 'error', message: 'Word limit exceeded' };
    }
    
    if (requirementCoverage.percentage < 80) {
      return { status: 'warning', message: 'Low requirement coverage' };
    }
    
    return { status: 'success', message: 'Compliant' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatProposalName = (title: string, maxLength: number = 60) => {
    if (title.length <= maxLength) {
      return title;
    }
    
    // Try to break at logical points like underscores or spaces
    const words = title.split(/[_\s]+/);
    let result = '';
    
    for (const word of words) {
      if ((result + word).length > maxLength) {
        if (result.length > 20) { // Only truncate if we have a reasonable amount
          return result.trimEnd() + '...';
        } else {
          // If we haven't built up much, just truncate the current word
          return (result + word.substring(0, maxLength - result.length - 3)).trimEnd() + '...';
        }
      }
      result += (result ? ' ' : '') + word;
    }
    
    return result;
  };

  const tabs = [
    { id: 'upload', label: 'Upload RFP', icon: Upload },
    { id: 'generate', label: 'Generate Proposal', icon: Wand2 },
    { id: 'edit', label: 'Edit Proposal', icon: FileText },
    { id: 'proposals', label: 'My Proposals', icon: Eye }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <FileText className="inline-block w-8 h-8 mr-2 text-blue-600" />
          AI Proposal Drafter
        </h1>
        <p className="text-gray-600">
          Upload RFP documents and generate compliant proposal responses with AI assistance
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Onboarding Guide */}
              {showOnboarding && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <Info className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-800">🚀 AI Proposal Drafter Quick Start</h4>
                        <div className="mt-2 text-sm text-blue-700 space-y-1">
                          <p>• <strong>Step 1:</strong> Upload your RFP document (PDF, Word, or text format)</p>
                          <p>• <strong>Step 2:</strong> AI analyzes requirements and identifies key sections</p>
                          <p>• <strong>Step 3:</strong> Generate AI-powered proposal with 15 professional sections</p>
                          <p>• <strong>Step 4:</strong> Edit, refine, and download your completed proposal</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowOnboarding(false)}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative">
                <button
                  onClick={() => setShowHelp(showHelp === 'upload' ? null : 'upload')}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                
                {showHelp === 'upload' && (
                  <div className="absolute top-8 right-2 w-64 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-10 text-left">
                    <div className="font-medium text-gray-800 mb-2">📄 Supported File Types</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>• <strong>PDF:</strong> Best for complex formatting</p>
                      <p>• <strong>Word (.docx):</strong> Recommended for editing</p>
                      <p>• <strong>Text (.txt):</strong> Simple requirements</p>
                      <p className="pt-2 border-t">💡 <strong>Tip:</strong> Clear, structured documents work best!</p>
                    </div>
                  </div>
                )}
                
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload RFP Document</h3>
                <p className="text-gray-600 mb-4">
                  Upload PDF, Word, or text files containing RFP requirements
                </p>
                <div className="text-sm text-gray-500 mb-4">
                  💡 <strong>Best practices:</strong> Use clear, well-structured documents with defined sections
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                  id="rfp-upload"
                />
                <label
                  htmlFor="rfp-upload"
                  className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      🧠 AI analyzing document structure...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </>
                  )}
                </label>
              </div>

              {/* Recent Uploads */}
              {rfpDocuments.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Uploads</h3>
                  <div className="space-y-3">
                    {rfpDocuments.slice(0, 5).map((doc) => (
                      <div key={doc.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="font-medium text-gray-900 break-words leading-relaxed">
                              {doc.filename}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Uploaded: {formatDate(doc.uploadedAt)}
                              {doc.hasAnalysis && (
                                <span className="ml-2 text-green-600">• Analyzed</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteRfpDocument(doc.id, doc.filename)}
                            className="flex-shrink-0 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1"
                            title="Delete RFP document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setSelectedRfp(doc.id);
                              setActiveTab('generate');
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Generate Proposal
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              {/* Generation Guide */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <Wand2 className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-green-800">🎯 AI Proposal Generation</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Our AI will analyze your RFP and generate a comprehensive 15-section proposal including: Executive Summary, Technical Approach, Management Plan, Past Performance, and more.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Select RFP Document</h3>
                  <div className="text-sm text-gray-500">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Generation takes 2-5 minutes
                  </div>
                </div>
                <div className="space-y-3">
                  {rfpDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        selectedRfp === doc.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div 
                          className="flex-1 min-w-0 cursor-pointer mr-4"
                          onClick={() => setSelectedRfp(doc.id)}
                        >
                          <p className="font-medium text-gray-900 break-words leading-relaxed">
                            {doc.filename}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {doc.sections?.length || 0} sections identified
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {selectedRfp === doc.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRfpDocument(doc.id, doc.filename);
                            }}
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                            title="Delete RFP document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <div className="text-center">
                  {selectedRfp && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <div className="font-medium text-blue-800 mb-1">🎯 What AI will generate:</div>
                      <div className="text-blue-700 grid grid-cols-2 gap-1 text-xs">
                        <div>✓ Executive Summary</div>
                        <div>✓ Technical Approach</div>
                        <div>✓ Management Plan</div>
                        <div>✓ Past Performance</div>
                        <div>✓ Key Personnel</div>
                        <div>✓ Cost Proposal</div>
                        <div>✓ Schedule & Milestones</div>
                        <div>✓ Risk Management</div>
                        <div>+ 7 more sections</div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={generateProposal}
                    disabled={!selectedRfp || generating}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        🧠 AI crafting your proposal sections...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        🚀 Generate AI Proposal
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Tab */}
          {activeTab === 'edit' && (
            <div className="space-y-6">
              {/* Proposal Selector */}
              {proposals.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select Proposal to Edit</h3>
                      <select
                        value={currentProposal?.id || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            loadProposal(e.target.value);
                          }
                        }}
                        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a proposal...</option>
                        {proposals.map((proposal) => (
                          <option key={proposal.id} value={proposal.id}>
                            {proposal.title} - Version {proposal.version} ({formatDate(proposal.createdAt)})
                          </option>
                        ))}
                      </select>
                    </div>
                    {currentProposal && (
                      <div className="text-sm text-gray-500">
                        💡 Edit sections below, then download your completed proposal
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentProposal ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{currentProposal.title}</h3>
                      <div className="mt-1 text-sm text-gray-600 flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        {currentProposal.sections?.length || 0} sections generated • Ready for editing
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Last updated: {formatDate(currentProposal.updatedAt)}
                    </div>
                  </div>

              {/* Download/Save Actions */}
              <DownloadButtons
                mode="proposal"
                proposalId={parseInt(currentProposal.id)}
                title={currentProposal.title}
                sections={currentProposal.sections}
                onSaveDraft={() => {
                  // Refresh the proposal data after saving
                  loadProposal(currentProposal.id);
                }}
                className="mb-6"
              />

              <div className="space-y-6">
                {currentProposal.sections.map((section) => {
                  const compliance = getComplianceStatus(section);
                  
                  return (
                    <div key={section.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-medium text-gray-900">{section.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            compliance.status === 'success' ? 'bg-green-100 text-green-800' :
                            compliance.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {compliance.message}
                          </span>
                          <span className="text-sm text-gray-600">
                            {section.wordCount} words
                            {section.compliance.wordLimit.maximum && 
                              ` / ${section.compliance.wordLimit.maximum} max`
                            }
                          </span>
                        </div>
                      </div>

                      <textarea
                        value={section.content}
                        onChange={(e) => updateSectionContent(section.id, e.target.value)}
                        className="w-full h-64 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Section content will be generated here..."
                      />

                      {/* Compliance Details */}
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Requirement Coverage:</span>
                            <p className="font-medium">
                              {section.compliance.requirementCoverage.percentage}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Last Modified:</span>
                            <p className="font-medium">
                              {formatDate(section.lastModified)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  {proposals.length > 0 ? (
                    <div className="text-gray-500">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-lg font-medium">Select a proposal to edit</p>
                      <p className="text-sm">Choose from {proposals.length} available proposal{proposals.length > 1 ? 's' : ''} above</p>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-lg font-medium">No proposals available</p>
                      <p className="text-sm">Generate a proposal first by uploading an RFP document and using the Generate tab</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">My Proposals</h3>
                {proposals.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {proposals.length} proposal{proposals.length > 1 ? 's' : ''} total
                  </div>
                )}
              </div>
              
              {proposals.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {proposals.map((proposal, index) => (
                      <div key={proposal.id} className="px-4 py-3 hover:bg-gray-50 transition-colors duration-150">
                        <div className="flex items-center justify-between">
                          {/* Left side - Proposal info */}
                          <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 mb-1" title={proposal.title}>
                                  {formatProposalName(proposal.title, 80)}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    {proposal.sections?.length || 0} sections
                                  </span>
                                  <span>v{proposal.version}</span>
                                  <span>{formatDate(proposal.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right side - Status and actions */}
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                              Ready
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => loadProposal(proposal.id)}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                              >
                                Edit
                              </button>
                              <DownloadButtons
                                mode="proposal"
                                proposalId={parseInt(proposal.id)}
                                title={proposal.title}
                                sections={proposal.sections || []}
                                className="inline-block"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No proposals yet</h4>
                  <p className="text-gray-500 mb-4">Upload an RFP document to get started with AI-powered proposal generation</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Upload RFP
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalDrafter;
