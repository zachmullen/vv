attribute highp vec3 aVertexPosition;
attribute highp vec4 aVertexColor;
attribute highp vec3 aVertexNormal;

uniform highp mat4 uNormalMatrix;
uniform highp mat4 uMVMatrix;
uniform highp mat4 uPMatrix;

varying highp vec4 vColor;
varying highp vec3 vLighting;

void main(void) {
  highp vec3 ambientLight = vec3(0.5, 0.5, 0.5);
  highp vec3 directionalLightColor = vec3(0.5, 0.5, 0.5);
  highp vec3 directionalVector = vec3(0, 0, 1);

  highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 1.0);

  highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
  vLighting = ambientLight + (directionalLightColor * directional);
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  vColor = aVertexColor;
}
