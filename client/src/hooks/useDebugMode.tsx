import React, { createContext, useContext, useState, ReactNode, FC } from 'react';

interface DebugContextType {
  isDebugMode: boolean;
  setIsDebugMode: (value: boolean) => void;
  debugLog: (...args: unknown[]) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [isDebugMode, setIsDebugMode] = useState(false);

  const debugLog = (...args: unknown[]) => {
    if (isDebugMode) {
      console.log(...args);
    }
  };

  const value = {
    isDebugMode,
    setIsDebugMode,
    debugLog
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

export function useDebugMode() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebugMode must be used within a DebugProvider');
  }
  return context;
} 