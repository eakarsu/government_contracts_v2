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
  Brain,
  FolderKanban,
  Users,
  ListChecks,
  GitCompareArrows,
  CalendarClock,
  ShieldCheck,
  Scale,
  FileCheck2
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

const lifecycleNavigation = [
  { name: 'Lifecycle Overview', href: '/lifecycle', icon: FolderKanban },
  { name: 'Contract Matters', href: '/lifecycle/matters', icon: Briefcase },
  { name: 'Parties', href: '/lifecycle/parties', icon: Users },
  { name: 'Documents', href: '/lifecycle/document-versions', icon: FileText },
  { name: 'Clauses & Playbooks', href: '/lifecycle/clauses', icon: FileCheck2 },
  { name: 'Obligations', href: '/lifecycle/obligations', icon: ListChecks },
  { name: 'Amendments', href: '/lifecycle/amendments', icon: GitCompareArrows },
  { name: 'Approvals', href: '/lifecycle/approvals', icon: ShieldCheck },
  { name: 'Renewals & Options', href: '/lifecycle/renewals', icon: CalendarClock },
  { name: 'Risk & AI Evidence', href: '/lifecycle/risk-assessments', icon: Brain },
];

function NavigationLink({ item, active, onClose }: { item: { name: string; href: string; icon: React.ElementType }; active: boolean; onClose: () => void }) {
  return <li>
    <NavLink to={item.href} onClick={onClose} className={clsx('group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200', active ? 'border-r-2 border-primary-500 bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
      <item.icon className={clsx('mr-3 h-5 w-5 shrink-0', active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500')} />
      {item.name}
    </NavLink>
  </li>;
}

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
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <Zap className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">
              GovContract AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Opportunity Intelligence</h3>
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href === '/rfp' && location.pathname.startsWith('/rfp'));
              return <NavigationLink key={item.name} item={item} active={isActive} onClose={onClose} />;
            })}
          </ul>

          <div className="mt-8">
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Contract Lifecycle</h3>
            <ul className="mt-2 space-y-1">
              {lifecycleNavigation.map(item => {
                const isActive = item.href === '/lifecycle' ? location.pathname === '/lifecycle' : location.pathname === item.href;
                return <NavigationLink key={item.name} item={item} active={isActive} onClose={onClose} />;
              })}
              <NavigationLink item={{ name: 'Compliance Governance', href: '/governance', icon: Scale }} active={location.pathname === '/governance'} onClose={onClose} />
            </ul>
          </div>

          {/* AI Enhancements Links */}
          <div className="mt-8">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Enhancements
            </h3>
            <ul className="mt-2 space-y-1">
              {aiEnhancements.map(item => <NavigationLink key={item.name} item={item} active={location.pathname === item.href} onClose={onClose} />)}
            </ul>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="text-xs text-gray-500 text-center">
            Government Contract Lifecycle
            <br />
            Powered by AI
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
