import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  BarChart3,
  X,
  Zap,
  ClipboardList,
  Target,
  Sparkles,
  FileText
} from 'lucide-react';
// Note: Sparkles icon is also used for AI Search mode in unified Search page

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'RFP System', href: '/rfp', icon: ClipboardList },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Jobs', href: '/jobs', icon: BarChart3 },
];

const aiEnhancements = [
  { name: 'AI Center', href: '/ai/center', icon: Sparkles },
  { name: 'Bid Analyzer', href: '/ai/bid-analyzer', icon: Target },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const isNavActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/';
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const isAIActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith('/ai');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm transition-opacity animate-fade-in" />
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          bg-white border-r border-gray-100
          transform transition-transform duration-300 ease-out
          lg:translate-x-0 lg:static lg:inset-0
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-secondary-900">
              ContractAI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = isNavActive(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5
                    text-sm font-medium rounded-lg
                    transition-all duration-200
                    ${isActive
                      ? 'bg-primary-50 text-primary-700 border-l-[3px] border-primary-500 -ml-[3px] pl-[calc(0.75rem+3px)]'
                      : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                    }
                  `}
                >
                  <item.icon
                    className={`
                      h-5 w-5 flex-shrink-0 transition-colors duration-200
                      ${isActive
                        ? 'text-primary-600'
                        : 'text-secondary-400 group-hover:text-secondary-600'
                      }
                    `}
                  />
                  {item.name}
                </NavLink>
              );
            })}
          </div>

          {/* AI Enhancements Section */}
          <div className="mt-8">
            <div className="px-3 mb-3">
              <h3 className="text-xs font-semibold text-secondary-400 uppercase tracking-wider">
                AI Enhancements
              </h3>
            </div>
            <div className="space-y-1">
              {aiEnhancements.map((item) => {
                const isActive = isAIActive(item.href);
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={`
                      group flex items-center gap-3 px-3 py-2.5
                      text-sm font-medium rounded-lg
                      transition-all duration-200
                      ${isActive
                        ? 'bg-accent-50 text-accent-700 border-l-[3px] border-accent-500 -ml-[3px] pl-[calc(0.75rem+3px)]'
                        : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                      }
                    `}
                  >
                    <item.icon
                      className={`
                        h-5 w-5 flex-shrink-0 transition-colors duration-200
                        ${isActive
                          ? 'text-accent-600'
                          : 'text-secondary-400 group-hover:text-secondary-600'
                        }
                      `}
                    />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary-50">
            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-secondary-700 truncate">
                System Online
              </p>
              <p className="text-xs text-secondary-500">
                Powered by AI
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
