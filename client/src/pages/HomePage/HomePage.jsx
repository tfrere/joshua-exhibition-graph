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
  ToneMapping,
} from "@react-three/postprocessing";
import { useControls, folder } from "leva";
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
        console.log("Données du graphe chargées:", graphJsonData);
      } else {
        console.error("Format de données du graphe invalide:", graphJsonData);
      }

      // Charger les données des posts
      const postsResponse = await fetch("/data/spatialized_posts.data.json");
      const postsJsonData = await postsResponse.json();

      // Validation basique des données des posts
      if (Array.isArray(postsJsonData)) {
        // Hack temporaire: s'assurer que tous les posts ont un postUID
        const processedPostsData = postsJsonData.map((post, index) => {
          if (post.postUID === undefined) {
            // Générer un postUID unique basé sur l'index + un offset élevé pour éviter les conflits
            const generatedUID = 1000000 + index;
            console.log(
              `Hack temporaire: Généré postUID=${generatedUID} pour post.id=${post.id}`
            );
            return {
              ...post,
              postUID: generatedUID,
            };
          }
          return post;
        });

        setPostsData(processedPostsData);
        console.log("Données des posts chargées:", processedPostsData);

        // Ajouter les posts au graphData pour que le détecteur puisse y accéder
        if (graphJsonData) {
          graphJsonData.posts = processedPostsData;
          setGraphData(graphJsonData);
          console.log("Posts ajoutés au graphData:", graphJsonData);
        }
      } else {
        console.error("Format de données des posts invalide:", postsJsonData);

        if (graphJsonData) {
          setGraphData(graphJsonData);
        }
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
    hasToneMapping,
    // Paramètres de DepthOfField
    focusDistance,
    focusRange,
    focalLength,
    bokehScale,
  } = useControls({
    debug: true,
    hasPosts: true,
    hasBloom: false,
    hasGraph: true,
    hasDepthOfField: false,
    hasToneMapping: false,
    backgroundColor: "#000000",
    "Depth of Field": folder({
      focusDistance: {
        value: 10,
        min: 0,
        max: 50,
        step: 0.1,
        label: "Distance de focus",
      },
      focusRange: {
        value: 30,
        min: 0,
        max: 100,
        step: 1,
        label: "Plage de focus",
      },
      focalLength: {
        value: 1.8,
        min: 0.1,
        max: 5,
        step: 0.1,
        label: "Longueur focale",
      },
      bokehScale: {
        value: 5,
        min: 0,
        max: 20,
        step: 0.1,
        label: "Échelle du bokeh",
      },
    }),
  });

  // Log quand graphData ou postsData changent
  useEffect(() => {
    if (graphData) {
      console.log("GraphData mis à jour:", graphData);
      console.log(
        "Posts dans graphData:",
        graphData.posts ? graphData.posts.length : 0
      );
    }
  }, [graphData]);

  useEffect(() => {
    if (postsData) {
      console.log("PostsData mis à jour:", postsData.length);
    }
  }, [postsData]);

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
          {hasToneMapping && (
            <ToneMapping mode={THREE.ACESFilmicToneMapping} exposure={0.5} />
          )}
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
              focusDistance={focusDistance}
              focusRange={focusRange}
              focalLength={focalLength}
              bokehScale={bokehScale}
            />
          )}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default HomePage;
