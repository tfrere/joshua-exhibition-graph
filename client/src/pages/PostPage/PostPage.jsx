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
  const loaderRef = useRef(null);
  const dataLoadedRef = useRef(false);

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

  // Écouter les changements du post actif
  useEffect(() => {
    const handleActivePostChange = (post) => {
      if (!post) return;
      console.log("Mise à jour du post actif:", post);

      // Ne pas montrer le loading si on a déjà les données
      if (!dataLoadedRef.current) {
        setIsLoading(true);
      }

      // Trouver le personnage dans les données déjà chargées
      if (databaseData && post.slug) {
        const character = findCharacter(post.slug);
        if (character) {
          setActiveCharacterData(character);
        } else {
          console.warn(
            "Personnage actif non trouvé dans la base de données:",
            post.slug
          );
          setActiveCharacterData(null);
        }
      }

      // Trouver le post dans les données déjà chargées
      if (postsData && post.postUID !== undefined) {
        const fullPost = findCurrentPost(post.postUID);
        if (fullPost) {
          setactivePost(fullPost);
        } else {
          setactivePost(post);
        }
      } else {
        setactivePost(post);
      }

      setIsLoading(false);
    };

    // Ajouter l'écouteur d'événement
    addEventListener("activePostChanged", handleActivePostChange);

    // Vérifier si un post est déjà actif
    if (activePostRef.current && dataLoadedRef.current) {
      handleActivePostChange(activePostRef.current);
    } else if (!activePostRef.current) {
      setIsLoading(false);
    }

    // Nettoyer l'écouteur d'événement lors du démontage
    return () => {
      removeEventListener("activePostChanged", handleActivePostChange);
    };
  }, [postsData, databaseData, findCharacter, findCurrentPost]);

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
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "60px",
              background: activeCharacterData.isJoshua ? "#ffffff" : "#888888",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "1.25rem",
              color: "#000",
              fontSize: "3rem",
              fontWeight: "bold",
              border: "4px solid #222",
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
                  fontSize: "0.8rem",
                  color: "#fff",
                  marginTop: "1rem",
                  borderTop: "1px solid #333",
                  paddingTop: "0.75rem",
                  height: "30px",
                }}
              >
                <div style={{ display: "flex", gap: "1rem" }}>
                  Posté le
                  {activePost && activePost.creationDate ? (
                    <span>
                      {new Date(
                        activePost.creationDate * 1000
                      ).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>01/01/2023</span>
                  )}
                  sur
                  {activePost && activePost.source ? (
                    <span>
                      {/* <TextScramble text={activePost.source} /> */}
                      {activePost.source}
                    </span>
                  ) : (
                    <span>Source inconnue</span>
                  )}
                </div>
                {activePost && (
                  <span
                    style={{
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      //backgroundColor: "rgba(255, 255, 255, 0.1)",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <TextScramble
                      text={`Viralité: ${activePost.impact || 1}`}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [isLoading, activeCharacterData, activePost]);

  return pageContent;
}

export default PostPage;
