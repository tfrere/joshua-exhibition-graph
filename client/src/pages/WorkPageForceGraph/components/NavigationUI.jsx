import { useState, useEffect } from "react";

// Composant UI simplifié
export const NavigationUI = ({ graphRef }) => {
  // Accéder à l'état global pour connaître l'état d'animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cameraMode, setCameraMode] = useState("orbit");
  const [showExportButton, setShowExportButton] = useState(false);

  // Écouter l'état d'animation et le mode exposés par le contrôleur de caméra
  useEffect(() => {
    // Créer une fonction pour écouter l'état d'animation et le mode
    const checkCameraState = () => {
      if (window.__cameraAnimating !== undefined) {
        setIsTransitioning(window.__cameraAnimating);
      }
      if (window.__cameraMode !== undefined) {
        setCameraMode(window.__cameraMode);
      }
    };

    // Vérifier régulièrement l'état d'animation
    const intervalId = setInterval(checkCameraState, 100);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        color: "white",
        padding: "10px",
        background: "rgba(0,0,0,0.5)",
        borderRadius: "5px",
        fontSize: "14px",
        zIndex: 1000,
        maxWidth: "300px",
      }}
    >
      <div style={{ marginBottom: "8px" }}>
        <strong>
          Mode: {cameraMode === "flight" ? "Vol libre" : "Orbite"}
        </strong>{" "}
        <span style={{ opacity: 0.7, fontSize: "12px" }}>
          (TAB pour changer)
        </span>
      </div>

      {isTransitioning ? (
        <div style={{ color: "#ffcc00" }}>Transition en cours...</div>
      ) : (
        <>
          {cameraMode === "flight" ? (
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              <p>
                <strong>Commandes de vol:</strong>
                <br />
                ZQSD/Flèches: Mouvement
                <br />
                E/Espace: Monter | C/Shift: Descendre
                <br />
                Q/E: Rotation | Z/X: Tangage | R/F: Roulis
              </p>
            </div>
          ) : (
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              <p>
                Utilisez ESPACE pour naviguer entre les positions prédéfinies
              </p>
            </div>
          )}
        </>
      )}

      {/* Bouton d'exportation des données spatiales */}
      {showExportButton && (
        <button
          onClick={handleExportData}
          style={{
            marginTop: "15px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            padding: "8px 12px",
            textAlign: "center",
            textDecoration: "none",
            display: "inline-block",
            fontSize: "14px",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Exporter données spatialisées
        </button>
      )}
    </div>
  );
};

export default NavigationUI;
