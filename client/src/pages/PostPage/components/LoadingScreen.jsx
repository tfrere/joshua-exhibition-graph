import React from "react";

/**
 * Composant d'écran de chargement
 * @returns {JSX.Element} - Élément JSX
 */
const LoadingScreen = () => {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      Chargement des données du personnage...
    </div>
  );
};

export default LoadingScreen;
