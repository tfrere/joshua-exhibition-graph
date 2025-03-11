import React, { useState, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text, PositionalAudio } from "@react-three/drei";
import * as THREE from "three";
import { useSpring, animated, config } from "@react-spring/three";

// Composant NodeLabel avec logique conditionnelle et audio positionnel
const NodeLabel = ({
  node,
  nodePosition,
  meshRef,
  baseSize,
  isSelected,
  isActive,
}) => {
  const [isLabelVisible, setIsLabelVisible] = useState(false);
  const [shouldPlaySound, setShouldPlaySound] = useState(false);
  const [audioFile, setAudioFile] = useState("/sounds/character-touch.mp3");
  const audioRef = useRef();
  const { camera } = useThree();

  // Animation de fade in/fade out avec des paramètres améliorés pour une transition plus douce
  const { opacity, scale, positionY } = useSpring({
    opacity: isLabelVisible ? 1 : 0,
    scale: isLabelVisible ? 1 : 0.8,
    positionY: isLabelVisible ? 0 : -0.2,
    from: { opacity: 0, scale: 0.8, positionY: -0.2 },
    config: {
      mass: 1.5,
      tension: 180,
      friction: 26,
      clamp: true,
    },
    delay: isLabelVisible ? 100 : 0, // Léger délai à l'apparition
  });

  // Texte à afficher
  const displayText = node.label || node.name || "Node";

  // Vérifier la visibilité du label par rapport à la position de la caméra
  useFrame(() => {
    // Obtenir la position de la caméra
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    // Créer un point de référence à 20 unités devant la caméra sur l'axe X uniquement
    const referencePoint = new THREE.Vector3(
      cameraPosition.x + 20,
      cameraPosition.y,
      cameraPosition.z
    );

    // Récupérer la position mondiale du nœud
    const nodeWorldPosition = new THREE.Vector3();
    if (meshRef.current) {
      meshRef.current.getWorldPosition(nodeWorldPosition);
    } else {
      nodeWorldPosition.copy(nodePosition);
    }

    // Calculer la distance entre le nœud et le point de référence
    const distance = nodeWorldPosition.distanceTo(referencePoint);

    // Le label est visible si la distance est inférieure à 10 mètres
    const newLabelVisible = distance < 50;

    // Déclencher le son seulement si le label vient d'apparaître
    if (newLabelVisible && !isLabelVisible) {
      // Choisir aléatoirement entre les deux fichiers audio
      const randomSound =
        Math.random() < 0.5
          ? "/sounds/character-touch.mp3"
          : "/sounds/character-touch-2.mp3";
      setAudioFile(randomSound);
      setShouldPlaySound(true);
    } else if (!newLabelVisible && isLabelVisible) {
      setShouldPlaySound(false);
    }

    // Mettre à jour l'état de visibilité du label
    setIsLabelVisible(newLabelVisible);
  });

  // Jouer le son quand shouldPlaySound devient true
  useEffect(() => {
    if (shouldPlaySound && audioRef.current) {
      audioRef.current.play();
      // Réinitialiser l'état après avoir joué le son
      setTimeout(() => {
        setShouldPlaySound(false);
      }, 500);
    }
  }, [shouldPlaySound]);

  // Ne rien rendre si le label n'est pas visible pour des raisons de performance
  // Mais continuer à calculer l'animation pour une transition fluide
  if (!isLabelVisible && opacity.get() === 0) return null;

  return (
    <group position={[0, baseSize + 0.3, 0]}>
      {/* Jouer le son lorsque le label devient visible */}
      {shouldPlaySound && (
        <PositionalAudio
          ref={audioRef}
          url={audioFile}
          distance={5}
          loop={false}
          volume={0.2}
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
