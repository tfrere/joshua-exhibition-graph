import { useState, useEffect, useCallback } from "react";
import {
  addEventListener,
  removeEventListener,
  activePostRef,
} from "../../../pages/HomePage/components/Posts/hooks/useNearestPostDetection";

/**
 * Hook personnalisé pour gérer le comptage des posts visités
 * @param {Object} options - Options de configuration
 * @param {Array} options.postsData - Données de tous les posts
 * @param {string} options.navigationMode - Mode de navigation actuel ('normal', 'orbit', 'transitioning')
 * @returns {Object} - États et fonctions pour gérer le comptage
 */
const usePostCounting = ({ postsData }) => {
  const [visitedPosts, setVisitedPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isCountingEnabled, setIsCountingEnabled] = useState(false);
  const [navigationMode, setNavigationMode] = useState(() => {
    const isOrbiting = window.__orbitModeActive === true;
    const isTransitioning = window.__cameraAnimating === true;
    if (isOrbiting) return "orbit";
    if (isTransitioning) return "transitioning";
    return "normal";
  });

  // Mettre à jour le nombre total de posts quand les données sont chargées
  useEffect(() => {
    if (postsData) {
      setTotalPosts(postsData.length);
    }
  }, [postsData]);

  // Activer automatiquement le comptage après un délai
  useEffect(() => {
    // Pour déboguer: activer automatiquement le comptage après 5 secondes
    const timerId = setTimeout(() => {
      setIsCountingEnabled(true);
      // Essayons aussi d'émettre un événement startCounting pour voir si ça fonctionne
      try {
        if (window.socket && typeof window.socket.emit === "function") {
          window.socket.emit("startCounting", {
            timestamp: Date.now(),
            source: "auto_timer",
          });
        }
      } catch (error) {
        // Silencieux en cas d'erreur
      }
    }, 5000);

    return () => clearTimeout(timerId);
  }, []);

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
        setVisitedPosts([]);
        setIsCountingEnabled(false);
      }

      // Si nous passons du mode orbit au mode normal, réactiver le comptage
      if (navigationMode === "orbit" && newMode === "normal") {
        setIsCountingEnabled(true);

        // Émettre un événement custom pour signaler la reprise du comptage
        try {
          const startCountingEvent = new CustomEvent("startCounting");
          window.dispatchEvent(startCountingEvent);
        } catch (error) {
          // Silencieux en cas d'erreur
        }
      }

      // Mettre à jour le mode uniquement s'il a changé
      if (newMode !== navigationMode) {
        setNavigationMode(newMode);
      }
    };

    // Vérifier immédiatement puis à intervalles réguliers (plus fréquemment)
    checkNavigationMode();
    const intervalId = setInterval(checkNavigationMode, 200); // Plus rapide pour une meilleure réactivité

    // Exposer la fonction pour permettre des tests manuels
    window.__checkNavigationMode = checkNavigationMode;
    window.__resetVisitedPosts = () => {
      setVisitedPosts([]);
    };
    window.__startCounting = () => {
      setIsCountingEnabled(true);
    };

    return () => clearInterval(intervalId);
  }, [navigationMode]);

  // Mettre en place les écouteurs pour les événements de réinitialisation et de démarrage du comptage
  useEffect(() => {
    // Écouter le signal de réinitialisation via socket
    if (window.socket) {
      window.socket.on("resetView", () => {
        // Forcer la réinitialisation avec un nouveau tableau vide pour garantir la mise à jour
        setVisitedPosts([]);
        // Forcer la vérification du mode de navigation
        if (typeof window.__checkNavigationMode === "function") {
          window.__checkNavigationMode();
        }
        // Désactiver le comptage en mode orbit
        setIsCountingEnabled(false);
      });

      // Nouveau signal pour démarrer le comptage (après avoir cliqué sur start ou quitté l'orbit)
      window.socket.on("startCounting", (data) => {
        setIsCountingEnabled(true);
      });
    }

    // Écouter également l'événement DOM comme mécanisme de secours
    const handleResetEvent = (event) => {
      setVisitedPosts([]);
      // Forcer la vérification du mode de navigation
      if (typeof window.__checkNavigationMode === "function") {
        window.__checkNavigationMode();
      }
      // Forcer aussi le passage en mode orbit et désactiver le comptage
      setNavigationMode("orbit");
      setIsCountingEnabled(false);
    };

    // Écouter l'événement DOM pour démarrer le comptage
    const handleStartCountingEvent = (event) => {
      setIsCountingEnabled(true);
    };

    // Ajouter les écouteurs d'événements DOM
    window.addEventListener("resetVisitedPosts", handleResetEvent);
    window.addEventListener("startCounting", handleStartCountingEvent);

    // Exposer des fonctions pour tests manuels depuis la console
    window.__startCountingManual = () => {
      setIsCountingEnabled(true);
    };

    return () => {
      // Supprimer les écouteurs socket
      if (window.socket) {
        window.socket.off("resetView");
        window.socket.off("startCounting");
      }

      // Supprimer les écouteurs DOM
      window.removeEventListener("resetVisitedPosts", handleResetEvent);
      window.removeEventListener("startCounting", handleStartCountingEvent);
    };
  }, []);

  // Function to update visited posts
  const updateVisitedPosts = useCallback(
    (postUID) => {
      if (postUID === undefined) {
        return;
      }

      // Ne compter les posts visités que si nous sommes en mode normal ET que le comptage est activé
      if (navigationMode === "normal" && isCountingEnabled) {
        setVisitedPosts((prevVisited) => {
          if (!prevVisited.includes(postUID)) {
            return [...prevVisited, postUID];
          }
          return prevVisited;
        });
      }
    },
    [navigationMode, isCountingEnabled]
  );

  // Calculer le pourcentage de posts visités
  const visitedPercentage =
    totalPosts > 0 ? ((visitedPosts.length / totalPosts) * 100).toFixed(2) : 0;

  // Fonction pour réinitialiser manuellement les posts visités
  const resetVisitedPosts = useCallback(() => {
    setVisitedPosts([]);
  }, []);

  // Fonction pour activer/désactiver le comptage
  const toggleCounting = useCallback((enabled = true) => {
    setIsCountingEnabled(enabled);
  }, []);

  // Écouter les changements du post actif
  useEffect(() => {
    const handleActivePostChange = (data) => {
      const post = data.post;

      // Si le post est null, ne rien faire
      if (!post) return;

      // Ne compter les posts visités que si le comptage est activé et que nous sommes en mode normal
      if (
        post.postUID !== undefined &&
        navigationMode === "normal" &&
        isCountingEnabled
      ) {
        updateVisitedPosts(post.postUID);
      }
    };

    // S'abonner aux changements du post actif
    addEventListener("activePostChanged", handleActivePostChange);

    // Nettoyer l'écouteur à la destruction du composant
    return () => {
      removeEventListener("activePostChanged", handleActivePostChange);
    };
  }, [navigationMode, isCountingEnabled, updateVisitedPosts]);

  return {
    visitedPosts,
    totalPosts,
    isCountingEnabled,
    navigationMode,
    visitedPercentage,
    updateVisitedPosts,
    resetVisitedPosts,
    toggleCounting,
  };
};

export default usePostCounting;
