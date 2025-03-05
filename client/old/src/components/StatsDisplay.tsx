import { useEffect, useRef } from 'react';
import Stats from 'stats.js';

export function StatsDisplay() {
  const statsRef = useRef<Stats | null>(null);

  useEffect(() => {
    // Créer une instance de Stats.js
    const stats = new Stats();
    statsRef.current = stats;
    
    // Configurer les panneaux
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    
    // Ajouter le conteneur au DOM
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.zIndex = '1000';
    container.appendChild(stats.dom);
    document.body.appendChild(container);
    
    // Fonction d'animation pour mettre à jour les statistiques
    const animate = () => {
      stats.begin();
      // Les calculs de rendu se produisent entre begin() et end()
      stats.end();
      
      requestAnimationFrame(animate);
    };
    
    // Démarrer l'animation
    requestAnimationFrame(animate);
    
    // Nettoyer lors du démontage du composant
    return () => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      // Arrêter l'animation
      if (statsRef.current) {
        statsRef.current = null;
      }
    };
  }, []);
  
  // Ce composant ne rend rien directement dans le DOM React
  return null;
} 