import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  activePostRef,
  initSocketSync,
  addEventListener,
  removeEventListener,
} from "../HomePage/components/Posts/hooks/useNearestPostDetection";
import TextScramble from "../../components/TextScramble";
import "../../components/TextScramble.css";

function PostPage() {
  const [postsData, setPostsData] = useState(null);
  const [databaseData, setDatabaseData] = useState(null);
  const [activeCharacterData, setActiveCharacterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePost, setactivePost] = useState(null);
  const [characterImageExists, setCharacterImageExists] = useState(false);
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

        console.log("Posts chargés:", postsData.length);
        console.log(
          "Données de la base chargées:",
          databaseData.length,
          "personnages"
        );

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
            setactivePost(postsData[post.postUID]);
          } else {
            setactivePost(post);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        setIsLoading(false);
      }
    };

    loadAllData();

    // Initialiser la connexion socket
    initSocketSync();

    // Nettoyage des ressources à la destruction du composant
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

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

  // Écouter les changements du post actif
  useEffect(() => {
    const handleActivePostChange = (post) => {
      if (!post) return;
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
            setactivePost(fullPost);
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

    // Afficher les informations du personnage
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
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "500px",
            background: "#000000",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "2rem 1.5rem",
          }}
        >
          {/* Photo de profil */}
          {characterImageExists ? (
            <img
              src={`/public/img/characters/${activeCharacterData.slug}.png`}
              alt={activeCharacterData.displayName || activeCharacterData.slug}
              style={{
                width: "320px",
                height: "320px",
                borderRadius: "0px",
                marginBottom: "1.25rem",
                border: "4px solid #222",
                objectFit: "cover",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              style={{
                width: "320px",
                height: "320px",
                borderRadius: "0px",
                background: "#000000",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: "1.25rem",
                color: "#ffffff",
                fontSize: "6rem",
                fontWeight: "bold",
                border: "4px solid #222",
                boxSizing: "border-box",
              }}
            >
              {(
                activeCharacterData.displayName ||
                activeCharacterData.slug ||
                "?"
              )
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          {/* Nom du personnage et badge Joshua */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                margin: "0 0 0.5rem 0",
                color: activeCharacterData.isJoshua ? "#ffffff" : "#cccccc",
                fontSize: "1.75rem",
              }}
            >
              <TextScramble
                text={
                  activeCharacterData.displayName || activeCharacterData.slug
                }
              />
            </h2>
          </div>

          {/* Biographie */}
          <div
            style={{
              width: "100%",
              textAlign: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                color: "#999",
                margin: "0 0 0.75rem 0",
                fontWeight: "normal",
              }}
            >
              Biographie
            </h3>
            <p
              style={{
                margin: 0,
                lineHeight: "1.5",
                fontSize: "0.95rem",
                color: "#eee",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              <TextScramble
                text={
                  activeCharacterData.biography ||
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam condimentum felis et est finibus, quis varius magna ullamcorper. Donec sit amet eros ac enim faucibus laoreet. Proin eget diam vestibulum, vehicula purus vel, fermentum purus."
                }
              />
            </p>
          </div>

          {/* Post avec le plus d'impact */}
          <div
            style={{
              width: "100%",
              marginBottom: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                color: "#999",
                margin: "0 0 0.75rem 0",
                textAlign: "center",
                fontWeight: "normal",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              Post sélectionné
            </h3>

            <div
              style={{
                //background: "#1a1a1a",
                padding: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid #555",
                height: "auto",
                minHeight: "180px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  flex: "1 1 auto",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    lineHeight: "1.5",
                    fontSize: "0.95rem",
                    color: "#eee",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textAlign: "center",
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  <TextScramble
                    text={
                      activePost && (activePost.content || activePost.title)
                        ? activePost.content || activePost.title
                        : "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas egestas, enim in viverra aliquam, eros tellus rhoncus tellus, et dapibus magna nisi sit amet erat. Ut lacus turpis, varius eu urna vitae, feugiat semper urna."
                    }
                  />
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  justifyItems: "center",
                  fontSize: "0.8rem",
                  color: "#fff",
                  marginTop: "1rem",
                  borderTop: "1px solid #333",
                  paddingTop: "0.75rem",
                  height: "30px",
                }}
              >
                <div style={{ display: "flex", gap: ".3rem" }}>
                  <span style={{ opacity: 0.5 }}> Posté le</span>
                  {activePost && activePost.creationDate ? (
                    <span>
                      {new Date(
                        activePost.creationDate * 1000
                      ).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>01/01/2023</span>
                  )}
                </div>

                {/* Plateforme alignée à droite */}
                <div>
                  {activePost && activePost.source ? (
                    <span
                      style={{
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.25rem",
                      }}
                    >
                      {activePost.source}
                    </span>
                  ) : (
                    <span>Source inconnue</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [isLoading, activeCharacterData, activePost, characterImageExists]);

  return pageContent;
}

export default PostPage;
