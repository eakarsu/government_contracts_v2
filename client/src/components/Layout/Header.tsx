import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Search, Settings, ChevronRight, User, LogOut, ChevronDown } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

// Breadcrumb mapping
const breadcrumbNames: Record<string, string> = {
  '': 'Dashboard',
  'dashboard': 'Dashboard',
  'search': 'Search',
  'nlp-search': 'NLP Search',
  'rfp': 'RFP System',
  'jobs': 'Jobs',
  'api-docs': 'API Documentation',
  'documents': 'Documents',
  'ai': 'AI',
  'center': 'AI Center',
  'proposal-drafter': 'Proposal Drafter',
  'bid-analyzer': 'Bid Analyzer',
  'contracts': 'Contract Details',
  'opportunities': 'Opportunities',
};

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumbs = () => {
    const crumbs = [{ name: 'Home', path: '/dashboard' }];
    let currentPath = '';

    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`;
      const name = breadcrumbNames[segment] || segment;
      crumbs.push({ name, path: currentPath });
    });

    return crumbs;
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-secondary-300" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-secondary-900">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-secondary-500 hover:text-secondary-700 transition-colors"
                  >
                    {crumb.name}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Mobile title */}
          <h1 className="text-lg font-semibold text-secondary-900 sm:hidden">
            {breadcrumbs[breadcrumbs.length - 1]?.name || 'Dashboard'}
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-secondary-400" />
              </div>
              <input
                type="text"
                placeholder="Quick search..."
                className="
                  w-48 lg:w-64 pl-9 pr-4 py-2
                  text-sm text-secondary-900 placeholder-secondary-400
                  bg-secondary-50 border-0 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white
                  transition-all duration-200
                "
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-secondary-200" />

          {/* Notifications */}
          <button
            className="
              relative p-2 rounded-lg text-secondary-400
              hover:text-secondary-600 hover:bg-secondary-100
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            "
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
          </button>

          {/* Settings */}
          <button
            className="
              p-2 rounded-lg text-secondary-400
              hover:text-secondary-600 hover:bg-secondary-100
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            "
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-secondary-100 transition-colors"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white text-sm font-medium">
                {getUserInitials()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-secondary-900">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'User'}
                </div>
                <div className="text-xs text-secondary-500">{user?.email}</div>
              </div>
              <ChevronDown className={`hidden md:block w-4 h-4 text-secondary-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white text-lg font-medium">
                      {getUserInitials()}
                    </div>
                    <div>
                      <div className="font-medium text-secondary-900">
                        {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
                      </div>
                      <div className="text-sm text-secondary-500">{user?.email}</div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-secondary-700 hover:bg-secondary-50 transition-colors"
                  >
                    <User className="w-5 h-5 text-secondary-400" />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-secondary-700 hover:bg-secondary-50 transition-colors"
                  >
                    <Settings className="w-5 h-5 text-secondary-400" />
                    <span>Settings</span>
                  </Link>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 pt-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
