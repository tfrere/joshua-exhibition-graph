import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useState, useEffect } from "react";
import MovableGraph from "./components/MovableGraph";
import Posts from "../HomePage/components/Posts";
import "./MovablePage.css";

const MovablePage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPosts, setShowPosts] = useState(true);

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

      <Canvas
        camera={{ position: [0, 0, 500], fov: 50, near: 0.1, far: 1000000 }}
      >
        <Stats />
        <color attach="background" args={["#000000"]} />

        {/* Éclairage */}
        <ambientLight intensity={1.2} />

        {/* Afficher le graphe si les données sont disponibles et valides */}
        {graphData && graphData.nodes && graphData.links && (
          <MovableGraph data={graphData} />
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
