import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import * as THREE from "../../node_modules/@types/three";

// Types for posts
export interface Post {
  uid: number;
  character: string;
  timestamp: number;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
  color: string;
}

// Generate distinct colors for unique characters
function generateCharacterColors(posts: Post[]): Map<string, THREE.Color> {
  const uniqueCharacters = Array.from(
    new Set(posts.map((post) => post.character))
  );
  const colorMap = new Map<string, THREE.Color>();

  // Generate distinct colors using HSL for better visual separation
  uniqueCharacters.forEach((character, index) => {
    // Distribute hues evenly around the color wheel
    const hue = (index / uniqueCharacters.length) * 360;
    // Keep saturation and lightness high for vibrant colors
    const color = new THREE.Color().setHSL(hue / 360, 0.8, 0.6);
    colorMap.set(character, color);
  });

  return colorMap;
}

// Optimized component for rendering posts using Points (particle system)
export function PostsRenderer({ posts }: { posts: Post[] }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();

  // Create character to color mapping
  const characterColorMap = useMemo(() => {
    return generateCharacterColors(posts);
  }, [posts]);

  // Create geometry with all positions
  const pointsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    // Create position array for all points
    const positions = new Float32Array(posts.length * 3);
    const colors = new Float32Array(posts.length * 3);

    posts.forEach((post, i) => {
      const i3 = i * 3;
      positions[i3] = post.coordinates.x;
      positions[i3 + 1] = post.coordinates.y;
      positions[i3 + 2] = post.coordinates.z;

      // Use character-based color
      const color =
        characterColorMap.get(post.character) || new THREE.Color(0xffffff);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return geometry;
  }, [posts, characterColorMap]);

  // Create point material with size attenuation
  const pointsMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.5,
      sizeAttenuation: true, // Points get smaller with distance
      vertexColors: true, // Use colors from the geometry
      transparent: true,
      alphaTest: 0.5, // Remove pixel artifacts
      map: createPointTexture(), // Create circular point texture
    });
  }, []);

  // Make points rotate to face camera
  useFrame(() => {
    if (pointsRef.current) {
      // Nothing needed here as PointsMaterial automatically faces the camera
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={pointsGeometry}
      material={pointsMaterial}
    />
  );
}

// Function to create a circular texture for points
function createPointTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext("2d");
  if (context) {
    context.beginPath();
    context.arc(32, 32, 30, 0, 2 * Math.PI);
    context.closePath();
    context.fillStyle = "white";
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Alternative optimized renderer using billboards (sprite-like planes)
export function PostsRendererBillboards({ posts }: { posts: Post[] }) {
  const positions = useMemo(() => {
    return posts.map((post) => [
      post.coordinates.x,
      post.coordinates.y,
      post.coordinates.z,
    ]);
  }, [posts]);

  // Create character to color mapping
  const characterColorMap = useMemo(() => {
    return generateCharacterColors(posts);
  }, [posts]);

  // Get colors based on character
  const colors = useMemo(() => {
    return posts.map((post) => {
      return characterColorMap.get(post.character) || new THREE.Color(0xffffff);
    });
  }, [posts, characterColorMap]);

  return (
    <Instances limit={50000}>
      <planeGeometry args={[0.5, 0.5]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent={true} />
      {positions.map((pos, i) => (
        <Instance
          key={posts[i].uid}
          position={pos as [number, number, number]}
          color={colors[i]}
        >
          <BillboardFacer />
        </Instance>
      ))}
    </Instances>
  );
}

// Component to make an object always face the camera
function BillboardFacer() {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (ref.current) {
      ref.current.quaternion.copy(camera.quaternion);
    }
  });

  return <primitive ref={ref} object={new THREE.Object3D()} />;
}

// Component for frustum culling
export function FrustumCuller() {
  const { camera } = useThree();
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(() => {
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);
  });

  return null;
}
