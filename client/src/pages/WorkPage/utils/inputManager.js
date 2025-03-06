import { useState, useEffect } from "react";

// Classe pour la gestion unifiée des entrées (clavier et manette)
export class InputManager {
  constructor() {
    // État des entrées
    this.inputs = {
      // Déplacement
      moveForward: 0, // -1 à 1
      moveRight: 0, // -1 à 1
      moveUp: 0, // -1 à 1

      // Rotation
      lookHorizontal: 0, // -1 à 1
      lookVertical: 0, // -1 à 1
      roll: 0, // -1 à 1

      // Actions
      toggleMode: false,
      nextPosition: false,
      action1: false,
      action2: false,
    };

    // Configuration
    this.config = {
      deadzone: 0.1,
      keyboardSensitivity: 1.5,
      keyboardMovementMultiplier: 3.0,
      keyboardLookMultiplier: 0.5,
    };

    // États internes
    this.keysPressed = {};
    this.previousButtonStates = {};
    this.listeners = [];
    this.gamepadConnected = false;
    this.inputSource = "keyboard";

    // Démarre les écouteurs d'événements
    this.bindEvents();
  }

  // Ajouter un écouteur pour recevoir les mises à jour d'entrée
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  // Notifier tous les écouteurs d'une mise à jour des entrées
  notifyListeners() {
    for (const listener of this.listeners) {
      listener({ ...this.inputs });
    }
  }

  // Configurer les écouteurs d'événements
  bindEvents() {
    // Gestion du clavier
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    // Gestion des événements de manette
    window.addEventListener("gamepadconnected", this.handleGamepadConnected);
    window.addEventListener(
      "gamepaddisconnected",
      this.handleGamepadDisconnected
    );

    // Démarrer la boucle de polling pour la manette
    this.startGamepadPolling();
  }

  // Nettoyer les écouteurs d'événements
  unbindEvents() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("gamepadconnected", this.handleGamepadConnected);
    window.removeEventListener(
      "gamepaddisconnected",
      this.handleGamepadDisconnected
    );

    if (this.gamepadIntervalId) {
      clearInterval(this.gamepadIntervalId);
    }
  }

  // Gestion des événements clavier
  handleKeyDown = (event) => {
    this.keysPressed[event.code] = true;

    // Gestion d'actions spéciales
    if (event.code === "Tab") {
      event.preventDefault();
      this.inputs.toggleMode = true;
    }

    if (event.code === "Space") {
      event.preventDefault();
      // Seulement activer si ce n'était pas déjà activé
      if (!this.inputs.nextPosition) {
        this.inputs.nextPosition = true;
      }
    }

    // Traiter les entrées après avoir géré les actions spéciales
    this.processKeyboardInput();

    // Notifier les écouteurs pour les actions spéciales
    this.notifyListeners();
  };

  handleKeyUp = (event) => {
    this.keysPressed[event.code] = false;

    // Réinitialiser les actions après notification
    if (event.code === "Tab") {
      this.inputs.toggleMode = false;
    }

    if (event.code === "Space") {
      // Délai court pour s'assurer que l'action est bien traitée avant réinitialisation
      setTimeout(() => {
        this.inputs.nextPosition = false;
        this.notifyListeners();
      }, 50);
    }

    // Traiter les entrées
    this.processKeyboardInput();
  };

  // Traitement des entrées clavier
  processKeyboardInput() {
    // Indiquer que la source est le clavier
    this.inputSource = "keyboard";

    // Application des multiplicateurs pour le clavier
    const moveMultiplier = this.config.keyboardMovementMultiplier;
    const lookMultiplier = this.config.keyboardLookMultiplier;

    // Mouvement avant/arrière (flèches haut/bas)
    const rawMoveForward =
      (this.keysPressed["ArrowUp"] ? 1 : 0) -
      (this.keysPressed["ArrowDown"] ? 1 : 0);

    // Mouvement latéral (flèches gauche/droite)
    const rawMoveRight =
      (this.keysPressed["ArrowRight"] ? 1 : 0) -
      (this.keysPressed["ArrowLeft"] ? 1 : 0);

    // Mouvement vertical (E/C)
    const rawMoveUp =
      (this.keysPressed["KeyE"] ? 1 : 0) - (this.keysPressed["KeyC"] ? 1 : 0);

    // Second stick virtuel (ZQSD) pour les rotations
    const rawLookVertical =
      (this.keysPressed["KeyW"] ? 1 : 0) - (this.keysPressed["KeyS"] ? 1 : 0);

    const rawLookHorizontal =
      (this.keysPressed["KeyD"] ? 1 : 0) - (this.keysPressed["KeyA"] ? 1 : 0);

    // Appliquer les multiplicateurs appropriés
    this.inputs.moveForward = rawMoveForward * moveMultiplier;
    this.inputs.moveRight = rawMoveRight * moveMultiplier;
    this.inputs.moveUp = rawMoveUp * moveMultiplier;

    // Rotation avec ZQSD (second stick) - sensibilité réduite
    this.inputs.lookHorizontal = rawLookHorizontal * lookMultiplier;
    this.inputs.lookVertical = rawLookVertical * lookMultiplier;

    // Roll avec Q/E
    this.inputs.roll =
      (this.keysPressed["KeyQ"] ? 1 : 0) - (this.keysPressed["KeyE"] ? 1 : 0);

    // Notifier les écouteurs
    this.notifyListeners();
  }

  // Gestion de la manette
  handleGamepadConnected = (event) => {
    console.log("Manette connectée:", event.gamepad.id);
    this.gamepadConnected = true;
  };

  handleGamepadDisconnected = (event) => {
    console.log("Manette déconnectée");
    this.gamepadConnected = false;

    // Réinitialiser les entrées
    this.resetInputs();
    this.notifyListeners();
  };

  startGamepadPolling() {
    // Intervalle de polling pour la manette (60fps)
    this.gamepadIntervalId = setInterval(() => this.pollGamepad(), 16);
  }

  pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = gamepads[0]; // On utilise la première manette

    if (!gamepad) {
      if (this.gamepadConnected) {
        this.gamepadConnected = false;
        this.resetInputs();
        this.notifyListeners();
      }
      return;
    }

    // Mettre à jour l'état de connexion si nécessaire
    if (!this.gamepadConnected) {
      this.gamepadConnected = true;
    }

    // Indiquer que la source est la manette
    this.inputSource = "gamepad";

    // Appliquer une zone morte aux sticks
    const applyDeadzone = (value) =>
      Math.abs(value) > this.config.deadzone ? value : 0;

    // Mouvements (stick gauche)
    this.inputs.moveForward = -applyDeadzone(gamepad.axes[1]);
    this.inputs.moveRight = applyDeadzone(gamepad.axes[0]);

    // Mouvements sur l'axe vertical (gâchettes)
    this.inputs.moveUp =
      (gamepad.buttons[5]?.value || 0) - (gamepad.buttons[4]?.value || 0);

    // Rotation caméra (stick droit)
    this.inputs.lookHorizontal = applyDeadzone(gamepad.axes[2]);
    this.inputs.lookVertical = applyDeadzone(gamepad.axes[3]);

    // Roll (L1/R1 ou équivalent)
    this.inputs.roll =
      (gamepad.buttons[7]?.pressed ? 1 : 0) -
      (gamepad.buttons[6]?.pressed ? 1 : 0);

    // Actions (avec gestion d'état pour éviter répétition)
    // Changement de mode (bouton X ou carré)
    if (gamepad.buttons[2]?.pressed && !this.previousButtonStates.mode) {
      this.inputs.toggleMode = true;
    } else {
      this.inputs.toggleMode = false;
    }
    this.previousButtonStates.mode = gamepad.buttons[2]?.pressed;

    // Position suivante (bouton A ou croix)
    if (
      gamepad.buttons[0]?.pressed &&
      !this.previousButtonStates.nextPosition
    ) {
      this.inputs.nextPosition = true;
    } else {
      this.inputs.nextPosition = false;
    }
    this.previousButtonStates.nextPosition = gamepad.buttons[0]?.pressed;

    // Autres actions
    this.inputs.action1 = gamepad.buttons[1]?.pressed || false; // B ou cercle
    this.inputs.action2 = gamepad.buttons[3]?.pressed || false; // Y ou triangle

    // Notifier les écouteurs
    this.notifyListeners();
  }

  resetInputs() {
    // Réinitialiser toutes les entrées à zéro
    Object.keys(this.inputs).forEach((key) => {
      if (typeof this.inputs[key] === "number") {
        this.inputs[key] = 0;
      } else if (typeof this.inputs[key] === "boolean") {
        this.inputs[key] = false;
      }
    });
  }

  // Mettre à jour la configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  // Méthode pour nettoyer et libérer les ressources
  dispose() {
    this.unbindEvents();
    this.listeners = [];
  }

  // Vérifier si une manette est connectée
  isGamepadConnected() {
    return this.gamepadConnected;
  }
}

// Instance singleton pour partager le même gestionnaire d'entrées
let inputManagerInstance = null;

export const getInputManager = () => {
  if (!inputManagerInstance) {
    inputManagerInstance = new InputManager();
  }
  return inputManagerInstance;
};

// Hook React pour utiliser le gestionnaire d'entrées dans les composants
export const useInputs = () => {
  const [inputs, setInputs] = useState(getInputManager().inputs);

  useEffect(() => {
    // S'abonner aux mises à jour d'entrées
    const unsubscribe = getInputManager().addListener((newInputs) => {
      setInputs({ ...newInputs });
    });

    // Nettoyer l'abonnement
    return unsubscribe;
  }, []);

  return inputs;
};
