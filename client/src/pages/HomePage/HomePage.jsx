import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, SpotLight, Stats } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import Graph from "./components/Graph.jsx";
import Posts from "./components/Posts.jsx";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
} from "@react-three/postprocessing";
import { useControls } from "leva";
import NavigationUI from "./components/NavigationUI.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";

import "./HomePage.css";

const HomePage = () => {
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

  // Configurer tous les contrôles avec Leva
  const {
    debug,
    backgroundColor,
    cameraConfig,
    hasPosts,
    hasBloom,
    hasGraph,
    hasDepthOfField,
  } = useControls({
    debug: true,
    hasPosts: true,
    hasBloom: true,
    hasGraph: false,
    hasDepthOfField: true,
    backgroundColor: "#000000",
  });

  return (
    <div className="canvas-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Interface utilisateur en dehors du Canvas */}
      <NavigationUI />

      {/* Indicateur de connexion de manette */}
      <GamepadIndicator />
      <Canvas
        camera={{ position: [0, 0, 500], fov: 50, near: 0.1, far: 1000000 }}
      >
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />

        <AdvancedCameraController config={cameraConfig} />

        {/* Éclairage */}
        <ambientLight intensity={1.2} />

        {/* Afficher le graphe si les données sont disponibles et valides */}
        {hasGraph && graphData && graphData.nodes && graphData.links && (
          <Graph data={graphData} />
        )}
        {hasPosts && postsData && <Posts data={postsData} />}

        <EffectComposer>
          {hasBloom && (
            <Bloom
              intensity={0.5}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.2}
            />
          )}
          {/* <Pixelation
            granularity={3} // pixel granularity
          /> */}
          {hasDepthOfField && (
            <DepthOfField
              focusDistance={10} // where to focu
              focusRange={30}
              focalLength={1.8} // focal length
              // worldFocusDistance={1}
              bokehScale={5} // bokeh size
            />
          )}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default HomePage;
