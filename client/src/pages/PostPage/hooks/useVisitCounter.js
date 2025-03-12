import { useState, useCallback, useEffect } from "react";

/**
 * Hook personnalisé pour gérer le comptage des visites de posts
 * @param {string} navigationMode - Le mode de navigation actuel
 * @param {object} socket - La connexion socket.io
 * @returns {Object} - Les états et fonctions relatifs au comptage des visites
 */
export const useVisitCounter = (navigationMode, socket) => {
  const [visitedPosts, setVisitedPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isCountingEnabled, setIsCountingEnabled] = useState(false);

  // Initialisation des variables globales
  useEffect(() => {
    // Au démarrage, on ne compte pas les posts
    console.log("Réinitialisation du compteur à l'initialisation");
    setVisitedPosts([]);
    setIsCountingEnabled(false);
    window.__countingEnabled = false;

    // Créer un écouteur global pour forcer le comptage depuis n'importe où dans l'application
    window.__enableCountingGlobally = () => {
      console.log("🌍 ACTIVATION GLOBALE DU COMPTAGE demandée");
      window.__countingEnabled = true;
      setIsCountingEnabled(true);
      return true;
    };

    // Pour déboguer: activer automatiquement le comptage après 5 secondes
    console.log(
      "Configuration du timer pour l'activation automatique du comptage"
    );
    setTimeout(() => {
      console.log("⏱️ Activation automatique du comptage après délai");
      setIsCountingEnabled(true);
      // Essayons aussi d'émettre un événement startCounting pour voir si ça fonctionne
      try {
        if (window.socket && typeof window.socket.emit === "function") {
          window.socket.emit("startCounting", {
            timestamp: Date.now(),
            source: "auto_timer",
          });
          console.log("✅ Événement startCounting émis depuis le timer");
        } else {
          console.warn(
            "⚠️ Impossible d'émettre l'événement startCounting: socket non initialisé"
          );
        }
      } catch (error) {
        console.error(
          "❌ Erreur lors de l'émission de l'événement startCounting:",
          error
        );
      }
    }, 5000);

    if (socket) {
      // Écouter le signal de réinitialisation via socket
      socket.on("resetView", () => {
        console.log("RESET SIGNAL REÇU! Remise à zéro du compteur de visites");
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
      socket.on("startCounting", (data) => {
        console.log("🔴 Signal START COUNTING reçu via SOCKET!", data);
        setIsCountingEnabled(true);
        console.log("État du comptage après activation:", true);
      });

      // Ajouter un événement pour forcer le passage en mode normal (pour le débogage)
      socket.on("forceNormalMode", (data) => {
        console.log("🔧 Signal FORCE NORMAL MODE reçu!", data);
        // Forcer l'activation du comptage
        setIsCountingEnabled(true);
        console.log("Mode forcé à 'normal', comptage activé");
      });
    }

    // Écouter également l'événement DOM comme mécanisme de secours
    const handleResetEvent = (event) => {
      console.log(
        "Événement DOM resetVisitedPosts reçu dans PostPage",
        event.detail
      );
      setVisitedPosts([]);
      // Forcer la vérification du mode de navigation
      if (typeof window.__checkNavigationMode === "function") {
        window.__checkNavigationMode();
      }
      // Désactiver le comptage
      setIsCountingEnabled(false);
    };

    // Écouter l'événement DOM pour démarrer le comptage
    const handleStartCountingEvent = (event) => {
      console.log("🔴 Événement DOM startCounting reçu dans PostPage", event);
      console.log("État du comptage avant activation:", isCountingEnabled);
      setIsCountingEnabled(true);
      console.log("État du comptage après activation:", true);
    };

    // Ajouter les écouteurs d'événements DOM
    window.addEventListener("resetVisitedPosts", handleResetEvent);
    window.addEventListener("startCounting", handleStartCountingEvent);

    // Nettoyage à la destruction du composant
    return () => {
      // Supprimer les écouteurs d'événements
      window.removeEventListener("resetVisitedPosts", handleResetEvent);
      window.removeEventListener("startCounting", handleStartCountingEvent);

      if (socket) {
        socket.off("resetView");
        socket.off("startCounting");
        socket.off("forceNormalMode");
      }
    };
  }, [socket]);

  // Écouter spécifiquement les changements de mode de navigation pour activer le comptage
  useEffect(() => {
    console.log("⚡️ Mode de navigation a changé:", navigationMode);

    // Si on vient de passer du mode orbit au mode normal, forcer l'activation du comptage
    if (navigationMode === "normal") {
      const isReallyNotOrbiting = window.__orbitModeActive !== true;

      if (isReallyNotOrbiting) {
        console.log(
          "🚨 ACTIVATION FORCÉE DU COMPTAGE après transition vers mode normal"
        );
        // Forcer la mise à jour de l'état de comptage
        setIsCountingEnabled(true);

        // Forcer également une mise à jour globale
        window.__countingEnabled = true;

        // Petite vérification après un court délai pour s'assurer que l'état a été mis à jour
        setTimeout(() => {
          if (!isCountingEnabled) {
            console.log(
              "🔄 L'état isCountingEnabled n'a pas été mis à jour, deuxième tentative"
            );
            setIsCountingEnabled(true);

            // Si après un autre délai ce n'est toujours pas activé, faire un dernier essai
            setTimeout(() => {
              if (!isCountingEnabled) {
                console.log("⚠️ Dernière tentative d'activation du comptage");
                // Forcer directement avec une fonction d'état
                setIsCountingEnabled((state) => true);
              }
            }, 500);
          }
        }, 200);
      }
    }
  }, [navigationMode, isCountingEnabled]);

  // Function to update visited posts
  const updateVisitedPosts = useCallback(
    (postUID) => {
      if (postUID === undefined) {
        console.log(
          "❌ updateVisitedPosts: postUID est undefined, pas de comptage"
        );
        return;
      }

      console.log(`🔍 updateVisitedPosts appelé pour postUID=${postUID}`);
      console.log(
        `🔍 Mode actuel: ${navigationMode}, Comptage activé: ${isCountingEnabled}`
      );

      // Obtenir l'état actuel directement depuis les variables globales pour plus de fiabilité
      const isOrbiting = window.__orbitModeActive === true;
      const isTransitioning = window.__cameraAnimating === true;
      const currentMode = isOrbiting
        ? "orbit"
        : isTransitioning
        ? "transitioning"
        : "normal";

      // Vérifier aussi la variable globale de comptage
      const globalCountingEnabled = window.__countingEnabled === true;

      console.log(
        `🔍 Vérification en temps réel: Mode=${currentMode}, isOrbiting=${isOrbiting}, globalCountingEnabled=${globalCountingEnabled}`
      );

      // Ne compter les posts visités que si nous sommes en mode normal ET que le comptage est activé
      // Vérifier aussi l'état global en temps réel pour s'assurer qu'on n'est pas en orbite
      if (
        currentMode === "normal" &&
        (isCountingEnabled || globalCountingEnabled) &&
        !isOrbiting
      ) {
        console.log("✅ Conditions remplies pour comptabiliser le post");

        // Si c'est la variable globale qui a activé le comptage, synchroniser l'état local
        if (!isCountingEnabled && globalCountingEnabled) {
          console.log(
            "📢 Synchronisation de l'état local isCountingEnabled avec la variable globale"
          );
          setIsCountingEnabled(true);
        }

        setVisitedPosts((prevVisited) => {
          if (!prevVisited.includes(postUID)) {
            console.log(
              `📊 Ajout du post ${postUID} aux posts visités (total: ${
                prevVisited.length + 1
              })`
            );
            return [...prevVisited, postUID];
          }
          console.log(
            `📊 Post ${postUID} déjà visité (total: ${prevVisited.length})`
          );
          return prevVisited;
        });
      } else {
        console.log(`❌ Conditions non remplies pour comptabiliser le post:`);
        console.log(`   - Mode navigatonMode = ${navigationMode}`);
        console.log(`   - Mode temps réel = ${currentMode}`);
        console.log(`   - Comptage activé (état) = ${isCountingEnabled}`);
        console.log(`   - Comptage activé (global) = ${globalCountingEnabled}`);
        console.log(`   - isOrbiting = ${isOrbiting}`);
      }
    },
    [navigationMode, isCountingEnabled]
  );

  // Fonction pour réinitialiser le compteur
  const resetVisitedPosts = useCallback(() => {
    console.log("Réinitialisation du compteur de visites");
    setVisitedPosts([]);
  }, []);

  // Fonction pour mettre à jour le nombre total de posts
  const setTotalPostsCount = useCallback((count) => {
    setTotalPosts(count);
  }, []);

  // Fonction d'urgence pour forcer le démarrage du comptage
  const forceStartCountingNow = useCallback(() => {
    console.log("🚨 URGENCE: Forçage manuel du comptage et du mode normal");

    // Forcer l'activation du comptage
    setIsCountingEnabled(true);

    // Forcer la mise à jour des variables globales
    window.__countingEnabled = true;

    // Tenter plusieurs fois pour s'assurer que ça fonctionne
    setTimeout(() => {
      window.__countingEnabled = true;
      setIsCountingEnabled(true);
    }, 100);

    // Envoyer un signal socket pour informer les autres clients
    if (socket && typeof socket.emit === "function") {
      try {
        socket.emit("forceNormalMode", {
          timestamp: Date.now(),
          source: "manual_console_emergency",
        });
        console.log("✅ Signal forceNormalMode envoyé aux autres clients");
      } catch (error) {
        console.error("❌ Erreur lors de l'envoi du signal:", error);
      }
    }

    console.log("✅ Forçage terminé, vérifiez le comptage maintenant");
    return true;
  }, [socket]);

  // Exposer des fonctions pour tests manuels depuis la console
  useEffect(() => {
    window.__startCountingManual = () => {
      console.log("🔴 Démarrage manuel du comptage depuis PostPage");
      setIsCountingEnabled(true);
      console.log("✅ Comptage activé, état: true");
    };

    window.__forceStartCountingNow = forceStartCountingNow;
    window.__resetVisitedPosts = resetVisitedPosts;

    return () => {
      // Nettoyer les fonctions globales
      window.__startCountingManual = undefined;
      window.__forceStartCountingNow = undefined;
      window.__resetVisitedPosts = undefined;
    };
  }, [forceStartCountingNow, resetVisitedPosts]);

  // Calculer le pourcentage de posts visités
  const visitedPercentage =
    totalPosts > 0 ? ((visitedPosts.length / totalPosts) * 100).toFixed(2) : 0;

  // Retourner toutes les valeurs et fonctions pertinentes
  return {
    visitedPosts,
    totalPosts,
    isCountingEnabled,
    visitedPercentage,
    setIsCountingEnabled,
    updateVisitedPosts,
    resetVisitedPosts,
    setTotalPostsCount,
    forceStartCountingNow,
  };
};
