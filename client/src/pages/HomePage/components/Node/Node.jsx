import React, { useRef, useState, useEffect } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { useSpring, animated, config } from "@react-spring/three";
import NodeLabel from "./components/NodeLabel";

// Composant pour afficher une sphère si aucune image SVG n'est disponible
const NodeSphere = ({ size, color, isSelected }) => {
  return (
    <>
      <sphereGeometry args={[size || 0.5, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.8}
        emissive={isSelected ? "#FFF" : "#FFF"}
        emissiveIntensity={0.5}
      />
    </>
  );
};

// Composant pour afficher un SVG chargé
const NodeSVG = ({ svgData, svgBounds, scale, isSelected, isPlatform }) => {
  if (!svgData || !svgBounds) return null;

  const SvgContent = () => (
    <group scale={[scale, scale, scale]}>
      {svgData.paths.map((path, i) => (
        <group
          key={i}
          // Properly center the SVG on the node
          position={[
            -svgBounds.centerX,
            svgBounds.centerY, // Invert Y position for correct centering
            0,
          ]}
        >
          {path.subPaths.map((subPath, j) => {
            // Create a line for each subpath
            const points = subPath.getPoints();
            return (
              <line key={`${i}-${j}`}>
                <bufferGeometry attach="geometry">
                  <bufferAttribute
                    attach="attributes-position"
                    count={points.length}
                    array={
                      new Float32Array(
                        points.flatMap((p) => [p.x, -p.y, 0]) // Invert Y axis
                      )
                    }
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial
                  attach="material"
                  color={isSelected ? "#ff9500" : "#FFFFFF"}
                  linewidth={2}
                  linecap="round"
                  linejoin="round"
                />
              </line>
            );
          })}
        </group>
      ))}
    </group>
  );

  // Utiliser Billboard uniquement pour les nœuds qui ne sont pas des plateformes
  return isPlatform ? (
    <group>
      <SvgContent />
    </group>
  ) : (
    <Billboard>
      <SvgContent />
    </Billboard>
  );
};

// Fonction utilitaire pour calculer les limites d'un SVG
const calculateSVGBounds = (paths) => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  paths.forEach((path) => {
    path.subPaths.forEach((subPath) => {
      const points = subPath.getPoints();
      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
    });
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

// Hook personnalisé pour vérifier et charger un SVG
const useSVGLoader = (node) => {
  const [useImage, setUseImage] = useState(false);
  const [svgData, setSvgData] = useState(null);
  const [svgBounds, setSvgBounds] = useState(null);

  useEffect(() => {
    const checkSvgExists = async () => {
      if (!node) {
        setUseImage(false);
        return;
      }

      console.log(node.name.toLowerCase());

      // Déterminer le nom du fichier SVG en fonction du type de nœud
      let svgFileName;
      if (node.type === "central") {
        svgFileName = "joshua-goldberg";
      } else if (node.name.toLowerCase().includes("fbi")) {
        svgFileName = "fbi";
      } else if (node.type === "character" && node.isJoshua === false) {
        svgFileName = "journalist";
      } else if (node.type === "character" && node.isJoshua === true) {
        svgFileName = "character";
      } else {
        svgFileName = node.name;
      }

      try {
        // Chemin du SVG à charger
        const svgPath = `/img/${svgFileName}.svg`;

        // Try to fetch the SVG
        const response = await fetch(svgPath);
        if (response.ok) {
          // Load the SVG only if response is successful
          const loader = new SVGLoader();
          const svgText = await response.text();

          try {
            const data = loader.parse(svgText);

            // Verify that we have valid paths in the SVG data
            if (data.paths && data.paths.length > 0) {
              setUseImage(true);
              setSvgData(data);
              setSvgBounds(calculateSVGBounds(data.paths));
            } else {
              setUseImage(false);
            }
          } catch (parseError) {
            setUseImage(false);
          }
        } else {
          console.log();
          setUseImage(false);
        }
      } catch (error) {
        setUseImage(false);
      }
    };

    checkSvgExists();
  }, [node]);

  return { useImage, svgData, svgBounds };
};

// Composant principal Node qui utilise tous les sous-composants
const Node = ({ node, onClick, isSelected }) => {
  const meshRef = useRef();
  const [isActive, setIsActive] = useState(false);
  const { camera } = useThree();

  // Animation spring pour la position
  const { position } = useSpring({
    from: { position: [0, 0, 0] },
    to: { position: [node.x, node.y, node.z] },
    config: { mass: 1, tension: 120, friction: 100 }, // Configuration pour une animation lente et sans rebond
    delay: 300, // Léger délai pour un effet cascade
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
  const nodeScale = isActive ? 1.75 : 1.0;
  const nodeSize = baseSize * nodeScale;

  const svgScale = nodeSize * 0.02;

  // Gestionnaires d'événements pour les interactions
  const handleClick = (e) => {
    e.stopPropagation();
    onClick && onClick(node);
  };

  // Créer un vecteur de position pour le nœud (pour le composant NodeLabel)
  const nodePosition = new THREE.Vector3(node.x, node.y, node.z);

  return (
    <animated.mesh
      ref={meshRef}
      position={position}
      onClick={handleClick}
      scale={[nodeScale, nodeScale, nodeScale]}
    >
      {!useImage ? (
        // Afficher une sphère si pas d'image SVG
        <NodeSphere size={baseSize} color={nodeColor} isSelected={isSelected} />
      ) : (
        // Afficher l'image SVG si disponible
        <NodeSVG
          svgData={svgData}
          svgBounds={svgBounds}
          scale={svgScale / nodeScale} // Ajuster l'échelle pour compenser le scale du mesh parent
          isSelected={isSelected}
          isPlatform={isPlatform}
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
  );
};

export default Node;
