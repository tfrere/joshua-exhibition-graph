import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";

// Default constants for the animation
const DEFAULT_DURATION = 0.3; // seconds
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_START_SIZE = 0.2;
const DEFAULT_COLOR = [1.0, 1.0, 1.0]; // White color
const DEFAULT_OPACITY_START = 0.5;
const DEFAULT_RINGS = 2;
const DEFAULT_RING_DELAY = 0.01; // seconds between rings

/**
 * Component that creates an expanding ring effect at a specific position
 *
 * @param {Object} props
 * @param {[number, number, number]} props.position - Position where the effect should appear
 * @param {number} [props.duration=1.5] - Duration of the animation in seconds
 * @param {number} [props.maxSize=10] - Maximum size the ring will grow to
 * @param {number} [props.startSize=0.1] - Initial size of the ring
 * @param {[number, number, number]} [props.color=[1.0, 1.0, 1.0]] - RGB color of the ring
 * @param {number} [props.opacityStart=0.8] - Initial opacity of the ring
 * @param {number} [props.rings=1] - Number of rings to display
 * @param {number} [props.ringDelay=0.0] - Delay between ring animations
 * @param {Function} [props.onComplete] - Callback when all animations complete
 */
export function PostActivationEffect({
  position,
  duration = DEFAULT_DURATION,
  maxSize = DEFAULT_MAX_SIZE,
  startSize = DEFAULT_START_SIZE,
  color = DEFAULT_COLOR,
  opacityStart = DEFAULT_OPACITY_START,
  rings = DEFAULT_RINGS,
  ringDelay = DEFAULT_RING_DELAY,
  onComplete,
}) {
  // State to track if all rings have completed their animation
  const [isComplete, setIsComplete] = useState(false);

  // Create refs for each ring
  const ringsRef = useRef(
    Array(rings)
      .fill()
      .map(() => ({
        progress: 0,
        active: false,
        ref: useRef(),
        material: useRef(),
      }))
  );

  // Track overall animation time
  const timeRef = useRef(0);

  // Setup the staggered start of each ring
  useEffect(() => {
    ringsRef.current.forEach((ring, index) => {
      setTimeout(() => {
        ring.active = true;
      }, index * ringDelay * 1000);
    });

    // Reset completion state if reused
    setIsComplete(false);
    timeRef.current = 0;
  }, [position, ringDelay]);

  // Animation update
  useFrame((_, delta) => {
    // Update overall time
    timeRef.current += delta;

    // Count completed rings
    let completedRings = 0;

    // Update each ring
    ringsRef.current.forEach((ring, index) => {
      // Skip if not active yet
      if (!ring.active) return;

      // Calculate elapsed time for this ring
      const ringStartTime = index * ringDelay;
      const elapsed = timeRef.current - ringStartTime;

      // Skip if not started yet
      if (elapsed < 0) return;

      // Calculate progress (0 to 1)
      ring.progress = Math.min(1.0, elapsed / duration);

      if (ring.ref.current && ring.material.current) {
        // Update size with easing (cubic out for natural deceleration)
        const size =
          startSize + easeOutCubic(ring.progress) * (maxSize - startSize);
        ring.ref.current.scale.set(size, size, 1);

        // Update opacity - fade out with easing for smoother disappearance
        const opacity = opacityStart * (1 - easeInQuad(ring.progress));
        ring.material.current.opacity = opacity;
      }

      // Count if complete
      if (ring.progress >= 1.0) {
        completedRings++;
      }
    });

    // Check if all rings are complete
    if (completedRings === rings && !isComplete) {
      setIsComplete(true);
      if (onComplete) onComplete();
    }
  });

  // Don't render if no position is provided
  if (!position) return null;

  // Easing function (cubic out)
  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  // Easing function (quad in) for smoother fade out
  function easeInQuad(x) {
    return x * x;
  }

  return (
    <group position={[position[0], position[1], position[2]]}>
      {ringsRef.current.map((ring, index) => (
        <Billboard
          key={`ring-${index}`}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
        >
          <mesh
            ref={ring.ref}
            renderOrder={20} // Ensure it renders above other elements
          >
            <ringGeometry args={[0.98, 1.0, 64]} />
            <meshBasicMaterial
              ref={ring.material}
              color={new THREE.Color(color[0], color[1], color[2])}
              transparent={true}
              opacity={opacityStart}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

export default PostActivationEffect;
