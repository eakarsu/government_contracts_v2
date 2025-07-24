import React, { createContext, useContext, useState, useEffect } from 'react';

interface AINavigationContextType {
  parentRoute: string | null;
  setParentRoute: (route: string) => void;
  getBackNavigation: () => { path: string; label: string };
  clearParentRoute: () => void;
}

const AINavigationContext = createContext<AINavigationContextType | undefined>(undefined);

export const useAINavigation = () => {
  const context = useContext(AINavigationContext);
  if (context === undefined) {
    throw new Error('useAINavigation must be used within an AINavigationProvider');
  }
  return context;
};

interface AINavigationProviderProps {
  children: React.ReactNode;
}

export const AINavigationProvider: React.FC<AINavigationProviderProps> = ({ children }) => {
  const [parentRoute, setParentRouteState] = useState<string | null>(null);

  // Load parent route from localStorage on mount
  useEffect(() => {
    const savedParentRoute = localStorage.getItem('aiParentRoute');
    if (savedParentRoute) {
      setParentRouteState(savedParentRoute);
    }
  }, []);

  const setParentRoute = (route: string) => {
    setParentRouteState(route);
    localStorage.setItem('aiParentRoute', route);
  };

  const clearParentRoute = () => {
    setParentRouteState(null);
    localStorage.removeItem('aiParentRoute');
  };

  const getBackNavigation = () => {
    switch (parentRoute) {
      case '/ai/quick-actions':
        return { path: '/ai/quick-actions', label: 'Back to AI Quick Actions' };
      case '/ai/proposal-drafter':
        return { path: '/ai/proposal-drafter', label: 'Back to Proposal Drafter' };
      case '/ai/bid-analyzer':
        return { path: '/ai/bid-analyzer', label: 'Back to Bid Analyzer' };
      default:
        return { path: '/', label: 'Back to Dashboard' };
    }
  };

  return (
    <AINavigationContext.Provider value={{
      parentRoute,
      setParentRoute,
      getBackNavigation,
      clearParentRoute
    }}>
      {children}
    </AINavigationContext.Provider>
  );
};