import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { RFPTemplate, RFPTemplateForm, RFPSection, EvaluationCriteria } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<RFPTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<RFPTemplateForm>({
    name: '',
    agency: '',
    description: '',
    sections: [],
    evaluationCriteria: {
      technicalWeight: 60,
      costWeight: 30,
      pastPerformanceWeight: 10,
      factors: []
    }
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRFPTemplates();
      if (response.success) {
        setTemplates(response.templates);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    if (formData.sections.length === 0) {
      setError('At least one section is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const response = await apiService.createRFPTemplate(formData);
      if (response.success) {
        setTemplates([...templates, response.template]);
        setShowCreateForm(false);
        resetForm();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      agency: '',
      description: '',
      sections: [],
      evaluationCriteria: {
        technicalWeight: 60,
        costWeight: 30,
        pastPerformanceWeight: 10,
        factors: []
      }
    });
  };

  const addSection = () => {
    const newSection: Omit<RFPSection, 'id'> = {
      title: '',
      description: '',
      required: true,
      order: formData.sections.length + 1
    };
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const updateSection = (index: number, field: keyof RFPSection, value: any) => {
    const updatedSections = [...formData.sections];
    updatedSections[index] = { ...updatedSections[index], [field]: value };
    setFormData(prev => ({ ...prev, sections: updatedSections }));
  };

  const removeSection = (index: number) => {
    const updatedSections = formData.sections.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, sections: updatedSections }));
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFP Templates</h1>
          <p className="text-gray-600">Manage templates for different agencies and RFP types</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Templates List */}
      <div className="bg-white shadow rounded-lg">
        {templates.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {templates.map((template) => (
              <div key={template.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {template.description || 'No description provided'}
                    </p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Agency: {template.agency || 'General'}</span>
                      <span>•</span>
                      <span>Sections: {template.sections?.length || 0}</span>
                      <span>•</span>
                      <span>Created: {new Date(template.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-3">
                      <span className="font-medium text-sm text-gray-600">Sections:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {template.sections?.map((section, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {section.title}
                          </span>
                        )) || <span className="text-gray-400 text-sm">No sections defined</span>}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No RFP templates</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first RFP template.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create RFP Template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Create RFP Template</h3>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter template name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agency
                    </label>
                    <select
                      value={formData.agency}
                      onChange={(e) => setFormData(prev => ({ ...prev, agency: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select agency</option>
                      <option value="Department of Defense">Department of Defense</option>
                      <option value="Department of Energy">Department of Energy</option>
                      <option value="NASA">NASA</option>
                      <option value="Department of Commerce">Department of Commerce</option>
                      <option value="GSA">GSA</option>
                      <option value="Department of Homeland Security">Department of Homeland Security</option>
                      <option value="General">General (All Agencies)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe this template and when to use it"
                  />
                </div>
              </div>

              {/* Evaluation Criteria */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Evaluation Criteria</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Technical Weight (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.evaluationCriteria.technicalWeight}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        evaluationCriteria: {
                          ...prev.evaluationCriteria,
                          technicalWeight: Number(e.target.value)
                        }
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Weight (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.evaluationCriteria.costWeight}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        evaluationCriteria: {
                          ...prev.evaluationCriteria,
                          costWeight: Number(e.target.value)
                        }
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Past Performance Weight (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.evaluationCriteria.pastPerformanceWeight}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        evaluationCriteria: {
                          ...prev.evaluationCriteria,
                          pastPerformanceWeight: Number(e.target.value)
                        }
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Total: {formData.evaluationCriteria.technicalWeight + formData.evaluationCriteria.costWeight + formData.evaluationCriteria.pastPerformanceWeight}%
                  {(formData.evaluationCriteria.technicalWeight + formData.evaluationCriteria.costWeight + formData.evaluationCriteria.pastPerformanceWeight) !== 100 && (
                    <span className="text-red-600 ml-2">⚠️ Should total 100%</span>
                  )}
                </div>
              </div>

              {/* Sections */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900">RFP Sections</h4>
                  <button
                    onClick={addSection}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + Add Section
                  </button>
                </div>
                
                {formData.sections.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-500">No sections added yet</p>
                    <button
                      onClick={addSection}
                      className="mt-2 text-blue-600 hover:text-blue-800"
                    >
                      Add your first section
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.sections.map((section, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-medium text-gray-900">Section {index + 1}</h5>
                          <button
                            onClick={() => removeSection(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Section Title *
                          </label>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSection(index, 'title', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Technical Approach"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={section.description}
                            onChange={(e) => updateSection(index, 'description', e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Describe what should be covered in this section"
                          />
                        </div>
                        
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={section.required}
                            onChange={(e) => updateSection(index, 'required', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`required-${index}`} className="ml-2 block text-sm text-gray-900">
                            This section is required
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-800">{error}</div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={creating || !formData.name.trim() || formData.sections.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {creating && <LoadingSpinner size="sm" className="mr-2" />}
                {creating ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RFPTemplates;
