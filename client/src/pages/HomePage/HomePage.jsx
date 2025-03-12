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
import IntroScreen from "./components/IntroScreen.jsx";

const HomePage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);

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

  // Fonction pour démarrer l'audio immédiatement
  const startAudio = useCallback(() => {
    setAudioStarted(true);
    console.log("Audio démarré");
  }, []);

  // Fonction pour démarrer le jeu
  const startGame = useCallback(() => {
    setGameStarted(true);
    console.log("Jeu démarré");
  }, []);

  // Gestion du mode debug et de la rotation avec les touches
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "p" || event.key === "P") {
        setDebugMode((prevMode) => !prevMode);
        console.log("Mode debug:", !debugMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
  }, [debugMode]);

  return (
    <div className="canvas-container">
      {/* Écran d'introduction - composant externalisé */}
      {!gameStarted && (
        <IntroScreen
          onStart={() => setGameStarted(true)}
          onStartAudio={startAudio}
        />
      )}

      {/* Composants de son - maintenant contrôlés par audioStarted */}
      {audioStarted && (
        <>
          <SoundPlayer
            soundPath="/sounds/ambiant.mp3"
            defaultVolume={0.1}
            loop={true}
            autoPlay={true}
            displayControls={false}
            controlPosition={{ top: "20px", right: "20px" }}
            tooltipLabels={{ mute: "Couper le son", unmute: "Activer le son" }}
          />
          <SoundPlayer
            soundPath="/sounds/interview.mp3"
            defaultVolume={0.5}
            loop={true}
            autoPlay={true}
            displayControls={false}
            controlPosition={{ top: "20px", right: "80px" }}
            tooltipLabels={{ mute: "Couper le son", unmute: "Activer le son" }}
          />
        </>
      )}

      {isLoading && gameStarted && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Interface utilisateur en dehors du Canvas - conditionnée par le mode debug et le démarrage du jeu */}
      {debugMode && gameStarted && <NavigationUI />}

      {/* Indicateur de connexion de manette - conditionné par le mode debug et le démarrage du jeu */}
      {debugMode && gameStarted && <GamepadIndicator />}

      {/* Canvas - toujours rendu mais masqué par l'écran d'intro si le jeu n'a pas démarré */}
      <Canvas
        shadows
        // gl={{ toneMapping: THREE.NoToneMapping }}
        camera={{ position: [0, 0, 600], fov: 50, near: 0.1, far: 1000000 }}
      >
        {/* Affichage des stats (FPS) conditionné par le mode debug */}
        {debugMode && gameStarted && <Stats />}
        <color attach="background" args={["#000000"]} />

        {gameStarted && <AdvancedCameraController />}

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

        {/* Effets de post-processing - seulement si le jeu a démarré */}
        {gameStarted && (
          <EffectComposer>
            {/* <Bloom intensity={0.2} threshold={0.1} radius={0.5} amount={0.1} /> */}
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};

export default HomePage;
