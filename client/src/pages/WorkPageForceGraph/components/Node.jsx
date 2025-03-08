import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

// Node component for the 3D graph
const Node = ({ node, onClick, isSelected }) => {
  const meshRef = useRef();

  // Optional animation
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.005;
      meshRef.current.rotation.z += 0.005;
    }
  });

  // Use node color from data if available, otherwise use default
  const defaultColor = isSelected ? "#ff9500" : "#0088ff";
  const nodeColor =
    node.data && node.data.color ? node.data.color : defaultColor;
  const hoverColor = "#ff0088";

  return (
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        if (meshRef.current) {
          meshRef.current.material.color.set(hoverColor);
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "auto";
        if (meshRef.current) {
          meshRef.current.material.color.set(nodeColor);
        }
      }}
    >
      <sphereGeometry args={[node.size || 0.5, 32, 32]} />
      <meshStandardMaterial
        color={nodeColor}
        roughness={0.3}
        metalness={0.8}
        emissive={isSelected ? "#FFF" : "#FFF"}
        emissiveIntensity={0.5}
      />
      {/* Optional label that rotates to face the camera */}
      {node.label && (
        <group position={[0, node.size + 0.2, 0]}>
          <Billboard>
            <Text
              fontSize={0.2}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0]}
            >
              {node.label}
            </Text>
          </Billboard>
        </group>
      )}
    </mesh>
  );
};

export default Node;
