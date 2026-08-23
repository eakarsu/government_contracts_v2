import React from 'react';
import { Menu, Bell, LogOut, Search, Settings } from 'lucide-react';
import { AppConfig } from '../../types';
import { useAuth } from '../AuthGate';

interface HeaderProps {
  onMenuClick: () => void;
  config?: AppConfig;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, config }) => {
  const { signOut, signingOut } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="ml-4 lg:ml-0">
            <h1 className="text-2xl font-bold text-gray-900">
              Government Contract Intelligence
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
          <button
            type="button"
            aria-label="Notifications"
            className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Bell className="h-6 w-6" />
          </button>

          {/* Settings */}
          <button
            type="button"
            aria-label="Settings"
            className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Settings className="h-6 w-6" />
          </button>

          {/* Feature indicators */}
          {config && (
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

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden sm:inline">{signingOut ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
