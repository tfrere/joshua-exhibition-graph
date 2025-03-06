import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { SpotLight, Stats } from "@react-three/drei";
import { useState, useRef, useEffect } from "react";
import { useControls, folder, button } from "leva";
import ForceGraphComponent, { ForceGraphUI } from "./components/ForceGraph";
import PostsRenderer from "../../components/PostsRenderer";
import { useData } from "../../contexts/DataContext";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";
import { DEFAULT_FLIGHT_CONFIG } from "./utils/advancedCameraControls";
import { EffectComposer, Bloom, Pixelation } from "@react-three/postprocessing";
const WorkPage = () => {
  const [gamepadEnabled, setGamepadEnabled] = useState(false);
  const { isLoadingGraph, isLoadingPosts, updatePostsPositions } = useData();

  // Configuration par défaut pour la spatialisation des posts
  const DEFAULT_POSTS_SPATIAL_CONFIG = {
    joshuaOnly: true,
    preserveOtherPositions: true,
    // Paramètres de positionnement
    radius: 60,
    minDistance: 40,
    verticalSpread: 1.2,
    horizontalSpread: 1.5,
    // Paramètres de l'algorithme Voronoi
    perlinScale: 0.05,
    perlinAmplitude: 7,
    dilatationFactor: 1.8,
    // Coloration des posts
    useUniqueColorsPerCharacter: true,
    // Paramètres du flowfield
    useFlowfield: true,
    flowFrames: 100,
    flowScale: 0.02,
    flowStrength: 5,
    // Paramètres de normalisation sphérique
    normalizeInSphere: true,
    sphereRadius: 250,
    volumeExponent: 2 / 3, // 1/3 donne une distribution uniforme dans le volume
    minRadius: 0, // Distance minimum depuis le centre (10% du rayon)
    jitter: 0.2, // 20% de variation aléatoire pour éviter les motifs trop réguliers
  };

  // Configurer tous les contrôles avec Leva
  const { debug, backgroundColor, cameraConfig } = useControls({
    debug: true,
    backgroundColor: "#000000",
  });

  // Ajouter un contrôle simple pour mettre à jour les positions
  useControls({
    "Contrôles des Posts": folder({
      "Mettre à jour les positions": button(() => {
        // Vérifier que les données ne sont pas en cours de chargement avant de mettre à jour
        if (isLoadingGraph || isLoadingPosts) {
          console.warn(
            "Impossible de mettre à jour les positions : chargement des données en cours"
          );
          return;
        }

        console.log("Mise à jour manuelle des positions des posts...");
        updatePostsPositions(DEFAULT_POSTS_SPATIAL_CONFIG);
      }),
    }),
  });

  // Mettre à jour automatiquement les positions des posts après le chargement des données
  const positionsUpdatedOnceRef = useRef(false);

  useEffect(() => {
    // Vérifier que ni le graphe ni les posts ne sont en cours de chargement
    if (
      !isLoadingGraph &&
      !isLoadingPosts &&
      !positionsUpdatedOnceRef.current
    ) {
      console.log(
        "Données entièrement chargées, planification de la mise à jour des positions..."
      );

      // Attendre que le rendu du graphe soit terminé avant de mettre à jour
      const timer = setTimeout(() => {
        console.log("Tentative de mise à jour des positions des posts...");
        updatePostsPositions(DEFAULT_POSTS_SPATIAL_CONFIG);
        positionsUpdatedOnceRef.current = true;
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isLoadingGraph, isLoadingPosts, updatePostsPositions]);

  return (
    <div className="canvas-container">
      {/* Interface utilisateur en dehors du Canvas */}
      <ForceGraphUI />

      {/* Indicateur de connexion de manette */}
      <GamepadIndicator />

      {/* Canvas 3D avec les éléments 3D uniquement */}
      <Canvas camera={{ position: [0, 0, 500] }}>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />

        {/* Contrôleur de caméra avancé avec modes orbite et vol */}
        <AdvancedCameraController config={cameraConfig} />

        {/* Composant ForceGraph pour le rendu 3D uniquement */}
        <ForceGraphComponent />
        <PostsRenderer />
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.5}
          />
          {/* <Pixelation
            granularity={5} // pixel granularity
          /> */}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default WorkPage;
