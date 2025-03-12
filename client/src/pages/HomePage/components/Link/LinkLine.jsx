import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Composant pour la ligne du lien (trait plein ou pointillé)
const LinkLine = ({
  points,
  isDashed,
  linkColor,
  linkWidth,
  dashSize,
  gapSize,
  depth,
  opacity = 0.4, // Valeur par défaut si non fournie
}) => {
  const meshRef = useRef();

  // Create line geometry with line distances for dashed lines
  const lineGeometry = useMemo(() => {
    // Create a regular BufferGeometry from points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // For dashed lines, we need to add the LineDistances attribute
    if (isDashed) {
      // Calculate distances manually
      const distances = [];
      let cumulativeDistance = 0;

      for (let i = 0; i < points.length; i++) {
        if (i === 0) {
          distances.push(0);
        } else {
          // Add distance from previous point
          const distance = points[i].distanceTo(points[i - 1]);
          cumulativeDistance += distance;
          distances.push(cumulativeDistance);
        }
      }

      // Add LineDistances attribute to the geometry
      geometry.setAttribute(
        "lineDistance",
        new THREE.Float32BufferAttribute(distances, 1)
      );
    }

    return geometry;
  }, [points, isDashed]);

  // // Animation subtile
  // useFrame((state) => {
  //   if (meshRef.current) {
  //     const elapsedTime = state.clock.getElapsedTime();
  //     const initialDelay = 3; // 3 secondes
  //     const depthDelay = 0.6 * depth; // 300ms par depth

  //     if (elapsedTime < initialDelay + depthDelay) {
  //       meshRef.current.material.opacity = 0;
  //     } else {
  //       meshRef.current.material.opacity = THREE.MathUtils.lerp(
  //         0.6,
  //         1.0,
  //         (elapsedTime - initialDelay - depthDelay) / 1
  //       );
  //     }
  //   }
  // });

  return (
    <line ref={meshRef}>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      {isDashed ? (
        <lineDashedMaterial
          attach="material"
          color={linkColor}
          linewidth={linkWidth}
          transparent={true}
          opacity={opacity}
          dashSize={dashSize}
          gapSize={gapSize}
          scale={1} // Ajout d'un facteur de scale explicite
        />
      ) : (
        <lineBasicMaterial
          attach="material"
          color={linkColor}
          linewidth={linkWidth}
          transparent={true}
          opacity={opacity}
          linecap="round"
          linejoin="round"
        />
      )}
    </line>
  );
};

export default LinkLine;
