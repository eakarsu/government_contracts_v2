import React from 'react';
import { Menu, Bell, Search, Settings } from 'lucide-react';
import { AppConfig } from '../../types';

interface HeaderProps {
  onMenuClick: () => void;
  config?: AppConfig;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, config }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="ml-4 lg:ml-0">
            <h1 className="text-2xl font-bold text-gray-900">
              Contract Indexer
            </h1>
            {config && (
              <p className="text-sm text-gray-500">
                {config.environment} • v{config.version}
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Quick search..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Notifications */}
          <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
            <Bell className="h-6 w-6" />
          </button>

          {/* Settings */}
          <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
            <Settings className="h-6 w-6" />
          </button>

          {/* Feature indicators */}
          {config && config.features && (
            <div className="hidden lg:flex items-center space-x-2">
              {config.features.samGovApi && (
                <span className="badge-success">SAM.gov</span>
              )}
              {config.features.norshinApi && (
                <span className="badge-info">Norshin</span>
              )}
              {config.features.vectorDatabase && (
                <span className="badge-info">Vector DB</span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
