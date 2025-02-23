import { Pane } from "tweakpane";
import { CoordinateType } from "../types/coordinates";

interface TweakPaneConfig {
    coordinateType: CoordinateType;
    debug: boolean;
    showAxes: boolean;
    highlightScale: number;
    controller: {
        maxSpeed: number;
        acceleration: number;
        deceleration: number;
        rotationSpeed: number;
        deadzone: number;
    };
}

interface TweakPaneCallbacks {
    onCoordinateTypeChange: (value: CoordinateType) => void;
    onDebugChange: (value: boolean) => void;
    onShowAxesChange: (value: boolean) => void;
    onHighlightScaleChange: (value: number) => void;
    onControllerChange: (key: string, value: number) => void;
}

export const createPane = (
    initialConfig: TweakPaneConfig,
    callbacks: TweakPaneCallbacks,
    coordinateTypes: CoordinateType[]
): Pane => {
    const pane = new Pane();

    // Folder pour les contrôles de visualisation
    const visualFolder = pane.addFolder({
        title: "Viz",
        expanded: true,
    });

    // Contrôle du type de coordonnées
    visualFolder
        .addBinding(
            { coordinateType: initialConfig.coordinateType },
            "coordinateType",
            {
                options: coordinateTypes.reduce((acc, type) => {
                    acc[type] = type;
                    return acc;
                }, {} as Record<string, string>),
            }
        )
        .on("change", ({ value }: { value: unknown }) =>
            callbacks.onCoordinateTypeChange(value as CoordinateType)
        );

    // Contrôle de l'échelle de surbrillance
    visualFolder
        .addBinding(
            { highlightScale: initialConfig.highlightScale },
            "highlightScale",
            {
                label: "Highlight Scale",
                min: 2,
                max: 20,
                step: 1
            }
        )
        .on("change", ({ value }: { value: unknown }) => {
            if (typeof value === 'number' && !isNaN(value)) {
                callbacks.onHighlightScaleChange(value);
            }
        });

    // Folder pour les contrôles de la manette
    const controllerFolder = pane.addFolder({
        title: "Controller",
        expanded: false,
    });

    // Contrôles des paramètres de la manette
    controllerFolder
        .addBinding(initialConfig.controller, "maxSpeed", {
            min: 100,
            max: 3000,
            step: 100,
        })
        .on("change", ({ value }: { value: unknown }) => {
            if (typeof value === 'number' && !isNaN(value)) {
                callbacks.onControllerChange("maxSpeed", value);
            }
        });

    controllerFolder
        .addBinding(initialConfig.controller, "acceleration", {
            min: 100,
            max: 2000,
            step: 100,
        })
        .on("change", ({ value }: { value: unknown }) => {
            if (typeof value === 'number' && !isNaN(value)) {
                callbacks.onControllerChange("acceleration", value);
            }
        });

    controllerFolder
        .addBinding(initialConfig.controller, "deceleration", {
            min: 0.8,
            max: 0.99,
            step: 0.01,
        })
        .on("change", ({ value }: { value: unknown }) => {
            if (typeof value === 'number' && !isNaN(value)) {
                callbacks.onControllerChange("deceleration", value);
            }
        });

    controllerFolder
        .addBinding(initialConfig.controller, "rotationSpeed", {
            min: 0.5,
            max: 10,
            step: 0.1,
        })
        .on("change", ({ value }: { value: unknown }) => {
            if (typeof value === 'number' && !isNaN(value)) {
                callbacks.onControllerChange("rotationSpeed", value);
            }
        });

    controllerFolder
        .addBinding(initialConfig.controller, "deadzone", {
            min: 0.05,
            max: 0.5,
            step: 0.05,
        })
        .on("change", ({ value }: { value: unknown }) => {
            if (typeof value === 'number' && !isNaN(value)) {
                callbacks.onControllerChange("deadzone", value);
            }
        });

    // Folder pour les contrôles de debug
    const debugFolder = pane.addFolder({
        title: "Debug",
        expanded: false
    });

    // Contrôle du mode debug
    debugFolder
        .addBinding({ debug: initialConfig.debug }, "debug")
        .on("change", ({ value }: { value: boolean }) =>
            callbacks.onDebugChange(value)
        );

    // Contrôle de l'affichage des axes
    debugFolder
        .addBinding({ showAxes: initialConfig.showAxes }, "showAxes")
        .on("change", ({ value }: { value: boolean }) =>
            callbacks.onShowAxesChange(value)
        );

    return pane;
};
