export const sphereVertexShader = `
precision highp float;
precision highp int;

// Matrices de transformation fournies par Three.js
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

uniform float time;
uniform vec3 characterPositions[48];
uniform vec3 thematicPositions[17];
uniform int numCharacters;
uniform int numThematics;
uniform float pointSize;
uniform float highlightScale;
uniform vec3 highlightColor;
uniform float orbitSpeed;
uniform int layoutType;
uniform float transitionProgress;

in vec3 position;
in vec3 instancePosition;
in vec3 instanceColor;
in float characterIndex;
in float thematicIndex;
in float instanceRank;
in float isHighlighted;
in float creationDate;
in float vertexId;

out vec3 vColor;
out float vIsHighlighted;
out vec3 vFinalPosition;

#define PI 3.14159265359

vec3 calculateGalaxyPosition(vec3 centerPos, float rank, float uniqueOffset) {
	float radius = mix(20.0, 300.0, rank);
	float angle = uniqueOffset * 0.1 + time * orbitSpeed;
	
	return centerPos + vec3(
		radius * cos(angle),
		radius * sin(angle) * 0.5,
		radius * sin(angle)
	);
}

vec3 calculateChronologicPosition(float date) {
	return vec3(
		300.0 * cos(date * 0.017453),
		date,
		300.0 * sin(date * 0.017453)
	);
}

void main() {
	vColor = instanceColor;
	vIsHighlighted = isHighlighted;

	// Calcul des indices
	int charIndexInt = int(clamp(characterIndex, 0.0, float(numCharacters - 1)));
	int themIndexInt = int(clamp(thematicIndex, 0.0, float(numThematics - 1)));
	
	// Calcul de la position unique pour l'animation
	float uniqueOffset = vertexId * PI;

	// Calcul des positions selon le layout
	vec3 finalPos;
	if (layoutType == 0) {
		finalPos = calculateGalaxyPosition(characterPositions[charIndexInt], instanceRank, uniqueOffset);
	} else if (layoutType == 1) {
		finalPos = calculateGalaxyPosition(thematicPositions[themIndexInt], instanceRank, uniqueOffset);
	} else {
		finalPos = calculateChronologicPosition(creationDate);
	}

	// Transition et limite de distance
	vec3 currentPos = mix(instancePosition, finalPos, transitionProgress);
	float dist = length(currentPos);
	if (dist > 1000.0) {
		currentPos *= 1000.0 / dist;
	}

	// Application de la taille du point
	currentPos += position * pointSize;
	
	// Position finale
	vFinalPosition = currentPos;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(currentPos, 1.0);
}
`;

export const sphereFragmentShader = `
precision highp float;

in vec3 vColor;
in float vIsHighlighted;

uniform float highlightScale;
uniform vec3 highlightColor;

out vec4 fragColor;

void main() {
	vec3 finalColor = vColor;
	if (vIsHighlighted > 0.5) {
		finalColor = mix(finalColor, highlightColor, highlightScale * 0.2);
	}
	fragColor = vec4(finalColor, 1.0);
}
`;
