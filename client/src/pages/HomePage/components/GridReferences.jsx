import React from "react";
import { useThree } from "@react-three/fiber";

const GridReferences = ({
  rotationInterval = 15,
  maxRotation = 360,
  circleRadii = [50, 100, 150, 200, 250],
  color = "#FFF",
  opacity = 0.4,
}) => {
  // Calculate how many grid planes to create based on rotation interval
  const planeCount = Math.floor(maxRotation / rotationInterval);

  // Create an array to hold all rotations
  const rotations = Array.from(
    { length: planeCount },
    (_, i) => i * rotationInterval
  );

  return (
    <group>
      {/* Render each rotated grid plane */}
      {rotations.map((rotation, rotIndex) => (
        <group
          key={`plane-${rotIndex}`}
          rotation={[(rotation * Math.PI) / 180, 0, 0]}
        >
          {/* Draw circle references for each radius on the current plane */}
          {circleRadii.map((radius, index) => (
            <React.Fragment key={`circles-${rotIndex}-${index}`}>
              {/* XY plane circle (horizontal) */}
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={100}
                    array={
                      new Float32Array(
                        Array.from({ length: 100 }, (_, i) => {
                          const angle = (i / 100) * Math.PI * 2;
                          return [
                            Math.cos(angle) * radius,
                            Math.sin(angle) * radius,
                            0,
                          ];
                        }).flat()
                      )
                    }
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial
                  color={color}
                  transparent
                  opacity={opacity}
                />
              </line>
            </React.Fragment>
          ))}
        </group>
      ))}

      {/* Add reference circles in the YZ plane */}
      <group>
        {circleRadii.map((radius, index) => (
          <line key={`yz-${index}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={100}
                array={
                  new Float32Array(
                    Array.from({ length: 100 }, (_, i) => {
                      const angle = (i / 100) * Math.PI * 2;
                      return [
                        0,
                        Math.cos(angle) * radius,
                        Math.sin(angle) * radius,
                      ];
                    }).flat()
                  )
                }
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={color} transparent opacity={opacity} />
          </line>
        ))}
      </group>

      {/* Add reference circles in the ZX plane */}
      <group>
        {circleRadii.map((radius, index) => (
          <line key={`zx-${index}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={100}
                array={
                  new Float32Array(
                    Array.from({ length: 100 }, (_, i) => {
                      const angle = (i / 100) * Math.PI * 2;
                      return [
                        Math.sin(angle) * radius,
                        0,
                        Math.cos(angle) * radius,
                      ];
                    }).flat()
                  )
                }
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={color} transparent opacity={opacity} />
          </line>
        ))}
      </group>
    </group>
  );
};

export default GridReferences;
