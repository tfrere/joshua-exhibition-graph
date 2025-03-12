import { useState, useEffect, useRef, useCallback } from "react";
import {
  activePostRef,
  addEventListener,
  removeEventListener,
} from "../../HomePage/components/Posts/hooks/useNearestPostDetection";

/**
 * Hook personnalisé pour gérer le chargement et la gestion des données des posts
 * @param {string} navigationMode - Le mode de navigation actuel
 * @param {function} updateVisitedPosts - Fonction pour mettre à jour les posts visités
 * @param {function} setTotalPostsCount - Fonction pour mettre à jour le nombre total de posts
 * @returns {Object} - Les données et fonctions pour gérer les posts
 */
export const usePostData = (
  navigationMode,
  updateVisitedPosts,
  setTotalPostsCount
) => {
  const [postsData, setPostsData] = useState(null);
  const [databaseData, setDatabaseData] = useState(null);
  const [activeCharacterData, setActiveCharacterData] = useState(null);
  const [activePost, setActivePost] = useState(null);
  const [characterImageExists, setCharacterImageExists] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        console.error("Erreur lors de la vérification de l'image:", error);
      }
      setCharacterImageExists(false);
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

        console.log("Posts chargés:", postsData.length);
        console.log(
          "Données de la base chargées:",
          databaseData.length,
          "personnages"
        );

        setPostsData(postsData);
        setDatabaseData(databaseData);
        setTotalPostsCount(postsData.length);
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
        console.error("Erreur lors du chargement des données:", error);
        setIsLoading(false);
      }
    };

    loadAllData();

    return () => {
      cleanupResources();
    };
  }, [cleanupResources, setTotalPostsCount, updateVisitedPosts]);

  // Écouter les changements du post actif
  useEffect(() => {
    const handleActivePostChange = (post) => {
      if (!post) return;

      // Si nous sommes en mode orbit, ignorer les mises à jour de posts
      if (navigationMode === "orbit") {
        console.log("Mode orbit actif, ignorer la mise à jour du post:", post);
        return;
      }

      console.log("Mise à jour du post actif reçue:", post);

      pendingPostChangeRef.current = post;

      // Nettoyer le timeout précédent s'il existe
      cleanupResources();

      console.log("Attente de 2 secondes avant de changer de post...");
      changeTimeoutRef.current = setTimeout(() => {
        const pendingPost = pendingPostChangeRef.current;
        console.log("Appliquant le changement vers le post:", pendingPost);

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
            console.warn(
              "Personnage actif non trouvé dans la base de données:",
              pendingPost.slug
            );
            setActiveCharacterData(null);
            setCharacterImageExists(false);
          }
        }

        if (postsData && pendingPost.postUID !== undefined) {
          const fullPost = findCurrentPost(pendingPost.postUID);
          if (fullPost) {
            setActivePost(fullPost);
            // Add to visited posts
            updateVisitedPosts(pendingPost.postUID);
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
  ]);

  // Nettoyage global lors du démontage du composant
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    postsData,
    databaseData,
    activeCharacterData,
    activePost,
    characterImageExists,
    isLoading,
  };
};
