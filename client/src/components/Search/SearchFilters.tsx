import React, { useState, useEffect } from 'react';

interface SearchFilters {
  agency?: string;
  naics_code?: string;
  min_value?: number;
  max_value?: number;
  date_from?: string;
  date_to?: string;
  set_aside?: string;
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onFiltersChange }) => {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const agencies = [
    'Department of Defense',
    'Department of Homeland Security',
    'General Services Administration',
    'Department of Health and Human Services',
    'Department of Veterans Affairs',
    'Department of Energy',
    'NASA',
    'Department of Agriculture',
    'Department of Transportation',
    'Department of Justice'
  ];

  const setAsideTypes = [
    'Small Business',
    'Women-Owned Small Business',
    'Veteran-Owned Small Business',
    'Service-Disabled Veteran-Owned',
    'HUBZone',
    '8(a) Business Development',
    'Historically Black Colleges and Universities',
    'Minority Institution'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Advanced Filters</h3>
        <button
          onClick={clearFilters}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Agency Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agency
          </label>
          <select
            value={localFilters.agency || ''}
            onChange={(e) => handleFilterChange('agency', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Agencies</option>
            {agencies.map((agency) => (
              <option key={agency} value={agency}>
                {agency}
              </option>
            ))}
          </select>
        </div>

        {/* NAICS Code Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NAICS Code
          </label>
          <input
            type="text"
            value={localFilters.naics_code || ''}
            onChange={(e) => handleFilterChange('naics_code', e.target.value || undefined)}
            placeholder="e.g., 541511"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Set-Aside Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Set-Aside Type
          </label>
          <select
            value={localFilters.set_aside || ''}
            onChange={(e) => handleFilterChange('set_aside', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            {setAsideTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Contract Value Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Contract Value
          </label>
          <input
            type="number"
            value={localFilters.min_value || ''}
            onChange={(e) => handleFilterChange('min_value', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="$0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Contract Value
          </label>
          <input
            type="number"
            value={localFilters.max_value || ''}
            onChange={(e) => handleFilterChange('max_value', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="No limit"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Posted From
          </label>
          <input
            type="date"
            value={localFilters.date_from || ''}
            onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Posted To
          </label>
          <input
            type="date"
            value={localFilters.date_to || ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Active Filters Display */}
      {Object.keys(localFilters).length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Active Filters:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(localFilters).map(([key, value]) => {
              if (!value) return null;
              return (
                <span
                  key={key}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {key.replace('_', ' ')}: {value}
                  <button
                    onClick={() => handleFilterChange(key as keyof SearchFilters, undefined)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
