import { Pane } from 'tweakpane';

export interface ControlParams {
    highlightScale: number;
    highlightColor: string;
    pointSize: number;
    orbitSpeed: number;
    layout: 'Characters galaxy' | 'Thematics galaxy' | 'Chronologic';
}

type ChangeCallback = () => void;

class ParamsManager {
    private params: ControlParams = {
        highlightScale: 5.0,
        highlightColor: "#ff0000",
        pointSize: 0.3,
        orbitSpeed: 0.2,
        layout: 'Characters galaxy',
    };

    private listeners: Set<ChangeCallback> = new Set();

    get values(): ControlParams {
        return this.params;
    }

    set<K extends keyof ControlParams>(key: K, value: ControlParams[K]) {
        this.params[key] = value;
        this.notifyListeners();
    }

    onChange(callback: ChangeCallback): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners() {
        this.listeners.forEach(callback => callback());
    }
}

export const params = new ParamsManager();

export function setupControls() {
    const pane = new Pane() as any;
    const values = params.values;

    // Ajouter les contrôles
    pane.addBinding(values, 'layout', {
        options: {
            'Characters galaxy': 'Characters galaxy',
            'Thematics galaxy': 'Thematics galaxy',
            'Chronologic': 'Chronologic',
        },
        label: 'Layout'
    }).on('change', ({ value }: { value: ControlParams['layout'] }) => {
        params.set('layout', value);
    });

    pane.addBinding(values, 'highlightScale', {
        min: 1.0,
        max: 5.0,
        step: 0.1,
        label: 'Intensité surbrillance'
    }).on('change', ({ value }: { value: number }) => {
        params.set('highlightScale', value);
    });

    pane.addBinding(values, 'highlightColor', {
        view: 'color',
        label: 'Couleur surbrillance'
    }).on('change', ({ value }: { value: string }) => {
        params.set('highlightColor', value);
    });

    pane.addBinding(values, 'pointSize', {
        min: 0.1,
        max: 2.0,
        step: 0.1,
        label: 'Taille des points'
    }).on('change', ({ value }: { value: number }) => {
        params.set('pointSize', value);
    });

    pane.addBinding(values, 'orbitSpeed', {
        min: 0.0,
        max: 1.0,
        step: 0.05,
        label: 'Vitesse orbite'
    }).on('change', ({ value }: { value: number }) => {
        params.set('orbitSpeed', value);
    });

    return pane;
} 