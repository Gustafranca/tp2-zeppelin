export const vs = `#version 300 es
in vec4 position;
in vec3 normal;
in vec2 texcoord;

uniform mat4 u_matrix;
uniform mat4 u_world;
uniform mat4 u_worldInverseTranspose;
uniform float u_uvScale; 

// VARIÁVEIS DO HEIGHTMAP
uniform bool u_useHeightmap;
uniform sampler2D u_heightmap;
uniform float u_heightScale;

out vec3 v_normal;
out vec3 v_surfaceToView;
out vec2 v_texcoord; 
out vec3 v_worldPosition; 

uniform vec3 u_viewWorldPosition;

void main() {
    vec4 pos = position;
    
    if (u_useHeightmap) {
        float h = texture(u_heightmap, texcoord).r;
        pos.y += h * u_heightScale;
    }

    gl_Position = u_matrix * pos;
    v_worldPosition = (u_world * pos).xyz;
    
    v_normal = mat3(u_worldInverseTranspose) * normal;
    vec3 surfaceWorldPosition = (u_world * pos).xyz;
    v_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
    
    v_texcoord = texcoord * u_uvScale; 
}
`;

export const fs = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToView;
in vec2 v_texcoord; 
in vec3 v_worldPosition;

uniform vec4 u_color;
uniform vec3 u_lightDirection;
uniform bool u_luzLigada; 
uniform bool u_hasTexture;
uniform sampler2D u_texture;
uniform bool u_useHeightmap;
uniform float u_ambientIntensity;
uniform float u_lightIntensity;

// NOVAS VARIÁVEIS PARA OS POSTES DE LUZ
uniform bool u_isLamp;
uniform float u_nightFactor;

out vec4 outColor;

void main() {
    vec4 baseColor = u_color;
    if (u_hasTexture) {
        baseColor = texture(u_texture, v_texcoord) * u_color;
    }

    if (u_luzLigada) {
        vec3 normal = normalize(v_normal);
        
        if (u_useHeightmap) {
            vec3 dx = dFdx(v_worldPosition);
            vec3 dy = dFdy(v_worldPosition);
            normal = normalize(cross(dx, dy));
            if (normal.y < 0.0) normal = -normal; 
        }

        vec3 surfaceToViewDirection = normalize(v_surfaceToView);
        float luzAmbiente = u_ambientIntensity; 
        vec3 lightDir = normalize(u_lightDirection);
        float light = dot(normal, lightDir);
        float luzDifusa = max(light, 0.0) * u_lightIntensity;

        float luzEspecular = 0.0;
        if (luzDifusa > 0.0) {
            float shininess = 50.0; 
            vec3 reflectDir = reflect(-lightDir, normal);
            float specAngle = max(dot(reflectDir, surfaceToViewDirection), 0.0);
            luzEspecular = pow(specAngle, shininess) * u_lightIntensity;
        }
        
        vec3 finalColor = baseColor.rgb * (luzAmbiente + luzDifusa) + luzEspecular;
        
        // MAGIA DO POSTE: Adiciona uma emissão de luz amarela/laranja proporcional ao cair da noite
        if (u_isLamp) {
            finalColor += vec3(1.0, 0.8, 0.3) * u_nightFactor;
        }

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
uniform vec3 u_skyTint;
out vec4 outColor;
void main() {
    vec4 texColor = texture(u_skybox, normalize(v_texcoord));
    outColor = vec4(texColor.rgb * u_skyTint, texColor.a);
}
`;