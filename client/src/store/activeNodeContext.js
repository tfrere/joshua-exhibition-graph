import React, { createContext, useState, useContext, useEffect } from "react";

// Create context for active node state
const ActiveNodeContext = createContext(null);

// Provider component that wraps application to provide active node state
function ActiveNodeProvider({ children }) {
  const [activeNode, setActiveNode] = useState(null);

  // Listen for node activation/deactivation events
  useEffect(() => {
    // Function to handle node activation/deactivation
    const handleActiveNodeChanged = (event) => {
      console.log("Node activation event received in context:", event.detail);
      setActiveNode(event.detail);
    };

    // Check if node is already active on load
    if (window.activeNodeRef && window.activeNodeRef.current) {
      setActiveNode(window.activeNodeRef.current);
    }

    // Add event listener
    window.addEventListener("activeNodeChanged", handleActiveNodeChanged);

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener("activeNodeChanged", handleActiveNodeChanged);
    };
  }, []);

  return (
    <ActiveNodeContext.Provider value={{ activeNode, setActiveNode }}>
      {children}
    </ActiveNodeContext.Provider>
  );
}

// Custom hook to use the active node context
function useActiveNode() {
  const context = useContext(ActiveNodeContext);
  if (context === undefined) {
    throw new Error("useActiveNode must be used within an ActiveNodeProvider");
  }
  return context;
}

export { ActiveNodeContext, ActiveNodeProvider, useActiveNode };
