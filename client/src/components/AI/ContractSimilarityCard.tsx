import React from 'react';
import { ExternalLink, Clock, DollarSign, Building } from 'lucide-react';

interface SimilarContract {
  contract: {
    id: string;
    title: string;
    agency: string;
    naicsCode: string;
    awardAmount: string;
    postedDate: string;
    awardedTo?: string;
  };
  similarity: number;
  factors: Record<string, number>;
  keyMatches: string[];
}

interface ContractSimilarityCardProps {
  similarContracts: SimilarContract[];
  loading?: boolean;
  onViewDetails?: (contractId: string) => void;
}

const ContractSimilarityCard: React.FC<ContractSimilarityCardProps> = ({
  similarContracts,
  loading = false,
  onViewDetails
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="mb-4 pb-4 border-b border-gray-200 last:border-0">
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 'Amount TBD';
    
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    
    return `$${num.toLocaleString()}`;
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 80) return 'text-green-600';
    if (similarity >= 60) return 'text-yellow-600';
    return 'text-blue-600';
  };

  if (!similarContracts || similarContracts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Building className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No similar contracts found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Similar Contracts</h3>
        <span className="text-sm text-gray-500">{similarContracts.length} matches</span>
      </div>

      <div className="space-y-4">
        {similarContracts.map((item, index) => (
          <div 
            key={item.contract.id} 
            className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 text-sm mb-1">
                  {item.contract.title}
                </h4>
                <p className="text-xs text-gray-600">{item.contract.agency}</p>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${getSimilarityColor(item.similarity)}`}>
                  {item.similarity}%
                </div>
                <div className="text-xs text-gray-500">similarity</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">
                  {formatCurrency(item.contract.awardAmount)}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Building className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">{item.contract.naicsCode}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-gray-600">
                  {formatDate(item.contract.postedDate)}
                </span>
              </div>
            </div>

            {item.keyMatches.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {item.keyMatches.slice(0, 3).map((match, matchIndex) => (
                    <span
                      key={matchIndex}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {match}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {onViewDetails && (
              <div className="mt-3 text-right">
                <button
                  onClick={() => onViewDetails(item.contract.id)}
                  className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Details
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractSimilarityCard;