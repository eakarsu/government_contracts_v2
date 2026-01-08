import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  TrendingUp,
  Plus,
  Building2,
  BarChart3,
  ChevronRight,
  RefreshCw,
  Settings
} from 'lucide-react';
import { apiService } from '../services/api';
import { RFPDashboardStats, RFPResponse } from '../types';

const RFPDashboard: React.FC = () => {
  const [stats, setStats] = useState<RFPDashboardStats | null>(null);
  const [recentRFPs, setRecentRFPs] = useState<RFPResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const handleFocus = () => loadDashboardData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const deletedRFPs = JSON.parse(localStorage.getItem('deleted_rfp_ids') || '[]');

      const [statsResponse, rfpsResponse] = await Promise.all([
        apiService.getRFPDashboardStats().catch(() => ({ success: false, stats: null })),
        apiService.getRFPResponses(1, 5).catch(() => ({ success: false, responses: [] }))
      ]);

      if (statsResponse.success && statsResponse.stats) {
        setStats({
          ...statsResponse.stats,
          totalRFPs: Math.max(0, statsResponse.stats.totalRFPs - deletedRFPs.length),
          activeRFPs: Math.max(0, statsResponse.stats.activeRFPs - deletedRFPs.length)
        });
      } else {
        setStats({ totalRFPs: 0, activeRFPs: 0, submittedRFPs: 0, winRate: 0, averageScore: 0, recentActivity: [] });
      }

      setRecentRFPs(rfpsResponse.success ? rfpsResponse.responses || [] : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-green-50 text-green-700 border-green-200';
      case 'in_review': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'approved': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">RFP Dashboard</h1>
          </div>
          <p className="text-sm text-gray-500">
            Manage RFP responses and track performance
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/rfp/templates"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Templates
          </Link>
          <Link
            to="/rfp/generate"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Generate RFP
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">Error: {error}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-gray-500 font-medium">Total RFPs</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRFPs}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-gray-500 font-medium">Active</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">{stats.activeRFPs}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-gray-500 font-medium">Submitted</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.submittedRFPs}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-gray-500 font-medium">Win Rate</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">{stats.winRate}%</p>
              </div>
            </div>
          )}

          {/* Recent RFPs */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Recent RFP Responses</h2>
              <Link to="/rfp/responses" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {recentRFPs.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentRFPs.map((rfp) => (
                  <Link
                    key={rfp.id}
                    to={`/rfp/responses/${rfp.id}`}
                    className="block px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{rfp.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>Contract: {rfp.contractId}</span>
                          <span>Updated: {new Date(rfp.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusStyle(rfp.status)}`}>
                          {rfp.status.replace('_', ' ')}
                        </span>
                        {rfp.predictedScore && (
                          <span className="text-sm font-medium text-gray-700">
                            {typeof rfp.predictedScore === 'number' ? Math.round(rfp.predictedScore) : Math.round(rfp.predictedScore.overall)}%
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-5 py-16 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No RFP Responses</h3>
                <p className="text-gray-500 mb-6">Get started by generating your first RFP response</p>
                <Link
                  to="/rfp/generate"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Generate RFP Response
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4">
              <Link
                to="/rfp/generate"
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100">
                    <Plus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Generate New RFP</p>
                    <p className="text-xs text-gray-500">Create from contract</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/rfp/company-profiles"
                className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100">
                    <Building2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Company Profile</p>
                    <p className="text-xs text-gray-500">Update capabilities</p>
                  </div>
                </div>
              </Link>

              <Link
                to="/rfp/analytics"
                className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">View Analytics</p>
                    <p className="text-xs text-gray-500">Performance insights</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RFPDashboard;
