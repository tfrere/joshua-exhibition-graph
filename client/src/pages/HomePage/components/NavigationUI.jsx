import { useState, useEffect } from "react";
// Nous ne pouvons pas utiliser useThree ici car NavigationUI est en dehors du Canvas
// import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

// Composant UI simplifié pour le mode vol uniquement
export const NavigationUI = ({ graphRef }) => {
  // const { camera } = useThree(); // Ce hook n'est pas utilisable ici
  // Accéder à l'état global pour connaître l'état d'animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showExportButton, setShowExportButton] = useState(false);
  const [cameraMode, setCameraMode] = useState("Normal");
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, z: 0 });
  const [cameraTarget, setCameraTarget] = useState({ x: 0, y: 0, z: 0 });
  const [distanceToCenter, setDistanceToCenter] = useState(0);
  const [timeBeforeAutoOrbit, setTimeBeforeAutoOrbit] = useState(null);

  // Écouter l'état d'animation exposé par le contrôleur de caméra et mettre à jour les positions
  useEffect(() => {
    // Créer une fonction pour écouter l'état d'animation et la position
    const updateCameraInfo = () => {
      // Mise à jour de l'état de transition
      if (window.__cameraAnimating !== undefined) {
        setIsTransitioning(window.__cameraAnimating);
      }

      // Mise à jour du mode caméra
      if (window.__orbitModeActive !== undefined) {
        setCameraMode(
          window.__orbitModeActive
            ? "Orbite automatique"
            : window.__cameraAnimating
            ? "Transition"
            : "Normal"
        );
      } else {
        setCameraMode(window.__cameraAnimating ? "Transition" : "Normal");
      }

      // Mise à jour du temps restant avant l'auto-orbite
      if (window.__timeBeforeAutoOrbit !== undefined) {
        setTimeBeforeAutoOrbit(window.__timeBeforeAutoOrbit);
      }

      // Mise à jour de la position de la caméra si disponible
      if (window.__cameraPosition) {
        setCameraPosition({
          x: parseFloat(window.__cameraPosition.x.toFixed(2)),
          y: parseFloat(window.__cameraPosition.y.toFixed(2)),
          z: parseFloat(window.__cameraPosition.z.toFixed(2)),
        });

        // Calculer la distance au centre (0,0,0)
        const position = new Vector3(
          window.__cameraPosition.x,
          window.__cameraPosition.y,
          window.__cameraPosition.z
        );
        const distance = position.length();
        setDistanceToCenter(parseFloat(distance.toFixed(2)));
      }

      // Mise à jour de la cible de la caméra si disponible
      if (window.__cameraTarget) {
        setCameraTarget({
          x: parseFloat(window.__cameraTarget.x.toFixed(2)),
          y: parseFloat(window.__cameraTarget.y.toFixed(2)),
          z: parseFloat(window.__cameraTarget.z.toFixed(2)),
        });
      }
    };

    // Vérifier régulièrement l'état d'animation et la position
    const intervalId = setInterval(updateCameraInfo, 100);
    return () => clearInterval(intervalId);
  }, []);

  // Déterminer la couleur du mode en fonction de l'état
  const getModeColor = () => {
    if (cameraMode === "Orbite automatique") return "#00aaff";
    if (cameraMode === "Transition") return "#ffcc00";
    return "#4CAF50"; // Mode normal
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        color: "white",
        padding: "10px",
        background: "rgba(0,0,0,0.7)",
        borderRadius: "5px",
        fontSize: "14px",
        zIndex: 1000,
        maxWidth: "350px",
      }}
    >
      <div
        style={{
          marginBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Mode Vol Libre</strong>
        <span
          style={{
            backgroundColor: getModeColor(),
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "12px",
            color: "#fff",
          }}
        >
          {cameraMode}
        </span>
      </div>

      {/* Affichage des informations de la caméra */}
      <div
        style={{
          fontSize: "12px",
          backgroundColor: "rgba(0,0,0,0.4)",
          padding: "8px",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      >
        <div style={{ marginBottom: "5px" }}>
          <strong>Position caméra:</strong>
          X: {cameraPosition.x}, Y: {cameraPosition.y}, Z: {cameraPosition.z}
        </div>
        <div style={{ marginBottom: "5px" }}>
          <strong>Distance au centre:</strong>
          <span
            style={{
              color:
                distanceToCenter > 750
                  ? "#ff6b6b"
                  : distanceToCenter > 600
                  ? "#ffcc00"
                  : "#4CAF50",
            }}
          >
            {distanceToCenter}
          </span>
          {distanceToCenter > 750 && (
            <span style={{ color: "#ff6b6b" }}> (Limite: 800)</span>
          )}
        </div>
        <div>
          <strong>Direction:</strong>
          X: {cameraTarget.x}, Y: {cameraTarget.y}, Z: {cameraTarget.z}
        </div>
      </div>

      {isTransitioning ? (
        <div style={{ color: "#ffcc00" }}>Transition en cours...</div>
      ) : (
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
          <p>Utilisez ESPACE pour naviguer entre les positions prédéfinies</p>

          {/* Timer avant orbite automatique */}
          {cameraMode === "Normal" && timeBeforeAutoOrbit !== null ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: "8px",
                color: "#00aaff",
              }}
            >
              <strong style={{ marginRight: "8px" }}>
                Orbite automatique dans:
              </strong>
              <div
                style={{
                  backgroundColor: "rgba(0, 170, 255, 0.2)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  minWidth: "50px",
                  textAlign: "center",
                }}
              >
                {Math.ceil(timeBeforeAutoOrbit / 1000)}s
              </div>
            </div>
          ) : (
            <p style={{ color: "#00aaff" }}>
              Après 10s d'inactivité: orbite automatique
            </p>
          )}
        </div>
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
