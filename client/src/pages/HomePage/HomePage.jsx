import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useState, useEffect, useMemo, useCallback } from "react";
import Graph from "./components/Graph.jsx";
import Posts from "./components/Posts/Posts.jsx";
import { useControls, folder } from "leva";
import NavigationUI from "./components/NavigationUI.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";
import GridReferences from "./components/GridReferences.jsx";
import SoundPlayer from "./components/Audio/SoundPlayer.jsx";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
} from "@react-three/postprocessing";
import * as THREE from "three";
import "./HomePage.css";

const HomePage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

  // Configuration pour la rotation de la scène
  const sceneRotation = useMemo(() => {
    return isRotated
      ? new THREE.Euler(0, Math.PI / 2, 0)
      : new THREE.Euler(0, 0, 0);
  }, [isRotated]);

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

  // Fonction pour basculer la rotation
  const toggleRotation = useCallback(() => {
    setIsRotated((prev) => !prev);
    console.log("Rotation basculée:", !isRotated);
  }, [isRotated]);

  // Gestion du mode debug et de la rotation avec les touches
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "p" || event.key === "P") {
        setDebugMode((prevMode) => !prevMode);
        console.log("Mode debug:", !debugMode);
      } else if (event.key === "r" || event.key === "R") {
        // Touche R pour basculer la rotation
        toggleRotation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Nettoyage de l'écouteur d'événement
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [debugMode, toggleRotation]);

  return (
    <div className="canvas-container">
      {/* Bouton de rotation */}
      <button
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 1000,
          padding: "10px",
          background: "#333",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
        onClick={toggleRotation}
      >
        {isRotated ? "Rotation 0°" : "Rotation 90°"}
      </button>

      {/* Composant de son d'ambiance */}
      <SoundPlayer
        soundPath="/sounds/ambiant.mp3"
        defaultVolume={0.1}
        loop={true}
        autoPlay={true}
        displayControls={true}
        controlPosition={{ top: "20px", right: "20px" }}
        tooltipLabels={{ mute: "Couper le son", unmute: "Activer le son" }}
      />
      <SoundPlayer
        soundPath="/sounds/interview.mp3"
        defaultVolume={0.5}
        loop={true}
        autoPlay={true}
        displayControls={true}
        controlPosition={{ top: "20px", right: "20px" }}
        tooltipLabels={{ mute: "Couper le son", unmute: "Activer le son" }}
      />

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

        {/* Groupe englobant avec rotation basée sur l'état */}
        <group rotation={sceneRotation}>
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
        </group>

        {/* Effets de post-processing */}
        {/* <PostProcessingEffects /> */}
        <EffectComposer>
          {/* <Bloom intensity={0.2} threshold={0.1} radius={0.5} amount={0.1} /> */}
          {/* <DepthOfField
            // blendFunction?: import("postprocessing").BlendFunction | undefined;
            // worldFocusDistance?: number | undefined;
            // worldFocusRange?: number | undefined;
            // focusDistance?: number | undefined;
            // focalLength?: number | undefined;
            // focusRange?: number | undefined;
            // bokehScale?: number | undefined;
            // resolutionScale?: number | undefined;
            // resolutionX?: number | undefined;
            // resolutionY?: number | undefined;
            // width?: number | undefined;
            // height?: number | undefined;

            // worldFocusDistance={100}
            // focusDistance={100}
            focalLength={0.3}
            bokehScale={3}
          /> */}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default HomePage;
