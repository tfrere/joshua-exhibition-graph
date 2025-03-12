import { useState, useEffect, useCallback } from "react";

/**
 * Hook personnalisé pour gérer le mode de navigation
 * @param {function} setIsCountingEnabled - Fonction pour activer/désactiver le comptage
 * @returns {Object} - Le mode de navigation actuel et les fonctions associées
 */
export const useNavigationMode = (setIsCountingEnabled) => {
  // Initialiser le mode de navigation en fonction des variables globales
  const [navigationMode, setNavigationMode] = useState(() => {
    const isOrbiting = window.__orbitModeActive === true;
    const isTransitioning = window.__cameraAnimating === true;
    if (isOrbiting) return "orbit";
    if (isTransitioning) return "transitioning";
    return "normal";
  });

  // Vérifier périodiquement le mode de navigation
  useEffect(() => {
    const checkNavigationMode = () => {
      // Vérifier les valeurs directement depuis les variables globales
      const isOrbiting = window.__orbitModeActive === true;
      const isTransitioning = window.__cameraAnimating === true;

      let newMode = "normal";
      if (isOrbiting) {
        newMode = "orbit";
      } else if (isTransitioning) {
        newMode = "transitioning";
      }

      // Si nous passons en mode orbit, réinitialiser automatiquement le compteur et désactiver le comptage
      if (newMode === "orbit" && navigationMode !== "orbit") {
        console.log(
          "Mode orbit détecté: réinitialisation du compteur de visites"
        );
        // Désactiver le comptage en mode orbit
        setIsCountingEnabled(false);
        window.__countingEnabled = false;
      }

      // Si nous passons du mode orbit au mode normal, réactiver le comptage
      if (navigationMode === "orbit" && newMode === "normal") {
        console.log(
          "🚨 TRANSITION DÉTECTÉE: Sortie du mode orbit vers mode normal"
        );

        // Utiliser une fonction de rappel pour s'assurer que l'état est bien mis à jour
        setIsCountingEnabled(true);
        window.__countingEnabled = true;

        // Petit délai pour laisser le temps à React de mettre à jour l'état
        setTimeout(() => {
          console.log(
            "✅ État de comptage après activation temporisée:",
            window.__countingEnabled
          );
          window.__countingEnabled = true;
        }, 100);

        // Émettre un événement custom pour signaler la reprise du comptage
        try {
          const startCountingEvent = new CustomEvent("startCounting", {
            detail: { source: "orbit_exit_transition" },
          });
          window.dispatchEvent(startCountingEvent);
          console.log(
            "✅ Événement DOM startCounting diffusé depuis la transition orbit->normal"
          );
        } catch (error) {
          console.error(
            "❌ Erreur lors de la diffusion de l'événement startCounting:",
            error
          );
        }

        // Tenter également d'envoyer via socket pour être sûr
        try {
          if (window.socket && typeof window.socket.emit === "function") {
            window.socket.emit("startCounting", {
              timestamp: Date.now(),
              source: "orbit_exit_transition",
            });
            console.log(
              "✅ Signal socket startCounting envoyé depuis la transition orbit->normal"
            );
          }
        } catch (error) {
          console.error("❌ Erreur lors de l'envoi du signal socket:", error);
        }
      }

      // Mettre à jour le mode uniquement s'il a changé
      if (newMode !== navigationMode) {
        console.log(
          "Changement de mode de navigation:",
          navigationMode,
          "->",
          newMode
        );
        setNavigationMode(newMode);
      }
    };

    // Vérifier immédiatement puis à intervalles réguliers (plus fréquemment)
    checkNavigationMode();
    const intervalId = setInterval(checkNavigationMode, 200); // Plus rapide pour une meilleure réactivité

    // Exposer la fonction pour permettre des tests manuels
    window.__checkNavigationMode = checkNavigationMode;

    return () => clearInterval(intervalId);
  }, [navigationMode, setIsCountingEnabled]);

  // Fonction pour forcer le passage en mode normal
  const forceNormalMode = useCallback(() => {
    setNavigationMode("normal");
    window.__orbitModeActive = false;
    window.__cameraAnimating = false;
  }, []);

  return {
    navigationMode,
    setNavigationMode,
    forceNormalMode,
  };
};
