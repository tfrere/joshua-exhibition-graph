import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  activePostRef,
  initSocketSync,
  addEventListener,
  removeEventListener,
} from "../HomePage/components/Posts/hooks/useNearestPostDetection";
import { activeNodeRef } from "../HomePage/components/Node/hooks/useNodeProximitySync";
import TextScramble from "../../components/TextScramble";
import "../../components/TextScramble.css";
import ProfileDisplay from "./ProfileDisplay";
import SocketDebugger from "./SocketDebugger";
import usePostCounting from "./hooks/usePostCounting";

// Fonction utilitaire pour vérifier si un nœud est valide
function isValidNode(node) {
  return node && (node.name || node.label || node.id || node.type);
}

function PostPage() {
  // Utiliser le composant SocketDebugger pour le débogage
  // return <SocketDebugger />;

  const [postsData, setPostsData] = useState(null);
  const [databaseData, setDatabaseData] = useState(null);
  const [activeCharacterData, setActiveCharacterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePost, setActivePost] = useState(null);
  const [characterImageExists, setCharacterImageExists] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const loaderRef = useRef(null);
  const dataLoadedRef = useRef(false);
  const pendingPostChangeRef = useRef(null);
  const changeTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastActivePostRef = useRef(null);

  // Utiliser notre hook de comptage de posts
  const {
    visitedPosts,
    totalPosts,
    isCountingEnabled,
    navigationMode,
    visitedPercentage,
    updateVisitedPosts,
    resetVisitedPosts,
    toggleCounting,
  } = usePostCounting({ postsData });

  // Calculer les valeurs dérivées en dehors du useMemo
  const isValidActiveNode = isValidNode(activeNode);
  const isNodeCharacter = activeNode && activeNode.type === "character";
  // Vérifier si nous avons un post actif ou un dernier post à afficher
  const hasActiveContent =
    activePost || activeCharacterData || lastActivePostRef.current;

  // Logging des valeurs dérivées
  useEffect(() => {
    console.log("[PostPage Render] isValidActiveNode:", isValidActiveNode);
    console.log("[PostPage Render] isNodeCharacter:", isNodeCharacter);
    console.log("[PostPage Render] hasActiveContent:", hasActiveContent);
    console.log(
      "[PostPage Render] Properties in activeNode:",
      activeNode
        ? {
            id: activeNode.id,
            name: activeNode.name,
            label: activeNode.label,
            type: activeNode.type,
            description: activeNode.description,
            isJoshua: activeNode.isJoshua,
          }
        : "No activeNode"
    );
  }, [isValidActiveNode, isNodeCharacter, hasActiveContent, activeNode]);

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
            setActivePost(postsData[post.postUID]);

            // Add to visited posts if not already visited
            if (post.postUID !== undefined) {
              updateVisitedPosts(post.postUID);
            }
          } else {
            setActivePost(post);
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

    // Nettoyage des ressources à la destruction du composant
    return () => {
      cleanupResources();
    };
  }, [cleanupResources, updateVisitedPosts]);

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
      const response = await fetch(`/img/characters/${slug}.png`, {
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
    const handleActivePostChange = (data) => {
      // data contient déjà { post, previousPost }
      const post = data.post;

      // Si le post est null, réinitialiser les états mais garder activeNode si présent
      if (!post) {
        setActivePost(null);
        // Ne pas réinitialiser activeCharacterData si on a un nœud actif
        if (!activeNode) {
          setActiveCharacterData(null);
          setCharacterImageExists(false);
        }
        setIsLoading(false);
        return;
      }

      // Stocker le post actif dans la référence
      lastActivePostRef.current = post;

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
            setActivePost(fullPost);
            // Note: updateVisitedPosts est maintenant géré par notre hook usePostCounting
          } else {
            setActivePost(pendingPost);
          }
        } else {
          setActivePost(pendingPost);
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
    activeNode,
  ]);

  // Écouter les changements du nœud actif et vérifier régulièrement l'état de window.activeNodeRef
  useEffect(() => {
    // Fonction pour gérer le changement de nœud actif via l'événement
    const handleActiveNodeChanged = (event) => {
      console.log("[PostPage] Active node changed event received:", event);
      console.log("[PostPage] Event detail type:", typeof event.detail);
      console.log("[PostPage] Event detail:", event.detail);

      // Mettre à jour directement l'état avec les données de l'événement
      if (event.detail) {
        // S'assurer que le nœud a les propriétés nécessaires
        const node = event.detail;
        console.log("[PostPage] Processing node from event:", node);

        // Journal des propriétés pour le débogage
        console.log("[PostPage] Node properties from event:", {
          id: node.id,
          name: node.name,
          label: node.label,
          type: node.type,
          isJoshua: node.isJoshua,
          description: node.description,
        });

        // Utiliser la fonction utilitaire isValidNode
        if (isValidNode(node)) {
          console.log("[PostPage] Node is valid, setting as activeNode");
          // Faire une copie profonde de l'objet nœud
          const nodeClone = JSON.parse(JSON.stringify(node));
          setActiveNode(nodeClone);
        } else {
          console.log("[PostPage] Node is invalid, properties missing");
        }
      } else if (event.detail === null) {
        // Si le détail est explicitement null, désactiver le nœud
        console.log(
          "[PostPage] Explicitly null node received, clearing activeNode"
        );

        // Restaurer le dernier post actif si disponible AVANT de désactiver le nœud
        if (lastActivePostRef.current) {
          console.log(
            "[PostPage] Restoring last active post immediately from ref check:",
            lastActivePostRef.current
          );

          const pendingPost = lastActivePostRef.current;

          // Appliquer immédiatement sans setTimeout
          if (databaseData && pendingPost.slug) {
            const character = findCharacter(pendingPost.slug);
            if (character) {
              setActiveCharacterData(character);
              checkImageExists(pendingPost.slug);
            }
          }

          if (postsData && pendingPost.postUID !== undefined) {
            const fullPost = findCurrentPost(pendingPost.postUID);
            if (fullPost) {
              setActivePost(fullPost);
            } else {
              setActivePost(pendingPost);
            }
          } else {
            setActivePost(pendingPost);
          }

          // Désactiver le nœud seulement après avoir restauré le post
          setActiveNode(null);
        } else {
          // Si pas de dernier post actif, simplement désactiver le nœud
          setActiveNode(null);
        }
      }
    };

    // Fonction pour vérifier directement window.activeNodeRef
    const checkActiveNodeRef = () => {
      // Vérifier d'abord si la fenêtre et la référence existent
      if (typeof window === "undefined") return;

      // Vérifier si activeNodeRef existe et contient un nœud
      if (window.activeNodeRef && window.activeNodeRef.current) {
        const nodeRef = window.activeNodeRef.current;
        console.log("[PostPage] Found node in window.activeNodeRef:", nodeRef);

        // Journal des propriétés pour le débogage
        console.log("[PostPage] Node properties from ref:", {
          id: nodeRef.id,
          name: nodeRef.name,
          label: nodeRef.label,
          type: nodeRef.type,
          isJoshua: nodeRef.isJoshua,
          description: nodeRef.description,
        });

        // Utiliser la fonction utilitaire isValidNode
        if (isValidNode(nodeRef)) {
          // Vérifier si le nœud est différent de l'état actuel
          const noActiveNodeOrDifferentId =
            !activeNode || activeNode.id !== nodeRef.id;

          if (noActiveNodeOrDifferentId) {
            console.log(
              "[PostPage] Setting activeNode from window.activeNodeRef"
            );
            // Faire une copie profonde de l'objet nœud
            const nodeClone = JSON.parse(JSON.stringify(nodeRef));
            setActiveNode(nodeClone);
          }
        } else {
          console.log(
            "[PostPage] Node from activeNodeRef is invalid, properties missing"
          );
        }
      } else if (activeNode) {
        // Si window.activeNodeRef.current est null mais que activeNode n'est pas null
        console.log(
          "[PostPage] No node in window.activeNodeRef but activeNode exists. Clearing activeNode."
        );

        // Restaurer le dernier post actif si disponible AVANT de désactiver le nœud
        if (lastActivePostRef.current) {
          console.log(
            "[PostPage] Restoring last active post immediately from ref check:",
            lastActivePostRef.current
          );

          const pendingPost = lastActivePostRef.current;

          // Appliquer immédiatement sans setTimeout
          if (databaseData && pendingPost.slug) {
            const character = findCharacter(pendingPost.slug);
            if (character) {
              setActiveCharacterData(character);
              checkImageExists(pendingPost.slug);
            }
          }

          if (postsData && pendingPost.postUID !== undefined) {
            const fullPost = findCurrentPost(pendingPost.postUID);
            if (fullPost) {
              setActivePost(fullPost);
            } else {
              setActivePost(pendingPost);
            }
          } else {
            setActivePost(pendingPost);
          }

          // Désactiver le nœud seulement après avoir restauré le post
          setActiveNode(null);
        } else {
          // Si pas de dernier post actif, simplement désactiver le nœud
          setActiveNode(null);
        }
      } else {
        console.log(
          "[PostPage] No node in window.activeNodeRef and no activeNode exists."
        );
      }
    };

    // Vérifier immédiatement si un nœud est déjà actif
    console.log("[PostPage] Initial check for activeNodeRef");
    checkActiveNodeRef();

    // Ajouter l'écouteur d'événement pour les changements dynamiques
    console.log("[PostPage] Adding event listener for activeNodeChanged");
    window.addEventListener("activeNodeChanged", handleActiveNodeChanged);

    // Vérifier régulièrement l'état de window.activeNodeRef, mais moins fréquemment
    const intervalId = setInterval(() => {
      console.log("[PostPage] Interval check for activeNodeRef");
      checkActiveNodeRef();
    }, 2000); // Vérifier toutes les 2 secondes pour réduire la fréquence

    // Nettoyer les écouteurs et l'intervalle à la déconnexion
    return () => {
      console.log("[PostPage] Removing event listener and interval");
      window.removeEventListener("activeNodeChanged", handleActiveNodeChanged);
      clearInterval(intervalId);
    };
  }, [activeNode]); // Dépendance à activeNode pour comparer avec window.activeNodeRef.current

  // Nettoyage global lors du démontage du composant
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Mémoriser le contenu pour éviter des re-renders inutiles
  const pageContent = useMemo(() => {
    console.log("[PostPage Render] activeCharacterData:", activeCharacterData);
    console.log("[PostPage Render] activeNode:", activeNode);
    console.log("[PostPage Render] activePost:", activePost);
    console.log(
      "[PostPage Render] lastActivePostRef:",
      lastActivePostRef.current
    );

    // Calculer le post avec le plus d'impact pour l'élément actuel
    let mostImpactfulPost = null;
    if (isValidActiveNode && databaseData) {
      const isNodeCharacter = activeNode && activeNode.type === "character";

      if (isNodeCharacter && activeNode.id) {
        // Chercher la correspondance par slug (id du nœud)
        const matchedCharacter = databaseData.find(
          (char) => char.slug === activeNode.id
        );
        if (matchedCharacter && matchedCharacter.mostImpactPost) {
          mostImpactfulPost = matchedCharacter.mostImpactPost;
          console.log(
            "[PostPage] Found most impactful post for character:",
            mostImpactfulPost
          );
        }
      } else if (!isNodeCharacter) {
        // Pour les nœuds non-character, essayer de trouver un caractère associé dans la base de données
        console.log(
          "[PostPage] Looking for associated character for node:",
          activeNode.id
        );

        // Essayer de trouver un caractère associé au nœud
        const relatedCharacter = databaseData.find((char) => {
          // Chercher une correspondance par identifiant ou par nom
          return (
            (activeNode.id && char.slug === activeNode.id) ||
            (activeNode.name && char.displayName === activeNode.name) ||
            (activeNode.label && char.displayName === activeNode.label)
          );
        });

        if (relatedCharacter && relatedCharacter.mostImpactPost) {
          mostImpactfulPost = relatedCharacter.mostImpactPost;
          console.log(
            "[PostPage] Found related character:",
            relatedCharacter.slug
          );
          console.log(
            "[PostPage] Found most impactful post for node:",
            mostImpactfulPost
          );
        }
      }
    }

    // Afficher un message de chargement
    if (isLoading) {
      console.log("[PostPage Render] Showing loading state");
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

    // Vérifier si nous avons un nœud actif valide
    if (isValidActiveNode) {
      console.log("[PostPage Render] We have a valid active node:", activeNode);
    }

    // Afficher un message s'il n'y a pas de personnage actif ET pas de nœud actif valide ET pas de dernier post actif
    if (!hasActiveContent && !isLoading) {
      console.log("[PostPage Render] Showing no active element message");
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
          <h2>Aucun élément actif</h2>
          <p>
            Veuillez sélectionner un personnage ou un nœud dans la vue
            principale pour afficher ses informations.
          </p>
        </div>
      );
    }

    console.log(
      "[PostPage Render] Showing ProfileDisplay with activeNode:",
      activeNode
    );

    // Utiliser le composant ProfileDisplay pour afficher les informations
    return (
      <ProfileDisplay
        activeCharacterData={activeCharacterData}
        activePost={activePost}
        characterImageExists={characterImageExists}
        visitedPosts={visitedPosts}
        totalPosts={totalPosts}
        navigationMode={navigationMode}
        isCountingEnabled={isCountingEnabled}
        activeNode={activeNode}
        databaseData={databaseData}
        mostImpactfulPost={mostImpactfulPost}
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
    activeNode,
    databaseData,
    lastActivePostRef.current,
    isValidActiveNode,
  ]);

  return pageContent;
}

export default PostPage;
