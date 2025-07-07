import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRFPAnalytics();
      if (response.success) {
        setAnalytics(response.analytics);
      }
    } catch (err: any) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RFP Analytics</h1>
        <p className="text-gray-600">Performance insights and trends for your RFP responses</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Win Rate Trend */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Win Rate Trend</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">0%</div>
            <p className="text-sm text-gray-500">No data available yet</p>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Average Score</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">--</div>
            <p className="text-sm text-gray-500">No submissions yet</p>
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Avg Response Time</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">--</div>
            <p className="text-sm text-gray-500">No data available</p>
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Rate</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">--</div>
            <p className="text-sm text-gray-500">No responses to analyze</p>
          </div>
        </div>

        {/* Agency Performance */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Agencies</h3>
          <div className="text-center">
            <p className="text-sm text-gray-500">No agency data available</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center">
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Performance Insights</h2>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start generating RFP responses to see performance insights and trends.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RFPAnalytics;
