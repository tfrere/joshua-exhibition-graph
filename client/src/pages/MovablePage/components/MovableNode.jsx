import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { TransformControls, Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

// Composant pour afficher une sphère si aucune image SVG n'est disponible
const NodeSphere = ({ size, color, isSelected }) => {
  return (
    <>
      <sphereGeometry args={[size * 3 || 0.5, 32, 32]} />
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
const NodeSVG = ({ svgData, svgBounds, scale, isSelected }) => {
  if (!svgData || !svgBounds) return null;

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
    </Billboard>
  );
};

// Composant pour afficher un label/texte
const NodeLabel = ({ text, size, isSelected, isActive }) => {
  return (
    <group position={[0, size + 0.3, 0]}>
      <Billboard>
        <group>
          {/* Background plane for better text visibility */}
          {(isActive || isSelected) && (
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[text.length * 0.25 + 0.3, 0.5]} />
              <meshBasicMaterial
                color="#000000"
                transparent
                opacity={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          {/* Text with improved visibility */}
          {(isActive || isSelected) && (
            <Text
              fontSize={2}
              color={"#ffffff"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor="#000000"
              outlineBlur={0.2}
              position={[0, 0, 0]}
            >
              {text}
            </Text>
          )}
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
  onPositionUpdate,
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

  // Charger le SVG si disponible
  const { useImage, svgData, svgBounds } = useSVGLoader(
    node.isJoshua ? "character" : node.name
  );

  // Couleurs et propriétés visuelles
  const defaultColor = isSelected ? "#ff9500" : "#0088ff";
  const nodeColor =
    node.data && node.data.color ? node.data.color : defaultColor;

  // Adapter la taille si le nœud est actif
  const baseSize = node.size || 0.5;
  const nodeScale = isActive ? 1.75 : 1.0;
  const nodeSize = baseSize * nodeScale;

  const svgScale = nodeSize * 0.02;

  // Texte à afficher
  const displayText = node.label || node.name || "Node";

  // Gestionnaires d'événements pour les interactions
  const handleClick = (e) => {
    e.stopPropagation();

    // Quand l'utilisateur clique sur un nœud, activer les contrôles de transformation
    // mais ne pas déclencher l'onClick normal si on est en train de transformer
    if (!isTransforming) {
      onClick && onClick(node);
    }
  };

  // Gestionnaire pour les événements de TransformControls
  const handleTransformStart = () => {
    setIsTransforming(true);

    // Désactiver les contrôles de caméra pendant la transformation
    if (controlsRef && controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  };

  const handleTransformEnd = () => {
    setIsTransforming(false);

    // Réactiver les contrôles de caméra après la transformation
    if (controlsRef && controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    // Lire la position actuelle pour la mise à jour
    if (nodeRef.current) {
      const position = nodeRef.current.position;

      // Synchroniser la position avec l'objet node
      node.x = position.x;
      node.y = position.y;
      node.z = position.z;

      // Appeler le callback de mise à jour
      onPositionUpdate &&
        onPositionUpdate({
          x: position.x,
          y: position.y,
          z: position.z,
        });
    }
  };

  useEffect(() => {
    if (transformRef.current) {
      // Écouter les événements de TransformControls
      const controls = transformRef.current;

      const handleDraggingChanged = (event) => {
        setIsTransforming(event.value);

        // Désactiver/réactiver les contrôles de caméra
        if (controlsRef && controlsRef.current) {
          controlsRef.current.enabled = !event.value;
        }

        // Si la transformation est terminée, mettre à jour la position
        if (!event.value && nodeRef.current) {
          const position = nodeRef.current.position;

          // Mettre à jour la position locale
          setLocalPosition({
            x: position.x,
            y: position.y,
            z: position.z,
          });

          // Synchroniser la position avec l'objet node pour les liens
          node.x = position.x;
          node.y = position.y;
          node.z = position.z;

          // Appeler le callback de mise à jour
          onPositionUpdate &&
            onPositionUpdate({
              x: position.x,
              y: position.y,
              z: position.z,
            });
        }
      };

      controls.addEventListener("dragging-changed", handleDraggingChanged);

      return () => {
        controls.removeEventListener("dragging-changed", handleDraggingChanged);
      };
    }
  }, [transformRef.current, controlsRef, onPositionUpdate, node]);

  // Définir la position initiale du nœud ou utiliser la position locale sauvegardée
  useEffect(() => {
    if (nodeRef.current) {
      // Si la position a été modifiée localement, utiliser celle-ci
      if (
        localPosition.x !== node.x ||
        localPosition.y !== node.y ||
        localPosition.z !== node.z
      ) {
        nodeRef.current.position.set(
          localPosition.x,
          localPosition.y,
          localPosition.z
        );
      } else {
        // Sinon, utiliser la position du nœud original
        nodeRef.current.position.set(node.x || 0, node.y || 0, node.z || 0);
      }
    }
  }, [node.x, node.y, node.z, localPosition]);

  // Basculer entre les modes de transformation avec la touche Shift
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Shift" && isSelected) {
        // Changer de mode lorsqu'on appuie sur Shift
        setTransformMode((prevMode) => {
          if (prevMode === "translate") return "rotate";
          if (prevMode === "rotate") return "scale";
          return "translate";
        });

        // Logger le changement de mode pour l'utilisateur
        console.log(
          `Mode de transformation changé à: ${
            transformMode === "translate"
              ? "rotation"
              : transformMode === "rotate"
              ? "mise à l'échelle"
              : "translation"
          }`
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSelected, transformMode]);

  // Hook pour mettre à jour la position en temps réel pendant la transformation
  useFrame(() => {
    if (isTransforming && nodeRef.current) {
      // Mettre à jour la position de l'objet node directement pour les liens
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
        {/* Utiliser un SVG s'il est disponible, sinon utiliser une sphère */}
        {useImage && svgData ? (
          <NodeSVG
            svgData={svgData}
            svgBounds={svgBounds}
            scale={svgScale}
            isSelected={isSelected}
          />
        ) : (
          <NodeSphere
            size={nodeSize}
            color={nodeColor}
            isSelected={isSelected}
          />
        )}

        {/* Ajouter le label */}
        <NodeLabel
          text={displayText}
          size={nodeSize}
          isSelected={isSelected}
          isActive={isActive}
        />
      </mesh>

      {/* Ajouter TransformControls uniquement si le nœud est sélectionné */}
      {isSelected && (
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
