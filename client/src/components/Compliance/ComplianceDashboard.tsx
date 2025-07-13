import React, { useState, useEffect } from 'react';
import { Shield, Calendar, CheckCircle, AlertTriangle, Clock, FileCheck } from 'lucide-react';

interface ComplianceItem {
  id: string;
  category: string;
  item: string;
  description: string;
  required: boolean;
  deadline_type: string;
  agency_specific: boolean;
  documentation: string[];
  resources: string[];
}

interface ComplianceChecklist {
  contractId: string;
  contractTitle: string;
  agency: string;
  checklist: ComplianceItem[];
  completionStatus: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Deadline {
  id: string;
  contractId: string;
  contractTitle: string;
  agency: string;
  deadlineType: string;
  deadlineDate: string;
  description: string;
  isCritical: boolean;
  daysUntilDeadline: number;
}

const ComplianceDashboard: React.FC = () => {
  const [checklists, setChecklists] = useState<ComplianceChecklist[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('deadlines');
  const [selectedContract, setSelectedContract] = useState<string>('');

  useEffect(() => {
    loadUpcomingDeadlines();
  }, []);

  const loadUpcomingDeadlines = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/compliance/deadlines?days=30', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDeadlines(data.deadlines);
      }
    } catch (error) {
      console.error('Failed to load deadlines:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComplianceChecklist = async (contractId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/compliance/checklist/${contractId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChecklists([data]);
        setSelectedContract(contractId);
      } else if (response.status === 404) {
        // Generate new checklist
        await generateComplianceChecklist(contractId);
      }
    } catch (error) {
      console.error('Failed to load compliance checklist:', error);
    }
  };

  const generateComplianceChecklist = async (contractId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/compliance/checklist/${contractId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChecklists([data]);
        setSelectedContract(contractId);
      }
    } catch (error) {
      console.error('Failed to generate compliance checklist:', error);
    }
  };

  const updateComplianceItem = async (contractId: string, itemId: string, completed: boolean, notes: string = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/compliance/checklist/${contractId}/item/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed, notes })
      });

      if (response.ok) {
        // Reload checklist
        loadComplianceChecklist(contractId);
      }
    } catch (error) {
      console.error('Failed to update compliance item:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDeadlineUrgency = (days: number) => {
    if (days < 0) return { color: 'text-red-600 bg-red-100', label: 'Overdue' };
    if (days <= 3) return { color: 'text-red-600 bg-red-100', label: 'Critical' };
    if (days <= 7) return { color: 'text-yellow-600 bg-yellow-100', label: 'Urgent' };
    if (days <= 14) return { color: 'text-blue-600 bg-blue-100', label: 'Upcoming' };
    return { color: 'text-gray-600 bg-gray-100', label: 'Future' };
  };

  const getCompletionPercentage = (checklist: ComplianceChecklist) => {
    const totalItems = checklist.checklist.length;
    const completedItems = Object.values(checklist.completionStatus).filter(
      (status: any) => status.completed
    ).length;
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  };

  const tabs = [
    { id: 'deadlines', label: 'Upcoming Deadlines', icon: Calendar },
    { id: 'checklists', label: 'Compliance Checklists', icon: Shield },
    { id: 'documents', label: 'Required Documents', icon: FileCheck }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <Shield className="inline-block w-8 h-8 mr-2 text-blue-600" />
          Compliance Dashboard
        </h1>
        <p className="text-gray-600">
          Track deadlines, manage compliance requirements, and ensure submission readiness
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Deadlines</p>
              <p className="text-2xl font-bold text-gray-900">
                {deadlines.filter(d => d.daysUntilDeadline <= 3 && d.daysUntilDeadline >= 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <Clock className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">
                {deadlines.filter(d => d.daysUntilDeadline <= 7 && d.daysUntilDeadline >= 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Next 30 Days</p>
              <p className="text-2xl font-bold text-gray-900">{deadlines.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">
                {deadlines.filter(d => d.daysUntilDeadline < 0).length}
              </p>
            </div>
          </div>
        </div>
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
          {/* Deadlines Tab */}
          {activeTab === 'deadlines' && (
            <div className="space-y-4">
              {deadlines.length > 0 ? (
                deadlines.map((deadline) => {
                  const urgency = getDeadlineUrgency(deadline.daysUntilDeadline);
                  
                  return (
                    <div key={deadline.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {deadline.deadlineType}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${urgency.color}`}>
                              {urgency.label}
                            </span>
                            {deadline.isCritical && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Critical
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {deadline.agency} • {deadline.contractTitle}
                          </p>
                          <p className="text-gray-700">{deadline.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Deadline:</span>
                          <p className="font-medium">{formatDateTime(deadline.deadlineDate)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Days Remaining:</span>
                          <p className={`font-medium ${deadline.daysUntilDeadline < 0 ? 'text-red-600' : ''}`}>
                            {deadline.daysUntilDeadline < 0 
                              ? `${Math.abs(deadline.daysUntilDeadline)} days overdue`
                              : `${deadline.daysUntilDeadline} days`
                            }
                          </p>
                        </div>
                        <div>
                          <button
                            onClick={() => {
                              loadComplianceChecklist(deadline.contractId);
                              setActiveTab('checklists');
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                          >
                            View Checklist
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No upcoming deadlines in the next 30 days.
                </div>
              )}
            </div>
          )}

          {/* Checklists Tab */}
          {activeTab === 'checklists' && (
            <div className="space-y-6">
              {checklists.length > 0 ? (
                checklists.map((checklist) => {
                  const completionPercentage = getCompletionPercentage(checklist);
                  
                  return (
                    <div key={checklist.contractId} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{checklist.contractTitle}</h3>
                          <p className="text-sm text-gray-600">{checklist.agency}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{completionPercentage}%</p>
                          <p className="text-sm text-gray-600">Complete</p>
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${completionPercentage}%` }}
                        ></div>
                      </div>

                      <div className="space-y-3">
                        {checklist.checklist.map((item, index) => {
                          const isCompleted = checklist.completionStatus[item.id]?.completed || false;
                          
                          return (
                            <div key={index} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={(e) => updateComplianceItem(
                                  checklist.contractId, 
                                  item.id, 
                                  e.target.checked
                                )}
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                    {item.item}
                                  </h4>
                                  {item.required && (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Required
                                    </span>
                                  )}
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {item.category}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                                
                                {item.documentation.length > 0 && (
                                  <div className="text-xs text-gray-500">
                                    <span className="font-medium">Required docs:</span> {item.documentation.join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a contract from the deadlines tab to view its compliance checklist.
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="text-center py-8 text-gray-500">
              Document management feature coming soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
