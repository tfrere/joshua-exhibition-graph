import React from "react";
import { Billboard } from "@react-three/drei";

// Composant pour afficher un SVG chargé
const NodeSVG = ({
  svgData,
  svgBounds,
  scale,
  isSelected,
  isPlatform,
  node,
}) => {
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
                  linewidth={60}
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

  // Vérifier si le nœud est une plateforme ou de type central (Joshua)
  const shouldBeFixed = isPlatform || (node && node.type === "central");

  // Utiliser Billboard uniquement pour les nœuds qui ne doivent pas être fixes
  return shouldBeFixed ? (
    <group>
      <SvgContent />
    </group>
  ) : (
    <Billboard>
      <SvgContent />
    </Billboard>
  );
};

export default NodeSVG;
