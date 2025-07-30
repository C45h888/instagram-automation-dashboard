import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteAnimationContextType {
  currentRoute: string;
  previousRoute: string;
  animationDirection: 'left' | 'right' | 'up' | 'down';
  isAnimating: boolean;
  setAnimating: (animating: boolean) => void;
}

const RouteAnimationContext = createContext<RouteAnimationContextType | undefined>(undefined);

export const useRouteAnimation = () => {
  const context = useContext(RouteAnimationContext);
  if (!context) {
    throw new Error('useRouteAnimation must be used within RouteAnimationProvider');
  }
  return context;
};

const routeOrder = ['/', '/content', '/engagement', '/analytics', '/ugc', '/settings'];

const getAnimationDirection = (from: string, to: string): 'left' | 'right' | 'up' | 'down' => {
  const fromIndex = routeOrder.indexOf(from);
  const toIndex = routeOrder.indexOf(to);
  
  if (fromIndex === -1 || toIndex === -1) return 'right';
  
  return fromIndex < toIndex ? 'right' : 'left';
};

export const RouteAnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [currentRoute, setCurrentRoute] = useState(location.pathname);
  const [previousRoute, setPreviousRoute] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (location.pathname !== currentRoute) {
      setPreviousRoute(currentRoute);
      setCurrentRoute(location.pathname);
      setIsAnimating(true);
      
      // Reset animation state after transition
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, currentRoute]);

  const animationDirection = getAnimationDirection(previousRoute, currentRoute);

  const value: RouteAnimationContextType = {
    currentRoute,
    previousRoute,
    animationDirection,
    isAnimating,
    setAnimating: setIsAnimating
  };

  return (
    <RouteAnimationContext.Provider value={value}>
      {children}
    </RouteAnimationContext.Provider>
  );
};