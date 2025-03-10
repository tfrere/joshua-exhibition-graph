import { Vector3, Euler, Quaternion } from "three";

// Positions fixes pour l'oscillation de la caméra
export const CAMERA_POSITIONS = [
  { position: new Vector3(0, 0, 600), target: new Vector3(0, 0, 0) }, // Position vue globale à 600 unités
  // { position: new Vector3(200, 100, 300), target: new Vector3(0, 0, 0) },
  // { position: new Vector3(-200, 50, 150), target: new Vector3(50, 0, 0) },
  // { position: new Vector3(0, 200, 100), target: new Vector3(0, 0, 0) },
  // { position: new Vector3(150, -100, 200), target: new Vector3(0, 50, 0) },
];

// Configuration par défaut pour le mode vol
export const DEFAULT_FLIGHT_CONFIG = {
  maxSpeed: 500,
  acceleration: 1000,
  deceleration: 0.95,
  rotationSpeed: 2.0,
  rotationAcceleration: 2.0, // Nouvelle propriété : accélération de rotation
  rotationDeceleration: 0.85, // Nouvelle propriété : décélération de rotation
  maxRotationSpeed: 4.0, // Nouvelle propriété : vitesse maximale de rotation
  deadzone: 0.1,
};

// Modes de contrôle de caméra disponibles
export const CAMERA_MODES = {
  ORBIT: "orbit",
  FLIGHT: "flight",
};

// Hook rbit gérer les entrées clavier pour le vol
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
  } else {
    // En mode vol, on doit orienter la caméra manuellement vers la cible
    // Calculer une direction de la caméra vers la cible
    const lookDirection = new Vector3()
      .subVectors(tempTarget, tempPos)
      .normalize();

    // Créer un vecteur "up" pour l'orientation
    const upVector = new Vector3(0, 1, 0);

    // Orienter la caméra vers la cible
    camera.lookAt(tempTarget);

    // Option: ajuster l'orientation up de la caméra si nécessaire
    camera.up.copy(upVector);
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
    this.rotationVelocity = { yaw: 0, pitch: 0, roll: 0 };

    // Paramètres pour la sphère limite
    this.boundingSphereRadius = 800; // Rayon de la sphère limite
    this.defaultPosition = new Vector3(0, 0, 600);
    this.defaultTarget = new Vector3(0, 0, 0);
    this.isReturningToDefault = false;

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

    // Si on est en train de retourner à la position par défaut, ne pas appliquer les contrôles normaux
    if (this.isReturningToDefault) {
      return;
    }

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

    // Vérifier si le joueur est en dehors de la sphère limite
    const distanceFromCenter = this.camera.position.length();
    if (distanceFromCenter > this.boundingSphereRadius) {
      console.log(
        `Joueur hors limites (${distanceFromCenter.toFixed(2)} > ${
          this.boundingSphereRadius
        }), retour à la position par défaut`
      );
      this.returnToDefaultPosition();
      return;
    }

    // Rotation de la caméra avec accélération progressive
    this.euler.setFromQuaternion(this.camera.quaternion);

    // Accélération du lacet (yaw)
    if (this.input.yaw !== 0) {
      // Appliquer l'accélération à la vitesse de rotation
      this.rotationVelocity.yaw +=
        this.input.yaw * config.rotationAcceleration * delta;
    }
    // Décélération du lacet
    else {
      this.rotationVelocity.yaw *= config.rotationDeceleration;
    }

    // Accélération du tangage (pitch)
    if (this.input.pitch !== 0) {
      this.rotationVelocity.pitch +=
        this.input.pitch * config.rotationAcceleration * delta;
    }
    // Décélération du tangage
    else {
      this.rotationVelocity.pitch *= config.rotationDeceleration;
    }

    // Accélération du roulis (roll)
    if (this.input.roll !== 0) {
      this.rotationVelocity.roll +=
        this.input.roll * config.rotationAcceleration * delta;
    }
    // Décélération et auto-stabilisation du roulis
    else {
      this.rotationVelocity.roll *= config.rotationDeceleration * 0.9; // Stabilisation plus rapide pour le roulis
    }

    // Limiter les vitesses de rotation maximales
    this.rotationVelocity.yaw = Math.max(
      -config.maxRotationSpeed,
      Math.min(config.maxRotationSpeed, this.rotationVelocity.yaw)
    );
    this.rotationVelocity.pitch = Math.max(
      -config.maxRotationSpeed,
      Math.min(config.maxRotationSpeed, this.rotationVelocity.pitch)
    );
    this.rotationVelocity.roll = Math.max(
      -config.maxRotationSpeed,
      Math.min(config.maxRotationSpeed, this.rotationVelocity.roll)
    );

    // Appliquer les rotations avec les vitesses actuelles
    this.euler.y -= this.rotationVelocity.yaw * delta * config.rotationSpeed;

    // Limiter le tangage (pitch) pour éviter de tourner à 180°
    this.euler.x = Math.max(
      -Math.PI / 2,
      Math.min(
        Math.PI / 2,
        this.euler.x +
          this.rotationVelocity.pitch * delta * config.rotationSpeed
      )
    );

    // Limiter le roulis (roll)
    this.euler.z = Math.max(
      -Math.PI / 4,
      Math.min(
        Math.PI / 4,
        this.euler.z + this.rotationVelocity.roll * delta * config.rotationSpeed
      )
    );

    // Appliquer les rotations
    this.camera.quaternion.setFromEuler(this.euler);
  }

  // Nouvelle méthode pour retourner à la position par défaut
  returnToDefaultPosition() {
    // Éviter des appels multiples
    if (this.isReturningToDefault) return;

    this.isReturningToDefault = true;

    // Réinitialiser la vitesse
    this.velocity.set(0, 0, 0);
    this.rotationVelocity = { yaw: 0, pitch: 0, roll: 0 };

    // Trouver le contrôleur de caméra avancé pour lancer l'animation
    if (window.__animateToCameraPosition) {
      window.__animateToCameraPosition(0); // Animer vers la position 0 (vue globale)

      // Réactiver les contrôles après un délai
      setTimeout(() => {
        this.isReturningToDefault = false;
      }, 2500); // Délai légèrement supérieur à la durée de l'animation
    } else {
      // Solution de secours si la fonction d'animation n'est pas accessible
      // Téléporter directement à la position par défaut
      this.camera.position.copy(this.defaultPosition);
      this.camera.lookAt(this.defaultTarget);

      // Réactiver les contrôles après un court délai
      setTimeout(() => {
        this.isReturningToDefault = false;
      }, 500);
    }
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.rotationVelocity = { yaw: 0, pitch: 0, roll: 0 };
    this.isReturningToDefault = false;

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
