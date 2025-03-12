import React, { useState, useRef, useEffect } from "react";
import { Billboard, Text, PositionalAudio } from "@react-three/drei";
import * as THREE from "three";
import { useSpring, animated } from "@react-spring/three";
import useProximityCheck from "../hooks/useProximityCheck";

// Composant NodeLabel avec logique conditionnelle et audio positionnel
const NodeLabel = ({
  node,
  nodePosition,
  meshRef,
  baseSize,
  isSelected,
  isActive,
}) => {
  const [shouldPlaySound, setShouldPlaySound] = useState(false);
  const [audioFile, setAudioFile] = useState("/sounds/character-touch.mp3");
  const audioRef = useRef();

  // Utiliser le hook personnalisé pour vérifier si le nœud est proche du point de référence
  const isVisible = useProximityCheck({
    meshRef,
    objectPosition: nodePosition,
    threshold: 50,
    referenceOffset: 20,
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

  // Gestion de l'apparition/disparition du label et du son
  useEffect(() => {
    if (isVisible) {
      // Choisir aléatoirement entre les deux fichiers audio
      console.log(node);
      const randomSound =
        Math.random() < 0.5
          ? "/sounds/character-touch.mp3"
          : "/sounds/character-touch-2.mp3";
      setAudioFile(randomSound);
      setShouldPlaySound(true);
    } else {
      setShouldPlaySound(false);
    }
  }, [isVisible]);

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
          {/* Background plane for better text visibility */}
          {isActive && (
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[displayText.length * 0.25 + 0.3, 0.5]} />
              <animated.meshBasicMaterial
                color="#000000"
                transparent
                opacity={opacity.to((o) => o * 0.5)} // Lier l'opacité du fond à l'animation
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          {/* Text with improved visibility and animation */}
          <animated.group>
            <Text
              fontSize={2}
              font={"/fonts/caveat.ttf"}
              color={"#ffffff"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor="#000000"
              outlineBlur={0.2}
              position={[2, 5, 0]}
            >
              <animated.meshStandardMaterial
                attach="material"
                color={"#ffffff"}
                transparent
                opacity={opacity}
              />
              {displayText}
            </Text>
          </animated.group>
        </animated.group>
      </Billboard>
    </group>
  );
};

export default NodeLabel;
