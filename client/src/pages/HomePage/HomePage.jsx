import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useState, useEffect, useCallback } from "react";
import Graph from "./components/Graph.jsx";
import Posts from "./components/Posts/Posts.jsx";
import NavigationUI from "./components/NavigationUI.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
  CrosshairIndicator,
} from "./components/AdvancedCameraController";
import SoundPlayer from "./components/Audio/SoundPlayer.jsx";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
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

  // Gestion du mode debug et de la rotation avec les touches
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "p" || event.key === "P") {
        setDebugMode((prevMode) => !prevMode);
        console.log("Mode debug:", !debugMode);
      }

      // Ajout d'un test pour la vibration de la manette avec la touche "v"
      if (event.key === "v" || event.key === "V") {
        // Import dynamique pour éviter les dépendances circulaires
        import("./utils/inputManager").then(({ getInputManager }) => {
          const inputManager = getInputManager();
          if (inputManager) {
            console.log("Test de vibration du gamepad");
            inputManager.vibrateGamepad(100, 0.5, 1.0);
          } else {
            console.log(
              "InputManager non disponible pour le test de vibration"
            );
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Nettoyer l'écouteur d'événements lors du démontage
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
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
            soundPath="/sounds/interview.m4a"
            defaultVolume={0.7}
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

      {/* Affichage du crosshair (viseur) si le jeu a démarré */}
      {gameStarted && <CrosshairIndicator />}

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
            <ToneMapping exposure={1.0} mode={THREE.ReinhardToneMapping} />
            <Bloom intensity={0.25} threshold={0.28} radius={0.48} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};

export default HomePage;
