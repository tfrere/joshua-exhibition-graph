import { useRef, useState, useEffect } from "react";
import { useData } from "../../contexts/DataContext";
import {
  activeNodeRef,
  initSocketSync,
  addEventListener,
  removeEventListener,
} from "../HomePage/components/activeNodeRef";

function PostPage() {
  const { graphData, isLoadingGraph, graphError, postsData } = useData();
  const [activeCharacterData, setActiveCharacterData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [highImpactPost, setHighImpactPost] = useState(null);
  const loaderRef = useRef(null);

  // Initialiser la connexion socket
  useEffect(() => {
    initSocketSync();
  }, []);

  // Fonction pour charger les données du personnage actif
  const fetchCharacterData = async (activeNode) => {
    if (!activeNode || !activeNode.slug) {
      setActiveCharacterData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Si les données du graphe sont déjà chargées via le contexte, les utiliser
      if (graphData && graphData.nodes && graphData.nodes.length > 0) {
        const characterNode = graphData.nodes.find(
          (node) => node.slug === activeNode.slug
        );
        if (characterNode) {
          console.log("Personnage actif trouvé:", characterNode);
          setActiveCharacterData(characterNode);
        } else {
          console.warn(
            "Personnage actif non trouvé dans les données du graphe:",
            activeNode.slug
          );

          // Essayer de charger depuis database.data.json comme fallback
          await loadFromDatabase(activeNode);
        }
      } else {
        // Sinon, charger les données de database.data.json directement
        await loadFromDatabase(activeNode);
      }
    } catch (error) {
      console.error(
        "Erreur lors du chargement des données du personnage:",
        error
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour charger les données depuis database.data.json
  const loadFromDatabase = async (activeNode) => {
    const response = await fetch("/data/database.data.json");
    if (!response.ok) {
      throw new Error(
        `Erreur lors du chargement des données: ${response.status}`
      );
    }

    const databaseData = await response.json();
    console.log(
      "Données de la base chargées:",
      databaseData.length,
      "personnages"
    );

    if (activeNode && activeNode.slug) {
      const characterData = databaseData.find(
        (char) => char.slug === activeNode.slug
      );
      if (characterData) {
        console.log(
          "Personnage actif trouvé dans database.data.json:",
          characterData
        );
        setActiveCharacterData(characterData);
      } else {
        console.warn(
          "Personnage actif non trouvé dans la base de données:",
          activeNode.slug
        );
        setActiveCharacterData(null);
      }
    } else {
      console.log("Aucun personnage actif actuellement");
      setActiveCharacterData(null);
    }
  };

  // Écouter les changements de nœud actif et charger les données
  useEffect(() => {
    // Charger les données initiales
    fetchCharacterData(activeNodeRef.current);

    // Fonction de rappel pour les mises à jour du nœud actif
    const handleActiveNodeChange = (node) => {
      console.log("Événement de changement de nœud actif reçu:", node);
      fetchCharacterData(node);
    };

    // Ajouter l'écouteur d'événement
    addEventListener("activeNodeChanged", handleActiveNodeChange);

    // Nettoyer l'écouteur d'événement lors du démontage
    return () => {
      removeEventListener("activeNodeChanged", handleActiveNodeChange);
    };
  }, [graphData]);

  // Trouver le post avec le plus d'impact lorsque le personnage actif change
  useEffect(() => {
    if (
      activeCharacterData &&
      activeCharacterData.slug &&
      postsData &&
      postsData.length > 0
    ) {
      // Filtrer les posts qui appartiennent au personnage actif
      const characterPosts = postsData.filter(
        (post) => post.slug === activeCharacterData.slug
      );

      if (characterPosts.length > 0) {
        console.log(
          `${characterPosts.length} posts trouvés pour ${
            activeCharacterData.displayName || activeCharacterData.slug
          }`
        );

        // Trouver le post avec le plus d'impact
        const highestImpactPost = characterPosts.reduce((highest, current) => {
          const currentImpact = current.impact || 0;
          const highestImpact = highest.impact || 0;
          return currentImpact > highestImpact ? current : highest;
        }, characterPosts[0]);

        console.log("Post avec le plus d'impact:", highestImpactPost);
        setHighImpactPost(highestImpactPost);
      } else {
        console.log("Aucun post trouvé pour ce personnage");
        setHighImpactPost(null);
      }
    } else {
      setHighImpactPost(null);
    }
  }, [activeCharacterData, postsData]);

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
          background: "#111111",
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
            background: activeCharacterData.isJoshua ? "#ff6b6b" : "#0088ff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "1.25rem",
            color: "#fff",
            fontSize: "3rem",
            fontWeight: "bold",
            border: "4px solid #222",
          }}
        >
          {(activeCharacterData.displayName || activeCharacterData.slug || "?")
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
              color: activeCharacterData.isJoshua ? "#ff6b6b" : "#0088ff",
              fontSize: "1.75rem",
            }}
          >
            {activeCharacterData.displayName || activeCharacterData.slug}
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
            {activeCharacterData.biography ||
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam condimentum felis et est finibus, quis varius magna ullamcorper. Donec sit amet eros ac enim faucibus laoreet. Proin eget diam vestibulum, vehicula purus vel, fermentum purus."}
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
            Post le plus impactant
            {highImpactPost && highImpactPost.impact && (
              <span
                style={{
                  fontSize: "0.8rem",
                  background: "#ff6b6b",
                  color: "#000",
                  padding: "0.1rem 0.5rem",
                  borderRadius: "1rem",
                  fontWeight: "bold",
                }}
              >
                {highImpactPost.impact}
              </span>
            )}
          </h3>

          <div
            style={{
              background: "#1a1a1a",
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid #333",
              height: "180px",
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
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {highImpactPost &&
                (highImpactPost.content || highImpactPost.title)
                  ? highImpactPost.content || highImpactPost.title
                  : "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas egestas, enim in viverra aliquam, eros tellus rhoncus tellus, et dapibus magna nisi sit amet erat. Ut lacus turpis, varius eu urna vitae, feugiat semper urna."}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.8rem",
                color: "#888",
                marginTop: "1rem",
                flexShrink: 0,
              }}
            >
              {highImpactPost && highImpactPost.date ? (
                <span>
                  {new Date(highImpactPost.date).toLocaleDateString()}
                </span>
              ) : (
                <span>01/01/2023</span>
              )}
              {highImpactPost && highImpactPost.platform ? (
                <span>{highImpactPost.platform}</span>
              ) : (
                <span>Plateforme inconnue</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostPage;
