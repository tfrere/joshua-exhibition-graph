import { Canvas } from "@react-three/fiber";
import { OrbitControls, SpotLight, Stats } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import { useControls, folder, button } from "leva";
import ForceGraphComponent from "./components/ForceGraph";
import GamepadControls from "../../components/GamepadControls";
import PostsRenderer from "../../components/PostsRenderer";
import { useData } from "../../contexts/DataContext";

const WorkPage = () => {
  const [gamepadEnabled, setGamepadEnabled] = useState(false);
  const { isLoadingGraph, isLoadingPosts, updatePostsPositions } = useData();

  // Configurer tous les contrôles avec Leva
  const { debug, backgroundColor } = useControls({
    debug: true,
    backgroundColor: "#523e3e",
  });

  // Configurer les contrôles de la manette
  const gamepadControls = useControls({
    Manette: folder({
      enabled: {
        value: gamepadEnabled,
        onChange: (v) => setGamepadEnabled(v),
      },
      config: folder({
        maxSpeed: { value: 10, min: 1, max: 50 },
        acceleration: { value: 15, min: 1, max: 30 },
        deceleration: { value: 0.95, min: 0.5, max: 0.99 },
        rotationSpeed: { value: 1.5, min: 0.1, max: 5 },
        deadzone: { value: 0.1, min: 0.01, max: 0.5 },
      }),
    }),
  });
  
  // Ajouter des contrôles pour les posts dans le panneau Leva
  useControls({
    "Contrôles des Posts": folder({
      "Mettre à jour les positions": button(() => {
        // Vérifier que les données ne sont pas en cours de chargement avant de mettre à jour
        if (isLoadingGraph || isLoadingPosts) {
          console.warn("Impossible de mettre à jour les positions : chargement des données en cours");
          return;
        }
        
        console.log("Mise à jour manuelle des positions des posts...");
        updatePostsPositions({
          joshuaOnly: true,
          preserveOtherPositions: true,
          radius: 20,
          minDistance: 8,
          verticalSpread: 1.2,
          horizontalSpread: 1.5,
          // Paramètres de l'algorithme Voronoi
          perlinScale: 0.05,
          perlinAmplitude: 7,
          dilatationFactor: 1.3
        });
      }),
    }),
  });
  
  // Mettre à jour automatiquement les positions des posts après le chargement des données
  const positionsUpdatedOnceRef = useRef(false);
  
  useEffect(() => {
    // Vérifier que ni le graphe ni les posts ne sont en cours de chargement
    if (!isLoadingGraph && !isLoadingPosts && !positionsUpdatedOnceRef.current) {
      console.log("Données entièrement chargées, planification de la mise à jour des positions...");
      
      // Attendre que le rendu du graphe soit terminé avant de mettre à jour
      const timer = setTimeout(() => {
        console.log("Tentative de mise à jour des positions des posts...");
        updatePostsPositions({
          joshuaOnly: true,
          preserveOtherPositions: true,
          radius: 20,
          minDistance: 8,
          verticalSpread: 1.2,
          horizontalSpread: 1.5,
          // Paramètres de l'algorithme Voronoi
          perlinScale: 0.05,
          perlinAmplitude: 7,
          dilatationFactor: 1.3
        });
        positionsUpdatedOnceRef.current = true;
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isLoadingGraph, isLoadingPosts, updatePostsPositions]);

  return (
    <div className="canvas-container">
      <Canvas camera={{ position: [0, 0, 500] }}>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />
        <pointLight position={[0, 20, 0]} intensity={1.2} color="#f0f0ff" />
        <SpotLight
          position={[10, 20, 10]}
          angle={0.3}
          penumbra={0.8}
          intensity={2}
          castShadow
          distance={100}
        />

        {/* Utiliser ForceGraphComponent au lieu de CustomForceGraph */}
        <ForceGraphComponent />
        <PostsRenderer />

        {gamepadControls.enabled && (
          <GamepadControls config={gamepadControls.config} />
        )}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          makeDefault={true}
        />
      </Canvas>
    </div>
  );
};

export default WorkPage;
