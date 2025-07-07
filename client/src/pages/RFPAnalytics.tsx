import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const RFPAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Mock analytics data
  const analyticsData = {
    overview: {
      totalRFPs: 24,
      submittedRFPs: 18,
      wonRFPs: 7,
      winRate: 38.9,
      averageScore: 82.4,
      totalRevenue: 2450000,
      avgResponseTime: 4.2
    },
    trends: {
      rfpVolume: [12, 15, 18, 22, 24, 20, 24],
      winRate: [25, 30, 35, 40, 38.9, 42, 38.9],
      avgScore: [78, 80, 82, 85, 82.4, 84, 82.4]
    },
    topAgencies: [
      { name: 'Department of Defense', rfps: 8, winRate: 50, revenue: 1200000 },
      { name: 'Department of Energy', rfps: 5, winRate: 40, revenue: 800000 },
      { name: 'NASA', rfps: 4, winRate: 25, revenue: 300000 },
      { name: 'Department of Commerce', rfps: 3, winRate: 33.3, revenue: 150000 },
      { name: 'GSA', rfps: 4, winRate: 25, revenue: 100000 }
    ],
    recentWins: [
      { title: 'Cloud Infrastructure Modernization', agency: 'DOD', value: 500000, date: '2024-01-15' },
      { title: 'Cybersecurity Assessment Services', agency: 'DOE', value: 300000, date: '2024-01-10' },
      { title: 'Data Analytics Platform', agency: 'NASA', value: 250000, date: '2024-01-05' }
    ],
    competitiveInsights: {
      avgBidders: 5.2,
      mostCompetitiveNAICS: '541511',
      leastCompetitiveNAICS: '541512',
      pricingTrends: {
        low: 50000,
        average: 180000,
        high: 750000
      }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFP Analytics</h1>
          <p className="text-gray-600">Performance insights and trends for your RFP responses</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Link
            to="/rfp"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
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
              <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.totalRFPs}</p>
              <p className="text-xs text-green-600">+12% from last period</p>
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
              <p className="text-sm font-medium text-gray-600">Win Rate</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.winRate}%</p>
              <p className="text-xs text-green-600">+5.2% from last period</p>
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
              <p className="text-sm font-medium text-gray-600">Avg Score</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.averageScore}</p>
              <p className="text-xs text-green-600">+3.1 from last period</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${(analyticsData.overview.totalRevenue / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-green-600">+18% from last period</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win Rate Trend */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Win Rate Trend</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {analyticsData.trends.winRate.map((rate, index) => (
              <div key={index} className="flex flex-col items-center">
                <div 
                  className="bg-green-500 rounded-t w-8"
                  style={{ height: `${(rate / 50) * 200}px` }}
                ></div>
                <span className="text-xs text-gray-500 mt-1">{rate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* RFP Volume */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">RFP Volume</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {analyticsData.trends.rfpVolume.map((volume, index) => (
              <div key={index} className="flex flex-col items-center">
                <div 
                  className="bg-blue-500 rounded-t w-8"
                  style={{ height: `${(volume / 30) * 200}px` }}
                ></div>
                <span className="text-xs text-gray-500 mt-1">{volume}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Agencies */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Top Agencies by Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RFPs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData.topAgencies.map((agency, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {agency.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agency.rfps}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      agency.winRate >= 40 ? 'bg-green-100 text-green-800' :
                      agency.winRate >= 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {agency.winRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${(agency.revenue / 1000).toFixed(0)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Wins */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Wins</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {analyticsData.recentWins.map((win, index) => (
            <div key={index} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">{win.title}</h3>
                  <p className="text-sm text-gray-500">{win.agency}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">${(win.value / 1000).toFixed(0)}K</p>
                  <p className="text-sm text-gray-500">{new Date(win.date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Competitive Insights</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg Bidders per RFP:</span>
              <span className="text-sm font-medium">{analyticsData.competitiveInsights.avgBidders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Most Competitive NAICS:</span>
              <span className="text-sm font-medium">{analyticsData.competitiveInsights.mostCompetitiveNAICS}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Least Competitive NAICS:</span>
              <span className="text-sm font-medium">{analyticsData.competitiveInsights.leastCompetitiveNAICS}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Trends</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Low:</span>
              <span className="text-sm font-medium">${(analyticsData.competitiveInsights.pricingTrends.low / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Average:</span>
              <span className="text-sm font-medium">${(analyticsData.competitiveInsights.pricingTrends.average / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">High:</span>
              <span className="text-sm font-medium">${(analyticsData.competitiveInsights.pricingTrends.high / 1000).toFixed(0)}K</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RFPAnalytics;
