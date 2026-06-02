export function criarNo() {
    return {
        localMatrix: twgl.m4.identity(),
        worldMatrix: twgl.m4.identity(),
        filhos: [],
        bufferInfo: null,
        uniforms: { 
            u_color: [1, 1, 1, 1], 
            u_hasTexture: false, 
            u_texture: null,
            u_uvScale: 1.0,
            u_useHeightmap: false, // NOVO
            u_heightmap: null,     // NOVO
            u_heightScale: 0.0     // NOVO
        }
    };
}

export function desenharNohEFilhos(gl, no, viewProjectionMatrix, programInfo, cameraPosition, direcaoLuz, luzEstado, ambientIntensity, lightIntensity) {
    const matrixFinal = twgl.m4.multiply(viewProjectionMatrix, no.worldMatrix);
    const worldInverseTranspose = twgl.m4.transpose(twgl.m4.inverse(no.worldMatrix));

    let uniformsAEnviar = {
        u_matrix: matrixFinal,
        u_world: no.worldMatrix,
        u_worldInverseTranspose: worldInverseTranspose,
        u_color: no.uniforms.u_color,
        u_viewWorldPosition: cameraPosition,
        u_lightDirection: direcaoLuz,
        u_luzLigada: luzEstado,
        u_hasTexture: no.uniforms.u_hasTexture,
        u_ambientIntensity: ambientIntensity,
        u_lightIntensity: lightIntensity,
        u_uvScale: no.uniforms.u_uvScale !== undefined ? no.uniforms.u_uvScale : 1.0,
        u_useHeightmap: no.uniforms.u_useHeightmap !== undefined ? no.uniforms.u_useHeightmap : false,
        u_heightScale: no.uniforms.u_heightScale || 0.0
    };
    
    if (no.uniforms.u_hasTexture) uniformsAEnviar.u_texture = no.uniforms.u_texture;
    if (no.uniforms.u_useHeightmap) uniformsAEnviar.u_heightmap = no.uniforms.u_heightmap;

    twgl.setUniforms(programInfo, uniformsAEnviar);
    twgl.setBuffersAndAttributes(gl, programInfo, no.bufferInfo);
    twgl.drawBufferInfo(gl, no.bufferInfo);

    no.filhos.forEach(filho => {
        desenharNohEFilhos(gl, filho, viewProjectionMatrix, programInfo, cameraPosition, direcaoLuz, luzEstado, ambientIntensity, lightIntensity);
    });
}

function carregarImagem(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('falha ao carregar ' + url));
        img.src = url;
    });
}

function imagemParaCanvasQuadrado(img) {
    const size = Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, (size - img.width) / 2, (size - img.height) / 2);
    return canvas;
}

export function criarTexturaSkybox(gl, urls) {
    const texturaSkybox = gl.createTexture();
    const skyboxFaceTargets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texturaSkybox);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const placeholderFace = new Uint8Array([128, 192, 255, 255]);
    skyboxFaceTargets.forEach((target) => {
        gl.texImage2D(target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderFace);
    });

    Promise.all(urls.map(carregarImagem)).then((imagens) => {
        imagens.forEach((img, i) => {
            const quadrado = imagemParaCanvasQuadrado(img);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texturaSkybox);
            gl.texImage2D(skyboxFaceTargets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, quadrado);
        });
    }).catch(err => console.error('Falha ao carregar skybox:', err));

    return texturaSkybox;
}