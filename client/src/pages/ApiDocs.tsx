import React from 'react';

const ApiDocs: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
        <p className="mt-2 text-gray-600">
          Complete reference for the Government Contracts API
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Endpoints</h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Configuration</h3>
              <div className="bg-gray-50 rounded-md p-4">
                <code className="text-sm">GET /api/config</code>
                <p className="text-sm text-gray-600 mt-1">Get application configuration</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Contracts</h3>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-md p-4">
                  <code className="text-sm">GET /api/contracts</code>
                  <p className="text-sm text-gray-600 mt-1">List contracts with pagination</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <code className="text-sm">POST /api/contracts/fetch</code>
                  <p className="text-sm text-gray-600 mt-1">Fetch contracts from external API</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <code className="text-sm">POST /api/contracts/index</code>
                  <p className="text-sm text-gray-600 mt-1">Index contracts for search</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Search</h3>
              <div className="bg-gray-50 rounded-md p-4">
                <code className="text-sm">POST /api/search</code>
                <p className="text-sm text-gray-600 mt-1">Search contracts with AI analysis</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Documents</h3>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-md p-4">
                  <code className="text-sm">POST /api/documents/process</code>
                  <p className="text-sm text-gray-600 mt-1">Process documents with AI</p>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <code className="text-sm">GET /api/documents/queue/status</code>
                  <p className="text-sm text-gray-600 mt-1">Get processing queue status</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
