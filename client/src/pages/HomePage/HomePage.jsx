import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { useState, useEffect } from "react";
import * as THREE from "three";
import Graph from "./components/Graph.jsx";
import Posts from "./components/Posts.jsx";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ToneMapping,
  Vignette,
  ChromaticAberration,
  Noise,
  Pixelation,
  SSAO,
  Glitch,
  Outline,
  GodRays,
  Grid,
  SelectiveBloom,
} from "@react-three/postprocessing";
import { BlendFunction, NormalPass, KernelSize, KawaseBlurPass } from "postprocessing";
import { useControls, button } from "leva";
import NavigationUI from "./components/NavigationUI.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "./components/AdvancedCameraController";

import "./HomePage.css";

const HomePage = () => {
  const [graphData, setGraphData] = useState(null);
  const [postsData, setPostsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Définition des valeurs par défaut pour tous les effets
  const defaultValues = {
    // Bloom
    hasBloom: true,
    bloomIntensity: 1.0,
    bloomLuminanceThreshold: 0.2,
    bloomLuminanceSmoothing: 0.2,
    
    // Tone Mapping
    hasToneMapping: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    
    // Depth of Field
    hasDepthOfField: false,
    focusDistance: 10,
    focusRange: 30,
    focalLength: 1.8,
    bokehScale: 5,
    
    // Vignette
    hasVignette: false,
    vignetteOffset: 0.5,
    vignetteDarkness: 0.5,
    
    // Chromatic Aberration
    hasChroma: false,
    chromaOffset: 0.005,
    
    // Noise
    hasNoise: false,
    noiseOpacity: 0.25,
    
    // Pixelation
    hasPixelation: false,
    pixelGranularity: 6,
    
    // SSAO
    hasSSAO: false,
    ssaoIntensity: 2,
    ssaoRadius: 10,
    ssaoLumInfluence: 0.5,
    
    // Blur (Kawase)
    hasBlur: false,
    kawaseIterations: 6,
    kawaseScale: 0.5,
    
    // Outline
    hasOutline: false,
    outlineEdgeStrength: 3.0,
    outlineVisibleEdgeColor: "#ffffff",
    outlineHiddenEdgeColor: "#190a05",
    
    // Glitch
    hasGlitch: false,
    glitchMode: 1, // 0 = wild, 1 = chronique
    glitchCustomPattern: true,
    glitchDelayMin: 1.5,
    glitchDelayMax: 3.5,
    glitchDurationMin: 0.3,
    glitchDurationMax: 1.0,
    glitchWeakGlitches: 0.3,
    glitchStrongGlitches: 0.7,
    glitchRatio: 0.85,
    glitchColumns: 0.05,
    glitchDtSize: 64,
    
    // Grid
    hasGrid: false,
    gridScale: 1.0,
    gridSize: 10.0,
    gridLineWidth: 0.05,
    gridFadeDistance: 100.0,
    
    // God Rays
    hasGodRays: false,
    godRaysDensity: 0.96,
    godRaysWeight: 0.3,
    godRaysDecay: 0.93,
    godRaysExposure: 0.6,
  };

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

  // Configuration de Leva - Options générales
  const [generalControls, setGeneralControls] = useControls(() => ({
    debug: true,
    hasPosts: true,
    hasGraph: true,
    backgroundColor: "#000000",
  }));
  
  // Configuration du bouton de réinitialisation en première position
  useControls("Effets - Réinitialisation", () => ({
    resetEffects: button(() => {
      try {
        // Réinitialiser les valeurs en utilisant les fonctions set retournées par useControls
        setBloomControls({
          hasBloom: defaultValues.hasBloom,
          bloomIntensity: defaultValues.bloomIntensity,
          bloomLuminanceThreshold: defaultValues.bloomLuminanceThreshold,
          bloomLuminanceSmoothing: defaultValues.bloomLuminanceSmoothing
        });
        
        setToneMappingControls({
          hasToneMapping: defaultValues.hasToneMapping,
          toneMapping: defaultValues.toneMapping,
          toneMappingExposure: defaultValues.toneMappingExposure
        });
        
        setDofControls({
          hasDepthOfField: defaultValues.hasDepthOfField,
          focusDistance: defaultValues.focusDistance,
          focusRange: defaultValues.focusRange,
          focalLength: defaultValues.focalLength,
          bokehScale: defaultValues.bokehScale
        });
        
        setVignetteControls({
          hasVignette: defaultValues.hasVignette,
          vignetteOffset: defaultValues.vignetteOffset,
          vignetteDarkness: defaultValues.vignetteDarkness
        });
        
        setChromaControls({
          hasChroma: defaultValues.hasChroma,
          chromaOffset: defaultValues.chromaOffset
        });
        
        setNoiseControls({
          hasNoise: defaultValues.hasNoise,
          noiseOpacity: defaultValues.noiseOpacity
        });
        
        setPixelationControls({
          hasPixelation: defaultValues.hasPixelation,
          pixelGranularity: defaultValues.pixelGranularity
        });
        
        setSsaoControls({
          hasSSAO: defaultValues.hasSSAO,
          ssaoIntensity: defaultValues.ssaoIntensity,
          ssaoRadius: defaultValues.ssaoRadius,
          ssaoLumInfluence: defaultValues.ssaoLumInfluence
        });
        
        setBlurControls({
          hasBlur: defaultValues.hasBlur,
          kawaseIterations: defaultValues.kawaseIterations,
          kawaseScale: defaultValues.kawaseScale
        });
        
        setOutlineControls({
          hasOutline: defaultValues.hasOutline,
          outlineEdgeStrength: defaultValues.outlineEdgeStrength,
          outlineVisibleEdgeColor: defaultValues.outlineVisibleEdgeColor,
          outlineHiddenEdgeColor: defaultValues.outlineHiddenEdgeColor
        });
        
        setGlitchControls({
          hasGlitch: defaultValues.hasGlitch,
          glitchMode: defaultValues.glitchMode,
          glitchCustomPattern: defaultValues.glitchCustomPattern,
          glitchDelayMin: defaultValues.glitchDelayMin,
          glitchDelayMax: defaultValues.glitchDelayMax,
          glitchDurationMin: defaultValues.glitchDurationMin,
          glitchDurationMax: defaultValues.glitchDurationMax,
          glitchWeakGlitches: defaultValues.glitchWeakGlitches,
          glitchStrongGlitches: defaultValues.glitchStrongGlitches,
          glitchRatio: defaultValues.glitchRatio,
          glitchColumns: defaultValues.glitchColumns,
          glitchDtSize: defaultValues.glitchDtSize
        });
        
        setGridControls({
          hasGrid: defaultValues.hasGrid,
          gridScale: defaultValues.gridScale,
          gridSize: defaultValues.gridSize,
          gridLineWidth: defaultValues.gridLineWidth,
          gridFadeDistance: defaultValues.gridFadeDistance
        });
        
        setGodRaysControls({
          hasGodRays: defaultValues.hasGodRays,
          godRaysDensity: defaultValues.godRaysDensity,
          godRaysWeight: defaultValues.godRaysWeight,
          godRaysDecay: defaultValues.godRaysDecay,
          godRaysExposure: defaultValues.godRaysExposure
        });
        
        console.log("Effets réinitialisés aux valeurs par défaut");
      } catch (error) {
        console.error("Erreur lors de la réinitialisation des effets:", error);
      }
    }, { label: "Restaurer défauts" })
  }), { collapsed: false });
  
  // Configuration des contrôles Leva pour Bloom
  const [bloomControls, setBloomControls] = useControls("Bloom", () => ({
    hasBloom: {
      value: defaultValues.hasBloom,
      label: "Activer"
    },
    bloomIntensity: {
      value: defaultValues.bloomIntensity,
      min: 0,
      max: 2,
      step: 0.05,
      label: "Intensité"
    },
    bloomLuminanceThreshold: {
      value: defaultValues.bloomLuminanceThreshold,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Seuil de luminance"
    },
    bloomLuminanceSmoothing: {
      value: defaultValues.bloomLuminanceSmoothing,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Lissage de luminance"
    },
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Tone Mapping
  const [toneMappingControls, setToneMappingControls] = useControls("Tone Mapping", () => ({
    hasToneMapping: {
      value: defaultValues.hasToneMapping,
      label: "Activer"
    },
    toneMapping: {
      options: {
        "None": THREE.NoToneMapping,
        "Linear": THREE.LinearToneMapping,
        "Reinhard": THREE.ReinhardToneMapping,
        "Cineon": THREE.CineonToneMapping,
        "ACES": THREE.ACESFilmicToneMapping,
      },
      value: defaultValues.toneMapping,
      label: "Mode"
    },
    toneMappingExposure: {
      value: defaultValues.toneMappingExposure,
      min: 0,
      max: 2,
      step: 0.01,
      label: "Exposition"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Depth of Field
  const [dofControls, setDofControls] = useControls("Depth of Field", () => ({
    hasDepthOfField: {
      value: defaultValues.hasDepthOfField,
      label: "Activer"
    },
    focusDistance: {
      value: defaultValues.focusDistance,
      min: 0,
      max: 50,
      step: 0.1,
      label: "Distance de focus",
    },
    focusRange: {
      value: defaultValues.focusRange,
      min: 0,
      max: 100,
      step: 1,
      label: "Plage de focus",
    },
    focalLength: {
      value: defaultValues.focalLength,
      min: 0.1,
      max: 5,
      step: 0.1,
      label: "Longueur focale",
    },
    bokehScale: {
      value: defaultValues.bokehScale,
      min: 0,
      max: 20,
      step: 0.1,
      label: "Échelle du bokeh",
    },
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Vignette
  const [vignetteControls, setVignetteControls] = useControls("Vignette", () => ({
    hasVignette: {
      value: defaultValues.hasVignette,
      label: "Activer"
    },
    vignetteOffset: {
      value: defaultValues.vignetteOffset,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Décalage"
    },
    vignetteDarkness: {
      value: defaultValues.vignetteDarkness,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Intensité"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Chromatic Aberration
  const [chromaControls, setChromaControls] = useControls("Chromatic Aberration", () => ({
    hasChroma: {
      value: defaultValues.hasChroma,
      label: "Activer"
    },
    chromaOffset: {
      value: defaultValues.chromaOffset,
      min: 0,
      max: 0.02,
      step: 0.001,
      label: "Intensité"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Noise
  const [noiseControls, setNoiseControls] = useControls("Noise", () => ({
    hasNoise: {
      value: defaultValues.hasNoise,
      label: "Activer"
    },
    noiseOpacity: {
      value: defaultValues.noiseOpacity,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Opacité"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Pixelation
  const [pixelationControls, setPixelationControls] = useControls("Pixelation", () => ({
    hasPixelation: {
      value: defaultValues.hasPixelation,
      label: "Activer"
    },
    pixelGranularity: {
      value: defaultValues.pixelGranularity,
      min: 1,
      max: 20,
      step: 1,
      label: "Granularité"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour SSAO
  const [ssaoControls, setSsaoControls] = useControls("SSAO (unsupported / NormalPass)", () => ({
    hasSSAO: {
      value: defaultValues.hasSSAO,
      label: "Activer"
    },
    ssaoIntensity: {
      value: defaultValues.ssaoIntensity,
      min: 0,
      max: 10,
      step: 0.1,
      label: "Intensité"
    },
    ssaoRadius: {
      value: defaultValues.ssaoRadius,
      min: 0,
      max: 50,
      step: 0.1,
      label: "Rayon"
    },
    ssaoLumInfluence: {
      value: defaultValues.ssaoLumInfluence,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Influence de luminance"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Blur
  const [blurControls, setBlurControls] = useControls("Blur (Kawase)", () => ({
    hasBlur: {
      value: defaultValues.hasBlur,
      label: "Activer"
    },
    kawaseIterations: {
      value: defaultValues.kawaseIterations,
      min: 1,
      max: 10,
      step: 1,
      label: "Itérations"
    },
    kawaseScale: {
      value: defaultValues.kawaseScale,
      min: 0.1,
      max: 1.0,
      step: 0.1,
      label: "Échelle"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Outline
  const [outlineControls, setOutlineControls] = useControls("Outline", () => ({
    hasOutline: {
      value: defaultValues.hasOutline,
      label: "Activer"
    },
    outlineEdgeStrength: {
      value: defaultValues.outlineEdgeStrength,
      min: 0,
      max: 10,
      step: 0.1,
      label: "Force des contours"
    },
    outlineVisibleEdgeColor: {
      value: defaultValues.outlineVisibleEdgeColor,
      label: "Couleur visible"
    },
    outlineHiddenEdgeColor: {
      value: defaultValues.outlineHiddenEdgeColor,
      label: "Couleur cachée"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Glitch
  const [glitchControls, setGlitchControls] = useControls("Glitch", () => ({
    hasGlitch: {
      value: defaultValues.hasGlitch,
      label: "Activer"
    },
    glitchMode: {
      options: {
        "Wild": 0,
        "Chronique": 1
      },
      value: defaultValues.glitchMode,
      label: "Mode"
    },
    glitchCustomPattern: {
      value: defaultValues.glitchCustomPattern,
      label: "Motif personnalisé"
    },
    glitchDelayMin: {
      value: defaultValues.glitchDelayMin,
      min: 0,
      max: 10,
      step: 0.1,
      label: "Délai min (s)"
    },
    glitchDelayMax: {
      value: defaultValues.glitchDelayMax,
      min: 0,
      max: 10,
      step: 0.1,
      label: "Délai max (s)"
    },
    glitchDurationMin: {
      value: defaultValues.glitchDurationMin,
      min: 0,
      max: 2,
      step: 0.1,
      label: "Durée min (s)"
    },
    glitchDurationMax: {
      value: defaultValues.glitchDurationMax,
      min: 0,
      max: 5,
      step: 0.1,
      label: "Durée max (s)"
    },
    glitchWeakGlitches: {
      value: defaultValues.glitchWeakGlitches,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Glitches faibles"
    },
    glitchStrongGlitches: {
      value: defaultValues.glitchStrongGlitches,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Glitches forts"
    },
    glitchRatio: {
      value: defaultValues.glitchRatio,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Ratio"
    },
    glitchColumns: {
      value: defaultValues.glitchColumns,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: "Colonnes"
    },
    glitchDtSize: {
      value: defaultValues.glitchDtSize,
      min: 8,
      max: 256,
      step: 8,
      label: "Taille DT"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Grid
  const [gridControls, setGridControls] = useControls("Grid", () => ({
    hasGrid: {
      value: defaultValues.hasGrid,
      label: "Activer"
    },
    gridScale: {
      value: defaultValues.gridScale,
      min: 0.1,
      max: 10,
      step: 0.1,
      label: "Échelle"
    },
    gridSize: {
      value: defaultValues.gridSize,
      min: 1,
      max: 50,
      step: 1,
      label: "Taille"
    },
    gridLineWidth: {
      value: defaultValues.gridLineWidth,
      min: 0.01,
      max: 0.2,
      step: 0.01,
      label: "Épaisseur des lignes"
    },
    gridFadeDistance: {
      value: defaultValues.gridFadeDistance,
      min: 10,
      max: 500,
      step: 10,
      label: "Distance de fondu"
    }
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour God Rays
  const [godRaysControls, setGodRaysControls] = useControls("God Rays", () => ({
    hasGodRays: {
      value: defaultValues.hasGodRays,
      label: "Activer"
    },
    godRaysDensity: {
      value: defaultValues.godRaysDensity,
      min: 0.1,
      max: 1,
      step: 0.01,
      label: "Densité"
    },
    godRaysWeight: {
      value: defaultValues.godRaysWeight,
      min: 0.1,
      max: 1,
      step: 0.01,
      label: "Poids"
    },
    godRaysDecay: {
      value: defaultValues.godRaysDecay,
      min: 0.5,
      max: 1,
      step: 0.01,
      label: "Décroissance"
    },
    godRaysExposure: {
      value: defaultValues.godRaysExposure,
      min: 0.1,
      max: 1,
      step: 0.01,
      label: "Exposition"
    }
  }), { collapsed: true });

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
        {generalControls.debug && <Stats />}
        <color attach="background" args={[generalControls.backgroundColor]} />

        <AdvancedCameraController config={generalControls.cameraConfig} />

        {/* Éclairage */}
        <ambientLight intensity={1.2} />

        {/* Afficher le graphe si les données sont disponibles et valides */}
        {generalControls.hasGraph && graphData && graphData.nodes && graphData.links && (
          <Graph data={graphData} />
        )}
        {generalControls.hasPosts && postsData && <Posts data={postsData} />}

        <EffectComposer normalPass={true}>
          {/* Nouveaux effets ajoutés */}
          {gridControls.hasGrid && (
            <Grid
              scale={gridControls.gridScale}
              size={gridControls.gridSize}
              lineWidth={gridControls.gridLineWidth}
              fadeDistance={gridControls.gridFadeDistance}
            />
          )}
          
          {outlineControls.hasOutline && (
            <Outline
              selection={[]} // Sélection des mailles pour le contour
              edgeStrength={outlineControls.outlineEdgeStrength}
              visibleEdgeColor={outlineControls.outlineVisibleEdgeColor}
              hiddenEdgeColor={outlineControls.outlineHiddenEdgeColor}
              blur
            />
          )}
          
          {glitchControls.hasGlitch && (
            <Glitch
              delay={new THREE.Vector2(glitchControls.glitchDelayMin, glitchControls.glitchDelayMax)}
              duration={new THREE.Vector2(glitchControls.glitchDurationMin, glitchControls.glitchDurationMax)}
              strength={new THREE.Vector2(glitchControls.glitchWeakGlitches, glitchControls.glitchStrongGlitches)}
              mode={glitchControls.glitchMode}
              active={true}
              ratio={glitchControls.glitchRatio}
              dtSize={glitchControls.glitchDtSize}
              columns={glitchControls.glitchColumns}
              custom={glitchControls.glitchCustomPattern}
            />
          )}
          
          {blurControls.hasBlur && (
            <primitive 
              object={new KawaseBlurPass({
                iterations: blurControls.kawaseIterations,
                scale: blurControls.kawaseScale
              })}
            />
          )}
          
          {/* Effets originaux */}
          {ssaoControls.hasSSAO && (
            <SSAO
              intensity={ssaoControls.ssaoIntensity}
              radius={ssaoControls.ssaoRadius}
              luminanceInfluence={ssaoControls.ssaoLumInfluence}
            />
          )}
          
          {toneMappingControls.hasToneMapping && (
            <ToneMapping
              mode={toneMappingControls.toneMapping}
              exposure={toneMappingControls.toneMappingExposure}
            />
          )}
          
          {bloomControls.hasBloom && (
            <Bloom
              intensity={bloomControls.bloomIntensity}
              luminanceThreshold={bloomControls.bloomLuminanceThreshold}
              luminanceSmoothing={bloomControls.bloomLuminanceSmoothing}
            />
          )}
          
          {dofControls.hasDepthOfField && (
            <DepthOfField
              focusDistance={dofControls.focusDistance}
              focusRange={dofControls.focusRange}
              focalLength={dofControls.focalLength}
              bokehScale={dofControls.bokehScale}
            />
          )}
          
          {vignetteControls.hasVignette && (
            <Vignette
              offset={vignetteControls.vignetteOffset}
              darkness={vignetteControls.vignetteDarkness}
              blendFunction={BlendFunction.NORMAL}
            />
          )}
          
          {chromaControls.hasChroma && (
            <ChromaticAberration
              offset={new THREE.Vector2(chromaControls.chromaOffset, chromaControls.chromaOffset)}
            />
          )}
          
          {noiseControls.hasNoise && (
            <Noise
              opacity={noiseControls.noiseOpacity}
              blendFunction={BlendFunction.OVERLAY}
            />
          )}
          
          {pixelationControls.hasPixelation && (
            <Pixelation
              granularity={pixelationControls.pixelGranularity}
            />
          )}
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default HomePage;
