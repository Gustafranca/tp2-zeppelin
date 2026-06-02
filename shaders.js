export const vs = `#version 300 es
in vec4 position;
in vec3 normal;
in vec2 texcoord;

uniform mat4 u_matrix;
uniform mat4 u_world;
uniform mat4 u_worldInverseTranspose;

out vec3 v_normal;
out vec3 v_surfaceToView;
out vec2 v_texcoord; 

uniform vec3 u_viewWorldPosition;

void main() {
    gl_Position = u_matrix * position;
    v_normal = mat3(u_worldInverseTranspose) * normal;
    vec3 surfaceWorldPosition = (u_world * position).xyz;
    v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
    v_texcoord = texcoord;
}
`;

export const fs = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToView;
in vec2 v_texcoord; 

uniform vec4 u_color;
uniform vec3 u_lightDirection;
uniform bool u_luzLigada; 
uniform bool u_hasTexture;
uniform sampler2D u_texture;

out vec4 outColor;

void main() {
    vec4 baseColor = u_color;
    if (u_hasTexture) {
        baseColor = texture(u_texture, v_texcoord) * u_color;
    }

    if (u_luzLigada) {
        vec3 normal = normalize(v_normal);
        vec3 surfaceToViewDirection = normalize(v_surfaceToView);
        float luzAmbiente = 0.3; 
        vec3 lightDir = normalize(u_lightDirection);
        float light = dot(normal, lightDir);
        float luzDifusa = max(light, 0.0);

        float luzEspecular = 0.0;
        if (luzDifusa > 0.0) {
            float shininess = 50.0; 
            vec3 reflectDir = reflect(-lightDir, normal);
            float specAngle = max(dot(reflectDir, surfaceToViewDirection), 0.0);
            luzEspecular = pow(specAngle, shininess);
        }
        vec3 finalColor = baseColor.rgb * (luzAmbiente + luzDifusa) + luzEspecular;
        outColor = vec4(finalColor, baseColor.a);
    } else {
        outColor = baseColor;
    }
}
`;

export const skyboxVs = `#version 300 es
in vec4 position;
uniform mat4 u_viewDirectionProjection;
out vec3 v_texcoord;
void main() {
    v_texcoord = position.xyz;
    vec4 pos = u_viewDirectionProjection * position;
    gl_Position = pos.xyww;
}
`;

export const skyboxFs = `#version 300 es
precision highp float;
in vec3 v_texcoord;
uniform samplerCube u_skybox;
out vec4 outColor;
void main() {
    outColor = texture(u_skybox, normalize(v_texcoord));
}
`;