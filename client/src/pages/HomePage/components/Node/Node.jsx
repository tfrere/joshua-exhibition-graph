import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useSpring, animated } from "@react-spring/three";
import NodeLabel from "./components/NodeLabel";
import NodeSVG from "./components/NodeSVG";
import NodeSphere from "./components/NodeSphere";
import useSVGLoader from "./hooks/useSVGLoader";
import useNodeProximitySync, {
  addEventListener,
  removeEventListener,
} from "./hooks/useNodeProximitySync";
import PulseEffect from "../Posts/effects/PulseEffect";

// Composant principal Node qui utilise tous les sous-composants
const Node = ({ node, onClick, isSelected }) => {
  const meshRef = useRef();
  const [isActive, setIsActive] = useState(false);
  const { camera } = useThree();

  // État pour les effets d'activation
  const [activationEffect, setActivationEffect] = useState(null);

  // Animation spring pour la position
  const { position } = useSpring({
    from: { position: [0, 0, 0] },
    to: { position: [node.x, node.y, node.z] },
    config: { mass: 1, tension: 120, friction: 100 }, // Configuration pour une animation lente et sans rebond
    delay: 300, // Léger délai pour un effet cascade
  });

  // Animation spring pour la mise à l'échelle
  const { scale } = useSpring({
    from: { scale: 1.0 },
    to: { scale: isActive ? 1.1 : 1.0 },
    config: { mass: 1, tension: 170, friction: 26 }, // Configuration pour une transition fluide
  });

  // Charger le SVG si disponible
  const { useImage, svgData, svgBounds } = useSVGLoader(node);

  // Vérifier si le nœud est une plateforme
  const isPlatform = node.type === "platform";

  // Couleurs et propriétés visuelles
  const defaultColor = isSelected ? "#ff9500" : "#0088ff";
  const nodeColor =
    node.data && node.data.color ? node.data.color : defaultColor;

  // Adapter la taille si le nœud est actif
  const baseSize = node.size || 0.5;
  // Même si nous utilisons une animation pour le scale,
  // nous gardons une référence à la valeur d'échelle actuelle pour d'autres calculs
  const currentScale = isActive ? 1.1 : 1.0;
  const nodeSize = baseSize;

  // Ajuster l'échelle SVG pour qu'elle reste proportionnelle même avec l'animation
  const svgScale = nodeSize * 0.02;

  // Utiliser notre hook pour détecter la proximité et synchroniser via socket
  const isInProximity = useNodeProximitySync({
    node: node,
    meshRef: meshRef,
    position: [node.x, node.y, node.z],
    threshold: 25, // Distance de proximité (ajuster selon les besoins)
  });

  // S'abonner aux événements de changement de nœud actif
  useEffect(() => {
    const handleNodeChanged = (data) => {
      const { node: activeNode, eventType } = data;

      // Si ce nœud est activé, créer un effet de pulse
      if (
        activeNode &&
        activeNode.id === node.id &&
        eventType === "activation"
      ) {
        setActivationEffect({
          id: `node-activation-${Date.now()}`,
          position: [node.x, node.y, node.z],
          timestamp: Date.now(),
        });
      }
    };

    // Ajouter l'écouteur d'événements
    addEventListener("activeNodeChanged", handleNodeChanged);

    return () => {
      // Nettoyage à la destruction du composant
      removeEventListener("activeNodeChanged", handleNodeChanged);
    };
  }, [node.id, node.x, node.y, node.z]);

  // Supprimer l'effet d'activation après un certain temps
  useEffect(() => {
    if (activationEffect) {
      const timeout = setTimeout(() => {
        setActivationEffect(null);
      }, 2000); // Durée totale en ms (ajuster selon les besoins)

      return () => clearTimeout(timeout);
    }
  }, [activationEffect]);

  // Mettre à jour l'état actif basé sur la proximité
  useEffect(() => {
    setIsActive(isInProximity);
  }, [isInProximity]);

  // Gestionnaires d'événements pour les interactions
  const handleClick = (e) => {
    e.stopPropagation();

    // N'activer que les nœuds de type "character"
    if (node && node.type !== "character") {
      console.log(
        `Node ${node.id} (${node.name}) is not a character node, ignoring click.`
      );
      return;
    }

    onClick && onClick(node);
  };

  // Créer un vecteur de position pour le nœud (pour le composant NodeLabel)
  const nodePosition = new THREE.Vector3(node.x, node.y, node.z);

  return (
    <>
      <animated.mesh
        ref={meshRef}
        position={position}
        onClick={handleClick}
        scale={scale.to((s) => [s, s, s])}
      >
        {!useImage ? (
          // Afficher une sphère si pas d'image SVG
          <NodeSphere
            size={baseSize}
            color={nodeColor}
            isSelected={isSelected}
          />
        ) : (
          // Afficher l'image SVG si disponible
          <NodeSVG
            svgData={svgData}
            svgBounds={svgBounds}
            scale={svgScale}
            isSelected={isSelected}
            isPlatform={isPlatform}
            node={node}
          />
        )}

        {/* Utiliser le composant NodeLabel externalisé avec la logique d'affichage conditionnelle */}
        <NodeLabel
          node={node}
          nodePosition={nodePosition}
          meshRef={meshRef}
          baseSize={baseSize}
          isActive={isActive}
        />
      </animated.mesh>

      {/* Effet d'activation - plus grand que celui des posts */}
      {activationEffect && (
        <PulseEffect
          key={activationEffect.id}
          position={activationEffect.position}
          sound={2}
          volume={0.5}
          duration={1.5} // Durée plus longue
          opacityStart={0.8} // Plus visible
          rings={1} // Plus d'anneaux
          maxScale={9.0} // Échelle bien plus grande que les posts
          minThickness={0.15}
          maxThickness={0.3} // Plus épais
          onComplete={() => console.log("Animation nœud terminée")}
        />
      )}
    </>
  );
};

export default Node;
