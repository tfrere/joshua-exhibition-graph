export interface PerformanceConfig {
  nodeResolution: number;
  maxNodes: number;
  maxNodesPerType: {
    displayName: number;
    pair: number;
    post: number;
  };
  samplingRates: {
    pairsPerDisplayName: number;
    postsPerPair: number;
  };
  forceSimulation: {
    warmupTicks: number;
    cooldownTicks: number;
    cooldownTime: number;
    d3AlphaMin: number;
    d3VelocityDecay: number;
  };
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  nodeResolution: 6,
  maxNodes: 1000000,
  maxNodesPerType: {
    displayName: 100000,
    pair: 100000,
    post: 100000,
  },
  samplingRates: {
    pairsPerDisplayName: 100000,
    postsPerPair: 100000,
  },
  forceSimulation: {
    warmupTicks: 100,
    cooldownTicks: 100,
    cooldownTime: 3000,
    d3AlphaMin: 0.1,
    d3VelocityDecay: 0.3,
  },
}; 