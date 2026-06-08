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
            u_useHeightmap: false, 
            u_heightmap: null,     
            u_heightScale: 0.0,
            u_isLamp: false
        }
    };
}


export function desenharNohEFilhos(gl, no, viewProjectionMatrix, programInfo, cameraPosition, direcaoLuz, luzEstado, ambientIntensity, lightIntensity, nightFactor = 0.0) {
    const matrixFinal = twgl.m4.multiply(viewProjectionMatrix, no.worldMatrix);
    const worldInverseTranspose = twgl.m4.transpose(twgl.m4.inverse(no.worldMatrix));

    let uniformsAEnviar = {
        u_matrix: matrixFinal, // matriz de projeção
        u_world: no.worldMatrix, // matriz do mundo
        u_worldInverseTranspose: worldInverseTranspose, 
        u_color: no.uniforms.u_color, // cor do objeto
        u_viewWorldPosition: cameraPosition, // posição da camera
        u_lightDirection: direcaoLuz,
        u_luzLigada: luzEstado, // estado da luz
        u_hasTexture: no.uniforms.u_hasTexture,
        u_ambientIntensity: ambientIntensity, // intensidade da luz ambiente
        u_lightIntensity: lightIntensity, // intensidade da luz difusa
        u_uvScale: no.uniforms.u_uvScale !== undefined ? no.uniforms.u_uvScale : 1.0,
        u_useHeightmap: no.uniforms.u_useHeightmap !== undefined ? no.uniforms.u_useHeightmap : false,
        u_heightScale: no.uniforms.u_heightScale || 0.0,
        u_isLamp: no.uniforms.u_isLamp || false, // Passa a flag do poste
        u_nightFactor: nightFactor               // Passa a escuridão atual
    };
    
    if (no.uniforms.u_hasTexture) uniformsAEnviar.u_texture = no.uniforms.u_texture;
    if (no.uniforms.u_useHeightmap) uniformsAEnviar.u_heightmap = no.uniforms.u_heightmap;

    twgl.setUniforms(programInfo, uniformsAEnviar);
    
    if (no.bufferInfo) {
        twgl.setBuffersAndAttributes(gl, programInfo, no.bufferInfo);
        twgl.drawBufferInfo(gl, no.bufferInfo);
    }

    no.filhos.forEach(filho => {
        // Repassa o nightFactor para os filhos
        desenharNohEFilhos(gl, filho, viewProjectionMatrix, programInfo, cameraPosition, direcaoLuz, luzEstado, ambientIntensity, lightIntensity, nightFactor);
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

// converter imagem para canvas quadrado
function imagemParaCanvasQuadrado(img) {
    const size = Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, (size - img.width) / 2, (size - img.height) / 2);
    return canvas;
}

// criar textura skybox
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


// carregar objeto do blender
export async function carregarObj(gl, url, isCarro = true) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Não foi possível carregar ' + url);
    const text = await response.text();

    const objPositions = [];
    const objTexcoords = [];
    const objNormals = [];

    const webglVertexData = [
        [], [], []
    ];

    function addVertex(vert) {
        const ptn = vert.split('/');
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) return;
            const objIndex = parseInt(objIndexStr);
            const arrayLen = i === 0 ? objPositions.length : i === 1 ? objTexcoords.length : objNormals.length;
            const index = objIndex > 0 ? objIndex - 1 : objIndex + arrayLen;
            
            if (i === 0) webglVertexData[0].push(...objPositions[index]); // posições
            else if (i === 1) webglVertexData[1].push(...objTexcoords[index]); // texturas
            else if (i === 2) webglVertexData[2].push(...objNormals[index]); // normais
        });
    }

    const lines = text.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (line === '' || line.startsWith('#')) continue;
        const parts = line.split(/\s+/);
        const keyword = parts.shift();
        
        if (keyword === 'v') objPositions.push(parts.map(parseFloat));
        else if (keyword === 'vn') objNormals.push(parts.map(parseFloat));
        else if (keyword === 'vt') objTexcoords.push(parts.map(parseFloat));
        else if (keyword === 'f') {
            const numTriangles = parts.length - 2;
            for (let tri = 0; tri < numTriangles; ++tri) {
                addVertex(parts[0]);
                addVertex(parts[tri + 1]);
                addVertex(parts[tri + 2]);
            }
        }
    }

    const pos = webglVertexData[0]; // posições
    if (pos.length > 0) {
        let minX = Infinity, minY = Infinity, minZ = Infinity; // valores minimos
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity; // valores maximos
        
        for (let i = 0; i < pos.length; i += 3) {
            if (pos[i] < minX) minX = pos[i]; if (pos[i] > maxX) maxX = pos[i]; // posições
            if (pos[i+1] < minY) minY = pos[i+1]; if (pos[i+1] > maxY) maxY = pos[i+1]; // texturas
            if (pos[i+2] < minZ) minZ = pos[i+2]; if (pos[i+2] > maxZ) maxZ = pos[i+2]; // normais
        }
        
        const cX = (minX + maxX) / 2;
        const cZ = (minZ + maxZ) / 2;
        
        let sizeX = maxX - minX;
        let sizeY = maxY - minY;
        let sizeZ = maxZ - minZ;
        // carros tem que ser esticados para frente, porque a textura do blender não estava correta
        if (isCarro) { 
            for (let i = 0; i < pos.length; i += 3) {
                pos[i] -= cX;
                pos[i+1] -= minY; 
                pos[i+2] -= cZ;
            }

            if (sizeX > sizeZ) {
                for (let i = 0; i < pos.length; i += 3) {
                    let tempX = pos[i]; // posições
                    pos[i] = pos[i + 2];
                    pos[i + 2] = -tempX;
                }
                const norms = webglVertexData[2];
                if (norms.length > 0) {
                    for (let i = 0; i < norms.length; i += 3) {
                        let tempX = norms[i];
                        norms[i] = norms[i + 2];
                        norms[i + 2] = -tempX;
                    }
                }
                let temp = sizeX; sizeX = sizeZ; sizeZ = temp;
            }

            const alvoComprimento = 3.0; 
            const escalaCorreta = alvoComprimento / sizeZ;
            for (let i = 0; i < pos.length; i++) { pos[i] *= escalaCorreta; }

        } else {
            // Centraliza em X e Z, base no chão (minY), e ajusta ALTURA (Y) para 4.0
            const alvoAltura = 4.0;
            const escalaCorreta = alvoAltura / (sizeY || 1.0);
            for (let i = 0; i < pos.length; i += 3) {
                pos[i]   = (pos[i] - cX) * escalaCorreta;
                pos[i+1] = (pos[i+1] - minY) * escalaCorreta; 
                pos[i+2] = (pos[i+2] - cZ) * escalaCorreta;
            }
        }
    }

    const arrays = { position: webglVertexData[0] };
    if (webglVertexData[1].length > 0) arrays.texcoord = webglVertexData[1];
    if (webglVertexData[2].length > 0) arrays.normal = webglVertexData[2];

    return twgl.createBufferInfoFromArrays(gl, arrays);
}