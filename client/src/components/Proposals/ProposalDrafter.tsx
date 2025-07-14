import React, { useState, useEffect } from 'react';
import { FileText, Upload, Wand2, Download, Save, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import DownloadButtons from '../RFP/DownloadButtons';

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
  const [rfpDocuments, setRfpDocuments] = useState<RFPDocument[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedRfp, setSelectedRfp] = useState<string>('');
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    loadRfpDocuments();
    loadProposals();
  }, []);

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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload RFP Document</h3>
                <p className="text-gray-600 mb-4">
                  Upload PDF, Word, or text files containing RFP requirements
                </p>
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
                      Processing...
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
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-sm text-gray-600">
                            Uploaded: {formatDate(doc.uploadedAt)}
                            {doc.hasAnalysis && (
                              <span className="ml-2 text-green-600">• Analyzed</span>
                            )}
                          </p>
                        </div>
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
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select RFP Document</h3>
                <div className="space-y-3">
                  {rfpDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedRfp === doc.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedRfp(doc.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-sm text-gray-600">
                            {doc.sections?.length || 0} sections identified
                          </p>
                        </div>
                        <div className="flex items-center">
                          {selectedRfp === doc.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={generateProposal}
                  disabled={!selectedRfp || generating}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating Proposal...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate AI Proposal
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Edit Tab */}
          {activeTab === 'edit' && currentProposal && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">{currentProposal.title}</h3>
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
            </div>
          )}

          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">My Proposals</h3>
              
              {proposals.length > 0 ? (
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{proposal.title}</h4>
                          <p className="text-sm text-gray-600">
                            {proposal.sections?.length || 0} sections • Version {proposal.version} • 
                            Created: {formatDate(proposal.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadProposal(proposal.id)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No proposals yet. Upload an RFP document to get started.
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
