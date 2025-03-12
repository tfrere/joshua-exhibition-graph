import * as THREE from "three";
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
  ShockWave,
} from "@react-three/postprocessing";
import { BlendFunction, NormalPass, KawaseBlurPass } from "postprocessing";
import { useControls, button, folder } from "leva";
import { useState, useRef, useCallback } from "react";

// Valeurs par défaut pour tous les effets
const defaultValues = {
  // Bloom
  hasBloom: false,
  bloomIntensity: 1.0,
  bloomLuminanceThreshold: 0.2,
  bloomLuminanceSmoothing: 0.2,
  
  // Tone Mapping
  hasToneMapping: false,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
  
  // Depth of Field
  hasDepthOfField: false,
  focusDistance: 0,
  focalLength: 0.048,
  bokehScale: 2,
  opacity: 1,
  
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
  
  // ShockWave
  hasShockWave: false,
  shockWaveSize: 0.5,       // size
  shockWaveMaxRadius: 1.0,  // extent
  shockWaveWaveSize: 0.2,   // waveSize
  shockWaveAmplitude: 0.3,  // amplitude
};

const PostProcessingEffects = () => {
  // État pour déclencher l'effet ShockWave
  const [shockWaveTime, setShockWaveTime] = useState(0);
  const epicenterRef = useRef(new THREE.Vector3(0, 0, 0));

  // Fonction de déclenchement de l'onde de choc
  const triggerShockWave = useCallback(() => {
    setShockWaveTime(Date.now()); // Mettre à jour le timestamp pour déclencher l'effet
    console.log("Onde de choc déclenchée avec timestamp:", Date.now());
  }, []);

  // Configuration du bouton de réinitialisation en première position
  const resetControls = useControls("Post-Processing", () => ({
    "Réinitialiser": button(() => {
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
          focalLength: defaultValues.focalLength,
          bokehScale: defaultValues.bokehScale,
          opacity: defaultValues.opacity
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
        
        setShockWaveControls({
          hasShockWave: defaultValues.hasShockWave,
          shockWaveSize: defaultValues.shockWaveSize,
          shockWaveMaxRadius: defaultValues.shockWaveMaxRadius,
          shockWaveWaveSize: defaultValues.shockWaveWaveSize,
          shockWaveAmplitude: defaultValues.shockWaveAmplitude
        });
        
        console.log("Effets réinitialisés aux valeurs par défaut");
      } catch (error) {
        console.error("Erreur lors de la réinitialisation des effets:", error);
      }
    })
  }), { collapsed: false });
  
  // Configuration des contrôles Leva pour Depth of Field
  const [dofControls, setDofControls] = useControls("Post-Processing", () => ({
    "Depth of Field": folder({
      hasDepthOfField: {
        value: defaultValues.hasDepthOfField,
        label: "Activer"
      },
      focusDistance: {
        value: defaultValues.focusDistance,
        min: 0,
        max: 1,
        step: 0.001,
        label: "Distance de focus",
      },
      focalLength: {
        value: defaultValues.focalLength,
        min: 0,
        max: 1,
        step: 0.001,
        label: "Longueur focale",
      },
      bokehScale: {
        value: defaultValues.bokehScale,
        min: 0,
        max: 5,
        step: 0.001,
        label: "Échelle du bokeh",
      },
      opacity: {
        value: defaultValues.opacity,
        min: 0,
        max: 1,
        step: 0.01,
        label: "Opacité",
      }
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Bloom
  const [bloomControls, setBloomControls] = useControls("Post-Processing", () => ({
    "Bloom": folder({
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
      }
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Tone Mapping
  const [toneMappingControls, setToneMappingControls] = useControls("Post-Processing", () => ({
    "Tone Mapping": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Vignette
  const [vignetteControls, setVignetteControls] = useControls("Post-Processing", () => ({
    "Vignette": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Chromatic Aberration
  const [chromaControls, setChromaControls] = useControls("Post-Processing", () => ({
    "Chromatic Aberration": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Noise
  const [noiseControls, setNoiseControls] = useControls("Post-Processing", () => ({
    "Noise": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Pixelation
  const [pixelationControls, setPixelationControls] = useControls("Post-Processing", () => ({
    "Pixelation": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour SSAO
  const [ssaoControls, setSsaoControls] = useControls("Post-Processing", () => ({
    "SSAO": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Blur
  const [blurControls, setBlurControls] = useControls("Post-Processing", () => ({
    "Blur": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Outline
  const [outlineControls, setOutlineControls] = useControls("Post-Processing", () => ({
    "Outline": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Glitch
  const [glitchControls, setGlitchControls] = useControls("Post-Processing", () => ({
    "Glitch": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour Grid
  const [gridControls, setGridControls] = useControls("Post-Processing", () => ({
    "Grid": folder({
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
    })
  }), { collapsed: true });
  
  // Configuration des contrôles Leva pour God Rays
  const [godRaysControls, setGodRaysControls] = useControls("Post-Processing", () => ({
    "God Rays": folder({
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
    })
  }), { collapsed: true });

  // Configuration des contrôles Leva pour ShockWave
  const [shockWaveControls, setShockWaveControls] = useControls("Post-Processing", () => ({
    "ShockWave (broken)": folder({
      hasShockWave: {
        value: defaultValues.hasShockWave,
        label: "Activer"
      },
      shockWaveSize: {
        value: defaultValues.shockWaveSize,
        min: 0.1,
        max: 2.0,
        step: 0.05,
        label: "Size"
      },
      shockWaveMaxRadius: {
        value: defaultValues.shockWaveMaxRadius,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        label: "Extent"
      },
      shockWaveWaveSize: {
        value: defaultValues.shockWaveWaveSize,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        label: "Wave Size"
      },
      shockWaveAmplitude: {
        value: defaultValues.shockWaveAmplitude,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        label: "Amplitude"
      },
      explodeShockWave: button(() => {
        if (shockWaveControls.hasShockWave) {
          triggerShockWave();
        }
      }, { label: "Explode (E)" })
    })
  }), { collapsed: true });

  // Rendu de l'EffectComposer et de tous les effets activés
  return (
    <EffectComposer normalPass={true}>
      {/* Grid */}
      {gridControls.hasGrid && (
        <Grid
          scale={gridControls.gridScale}
          size={gridControls.gridSize}
          lineWidth={gridControls.gridLineWidth}
          fadeDistance={gridControls.gridFadeDistance}
        />
      )}
      
      {/* Outline */}
      {outlineControls.hasOutline && (
        <Outline
          selection={[]} // Sélection des mailles pour le contour
          edgeStrength={outlineControls.outlineEdgeStrength}
          visibleEdgeColor={outlineControls.outlineVisibleEdgeColor}
          hiddenEdgeColor={outlineControls.outlineHiddenEdgeColor}
          blur
        />
      )}
      
      {/* Glitch */}
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
      
      {/* Blur (Kawase) */}
      {blurControls.hasBlur && (
        <primitive 
          object={new KawaseBlurPass({
            iterations: blurControls.kawaseIterations,
            scale: blurControls.kawaseScale
          })}
        />
      )}
      
      {/* SSAO */}
      {ssaoControls.hasSSAO && (
        <SSAO
          intensity={ssaoControls.ssaoIntensity}
          radius={ssaoControls.ssaoRadius}
          luminanceInfluence={ssaoControls.ssaoLumInfluence}
        />
      )}
      
      {/* ToneMapping */}
      {toneMappingControls.hasToneMapping && (
        <ToneMapping
          mode={toneMappingControls.toneMapping}
          exposure={toneMappingControls.toneMappingExposure}
        />
      )}
      
      {/* Bloom */}
      {bloomControls.hasBloom && (
        <Bloom
          intensity={bloomControls.bloomIntensity}
          luminanceThreshold={bloomControls.bloomLuminanceThreshold}
          luminanceSmoothing={bloomControls.bloomLuminanceSmoothing}
        />
      )}
      
      {/* Depth of Field */}
      {dofControls.hasDepthOfField && (
        <DepthOfField
          focusDistance={dofControls.focusDistance}
          focalLength={dofControls.focalLength}
          bokehScale={dofControls.bokehScale}
          opacity={dofControls.opacity}
        />
      )}
      
      {/* Vignette */}
      {vignetteControls.hasVignette && (
        <Vignette
          offset={vignetteControls.vignetteOffset}
          darkness={vignetteControls.vignetteDarkness}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
      
      {/* Chromatic Aberration */}
      {chromaControls.hasChroma && (
        <ChromaticAberration
          offset={new THREE.Vector2(chromaControls.chromaOffset, chromaControls.chromaOffset)}
        />
      )}
      
      {/* Noise */}
      {noiseControls.hasNoise && (
        <Noise
          opacity={noiseControls.noiseOpacity}
          blendFunction={BlendFunction.OVERLAY}
        />
      )}
      
      {/* Pixelation */}
      {pixelationControls.hasPixelation && (
        <Pixelation
          granularity={pixelationControls.pixelGranularity}
        />
      )}
      
      {/* ShockWave - onde de choc */}
      {shockWaveControls.hasShockWave && (
        <ShockWave
          key={`shockwave-${shockWaveTime}`} // Forcer la recréation du composant quand le timestamp change
          epicenter={epicenterRef.current}
          size={shockWaveControls.shockWaveSize}
          maxRadius={shockWaveControls.shockWaveMaxRadius}
          waveSize={shockWaveControls.shockWaveWaveSize}
          amplitude={shockWaveControls.shockWaveAmplitude}
          opacity={1.0}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
    </EffectComposer>
  );
};

export default PostProcessingEffects; 