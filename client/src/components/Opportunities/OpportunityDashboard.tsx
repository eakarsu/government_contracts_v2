import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Clock, DollarSign, Building, Filter, Bell, Star } from 'lucide-react';
import NotificationSettingsModal from './NotificationSettingsModal';

interface Opportunity {
  id: string;
  contractId: string;
  noticeId: string;
  title: string;
  description: string;
  agency: string;
  naicsCode: string;
  contractValue: number;
  postedDate: string;
  responseDeadline: string;
  matchScore: number;
  matchFactors: Record<string, any>;
  notificationSent: boolean;
  matchedAt: string;
}

interface OpportunityStats {
  totalOpportunities: number;
  highMatchOpportunities: number;
  avgMatchScore: number;
  newThisWeek: number;
}

const OpportunityDashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<OpportunityStats>({
    totalOpportunities: 0,
    highMatchOpportunities: 0,
    avgMatchScore: 0,
    newThisWeek: 0
  });
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0.5);
  const [sortBy, setSortBy] = useState('matchScore');
  const [filterAgency, setFilterAgency] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  useEffect(() => {
    loadOpportunities();
  }, [minScore]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/profiles/opportunities?minScore=${minScore}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setOpportunities(data.opportunities || []);
          calculateStats(data.opportunities || []);
        } else {
          console.error('Expected JSON response but got:', contentType);
          setOpportunities([]);
        }
      } else if (response.status === 404) {
        // No business profile found
        setOpportunities([]);
      } else {
        console.error('Failed to load opportunities, status:', response.status);
        const text = await response.text();
        console.error('Response body:', text.substring(0, 200));
        setOpportunities([]);
      }
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (opps: Opportunity[]) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalOpportunities: opps.length,
      highMatchOpportunities: opps.filter(o => o.matchScore >= 0.8).length,
      avgMatchScore: opps.length > 0 ? opps.reduce((sum, o) => sum + o.matchScore, 0) / opps.length : 0,
      newThisWeek: opps.filter(o => new Date(o.matchedAt) >= weekAgo).length
    };

    setStats(stats);
  };

  const handleNotificationSettings = async (settings: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Notification settings saved successfully:', data.message);
        // You could add a toast notification here
        // toast.success('Notification settings saved successfully!');
      } else {
        console.error('Failed to save notification settings:', response.status);
        // toast.error('Failed to save notification settings');
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      // toast.error('Error saving notification settings');
    }
  };

  const filteredAndSortedOpportunities = opportunities
    .filter(opp => !filterAgency || opp.agency.toLowerCase().includes(filterAgency.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'matchScore':
          return b.matchScore - a.matchScore;
        case 'deadline':
          return new Date(a.responseDeadline).getTime() - new Date(b.responseDeadline).getTime();
        case 'value':
          return (b.contractValue || 0) - (a.contractValue || 0);
        case 'posted':
          return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
        default:
          return 0;
      }
    });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-100';
    if (score >= 0.8) return 'text-blue-600 bg-blue-100';
    if (score >= 0.7) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

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
          <Target className="inline-block w-8 h-8 mr-2 text-blue-600" />
          Opportunity Dashboard
        </h1>
        <p className="text-gray-600">
          AI-matched contract opportunities based on your business profile
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Target className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOpportunities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <Star className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">High Match (80%+)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.highMatchOpportunities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Match Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(stats.avgMatchScore * 100)}%
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
              <p className="text-sm font-medium text-gray-600">New This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.newThisWeek}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Min Match Score:</label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.1"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-gray-600">{Math.round(minScore * 100)}%</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="matchScore">Match Score</option>
              <option value="deadline">Deadline</option>
              <option value="value">Contract Value</option>
              <option value="posted">Posted Date</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Agency:</label>
            <input
              type="text"
              value={filterAgency}
              onChange={(e) => setFilterAgency(e.target.value)}
              placeholder="Filter by agency"
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button 
            onClick={() => setShowNotificationModal(true)}
            className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            Notification Settings
          </button>
        </div>
      </div>

      {/* Opportunities List */}
      {filteredAndSortedOpportunities.length > 0 ? (
        <div className="space-y-4">
          {filteredAndSortedOpportunities.map((opportunity) => {
            const daysUntilDeadline = getDaysUntilDeadline(opportunity.responseDeadline);
            const isUrgent = daysUntilDeadline <= 7;

            return (
              <div key={opportunity.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {opportunity.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMatchScoreColor(opportunity.matchScore)}`}>
                        {Math.round(opportunity.matchScore * 100)}% match
                      </span>
                      {isUrgent && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {opportunity.agency} • Notice ID: {opportunity.noticeId}
                    </p>
                  </div>
                </div>

                <p className="text-gray-700 mb-4 line-clamp-2">
                  {opportunity.description}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">NAICS Code:</span>
                    <p className="font-medium">{opportunity.naicsCode || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Value:</span>
                    <p className="font-medium">
                      {opportunity.contractValue ? formatCurrency(opportunity.contractValue) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Posted:</span>
                    <p className="font-medium">{formatDate(opportunity.postedDate)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Deadline:</span>
                    <p className={`font-medium ${isUrgent ? 'text-red-600' : ''}`}>
                      {formatDate(opportunity.responseDeadline)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Days Left:</span>
                    <p className={`font-medium ${isUrgent ? 'text-red-600' : ''}`}>
                      {daysUntilDeadline > 0 ? daysUntilDeadline : 'Expired'}
                    </p>
                  </div>
                </div>

                {/* Match Factors */}
                {opportunity.matchFactors && Object.keys(opportunity.matchFactors).length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-blue-800 mb-2">Why this matches:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(opportunity.matchFactors).map(([factor, value], index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {factor}: {typeof value === 'number' ? Math.round(value * 100) + '%' : value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Matched: {formatDate(opportunity.matchedAt)}
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                      View Details
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Start Proposal
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
          <p className="text-gray-600 mb-4">
            {opportunities.length === 0 
              ? "Complete your business profile to start receiving personalized opportunities."
              : "Try adjusting your filters to see more opportunities."
            }
          </p>
          {opportunities.length === 0 && (
            <button 
              onClick={() => window.location.href = '/rfp/company-profiles'}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Complete Profile
            </button>
          )}
        </div>
      )}

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onSave={handleNotificationSettings}
      />
    </div>
  );
};

export default OpportunityDashboard;
