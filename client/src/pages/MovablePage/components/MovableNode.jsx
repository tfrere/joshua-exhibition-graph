import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { TransformControls, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

// Composant pour afficher une sphère si aucune image SVG n'est disponible
const NodeSphere = ({
  size,
  color,
  isSelected,
  isMultiSelected,
  isActiveNode,
  transparent = false,
}) => {
  // Déterminer la couleur en fonction du statut de sélection
  let sphereColor;

  if (isActiveNode) {
    // Le nœud actif (avec TransformControls) est orange vif
    sphereColor = "#ff9500";
  } else if (isMultiSelected) {
    // Les nœuds en multi-sélection (mais pas actifs) sont violet
    sphereColor = "#9900ff";
  } else if (isSelected) {
    // Les nœuds simplement sélectionnés sont jaunes
    sphereColor = "#ffcc00";
  } else {
    // Les nœuds non sélectionnés utilisent la couleur par défaut
    sphereColor = color;
  }

  // Intensité de l'émission pour renforcer la visibilité
  const emissiveIntensity = isSelected || isActiveNode ? 0.6 : 0.3;

  return (
    <>
      <sphereGeometry args={[size * 3 || 0.5, 32, 32]} />
      <meshStandardMaterial
        color={sphereColor}
        roughness={0.3}
        metalness={0.8}
        emissive={isSelected || isActiveNode ? sphereColor : "#FFF"}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={transparent ? 0.3 : 1.0}
      />
    </>
  );
};

// Composant pour afficher un SVG chargé
const NodeSVG = ({
  svgData,
  svgBounds,
  scale,
  isSelected,
  isMultiSelected,
  isActiveNode,
}) => {
  if (!svgData || !svgBounds) return null;

  // Déterminer la couleur des lignes du SVG selon l'état de sélection
  let strokeColor;
  if (isActiveNode) {
    strokeColor = "#ff9500"; // Orange pour le nœud actif
  } else if (isMultiSelected) {
    strokeColor = "#9900ff"; // Violet pour les nœuds en multi-sélection
  } else if (isSelected) {
    strokeColor = "#ffcc00"; // Jaune pour les nœuds sélectionnés
  } else {
    strokeColor = "#FFFFFF"; // Blanc pour les nœuds non sélectionnés
  }

  return (
    <Billboard>
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
                    color={strokeColor}
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
    </Billboard>
  );
};

// Composant pour afficher un label/texte
const NodeLabel = ({
  text,
  size,
  isSelected,
  isActiveNode,
  isMultiSelected,
}) => {
  // Déterminer la couleur du texte selon l'état de sélection
  let textColor;
  if (isActiveNode) {
    textColor = "#ffa500"; // Orange pour le nœud actif
  } else if (isMultiSelected) {
    textColor = "#d699ff"; // Violet clair pour les nœuds en multi-sélection
  } else if (isSelected) {
    textColor = "#ffdd77"; // Jaune clair pour les nœuds sélectionnés
  } else {
    textColor = "#ffffff"; // Blanc pour les nœuds non sélectionnés
  }

  // Taille du texte légèrement plus grande pour les nœuds sélectionnés
  const fontSize = isSelected || isActiveNode ? 2.2 : 2;

  return (
    <group position={[0, size * 3 + 0.3, 0]}>
      <Billboard>
        <group>
          {/* Background plane for better text visibility */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[text.length * 0.25 + 0.3, 0.5]} />
            <meshBasicMaterial
              color="#000000"
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Text with improved visibility */}
          <Text
            fontSize={fontSize}
            color={textColor}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.2}
            outlineColor="#000000"
            outlineBlur={0.2}
            position={[0, 0, 0]}
          >
            {text}
          </Text>
        </group>
      </Billboard>
    </group>
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
const useSVGLoader = (nodeName) => {
  const [useImage, setUseImage] = useState(false);
  const [svgData, setSvgData] = useState(null);
  const [svgBounds, setSvgBounds] = useState(null);

  useEffect(() => {
    const checkSvgExists = async () => {
      if (!nodeName) {
        setUseImage(false);
        return;
      }

      try {
        // Chemin du SVG à charger
        const svgPath = `/img/${nodeName}.svg`;

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
              console.log(`SVG for ${nodeName} doesn't have valid paths`);
              setUseImage(false);
            }
          } catch (parseError) {
            console.log(`Error parsing SVG for ${nodeName}:`, parseError);
            setUseImage(false);
          }
        } else {
          console.log(
            `SVG not found for ${nodeName} (status: ${response.status})`
          );
          setUseImage(false);
        }
      } catch (error) {
        console.log(`Error fetching SVG for ${nodeName}:`, error);
        setUseImage(false);
      }
    };

    checkSvgExists();
  }, [nodeName]);

  return { useImage, svgData, svgBounds };
};

// Composant principal MovableNode qui utilise tous les sous-composants et permet la manipulation
const MovableNode = ({
  node,
  onClick,
  isSelected,
  isMultiSelected,
  isActiveNode,
  onPositionUpdate,
  onTransformStart,
  onTransformEnd,
  controlsRef,
}) => {
  const nodeRef = useRef();
  const transformRef = useRef();
  const [isActive, setIsActive] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformMode, setTransformMode] = useState("translate"); // translate, rotate, scale
  const { camera } = useThree();
  const [localPosition, setLocalPosition] = useState({
    x: node.x || 0,
    y: node.y || 0,
    z: node.z || 0,
  });

  // Activer le nœud lorsqu'il est sélectionné
  useEffect(() => {
    setIsActive(isSelected);
  }, [isSelected]);

  // Couleurs et propriétés visuelles
  const defaultColor = isSelected ? "#ff9500" : "#0088ff";
  const nodeColor =
    node.data && node.data.color ? node.data.color : defaultColor;

  // Adapter la taille si le nœud est actif
  const baseSize = node.size || 0.5;
  const nodeScale = isActive ? 1.75 : 1.0;
  const nodeSize = baseSize * nodeScale;

  // Charger le SVG si disponible
  const { useImage, svgData, svgBounds } = useSVGLoader(
    node.isJoshua ? "character" : node.name
  );

  const svgScale = nodeSize * 0.02;

  // Texte à afficher
  const displayText = node.label || node.name || "Node";

  // Gestionnaires d'événements pour les interactions
  const handleClick = (e) => {
    e.stopPropagation();

    // Ne pas déclencher le clic si on est en transformation
    if (!isTransforming) {
      // Passer l'état de la touche Shift au gestionnaire de clic parent
      onClick && onClick(node, e.shiftKey);
    }
  };

  // Gestionnaire pour les événements de TransformControls
  const handleTransformStart = () => {
    setIsTransforming(true);

    // Signaler le début de la transformation
    onTransformStart && onTransformStart();
  };

  const handleTransformEnd = () => {
    setIsTransforming(false);

    // Signaler la fin de la transformation
    onTransformEnd && onTransformEnd();

    // Mettre à jour la position finale
    if (nodeRef.current) {
      const position = nodeRef.current.position;

      // Mettre à jour la position locale
      setLocalPosition({
        x: position.x,
        y: position.y,
        z: position.z,
      });

      // Appeler le callback de mise à jour
      onPositionUpdate &&
        onPositionUpdate({
          x: position.x,
          y: position.y,
          z: position.z,
        });

      console.log("Position finale après transformation:", position);
    }
  };

  // Écouter les événements de dragging du TransformControls
  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current;

      const handleDraggingChanged = (event) => {
        setIsTransforming(event.value);

        // Si la transformation est terminée, mettre à jour la position
        if (!event.value && nodeRef.current) {
          const position = nodeRef.current.position;

          // Appeler le callback de mise à jour
          onPositionUpdate &&
            onPositionUpdate({
              x: position.x,
              y: position.y,
              z: position.z,
            });
        }
      };

      // Écouter les changements pendant le déplacement pour mettre à jour les autres nœuds
      const handleObjectChange = () => {
        if (isTransforming && nodeRef.current) {
          const position = nodeRef.current.position;

          // Mettre à jour en temps réel pendant le déplacement
          onPositionUpdate &&
            onPositionUpdate({
              x: position.x,
              y: position.y,
              z: position.z,
            });
        }
      };

      controls.addEventListener("dragging-changed", handleDraggingChanged);
      controls.addEventListener("objectChange", handleObjectChange);

      return () => {
        controls.removeEventListener("dragging-changed", handleDraggingChanged);
        controls.removeEventListener("objectChange", handleObjectChange);
      };
    }
  }, [transformRef, isTransforming, onPositionUpdate]);

  // Définir la position initiale du nœud ou utiliser la position locale sauvegardée
  useEffect(() => {
    if (nodeRef.current) {
      // Si nous avons une position locale, l'utiliser
      nodeRef.current.position.set(
        localPosition.x,
        localPosition.y,
        localPosition.z
      );
    }
  }, [localPosition]);

  // Mettre à jour la position locale si la position du nœud change depuis l'extérieur
  useEffect(() => {
    if (
      node.x !== undefined &&
      node.y !== undefined &&
      node.z !== undefined &&
      (node.x !== localPosition.x ||
        node.y !== localPosition.y ||
        node.z !== localPosition.z)
    ) {
      setLocalPosition({
        x: node.x,
        y: node.y,
        z: node.z,
      });
    }
  }, [node.x, node.y, node.z]);

  // Hook pour visualiser les transformations
  useFrame(() => {
    if (nodeRef.current && isTransforming) {
      // Synchroniser la position pour que les liens suivent
      node.x = nodeRef.current.position.x;
      node.y = nodeRef.current.position.y;
      node.z = nodeRef.current.position.z;
    }
  });

  return (
    <>
      <mesh
        ref={nodeRef}
        onClick={handleClick}
        position={[localPosition.x, localPosition.y, localPosition.z]}
      >
        {/* Toujours afficher une sphère pour interagir, même si un SVG est présent */}
        <NodeSphere
          size={nodeSize * 0.7} // Taille augmentée pour faciliter l'interaction
          color={nodeColor}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          isActiveNode={isActiveNode}
          transparent={useImage && svgData}
        />

        {/* Afficher le SVG si disponible */}
        {useImage && svgData && (
          <NodeSVG
            svgData={svgData}
            svgBounds={svgBounds}
            scale={svgScale}
            isSelected={isSelected}
            isMultiSelected={isMultiSelected}
            isActiveNode={isActiveNode}
          />
        )}

        {/* Ajouter le label - toujours visible */}
        <NodeLabel
          text={displayText}
          size={nodeSize}
          isSelected={isSelected}
          isActiveNode={isActiveNode}
          isMultiSelected={isMultiSelected}
        />
      </mesh>

      {/* Ajouter TransformControls uniquement si c'est le nœud actif de la sélection */}
      {isActiveNode && (
        <TransformControls
          ref={transformRef}
          object={nodeRef}
          mode={transformMode}
          size={0.7}
          onMouseDown={handleTransformStart}
          onMouseUp={handleTransformEnd}
        />
      )}
    </>
  );
};

export default MovableNode;
