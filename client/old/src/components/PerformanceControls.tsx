import { useEffect, useRef } from 'react';
import { Pane } from 'tweakpane';
import { PerformanceConfig } from '../types/performance';

interface PerformanceControlsProps {
  config: PerformanceConfig;
  onConfigChange: (newConfig: PerformanceConfig) => void;
}

export function PerformanceControls({ config, onConfigChange }: PerformanceControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<Pane | null>(null);

  useEffect(() => {
    // Créer une copie du config pour éviter les modifications directes
    const configCopy = JSON.parse(JSON.stringify(config));
    
    // Créer le panneau Tweakpane
    const pane = new Pane({
      container: containerRef.current || undefined,
      title: 'Performance Controls',
      expanded: false
    });
    paneRef.current = pane;

    // Ajouter les contrôles pour les paramètres généraux
    const generalFolder = pane.addFolder({ title: 'General Settings' });
    generalFolder.addBinding(configCopy, 'nodeResolution', { 
      min: 2, 
      max: 12, 
      step: 1,
      label: 'Node Resolution'
    });
    generalFolder.addBinding(configCopy, 'maxNodes', { 
      min: 1000, 
      max: 100000, 
      step: 1000,
      label: 'Max Nodes'
    });

    // Ajouter les contrôles pour les limites par type de nœud
    const maxNodesFolder = pane.addFolder({ title: 'Max Nodes Per Type' });
    maxNodesFolder.addBinding(configCopy.maxNodesPerType, 'displayName', { 
      min: 10, 
      max: 1000, 
      step: 10,
      label: 'Display Name'
    });
    maxNodesFolder.addBinding(configCopy.maxNodesPerType, 'pair', { 
      min: 100, 
      max: 5000, 
      step: 100,
      label: 'Pair'
    });
    maxNodesFolder.addBinding(configCopy.maxNodesPerType, 'post', { 
      min: 1000, 
      max: 50000, 
      step: 1000,
      label: 'Post'
    });

    // Ajouter les contrôles pour les taux d'échantillonnage
    const samplingFolder = pane.addFolder({ title: 'Sampling Rates' });
    samplingFolder.addBinding(configCopy.samplingRates, 'pairsPerDisplayName', { 
      min: 1, 
      max: 20, 
      step: 1,
      label: 'Pairs per Display Name'
    });
    samplingFolder.addBinding(configCopy.samplingRates, 'postsPerPair', { 
      min: 1, 
      max: 50, 
      step: 1,
      label: 'Posts per Pair'
    });

    // Ajouter les contrôles pour la simulation de force
    const forceFolder = pane.addFolder({ title: 'Force Simulation' });
    forceFolder.addBinding(configCopy.forceSimulation, 'warmupTicks', { 
      min: 0, 
      max: 200, 
      step: 10,
      label: 'Warmup Ticks'
    });
    forceFolder.addBinding(configCopy.forceSimulation, 'cooldownTicks', { 
      min: 0, 
      max: 200, 
      step: 10,
      label: 'Cooldown Ticks'
    });
    forceFolder.addBinding(configCopy.forceSimulation, 'cooldownTime', { 
      min: 0, 
      max: 5000, 
      step: 100,
      label: 'Cooldown Time (ms)'
    });
    forceFolder.addBinding(configCopy.forceSimulation, 'd3AlphaMin', { 
      min: 0.01, 
      max: 0.5, 
      step: 0.01,
      label: 'Alpha Min'
    });
    forceFolder.addBinding(configCopy.forceSimulation, 'd3VelocityDecay', { 
      min: 0.1, 
      max: 0.9, 
      step: 0.05,
      label: 'Velocity Decay'
    });

    // Ajouter un bouton pour réinitialiser les paramètres
    const resetButton = pane.addButton({ title: 'Reset to Defaults' });
    resetButton.on('click', () => {
      onConfigChange(config);
      pane.dispose();
      paneRef.current = null;
    });

    // Écouter les changements et mettre à jour le config
    pane.on('change', () => {
      onConfigChange(configCopy);
    });

    // Nettoyer le panneau lors du démontage du composant
    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, [config, onConfigChange]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        zIndex: 1000 
      }}
    />
  );
} 