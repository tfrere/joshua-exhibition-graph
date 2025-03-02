precision highp float;

in vec3 position;
in vec3 velocity;
in float charge;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float deltaTime;

out vec3 vPosition;
out vec3 vVelocity;
out float vCharge;

void main() {
    vPosition = position;
    vVelocity = velocity;
    vCharge = charge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
} 