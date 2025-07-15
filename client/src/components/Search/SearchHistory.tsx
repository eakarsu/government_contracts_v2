import React, { useState, useEffect } from 'react';

interface SearchHistoryItem {
  query_text: string;
  results_count: number;
  created_at: string;
}

interface SearchHistoryProps {
  onHistoryItemClick: (query: string) => void;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ onHistoryItemClick }) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const fetchSearchHistory = async () => {
    try {
      const response = await fetch('/api/search/history');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHistory(data.history);
        }
      }
    } catch (error) {
      console.error('Error fetching search history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading history...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">No search history available</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Searches</h3>
      <div className="space-y-2">
        {history.map((item, index) => (
          <button
            key={index}
            onClick={() => onHistoryItemClick(item.query_text)}
            className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-900">{item.query_text}</span>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{item.results_count} results</span>
                <span>•</span>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchHistory;
