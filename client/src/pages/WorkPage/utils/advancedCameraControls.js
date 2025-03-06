import { Vector3, Euler, Quaternion } from "three";

// Positions fixes pour l'oscillation de la caméra
export const CAMERA_POSITIONS = [
  { position: new Vector3(200, 100, 300), target: new Vector3(0, 0, 0) },
  { position: new Vector3(-200, 50, 150), target: new Vector3(50, 0, 0) },
  { position: new Vector3(0, 200, 100), target: new Vector3(0, 0, 0) },
  { position: new Vector3(150, -100, 200), target: new Vector3(0, 50, 0) },
];

// Configuration par défaut pour le mode vol
export const DEFAULT_FLIGHT_CONFIG = {
  maxSpeed: 500,
  acceleration: 300,
  deceleration: 0.95,
  rotationSpeed: 2.0,
  deadzone: 0.1,
};

// Modes de contrôle de caméra disponibles
export const CAMERA_MODES = {
  ORBIT: "orbit",
  FLIGHT: "flight",
};

// Hook pour gérer les entrées clavier pour le vol
export function useKeyboardFlightControls(onInput) {
  const keysPressed = {};

  const handleKeyDown = (event) => {
    keysPressed[event.code] = true;
    processKeys();
  };

  const handleKeyUp = (event) => {
    keysPressed[event.code] = false;
    processKeys();
  };

  const processKeys = () => {
    // Mouvement avant/arrière (Z/S)
    const thrust =
      (keysPressed["KeyW"] || keysPressed["ArrowUp"] ? 1 : 0) -
      (keysPressed["KeyS"] || keysPressed["ArrowDown"] ? 1 : 0);

    // Mouvement latéral (Q/D)
    const lateral =
      (keysPressed["KeyD"] || keysPressed["ArrowRight"] ? 1 : 0) -
      (keysPressed["KeyA"] || keysPressed["ArrowLeft"] ? 1 : 0);

    // Mouvement vertical (E/C)
    const upDown =
      (keysPressed["KeyE"] || keysPressed["Space"] ? 1 : 0) -
      (keysPressed["KeyC"] || keysPressed["ShiftLeft"] ? 1 : 0);

    // Rotation (Q/E pour le lacet, Z/S pour le tangage, A/D pour le roulis)
    const yaw = (keysPressed["KeyQ"] ? 1 : 0) - (keysPressed["KeyE"] ? 1 : 0);
    const pitch = (keysPressed["KeyZ"] ? 1 : 0) - (keysPressed["KeyX"] ? 1 : 0);
    const roll = (keysPressed["KeyR"] ? 1 : 0) - (keysPressed["KeyF"] ? 1 : 0);

    // Envoyer les entrées au gestionnaire
    onInput({
      thrust,
      lateral,
      upDown,
      yaw,
      pitch,
      roll,
    });
  };

  return {
    bind: () => {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
    },
    unbind: () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    },
  };
}

// Utilitaire pour calculer la transition entre deux positions de caméra
export function calculateCameraTransition(
  camera,
  controls,
  startPos,
  endPos,
  progress,
  easing = true
) {
  // Appliquer une fonction d'easing cubique si demandé
  const t = easing
    ? progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
    : progress;

  // Position temporaire pour l'interpolation
  const tempPos = new Vector3();
  const tempTarget = new Vector3();

  // Interpoler la position de la caméra
  tempPos.lerpVectors(startPos.position, endPos.position, t);
  tempTarget.lerpVectors(startPos.target, endPos.target, t);

  // Mettre à jour la caméra et les contrôles
  camera.position.copy(tempPos);
  if (controls && controls.target) {
    controls.target.copy(tempTarget);
    controls.update();
  }

  return { position: tempPos, target: tempTarget };
}

// Gestionnaire du mode vol
export class FlightController {
  constructor(camera, config = DEFAULT_FLIGHT_CONFIG) {
    this.camera = camera;
    this._config = { ...DEFAULT_FLIGHT_CONFIG, ...config };
    this.velocity = new Vector3();
    this.tempVector = new Vector3();
    this.euler = new Euler(0, 0, 0, "YXZ");
    this.direction = new Vector3();
    this.input = {
      thrust: 0,
      lateral: 0,
      upDown: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
  }

  // Accesseur pour la configuration
  get config() {
    return this._config;
  }

  // Mutateur pour la configuration
  set config(newConfig) {
    this._config = { ...DEFAULT_FLIGHT_CONFIG, ...newConfig };
  }

  setInput(input) {
    this.input = { ...this.input, ...input };
  }

  update(delta) {
    // Protection contre les erreurs si la caméra n'est pas disponible
    if (!this.camera) return;

    // Utiliser la configuration actuelle
    const config = this._config;

    // Calculer l'accélération dans la direction de vue (avant/arrière)
    if (this.input.thrust !== 0) {
      this.tempVector
        .set(0, 0, -1)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(this.input.thrust * config.acceleration * delta);
      this.velocity.add(this.tempVector);
    }

    // Mouvement latéral (gauche/droite)
    if (this.input.lateral !== 0) {
      this.tempVector
        .set(1, 0, 0)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(this.input.lateral * config.acceleration * delta);
      this.velocity.add(this.tempVector);
    }

    // Mouvement vertical (haut/bas)
    if (this.input.upDown !== 0) {
      this.tempVector
        .set(0, 1, 0)
        .multiplyScalar(this.input.upDown * config.acceleration * delta);
      this.velocity.add(this.tempVector);
    }

    // Appliquer la décélération
    this.velocity.multiplyScalar(config.deceleration);

    // Limiter la vitesse maximale
    const currentSpeed = this.velocity.length();
    if (currentSpeed > config.maxSpeed) {
      this.velocity.multiplyScalar(config.maxSpeed / currentSpeed);
    }

    // Appliquer le mouvement
    this.camera.position.add(this.velocity.clone().multiplyScalar(delta));

    // Rotation de la caméra
    this.euler.setFromQuaternion(this.camera.quaternion);

    if (this.input.yaw !== 0) {
      this.euler.y -= this.input.yaw * config.rotationSpeed * delta;
    }

    if (this.input.pitch !== 0) {
      this.euler.x = Math.max(
        -Math.PI / 2,
        Math.min(
          Math.PI / 2,
          this.euler.x + this.input.pitch * config.rotationSpeed * delta
        )
      );
    }

    if (this.input.roll !== 0) {
      this.euler.z = Math.max(
        -Math.PI / 4,
        Math.min(
          Math.PI / 4,
          this.euler.z + this.input.roll * config.rotationSpeed * delta
        )
      );
    } else {
      // Auto-stabilisation du roulis
      this.euler.z *= 0.95;
    }

    // Appliquer les rotations
    this.camera.quaternion.setFromEuler(this.euler);
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.input = {
      thrust: 0,
      lateral: 0,
      upDown: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
    // Réinitialiser le roulis à zéro pour une vue normale
    if (this.camera) {
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.z = 0;
      this.camera.quaternion.setFromEuler(this.euler);
    }
  }
}
