import React, { useState, useRef, useEffect } from "react";
import { Billboard, Text, PositionalAudio } from "@react-three/drei";
import * as THREE from "three";
import { useSpring, animated } from "@react-spring/three";
import useProximityCheck from "../hooks/useProximityCheck";

// Composant NodeLabel avec logique conditionnelle et audio positionnel
const NodeLabel = ({ node, nodePosition, meshRef, baseSize, isActive }) => {
  const [shouldPlaySound, setShouldPlaySound] = useState(false);
  const [audioFile, setAudioFile] = useState("/sounds/character-touch.mp3");
  const audioRef = useRef();

  // Utiliser le hook personnalisé pour vérifier si le nœud est proche du point de référence
  const isVisible = useProximityCheck({
    meshRef,
    objectPosition: nodePosition,
    threshold: 50,
    referenceOffset: 20,
    vibrateOnProximity: false, // Activer la vibration pour tous les nœuds
    vibrationOptions: {
      duration: 100,
      // Des intensités différentes en fonction du type de nœud
      weakMagnitude: node.type === "character" ? 0.3 : 0.15,
      strongMagnitude: node.type === "character" ? 0.7 : 0.4,
    },
  });

  // Animation de fade in/fade out avec des paramètres améliorés pour une transition plus douce
  const { opacity, scale, positionY } = useSpring({
    opacity: isVisible ? 1 : 0,
    scale: isVisible ? 1 : 0.8,
    positionY: isVisible ? 0 : -0.2,
    from: { opacity: 0, scale: 0.8, positionY: -0.2 },
    config: {
      mass: 1.5,
      tension: 180,
      friction: 26,
      clamp: true,
    },
    delay: isVisible ? 100 : 0, // Léger délai à l'apparition
  });

  // Texte à afficher
  const displayText = node.label || node.name || "Node";

  // Type du node à afficher avec logique personnalisée
  let displayType = "";
  if (node.type === "character") {
    displayType = node.isJoshua === true ? "persona" : "victime";
  } else if (node.type === "central") {
    displayType = "troll";
  } else {
    displayType = node.type || "";
  }

  // Gestion de l'apparition/disparition du label et du son
  useEffect(() => {
    if (isVisible) {
      // Définir le son en fonction du type de nœud
      let soundToPlay;

      if (node.type === "character") {
        if (node.isJoshua === true) {
          // Son pour "persona"
          soundToPlay = "/sounds/persona.mp3";
        } else {
          // Son pour "victime"
          soundToPlay = "/sounds/victime.mp3";
        }
      } else if (node.type === "central") {
        // Son pour "protagoniste"
        soundToPlay = "/sounds/joshua.mp3";
      } else {
        // Son par défaut pour les autres types ou choix aléatoire
        soundToPlay =
          Math.random() < 0.5
            ? "/sounds/character-touch.mp3"
            : "/sounds/character-touch-2.mp3";
      }

      console.log(node);
      setAudioFile(soundToPlay);
      setShouldPlaySound(true);
    } else {
      setShouldPlaySound(false);
    }
  }, [isVisible, node]);

  // Jouer le son quand shouldPlaySound devient true
  useEffect(() => {
    if (shouldPlaySound && audioRef.current) {
      audioRef.current.play();
      // Réinitialiser l'état après avoir joué le son
      const timeout = setTimeout(() => {
        setShouldPlaySound(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [shouldPlaySound]);

  // Ne rien rendre si le label n'est pas visible pour des raisons de performance
  // Mais continuer à calculer l'animation pour une transition fluide
  if (!isVisible && opacity.get() === 0) return null;

  return (
    <group position={[0, baseSize + 0.3, 0]}>
      {/* Jouer le son lorsque le label devient visible */}
      {shouldPlaySound && (
        <PositionalAudio
          ref={audioRef}
          url={audioFile}
          distance={2}
          loop={false}
          volume={0.0005}
        />
      )}

      <Billboard>
        <animated.group opacity={opacity} scale={scale} position-y={positionY}>
          <animated.group>
            {/* Node name with custom font */}
            <Text
              fontSize={2}
              font={"/fonts/caveat.ttf"}
              color={"#ffffff"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor="#000000"
              outlineBlur={0.2}
              position={[0, 5.3, 0]}
            >
              <animated.meshStandardMaterial
                attach="material"
                color={"#ffffff"}
                transparent
                opacity={opacity}
              />
              {displayText}
            </Text>

            {/* Node type with standard font, smaller size */}
            {displayType && (
              <Text
                fontSize={0.5}
                color={"#cccccc"}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.1}
                outlineColor="#000000"
                outlineBlur={0.1}
                position={[0, 6.6, 0]}
              >
                <animated.meshStandardMaterial
                  attach="material"
                  color={"#cccccc"}
                  transparent
                  opacity={opacity}
                />
                {displayType}
              </Text>
            )}
          </animated.group>
        </animated.group>
      </Billboard>
    </group>
  );
};

export default NodeLabel;
