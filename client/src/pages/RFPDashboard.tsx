import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { RFPDashboardStats, RFPResponse } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPDashboard: React.FC = () => {
  const [stats, setStats] = useState<RFPDashboardStats | null>(null);
  const [recentRFPs, setRecentRFPs] = useState<RFPResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to handle RFP deletion from child components
  const handleRFPDeleted = (deletedRFPId: number) => {
    // Remove from recent RFPs list
    setRecentRFPs(prev => prev.filter(rfp => rfp.id !== deletedRFPId));
    
    // Update stats counters
    if (stats) {
      setStats(prev => prev ? {
        ...prev,
        totalRFPs: Math.max(0, prev.totalRFPs - 1),
        activeRFPs: Math.max(0, prev.activeRFPs - 1)
      } : null);
    }
  };

  // Make this function available globally for other components
  React.useEffect(() => {
    (window as any).handleRFPDeleted = handleRFPDeleted;
    return () => {
      delete (window as any).handleRFPDeleted;
    };
  }, [stats]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, rfpsResponse] = await Promise.all([
        apiService.getRFPDashboardStats().catch(err => {
          console.warn('Dashboard stats not available:', err.message);
          return { success: false, stats: null };
        }),
        apiService.getRFPResponses(1, 5).catch(err => {
          console.warn('RFP responses not available:', err.message);
          return { success: false, responses: [] };
        })
      ]);

      if (statsResponse.success && statsResponse.stats) {
        setStats(statsResponse.stats);
      } else {
        // Set default stats if API not available
        setStats({
          totalRFPs: 0,
          activeRFPs: 0,
          submittedRFPs: 0,
          winRate: 0,
          averageScore: 0,
          recentActivity: []
        });
      }

      if (rfpsResponse.success) {
        setRecentRFPs(rfpsResponse.responses || []);
      } else {
        setRecentRFPs([]);
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFP Dashboard</h1>
          <p className="text-gray-600">Manage your RFP responses and track performance</p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/rfp/templates"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Manage Templates
          </Link>
          <Link
            to="/rfp/generate"
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            Generate RFP
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total RFPs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRFPs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active RFPs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeRFPs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold text-gray-900">{stats.submittedRFPs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.winRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent RFPs */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Recent RFP Responses</h2>
            <Link
              to="/rfp/responses"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentRFPs.length > 0 ? (
            recentRFPs.map((rfp) => (
              <div key={rfp.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Link
                      to={`/rfp/responses/${rfp.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {rfp.title}
                    </Link>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Contract: {rfp.contractId}</span>
                      <span>•</span>
                      <span>Updated: {new Date(rfp.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rfp.status === 'submitted' ? 'bg-green-100 text-green-800' :
                      rfp.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                      rfp.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {rfp.status.replace('_', ' ')}
                    </span>
                    {rfp.predictedScore && (
                      <span className="text-sm font-medium text-gray-900">
                        Score: {typeof rfp.predictedScore === 'number' ? Math.round(rfp.predictedScore) : Math.round(rfp.predictedScore.overall)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No RFP responses</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by generating your first RFP response.</p>
              <div className="mt-6">
                <Link
                  to="/rfp/generate"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Generate RFP Response
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/rfp/generate"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Generate New RFP</p>
              <p className="text-sm text-gray-500">Create response from contract</p>
            </div>
          </Link>

          <Link
            to="/rfp/company-profiles"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Manage Company Profile</p>
              <p className="text-sm text-gray-500">Update capabilities & experience</p>
            </div>
          </Link>

          <Link
            to="/rfp/analytics"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">View Analytics</p>
              <p className="text-sm text-gray-500">Performance insights & trends</p>
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
};

export default RFPDashboard;
