import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useState, useEffect } from "react";
import Graph from "../HomePage/components/Graph.jsx";
import Posts from "../HomePage/components/Posts/Posts.jsx";
import NavigationUI from "../HomePage/components/NavigationUI.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "../HomePage/components/AdvancedCameraController";
import PostProcessingEffects from "../HomePage/components/PostProcessingEffects.jsx";

const EffectsPage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="canvas-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Interface utilisateur en dehors du Canvas - conditionnée par le mode debug et le démarrage du jeu */}
      {/* <NavigationUI /> */}

      {/* Indicateur de connexion de manette - conditionné par le mode debug et le démarrage du jeu */}
      <GamepadIndicator />

      {/* Canvas - toujours rendu mais masqué par l'écran d'intro si le jeu n'a pas démarré */}
      <Canvas
        shadows
        // gl={{ toneMapping: THREE.NoToneMapping }}
        camera={{ position: [0, 0, 600], fov: 50, near: 0.1, far: 1000000 }}
      >
        {/* Affichage des stats (FPS) conditionné par le mode debug */}
        <Stats />
        <color attach="background" args={["#000000"]} />

        <AdvancedCameraController />

        {/* Éclairage */}
        <ambientLight intensity={3} color="white" />

        {/* Lumière ponctuelle centrale optimisée */}
        <pointLight
          position={[0, 0, 0]}
          intensity={18}
          distance={300}
          decay={0.1}
          color="white"
          castShadow
          shadow-mapSize-width={128}
          shadow-mapSize-height={128}
        />

        {/* Afficher le graphe si les données sont disponibles et valides et si le jeu a démarré */}
        {graphData && graphData.nodes && graphData.links && (
          <Graph data={graphData} postsData={postsData} />
        )}

        {/* Afficher les posts si activés et disponibles et si le jeu a démarré */}
        {postsData && <Posts data={postsData} />}

        {/* Effets de post-processing - utilisation du composant avancé */}
        <PostProcessingEffects />
      </Canvas>
    </div>
  );
};

export default EffectsPage;
