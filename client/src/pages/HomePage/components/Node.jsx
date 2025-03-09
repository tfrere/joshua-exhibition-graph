import React, { useRef, useState, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { activeNodeRef } from "./activeNodeRef";

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
          {isActive && (
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

          {/* Text with improved visibility - uniquement pour les nœuds actifs */}
          {true && (
            <Text
              fontSize={2}
              font={"/fonts/caveat.ttf"}
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

// Composant principal Node qui utilise tous les sous-composants
const Node = ({ node, onClick, isSelected }) => {
  const meshRef = useRef();
  const [isActive, setIsActive] = useState(false);

  // Charger le SVG si disponible
  const { useImage, svgData, svgBounds } = useSVGLoader(
    node.isJoshua ? "character" : node.name
  );

  // Vérifier si ce nœud est le nœud actif
  useFrame(() => {
    const shouldBeActive =
      activeNodeRef.current && activeNodeRef.current.id === node.id;
    if (shouldBeActive !== isActive) {
      setIsActive(shouldBeActive);
    }
  });

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
    onClick && onClick(node);
  };

  // Ajouter un log pour le débogage
  useEffect(() => {
    if (node.isJoshua) {
      console.log(
        `Nœud Joshua détecté: ${node.id}, utilisant l'image character.svg`
      );
    }
  }, [node]);

  return (
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z]}
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
        />
      )}

      {/* Afficher le label du nœud */}
      <NodeLabel
        text={displayText}
        size={baseSize}
        isSelected={isSelected}
        isActive={isActive}
      />
    </mesh>
  );
};

export default Node;
