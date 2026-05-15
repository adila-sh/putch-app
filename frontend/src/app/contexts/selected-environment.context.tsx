import { createContext, useContext, useState, ReactNode } from "react";

interface SelectedEnvironmentContextType {
  selectedEnvironmentId: string | null;
  setSelectedEnvironmentId: (id: string | null, collectionId: string) => void;
  getSelectedEnvironmentId: (collectionId: string) => string | null;
}

const SelectedEnvironmentContext = createContext<SelectedEnvironmentContextType | undefined>(undefined);

export function SelectedEnvironmentProvider({ children }: { children: ReactNode }) {
  const [selectedEnvironmentId, setSelectedEnvironmentIdState] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);

  const setSelectedEnvironmentId = (id: string | null, collId: string) => {
    setSelectedEnvironmentIdState(id);
    setCollectionId(collId);
    if (id) {
      localStorage.setItem(`selectedEnvironment_${collId}`, id);
    } else {
      localStorage.removeItem(`selectedEnvironment_${collId}`);
    }
  };

  const getSelectedEnvironmentId = (collId: string): string | null => {
    if (collectionId === collId) {
      return selectedEnvironmentId;
    }
    // Load from localStorage if collection changed
    const saved = localStorage.getItem(`selectedEnvironment_${collId}`);
    if (saved) {
      setSelectedEnvironmentIdState(saved);
      setCollectionId(collId);
      return saved;
    }
    return null;
  };

  return (
    <SelectedEnvironmentContext.Provider value={{ selectedEnvironmentId, setSelectedEnvironmentId, getSelectedEnvironmentId }}>
      {children}
    </SelectedEnvironmentContext.Provider>
  );
}

export function useSelectedEnvironment() {
  const context = useContext(SelectedEnvironmentContext);
  if (context === undefined) {
    throw new Error("useSelectedEnvironment must be used within a SelectedEnvironmentProvider");
  }
  return context;
}

