import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  activePostRef,
  initSocketSync,
  addEventListener,
  removeEventListener,
} from "../HomePage/components/Posts/hooks/useNearestPostDetection";
import TextScramble from "../../components/TextScramble";
import "../../components/TextScramble.css";
import ProfileDisplay from "./ProfileDisplay";

function PostPage() {
  const [postsData, setPostsData] = useState(null);
  const [databaseData, setDatabaseData] = useState(null);
  const [activeCharacterData, setActiveCharacterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePost, setactivePost] = useState(null);
  const [characterImageExists, setCharacterImageExists] = useState(false);
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
  const loaderRef = useRef(null);
  const dataLoadedRef = useRef(false);
  const pendingPostChangeRef = useRef(null);
  const changeTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Fonction pour nettoyer toutes les ressources en cours
  const cleanupResources = useCallback(() => {
    // Nettoyer les timeouts
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
      changeTimeoutRef.current = null;
    }

    // Annuler les fetch en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Charger toutes les données au montage du composant
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);

        // Charger les deux fichiers en parallèle
        const [postsResponse, databaseResponse] = await Promise.all([
          fetch("/data/posts.data.json"),
          fetch("/data/database.data.json"),
        ]);

        if (!postsResponse.ok) {
          throw new Error(
            `Erreur lors du chargement des posts: ${postsResponse.status}`
          );
        }

        if (!databaseResponse.ok) {
          throw new Error(
            `Erreur lors du chargement de la base de données: ${databaseResponse.status}`
          );
        }

        const postsData = await postsResponse.json();
        const databaseData = await databaseResponse.json();

        setPostsData(postsData);
        setDatabaseData(databaseData);
        setTotalPosts(postsData.length);
        dataLoadedRef.current = true;

        // Si un post est déjà actif, charger ses données immédiatement
        if (activePostRef.current) {
          const post = activePostRef.current;
          const character = databaseData.find(
            (char) => char.slug === post.slug
          );

          if (character) {
            setActiveCharacterData(character);
          }

          if (post.postUID !== undefined && postsData[post.postUID]) {
            setactivePost(postsData[post.postUID]);

            // Add to visited posts if not already visited
            if (post.postUID !== undefined) {
              updateVisitedPosts(post.postUID);
            }
          } else {
            setactivePost(post);
          }
        }

        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };

    loadAllData();

    // Initialiser la connexion socket
    const socket = initSocketSync();

    // Exposer le socket globalement pour que d'autres composants puissent l'utiliser
    window.socket = socket;

    // Pour déboguer: activer automatiquement le comptage après 5 secondes
    setTimeout(() => {
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

    // Au démarrage, on ne compte pas les posts
    setVisitedPosts([]);
    setIsCountingEnabled(false);

    // Écouter le signal de réinitialisation via socket
    if (socket) {
      socket.on("connect", () => {
        // Socket connecté
      });

      socket.on("resetView", () => {
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

    window.__testSocketEmit = () => {
      if (socket && typeof socket.emit === "function") {
        try {
          socket.emit("test", { timestamp: Date.now() });
          return true;
        } catch (error) {
          return false;
        }
      } else {
        return false;
      }
    };

    // Nettoyage des ressources à la destruction du composant
    return () => {
      cleanupResources();
      // Supprimer l'écouteur d'événement resetView
      if (socket) {
        socket.off("resetView");
      }
      // Supprimer l'écouteur d'événement DOM
      window.removeEventListener("resetVisitedPosts", handleResetEvent);
      window.removeEventListener("startCounting", handleStartCountingEvent);
    };
  }, [cleanupResources]);

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

  // Fonction mémorisée pour trouver un personnage par son slug
  const findCharacter = useCallback(
    (slug) => {
      if (!databaseData || !slug) return null;
      return databaseData.find((char) => char.slug === slug);
    },
    [databaseData]
  );

  // Fonction mémorisée pour trouver un post par son UID
  const findCurrentPost = useCallback(
    (postUID) => {
      if (
        !postsData ||
        postUID === undefined ||
        postUID < 0 ||
        postUID >= postsData.length
      )
        return null;
      return postsData[postUID];
    },
    [postsData]
  );

  // Vérifier si l'image du personnage existe avec gestion de l'annulation
  const checkImageExists = useCallback(async (slug) => {
    // Annuler toute requête fetch précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Créer un nouveau AbortController pour cette requête
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/public/img/characters/${slug}.png`, {
        signal: abortControllerRef.current.signal,
      });
      // Il faut vérifier si le contenu de la réponse est une image PNG valide
      // Un statut 200 n'est pas suffisant car le serveur peut renvoyer une page 404 personnalisée avec un statut 200
      const contentType = response.headers.get("content-type");
      const isPng = contentType && contentType.includes("png");
      setCharacterImageExists(isPng);
    } catch (error) {
      // Ne pas afficher d'erreur si la requête a été annulée intentionnellement
      if (error.name !== "AbortError") {
        setCharacterImageExists(false);
      }
      setCharacterImageExists(false);
    }
  }, []);

  // Écouter les changements du post actif
  useEffect(() => {
    const handleActivePostChange = (post) => {
      if (!post) return;

      // Si nous sommes en mode orbit, ignorer les mises à jour de posts
      if (navigationMode === "orbit") {
        return;
      }

      pendingPostChangeRef.current = post;

      // Nettoyer le timeout précédent s'il existe
      cleanupResources();

      changeTimeoutRef.current = setTimeout(() => {
        const pendingPost = pendingPostChangeRef.current;

        if (!dataLoadedRef.current) {
          setIsLoading(true);
        }

        if (databaseData && pendingPost.slug) {
          const character = findCharacter(pendingPost.slug);
          if (character) {
            setActiveCharacterData(character);
            // Vérifier si l'image du personnage existe
            checkImageExists(pendingPost.slug);
          } else {
            setActiveCharacterData(null);
            setCharacterImageExists(false);
          }
        }

        if (postsData && pendingPost.postUID !== undefined) {
          const fullPost = findCurrentPost(pendingPost.postUID);
          if (fullPost) {
            setactivePost(fullPost);
            // Add to visited posts
            updateVisitedPosts(pendingPost.postUID);
          } else {
            setactivePost(pendingPost);
          }
        } else {
          setactivePost(pendingPost);
        }

        setIsLoading(false);

        changeTimeoutRef.current = null;
      }, 0);
    };

    addEventListener("activePostChanged", handleActivePostChange);

    if (activePostRef.current && dataLoadedRef.current) {
      handleActivePostChange(activePostRef.current);
    } else if (!activePostRef.current) {
      setIsLoading(false);
    }

    return () => {
      removeEventListener("activePostChanged", handleActivePostChange);
      cleanupResources();
    };
  }, [
    postsData,
    databaseData,
    findCharacter,
    findCurrentPost,
    checkImageExists,
    cleanupResources,
    updateVisitedPosts,
    navigationMode,
  ]);

  // Nettoyage global lors du démontage du composant
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Mémoriser le contenu pour éviter des re-renders inutiles
  const pageContent = useMemo(() => {
    // Afficher un message de chargement
    if (isLoading) {
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
    }

    // Afficher un message s'il n'y a pas de personnage actif
    if (!activeCharacterData) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            background: "#000000",
            color: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2>Aucun personnage actif</h2>
          <p>
            Veuillez sélectionner un personnage dans la vue principale pour
            afficher ses informations.
          </p>
        </div>
      );
    }

    // Calculate visited percentage
    const visitedPercentage =
      totalPosts > 0
        ? ((visitedPosts.length / totalPosts) * 100).toFixed(2)
        : 0;

    // Utiliser le composant ProfileDisplay pour afficher les informations du personnage
    return (
      <ProfileDisplay
        activeCharacterData={activeCharacterData}
        activePost={activePost}
        characterImageExists={characterImageExists}
        visitedPosts={visitedPosts}
        totalPosts={totalPosts}
        navigationMode={navigationMode}
        isCountingEnabled={isCountingEnabled}
      />
    );
  }, [
    isLoading,
    activeCharacterData,
    activePost,
    characterImageExists,
    visitedPosts,
    totalPosts,
    navigationMode,
    isCountingEnabled,
  ]);

  return pageContent;
}

export default PostPage;
