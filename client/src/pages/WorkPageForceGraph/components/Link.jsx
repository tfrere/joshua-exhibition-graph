import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Link component for the 3D graph
const Link = ({ link, sourceNode, targetNode }) => {
  const meshRef = useRef();

  // Create line geometry between source and target nodes
  const points = useMemo(() => {
    // Create points for a curved line
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(
        (sourceNode.x + targetNode.x) / 2,
        (sourceNode.y + targetNode.y) / 2 + 0.5, // Add a slight curve upward
        (sourceNode.z + targetNode.z) / 2
      ),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
    );

    // Generate points along the curve
    return curve.getPoints(20);
  }, [sourceNode, targetNode]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  // Optional subtle animation
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulse effect
      const t = state.clock.getElapsedTime();
      meshRef.current.material.opacity = THREE.MathUtils.lerp(
        0.4,
        0.8,
        (Math.sin(t * 2) + 1) / 2
      );
    }
  });

  // Link color and properties based on link data
  const linkColor = link.color || "#FFF";
  const linkWidth = link.width || 2;

  return (
    <line ref={meshRef}>
      <bufferGeometry attach="geometry" {...lineGeometry} />
      <lineBasicMaterial
        attach="material"
        color={linkColor}
        linewidth={linkWidth}
        transparent={true}
        opacity={0.6}
        linecap="round"
        linejoin="round"
      />
    </line>
  );
};

export default Link;
