export const waveVertexShader = `
  uniform float time;
  attribute vec3 instancePosition;
  attribute vec3 instanceColor;
  varying vec3 vColor;

  void main() {
    vColor = instanceColor;
    vec3 pos = position + instancePosition;
    pos.z += cos(pos.x * 0.01 + time) * 5.0; // Appliquer une onde sur l'axe z
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const waveFragmentShader = `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`; 