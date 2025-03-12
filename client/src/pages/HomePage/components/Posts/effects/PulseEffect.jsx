import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard, PositionalAudio } from "@react-three/drei";

// Default constants for the animation
const DEFAULT_DURATION = 0.8; // seconds
const DEFAULT_COLOR = [1.0, 1.0, 1.0]; // Pure white
const DEFAULT_OPACITY_START = 0.1;
const DEFAULT_RINGS = 2;
const DEFAULT_MAX_SCALE = 3.0;
const DEFAULT_MIN_THICKNESS = 1; // Starting thickness (thin)
const DEFAULT_MAX_THICKNESS = 0.01; // Ending thickness (thicker)

// Array of available touch sound files
const TOUCH_SOUNDS = [
  "/sounds/touch-a.mp3",
  // "/sounds/touch-b.mp3",
  // "/sounds/touch-c.mp3",
  // "/sounds/touch-d.mp3",
];

/**
 * Component that creates a minimalist white pulsing effect
 *
 * @param {Object} props
 * @param {[number, number, number]} props.position - Position where the effect should appear
 * @param {number} [props.duration=0.8] - Duration of the animation in seconds
 * @param {number} [props.opacityStart=0.8] - Initial opacity of the effect
 * @param {number} [props.rings=1] - Number of rings to display
 * @param {number} [props.maxScale=3.0] - Maximum scale the effect will grow to
 * @param {number} [props.minThickness=0.01] - Starting thickness of the ring
 * @param {number} [props.maxThickness=0.15] - Maximum thickness the ring will grow to
 * @param {Function} [props.onComplete] - Callback when animation completes
 */
export function PulseEffect({
  position,
  duration = DEFAULT_DURATION,
  opacityStart = DEFAULT_OPACITY_START,
  rings = DEFAULT_RINGS,
  maxScale = DEFAULT_MAX_SCALE,
  minThickness = DEFAULT_MIN_THICKNESS,
  maxThickness = DEFAULT_MAX_THICKNESS,
  onComplete,
}) {
  // State to track animation completion
  const [isComplete, setIsComplete] = useState(false);

  // State to store the randomly selected sound
  const [soundUrl, setSoundUrl] = useState("");

  // Ref for audio
  const sound = useRef();

  // Ref for the group containing all effects
  const groupRef = useRef();

  // Create refs for rings
  const ringsRef = useRef(
    Array(rings)
      .fill()
      .map(() => ({
        ref: useRef(),
        material: useRef(),
        geometry: useRef(), // Add geometry ref to update thickness
      }))
  );

  // Animation progress tracker
  const timeRef = useRef(0);

  // Initialize effect
  useEffect(() => {
    // Reset state on new position
    setIsComplete(false);
    timeRef.current = 0;

    // Select a random sound from the array
    const randomSoundIndex = Math.floor(Math.random() * TOUCH_SOUNDS.length);
    const selectedSound = TOUCH_SOUNDS[randomSoundIndex];
    setSoundUrl(selectedSound);

    // Play sound (with a small delay to ensure the URL is set)
    setTimeout(() => {
      if (sound.current) {
        sound.current.play();
      }
    }, 10);

    // Return cleanup function
    return () => {
      if (sound.current) {
        sound.current.stop();
      }
    };
  }, [position]);

  // Animation update
  useFrame((_, delta) => {
    // Skip animation if complete
    if (isComplete) return;

    // Update time
    timeRef.current += delta;

    // Calculate overall progress (0 to 1)
    const progress = Math.min(1.0, timeRef.current / duration);

    // Update each ring
    ringsRef.current.forEach((ring, index) => {
      if (ring.ref.current && ring.material.current) {
        // Scale based on progress with easing
        const scale = easeOutQuart(progress) * maxScale;
        ring.ref.current.scale.set(scale, scale, 1);

        // Decreasing opacity as it expands
        const opacity = opacityStart * (1 - easeInQuad(progress));
        ring.material.current.opacity = opacity;

        // Calculate current thickness based on progress
        const currentThickness =
          minThickness + progress * (maxThickness - minThickness);

        // Calculate inner radius (from 0 to 1, where 1 is the outer edge)
        const innerRadius = 1.0 - currentThickness;

        // Update ring geometry with new thickness
        if (ring.ref.current.geometry) {
          // Dispose of old geometry to prevent memory leaks
          ring.ref.current.geometry.dispose();

          // Create new geometry with updated thickness
          ring.ref.current.geometry = new THREE.RingGeometry(
            innerRadius,
            1.0,
            32
          );
        }
      }
    });

    // Check for completion
    if (progress >= 1.0 && !isComplete) {
      setIsComplete(true);
      if (onComplete) onComplete();
    }
  });

  // Don't render if no position is provided
  if (!position) return null;

  // Easing functions for smoother animations
  function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
  }

  function easeInQuad(x) {
    return x * x;
  }

  return (
    <group position={[position[0], position[1], position[2]]} ref={groupRef}>
      {soundUrl && (
        <PositionalAudio
          ref={sound}
          url={soundUrl}
          distance={25}
          intensity={1.0}
          loop={false}
        />
      )}

      {/* Minimalist expanding rings */}
      {ringsRef.current.map((ring, index) => (
        <Billboard key={`pulse-ring-${index}`} follow={true}>
          <mesh ref={ring.ref} renderOrder={20 + index}>
            <ringGeometry
              args={[1.0 - minThickness, 1.0, 32]}
              ref={ring.geometry}
            />
            <meshBasicMaterial
              ref={ring.material}
              color={
                new THREE.Color(
                  DEFAULT_COLOR[0],
                  DEFAULT_COLOR[1],
                  DEFAULT_COLOR[2]
                )
              }
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

export default PulseEffect;
