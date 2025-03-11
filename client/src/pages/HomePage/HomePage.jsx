import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useState, useEffect } from "react";
import Graph from "./components/Graph.jsx";
import Posts from "./components/Posts/Posts.jsx";
import { useControls, folder } from "leva";
import NavigationUI from "./components/NavigationUI.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";
import GridReferences from "./components/GridReferences.jsx";
import AmbientSound from "./components/Audio/AmbientSound.jsx";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import "./HomePage.css";

// Composant pour la sphère lumineuse
const LightSphere = ({ radius = 30, intensity = 0.8, color = "#4080ff" }) => {
  return (
    <group>
      {/* Sphère lumineuse centrale avec matériau émissif */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Sphère intérieure pour renforcer l'effet de lumière */}
      <mesh>
        <sphereGeometry args={[radius * 0.8, 24, 24]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          distort={0.3}
          speed={0.5}
          transparent={true}
          opacity={0.1}
        />
      </mesh>

      {/* Lumière ponctuelle supplémentaire pour l'effet volumétrique */}
      <pointLight
        position={[0, 0, 0]}
        intensity={intensity * 50}
        distance={radius * 2}
        decay={1.5}
        color={color}
      />
    </group>
  );
};

const HomePage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

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

  // Gestion du mode debug avec la touche D
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "p" || event.key === "P") {
        setDebugMode((prevMode) => !prevMode);
        console.log("Mode debug:", !debugMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Nettoyage de l'écouteur d'événement
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [debugMode]);

  return (
    <div className="canvas-container">
      {/* Composant de son d'ambiance */}
      <AmbientSound />

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Interface utilisateur en dehors du Canvas - conditionnée par le mode debug */}
      {debugMode && <NavigationUI />}

      {/* Afficher les références de grille si activées */}
      <GridReferences
        rotationInterval={20}
        maxRotation={180}
        circleRadii={[50, 100, 150, 200, 250]}
        opacity={1}
      />

      {/* Indicateur de connexion de manette - conditionné par le mode debug */}
      {debugMode && <GamepadIndicator />}

      <Canvas
        shadows
        // gl={{ toneMapping: THREE.NoToneMapping }}
        camera={{ position: [0, 0, 600], fov: 50, near: 0.1, far: 1000000 }}
      >
        {/* Affichage des stats (FPS) conditionné par le mode debug */}
        {debugMode && <Stats />}
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

        {/* <pointLight
          position={[0, 0, 100]}
          intensity={20}
          distance={100}
          decay={0.1}
          color="orange"
        /> */}

        {/* Afficher le graphe si les données sont disponibles et valides */}
        {graphData && graphData.nodes && graphData.links && (
          <Graph data={graphData} postsData={postsData} />
        )}

        {/* Afficher les posts si activés et disponibles */}
        {postsData && <Posts data={postsData} />}

        {/* Effets de post-processing dans un composant séparé */}
        {/* <PostProcessingEffects /> */}
        {/* <EffectComposer>
          <Bloom intensity={0.2} threshold={0.1} radius={0.5} amount={0.1} />
        </EffectComposer> */}
      </Canvas>
    </div>
  );
};

export default HomePage;
