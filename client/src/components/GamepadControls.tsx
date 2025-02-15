import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3, Quaternion, Euler } from "three";

const DEADZONE = 0.15; // Pour éviter les mouvements involontaires
const MOVEMENT_SPEED = 15;
const ROTATION_SPEED = 0.02;

export function GamepadControls() {
  const { camera } = useThree();
  const moveDirection = useRef(new Vector3());
  const gamepadIndex = useRef<number | null>(null);
  const rotationQuaternion = useRef(new Quaternion());
  const tempVector = useRef(new Vector3());

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log("Manette connectée à l'index %d", e.gamepad.index);
      gamepadIndex.current = e.gamepad.index;
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log("Manette déconnectée de l'index %d", e.gamepad.index);
      if (gamepadIndex.current === e.gamepad.index) {
        gamepadIndex.current = null;
      }
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener(
        "gamepaddisconnected",
        handleGamepadDisconnected
      );
    };
  }, []);

  useFrame(() => {
    if (gamepadIndex.current === null) return;

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[gamepadIndex.current];
    if (!gamepad) return;

    // Left stick - Mouvement avant/arrière
    const forwardBackward =
      Math.abs(gamepad.axes[1]) > DEADZONE ? -gamepad.axes[1] : 0;

    // Right stick - Rotation vaisseau spatial
    const yawInput =
      Math.abs(gamepad.axes[2]) > DEADZONE ? -gamepad.axes[2] : 0; // Rotation gauche/droite
    const pitchInput =
      Math.abs(gamepad.axes[3]) > DEADZONE ? gamepad.axes[3] : 0; // Rotation haut/bas

    // Appliquer les rotations dans l'ordre correct pour un contrôle style vaisseau spatial
    if (yawInput !== 0) {
      // Rotation autour de l'axe Y (gauche/droite)
      rotationQuaternion.current.setFromAxisAngle(
        new Vector3(0, 1, 0),
        yawInput * ROTATION_SPEED
      );
      camera.quaternion.multiply(rotationQuaternion.current);
    }

    if (pitchInput !== 0) {
      // Rotation autour de l'axe X (haut/bas)
      // Utiliser le vecteur droit de la caméra pour la rotation en pitch
      tempVector.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      rotationQuaternion.current.setFromAxisAngle(
        tempVector.current,
        pitchInput * ROTATION_SPEED
      );
      camera.quaternion.multiply(rotationQuaternion.current);
    }

    // Calculer et appliquer le mouvement avant/arrière
    moveDirection.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(
      moveDirection.current,
      forwardBackward * MOVEMENT_SPEED
    );
  });

  return null;
}
