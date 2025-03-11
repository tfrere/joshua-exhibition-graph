import { useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Custom hook to check if an object is within a certain distance of a reference point
 * Returns a boolean indicating if the object is in proximity
 */
const useProximityCheck = ({
  meshRef,
  objectPosition,
  threshold = 50,
  referenceOffset = 20,
}) => {
  const [isInProximity, setIsInProximity] = useState(false);
  const { camera } = useThree();

  // Check object proximity based on distance from reference point
  useFrame(() => {
    // Get camera position
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    // Create reference point at specified offset in front of the camera on X axis
    const referencePoint = new THREE.Vector3(
      cameraPosition.x + referenceOffset,
      cameraPosition.y,
      cameraPosition.z
    );

    // Get object's world position
    const worldPosition = new THREE.Vector3();
    if (meshRef && meshRef.current) {
      meshRef.current.getWorldPosition(worldPosition);
    } else if (objectPosition) {
      worldPosition.copy(objectPosition);
    }

    // Calculate distance to reference point
    const distance = worldPosition.distanceTo(referencePoint);

    // Object is in proximity if distance is less than threshold
    const newProximityState = distance < threshold;

    // Update proximity state
    setIsInProximity(newProximityState);
  });

  return isInProximity;
};

export default useProximityCheck;
