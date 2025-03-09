import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import MovableGraph from "./components/MovableGraph";
import Posts from "../HomePage/components/Posts";
import "./MovablePage.css";

// Fonction utilitaire pour télécharger un fichier JSON
const downloadJSON = (content, fileName) => {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const MovablePage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPosts, setShowPosts] = useState(true);
  const graphInstanceRef = useRef(null);

  // Fonction pour charger les données JSON
  const loadJsonData = async () => {
    setIsLoading(true);
    try {
      // Charger les données du graphe
      const graphResponse = await fetch(
        "/data/spatialized_nodes_and_links.data.json"
      );
      const graphJsonData = await graphResponse.json();

      // Validation basique des données du graphe
      if (graphJsonData && graphJsonData.nodes && graphJsonData.links) {
        setGraphData(graphJsonData);
        console.log("Données du graphe chargées:", graphJsonData);
      } else {
        console.error("Format de données du graphe invalide:", graphJsonData);
      }

      // Charger les données des posts
      const postsResponse = await fetch("/data/spatialized_posts.data.json");
      const postsJsonData = await postsResponse.json();

      // Validation basique des données des posts
      if (Array.isArray(postsJsonData)) {
        setPostsData(postsJsonData);
        console.log("Données des posts chargées:", postsJsonData);
      } else {
        console.error("Format de données des posts invalide:", postsJsonData);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données JSON:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les données au démarrage
  useEffect(() => {
    loadJsonData();
  }, []);

  // Fonction pour basculer l'affichage des posts
  const togglePosts = () => {
    setShowPosts(!showPosts);
  };

  // Fonction pour exporter les données spatialisées
  const exportSpatializedData = () => {
    console.log("Début de l'exportation...");
    console.log("État actuel des données:");
    console.log("- graphData:", graphData);
    console.log("- postsData:", postsData);
    console.log("- graphInstance:", graphInstanceRef.current);

    // Vérifier si les données sont disponibles
    const hasGraphData =
      graphData && graphData.nodes && graphData.nodes.length > 0;
    const hasPostsData =
      postsData && Array.isArray(postsData) && postsData.length > 0;

    if (!hasGraphData) {
      console.warn("Aucune donnée de graphe à exporter");
      alert(
        "Attention: Aucune donnée de graphe disponible. Les données exportées seront vides."
      );
    }

    if (!hasPostsData) {
      console.warn("Aucune donnée de posts à exporter");
      alert(
        "Attention: Aucune donnée de posts disponible. Les données exportées seront vides."
      );
    }

    // Procéder à l'exportation même si les données sont vides (créer des fichiers vides)
    try {
      console.log("Démarrage de l'export...");

      // Création de l'export des nœuds et liens
      // ------------------------------------------------
      let nodesWithPositions = [];
      let links = [];

      // 1. Tenter d'utiliser la référence du graphe si disponible
      const useGraphRef =
        graphInstanceRef.current &&
        typeof graphInstanceRef.current.getNodesPositions === "function";

      if (useGraphRef) {
        console.log("Utilisation de la référence du graphe pour l'exportation");
        try {
          // Récupérer les positions des noeuds directement depuis le graphe
          nodesWithPositions = graphInstanceRef.current.getNodesPositions();
          console.log(
            `Récupéré ${
              nodesWithPositions?.length || 0
            } noeuds depuis la référence du graphe`
          );
        } catch (err) {
          console.error("Erreur lors de la récupération des noeuds:", err);
          nodesWithPositions = [];
        }
      }

      // 2. Si les noeuds sont vides, utiliser la méthode de secours avec les données du contexte
      if (!nodesWithPositions || nodesWithPositions.length === 0) {
        console.log("Méthode de secours pour les noeuds");

        if (hasGraphData) {
          nodesWithPositions = graphData.nodes.map((node) => {
            // Créer un objet qui contient toutes les propriétés du nœud
            return {
              id: node.id,
              group: node.group || 0,
              name: node.name || "",
              x: node.coordinates?.x ?? node.x ?? 0,
              y: node.coordinates?.y ?? node.y ?? 0,
              z: node.coordinates?.z ?? node.z ?? 0,
              value: node.value || 1,
              type: node.type,
              isJoshua: node.isJoshua,
              // Inclure toutes les autres propriétés directement
              slug: node.slug,
              biography: node.biography,
              mostViralContent: node.mostViralContent,
              displayName: node.displayName,
              aliases: node.aliases,
              fictionOrImpersonation: node.fictionOrImpersonation,
              platform: node.platform,
              thematic: node.thematic,
              career: node.career,
              genre: node.genre,
              polarisation: node.polarisation,
              cercle: node.cercle,
              politicalSphere: node.politicalSphere,
              sources: node.sources,
              totalPosts: node.totalPosts,
              hasEnoughPostsToUseInFrequencyPosts:
                node.hasEnoughPostsToUseInFrequencyPosts,
              hasEnoughTextToMakeWordcloud: node.hasEnoughTextToMakeWordcloud,
              topWords: node.topWords,
            };
          });
          console.log(
            `Récupéré ${nodesWithPositions.length} noeuds depuis graphData`
          );
        }
      }

      // 3. Préparer les liens depuis graphData
      if (graphData && graphData.links && graphData.links.length > 0) {
        links = graphData.links.map((link) => {
          // Extraction des IDs de source et cible
          const source =
            typeof link.source === "object" ? link.source.id : link.source;
          const target =
            typeof link.target === "object" ? link.target.id : link.target;

          return {
            source: source,
            target: target,
            value: link.value || 1,
            // Propriétés additionnelles sans le préfixe underscore
            isDirect: link._isDirect || link.isDirect,
            relationType: link._relationType || link.relationType,
            mediaImpact: link._mediaImpact || link.mediaImpact,
            virality: link._virality || link.virality,
            mediaCoverage: link._mediaCoverage || link.mediaCoverage,
            linkType: link._linkType || link.linkType,
          };
        });
        console.log(`Récupéré ${links.length} liens depuis graphData`);
      } else {
        console.log("Aucun lien disponible dans graphData");
      }

      // 4. Exporter le premier fichier (noeuds et liens)
      const spatializedNodesAndLinks = {
        nodes: nodesWithPositions || [],
        links: links || [],
      };

      console.log(
        `Export des nœuds: ${nodesWithPositions.length}, liens: ${links.length}`
      );
      downloadJSON(
        spatializedNodesAndLinks,
        "spatialized_nodes_and_links.data.json"
      );

      // // Création de l'export des posts
      // // ------------------------------------------------
      // let spatializedPosts = [];

      // // 5. Préparer les données des posts si disponibles
      // if (hasPostsData) {
      //   spatializedPosts = postsData.map((post) => {

      //     return {
      //       id: post.id,
      //       postUID: post.postUID || post.id, // Ajout de postUID, avec fallback sur id si non disponible
      //       slug: post.slug || "",
      //       impact: post.impact || 0,
      //       x: post.x || 0,
      //       y: post.y || 0,
      //       z: post.z || 0,
      //       // isJoshuaCharacter supprimé
      //     };
      //   });
      //   console.log(`Préparé ${spatializedPosts.length} posts pour l'export`);
      // }

      // // 6. Exporter le deuxième fichier (posts)
      // console.log(`Export des posts: ${spatializedPosts.length}`);
      // downloadJSON(spatializedPosts, "spatialized_posts.data.json");

      // 7. Afficher un message de confirmation
      alert(`Exportation terminée!
- Noeuds: ${nodesWithPositions.length}
- Liens: ${links.length} 
- Posts: ${spatializedPosts.length}`);
    } catch (error) {
      console.error("Erreur pendant l'exportation:", error);
      alert(`Erreur pendant l'exportation: ${error.message}`);
    }
  };

  return (
    <div className="movable-canvas-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      <div className="instructions">
        <h2>Mode Manipulation</h2>
        <p>Cliquez sur un nœud pour le sélectionner et le manipuler</p>
        <p>
          Utilisez la touche Shift pour changer de mode (déplacer, pivoter,
          redimensionner)
        </p>
        <button className="toggle-button" onClick={togglePosts}>
          {showPosts ? "Masquer les posts" : "Afficher les posts"}
        </button>
      </div>

      {/* Bouton d'exportation */}
      <button
        className="export-button"
        onClick={exportSpatializedData}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          padding: "10px 15px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        Exporter les données JSON
      </button>

      <Canvas
        camera={{ position: [0, 0, 500], fov: 50, near: 0.1, far: 1000000 }}
      >
        <Stats />
        <color attach="background" args={["#000000"]} />

        {/* Éclairage */}
        <ambientLight intensity={1.2} />

        {/* Afficher le graphe si les données sont disponibles et valides */}
        {graphData && graphData.nodes && graphData.links && (
          <MovableGraph ref={graphInstanceRef} data={graphData} />
        )}

        {/* Afficher les posts si les données sont disponibles */}
        {showPosts && Array.isArray(postsData) && postsData.length > 0 && (
          <Posts data={postsData} />
        )}
      </Canvas>
    </div>
  );
};

export default MovablePage;
