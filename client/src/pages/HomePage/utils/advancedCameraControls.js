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
  maxSpeed: 35,
  acceleration: 300,
  deceleration: 0.8,
  rotationSpeed: 0.15, // Valeur plus élevée pour une réponse directe sans accélération
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

    // Paramètres pour la sphère limite
    this.boundingSphereRadius = 800; // Rayon de la sphère limite
    this.defaultPosition = new Vector3(0, 0, 600);
    this.defaultTarget = new Vector3(0, 0, 0);
    this.isReturningToDefault = false;

    // Facteurs d'accélération pour la transition
    this.currentAccelerationFactor = 3; // Facteur actuel (interpolé)
    this.targetAccelerationFactor = 1; // Facteur cible
    this.accelerationTransitionSpeed = 0.05; // Vitesse de transition (3 fois plus lente qu'avant)

    // Entrées actuelles
    this.input = {
      thrust: 0,
      lateral: 0,
      upDown: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };

    // Entrées cibles (pour le lissage)
    this.targetInput = { ...this.input };

    // Lissage des entrées
    this.smoothFactor = 0.15;

    // Vitesse actuelle
    this.velocity = new Vector3(0, 0, 0);

    // Vecteur temporaire pour les calculs
    this.tempVector = new Vector3();

    // Pour les rotations
    this.quaternionTemp = new Quaternion();

    // Pour la transition entre positions
    this.transitionStart = null;
    this.transitionEnd = null;
    this.transitionProgress = 0;
    this.transitionDuration = 2000;
    this.isTransitioning = false;
    this.orbitControlsAfterTransition = false;

    // Limiter l'espace de jeu
    this.returnVelocity = 10;
    this.returnRotationSpeed = 0.1;
    this.returnStartPos = null;
    this.returnStartRot = null;
    this.returnProgress = 0;
    this.returnDuration = 2000;

    // Stockage des positions
    this.predefinedPositions = [];
    this.currentPredefinedPosition = -1;
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
    // Mettre à jour les entrées cibles, pas directement les entrées actuelles
    this.targetInput = { ...this.targetInput, ...input };
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

    // Calculer la distance par rapport au centre pour déterminer le facteur d'accélération cible
    const distanceFromCenter = this.camera.position.length();
    this.targetAccelerationFactor = distanceFromCenter > 400 ? 3 : 1;

    // Interpolation linéaire vers le facteur d'accélération cible
    if (
      Math.abs(this.currentAccelerationFactor - this.targetAccelerationFactor) >
      0.01
    ) {
      if (this.currentAccelerationFactor < this.targetAccelerationFactor) {
        this.currentAccelerationFactor += this.accelerationTransitionSpeed;
        if (this.currentAccelerationFactor > this.targetAccelerationFactor) {
          this.currentAccelerationFactor = this.targetAccelerationFactor;
        }
      } else {
        this.currentAccelerationFactor -= this.accelerationTransitionSpeed;
        if (this.currentAccelerationFactor < this.targetAccelerationFactor) {
          this.currentAccelerationFactor = this.targetAccelerationFactor;
        }
      }
    }

    // Utiliser le facteur d'accélération interpolé
    const accelerationFactor = this.currentAccelerationFactor;

    // Exposer le facteur d'accélération actuel pour le NavigationUI
    window.__accelerationFactor = accelerationFactor;

    // Log pour debug (à retirer une fois le problème résolu)
    if (Math.floor(Date.now() / 1000) % 5 === 0) {
      // Log toutes les 5 secondes environ
      console.log(
        `Distance: ${distanceFromCenter.toFixed(
          2
        )}, Accélération: ${accelerationFactor.toFixed(
          2
        )}x, Vitesse maximale: ${(config.maxSpeed * accelerationFactor).toFixed(
          2
        )}`
      );
    }

    // Interpoler progressivement entre les entrées actuelles et les entrées cibles
    this.input.thrust +=
      (this.targetInput.thrust - this.input.thrust) * this.smoothFactor;
    this.input.lateral +=
      (this.targetInput.lateral - this.input.lateral) * this.smoothFactor;
    this.input.upDown +=
      (this.targetInput.upDown - this.input.upDown) * this.smoothFactor;
    this.input.yaw +=
      (this.targetInput.yaw - this.input.yaw) * this.smoothFactor;
    this.input.pitch +=
      (this.targetInput.pitch - this.input.pitch) * this.smoothFactor;
    this.input.roll +=
      (this.targetInput.roll - this.input.roll) * this.smoothFactor;

    // Calculer l'accélération dans la direction de vue (avant/arrière)
    if (Math.abs(this.input.thrust) > 0.001) {
      this.tempVector
        .set(0, 0, -1)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(
          this.input.thrust * config.acceleration * delta * accelerationFactor
        );
      this.velocity.add(this.tempVector);
    }

    // Mouvement latéral (gauche/droite)
    if (Math.abs(this.input.lateral) > 0.001) {
      this.tempVector
        .set(1, 0, 0)
        .applyQuaternion(this.camera.quaternion)
        .multiplyScalar(
          this.input.lateral * config.acceleration * delta * accelerationFactor
        );
      this.velocity.add(this.tempVector);
    }

    // Mouvement vertical (haut/bas)
    if (Math.abs(this.input.upDown) > 0.001) {
      this.tempVector
        .set(0, 1, 0)
        .multiplyScalar(
          this.input.upDown * config.acceleration * delta * accelerationFactor
        );
      this.velocity.add(this.tempVector);
    }

    // Appliquer la décélération
    this.velocity.multiplyScalar(config.deceleration);

    // Limiter la vitesse maximale
    const currentSpeed = this.velocity.length();
    // Ajuster la vitesse maximale en fonction du facteur d'accélération
    const adjustedMaxSpeed = config.maxSpeed * accelerationFactor;
    // Exposer la vitesse maximale ajustée pour le NavigationUI
    window.__adjustedMaxSpeed = adjustedMaxSpeed;

    if (currentSpeed > adjustedMaxSpeed) {
      this.velocity.multiplyScalar(adjustedMaxSpeed / currentSpeed);
    }

    // Appliquer le mouvement
    this.camera.position.add(this.velocity.clone().multiplyScalar(delta));

    // Vérifier si le joueur est en dehors de la sphère limite
    if (distanceFromCenter > this.boundingSphereRadius) {
      console.log(
        `Joueur hors limites (${distanceFromCenter.toFixed(2)} > ${
          this.boundingSphereRadius
        }), retour à la position par défaut`
      );
      this.returnToDefaultPosition();
      return;
    }

    // Obtenir l'orientation actuelle de la caméra
    this.euler.setFromQuaternion(this.camera.quaternion);

    // APPLICATION DIRECTE: Appliquer directement les entrées de rotation
    // Lacet (yaw - rotation horizontale)
    if (Math.abs(this.input.yaw) > 0.001) {
      this.euler.y -= this.input.yaw * config.rotationSpeed * delta;
    }

    // Tangage (pitch - rotation verticale)
    if (Math.abs(this.input.pitch) > 0.001) {
      // Limiter le tangage (pitch) pour éviter de tourner à 180°
      this.euler.x = Math.max(
        -Math.PI / 2,
        Math.min(
          Math.PI / 2,
          this.euler.x + this.input.pitch * config.rotationSpeed * delta
        )
      );
    }

    // Roulis (roll - rotation sur l'axe de visée)
    if (Math.abs(this.input.roll) > 0.001) {
      // Limiter le roulis (roll)
      this.euler.z = Math.max(
        -Math.PI / 4,
        Math.min(
          Math.PI / 4,
          this.euler.z + this.input.roll * config.rotationSpeed * delta
        )
      );
    } else {
      // Auto-stabilisation du roulis quand pas d'entrée
      this.euler.z *= 0.95; // Facteur de stabilisation
    }

    // Appliquer les rotations
    this.camera.quaternion.setFromEuler(this.euler);
  }

  // Méthode pour retourner à la position par défaut
  returnToDefaultPosition() {
    // Éviter des appels multiples
    if (this.isReturningToDefault) return;

    console.log(
      "Limite de 800 dépassée - Simulation d'une action utilisateur pour transition fluide"
    );
    this.isReturningToDefault = true;

    // Réinitialiser la vitesse et la rotation
    this.velocity.set(0, 0, 0);

    // Pour simuler exactement l'action d'un utilisateur qui appuie sur une touche de position,
    // on va accéder directement au gestionnaire d'entrées global et déclencher le nextPosition
    if (window.getInputManager) {
      const inputManager = window.getInputManager();
      if (inputManager) {
        // Déclencher l'action nextPosition comme si l'utilisateur avait appuyé sur la touche
        inputManager.triggerNextPositionAction();
        console.log(
          "Action nextPosition déclenchée via le gestionnaire d'entrées"
        );

        // Réactiver les contrôles après la transition (après le délai d'animation)
        setTimeout(() => {
          this.isReturningToDefault = false;
          console.log("Contrôles de vol réactivés après la transition");
        }, 2500);
        return;
      }
    }

    // Si le gestionnaire d'entrées n'est pas disponible, on essaie avec l'animation directe
    if (typeof window.__animateToCameraPosition === "function") {
      console.log("Appel direct de la fonction d'animation");
      // Appel direct de l'animation (position 0 = vue globale, true = activer orbite ensuite)
      window.__animateToCameraPosition(0, true);

      setTimeout(() => {
        this.isReturningToDefault = false;
        console.log("Contrôles de vol réactivés après la transition");
      }, 2500);
    } else {
      // Solution de dernier recours - téléportation directe
      console.error(
        "Aucune méthode d'animation disponible - téléportation directe"
      );
      this.camera.position.copy(this.defaultPosition);
      this.camera.lookAt(this.defaultTarget);

      // Définir les valeurs globales pour cohérence
      window.__cameraPosition = {
        x: this.defaultPosition.x,
        y: this.defaultPosition.y,
        z: this.defaultPosition.z,
      };
      window.__orbitModeActive = true;

      setTimeout(() => {
        this.isReturningToDefault = false;
      }, 500);
    }
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.isReturningToDefault = false;

    this.input = {
      thrust: 0,
      lateral: 0,
      upDown: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };

    // Réinitialiser aussi les entrées cibles
    this.targetInput = {
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
