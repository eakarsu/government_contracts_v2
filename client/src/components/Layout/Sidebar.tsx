import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  FileText, 
  Briefcase, 
  Upload, 
  Settings, 
  BarChart3,
  X,
  Database,
  Zap,
  ClipboardList,
  Target,
  Wand2,
  Sparkles,
  Brain
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'NLP Search', href: '/nlp-search', icon: Sparkles },
  { name: 'RFP System', href: '/rfp', icon: ClipboardList },
  { name: 'Jobs', href: '/jobs', icon: BarChart3 },
  { name: 'Documents', href: '/documents', icon: Upload },
  { name: 'API Docs', href: '/api-docs', icon: Database },
];

const aiEnhancements = [
  { name: 'AI Quick Actions', href: '/ai/quick-actions', icon: Brain },
  { name: 'Proposal Drafter', href: '/ai/proposal-drafter', icon: Wand2 },
  { name: 'Bid Analyzer', href: '/ai/bid-analyzer', icon: Target },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <Zap className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">
              ContractAI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href === '/rfp' && location.pathname.startsWith('/rfp'));
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    onClick={onClose}
                    className={clsx(
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                      isActive
                        ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon
                      className={clsx(
                        'mr-3 h-5 w-5 transition-colors duration-200',
                        isActive
                          ? 'text-primary-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      )}
                    />
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* AI Enhancements Links */}
          <div className="mt-8">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Enhancements
            </h3>
            <ul className="mt-2 space-y-1">
              {aiEnhancements.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith('/ai');
                return (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      onClick={onClose}
                      className={clsx(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                        isActive
                          ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon
                        className={clsx(
                          'mr-3 h-5 w-5 transition-colors duration-200',
                          isActive
                            ? 'text-blue-500'
                            : 'text-gray-400 group-hover:text-gray-500'
                        )}
                      />
                      {item.name}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            Government Contract Indexer
            <br />
            Powered by AI
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
