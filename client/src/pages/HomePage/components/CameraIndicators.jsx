import { useState, useEffect } from "react";
import { getInputManager } from "../utils/inputManager";

/**
 * Indicateur de connexion de manette
 */
const GamepadIndicator = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const inputManager = getInputManager();

    const checkGamepadStatus = () => {
      setIsConnected(inputManager.isGamepadConnected());
    };

    // Vérifier immédiatement l'état
    checkGamepadStatus();

    // Vérifier périodiquement l'état de la manette
    const intervalId = setInterval(checkGamepadStatus, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Style pour le conteneur
  const containerStyle = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: "5px",
    display: "flex",
    alignItems: "center",
    zIndex: 1000,
  };

  // Style pour l'indicateur
  const indicatorStyle = {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: isConnected ? "#00ff00" : "#ff0000",
    marginRight: "10px",
  };

  return (
    <div style={containerStyle}>
      <div style={indicatorStyle}></div>
      <span style={{ color: "white", fontSize: "14px" }}>
        {isConnected ? "Manette connectée" : "Manette déconnectée"}
      </span>
    </div>
  );
};

/**
 * Composant affichant une croix au centre de l'écran (viseur)
 */
const CrosshairIndicator = () => {
  // Style pour le conteneur qui centre le viseur
  const containerStyle = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none", // Ne pas intercepter les clics de souris
    zIndex: 999,
  };

  // Styles pour les quatre segments du viseur (au lieu de deux lignes complètes)
  // Cela évite la superposition au centre
  const segmentStyle = {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.5)", // Blanc transparent
  };

  // Segment horizontal gauche
  const leftSegmentStyle = {
    ...segmentStyle,
    width: "7px",
    height: "1px",
    top: "50%",
    right: "50%",
    marginRight: "2px", // Espace entre le segment et le centre
    transform: "translateY(-50%)",
  };

  // Segment horizontal droit
  const rightSegmentStyle = {
    ...segmentStyle,
    width: "7px",
    height: "1px",
    top: "50%",
    left: "50%",
    marginLeft: "2px", // Espace entre le segment et le centre
    transform: "translateY(-50%)",
  };

  // Segment vertical haut
  const topSegmentStyle = {
    ...segmentStyle,
    width: "1px",
    height: "7px",
    bottom: "50%",
    left: "50%",
    marginBottom: "2px", // Espace entre le segment et le centre
    transform: "translateX(-50%)",
  };

  // Segment vertical bas
  const bottomSegmentStyle = {
    ...segmentStyle,
    width: "1px",
    height: "7px",
    top: "50%",
    left: "50%",
    marginTop: "2px", // Espace entre le segment et le centre
    transform: "translateX(-50%)",
  };

  // Style pour le point central
  const centerDotStyle = {
    position: "absolute",
    width: "2px",
    height: "2px",
    borderRadius: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  return (
    <div style={containerStyle}>
      <div style={leftSegmentStyle}></div>
      <div style={rightSegmentStyle}></div>
      <div style={topSegmentStyle}></div>
      <div style={bottomSegmentStyle}></div>
      <div style={centerDotStyle}></div>
    </div>
  );
};

// Fonction pour envoyer un signal de démarrage du comptage des posts
export const sendStartCountingSignal = () => {
  console.log(
    `🔔 COMPTAGE: Envoi du signal de comptage (timestamp: ${Date.now()})`
  );

  // Méthode 1: Utiliser un événement DOM pour la communication intra-page
  // Cette méthode est la plus fiable dans le navigateur
  try {
    const startCountingEvent = new CustomEvent("startCounting", {
      detail: { timestamp: Date.now() },
    });
    window.dispatchEvent(startCountingEvent);
    console.log(`✅ COMPTAGE: Événement DOM dispatché avec succès`);
  } catch (error) {
    console.log(
      `❌ COMPTAGE: Erreur lors du dispatch de l'événement DOM:`,
      error
    );
  }

  // Méthode 2: utiliser window.socket si disponible
  if (window.socket) {
    try {
      if (typeof window.socket.emit === "function") {
        window.socket.emit("startCounting", {
          timestamp: Date.now(),
          source: "window_socket",
        });
        console.log(`✅ COMPTAGE: Signal envoyé via window.socket`);
      } else {
        console.log(
          `⚠️ COMPTAGE: window.socket existe mais n'a pas de méthode emit()`
        );
      }
    } catch (error) {
      console.log(
        `❌ COMPTAGE: Erreur lors de l'envoi via window.socket:`,
        error
      );
    }
  } else {
    console.log(`⚠️ COMPTAGE: window.socket n'est pas disponible`);
  }

  // Méthode 3: Essayer d'accéder au socket via window.io si disponible
  if (window.io) {
    try {
      const socket = window.io.connect();
      if (socket && typeof socket.emit === "function") {
        socket.emit("startCounting", {
          timestamp: Date.now(),
          source: "io_connect",
        });
        console.log(`✅ COMPTAGE: Signal envoyé via window.io.connect()`);
      }
    } catch (error) {
      console.log(
        `❌ COMPTAGE: Erreur lors de l'utilisation de window.io:`,
        error
      );
    }
  }

  // Exposer une fonction globale pour les tests manuels
  window.__sendStartCountingSignal = () => {
    console.log(
      `🧪 TEST MANUEL: Envoi du signal de comptage (timestamp: ${Date.now()})`
    );

    // Réutiliser l'événement DOM (méthode la plus fiable)
    try {
      const testEvent = new CustomEvent("startCounting", {
        detail: { timestamp: Date.now(), source: "manual_test" },
      });
      window.dispatchEvent(testEvent);
      console.log(`✅ TEST MANUEL: Événement DOM dispatché avec succès`);
    } catch (error) {
      console.log(
        `❌ TEST MANUEL: Erreur lors du dispatch de l'événement DOM:`,
        error
      );
    }

    // Tenter d'utiliser le socket s'il est disponible
    if (window.socket && typeof window.socket.emit === "function") {
      try {
        window.socket.emit("startCounting", {
          timestamp: Date.now(),
          source: "manual_trigger",
        });
        console.log(`✅ TEST MANUEL: Signal envoyé via socket`);
      } catch (error) {
        console.log(
          `❌ TEST MANUEL: Erreur lors de l'envoi via socket:`,
          error
        );
      }
    } else {
      console.log(
        `⚠️ TEST MANUEL: window.socket n'est pas disponible pour le test manuel`
      );
    }
  };
};

export { GamepadIndicator, CrosshairIndicator };
