// ==========================================
// BLOCO 1: INFRAESTRUTURA E SHADERS
// ==========================================
const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl2");

if (!gl) {
    alert("Infelizmente o seu navegador não suporta WebGL2.");
}

const vs = `#version 300 es
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

const fs = `#version 300 es
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

const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

const skyboxVs = `#version 300 es
in vec4 position;
uniform mat4 u_viewDirectionProjection;
out vec3 v_texcoord;

void main() {
    v_texcoord = position.xyz;
    vec4 pos = u_viewDirectionProjection * position;
    gl_Position = pos.xyww;
}
`;

const skyboxFs = `#version 300 es
precision highp float;

in vec3 v_texcoord;
uniform samplerCube u_skybox;
out vec4 outColor;

void main() {
    outColor = texture(u_skybox, normalize(v_texcoord));
}
`;

const skyboxProgramInfo = twgl.createProgramInfo(gl, [skyboxVs, skyboxFs]);


// ==========================================
// BLOCO 2: GEOMETRIAS E ESTRUTURA DE DADOS
// ==========================================
const tamanhoChao = 2000;   
const tamanhoCidade = 800;  
const tamanhoLote = 6; 

const bufferInfoChao = twgl.primitives.createPlaneBufferInfo(gl, tamanhoChao, tamanhoChao);
const bufferInfoLote = twgl.primitives.createPlaneBufferInfo(gl, tamanhoLote, tamanhoLote); 
const bufferInfoCubo = twgl.primitives.createCubeBufferInfo(gl, 2);
const bufferInfoEsfera = twgl.primitives.createSphereBufferInfo(gl, 1, 24, 12);
const bufferInfoCilindro = twgl.primitives.createCylinderBufferInfo(gl, 0.5, 2, 24, 2);
const bufferInfoSkybox = twgl.primitives.createCubeBufferInfo(gl, 1);

const texturasMapa = twgl.createTextures(gl, {
    asphalt:     { src: 'asphalt.png', wrapS: gl.REPEAT, wrapT: gl.REPEAT },
    cruzamento1: { src: 'cruzamento1.png', wrapS: gl.REPEAT, wrapT: gl.REPEAT },
    cruzamento2: { src: 'cruzamento2.png', wrapS: gl.REPEAT, wrapT: gl.REPEAT }
});

const skyboxFaceUrls = [
    'clouds1_east.bmp', 'clouds1_west.bmp', 'clouds1_up.bmp',
    'clouds1_down.bmp', 'clouds1_south.bmp', 'clouds1_north.bmp',
];
const skyboxFaceTargets = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
];

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

const texturaSkybox = gl.createTexture();
gl.bindTexture(gl.TEXTURE_CUBE_MAP, texturaSkybox);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const placeholderFace = new Uint8Array([128, 192, 255, 255]);
skyboxFaceTargets.forEach((target) => {
    gl.texImage2D(target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderFace);
});

Promise.all(skyboxFaceUrls.map(carregarImagem)).then((imagens) => {
    imagens.forEach((img, i) => {
        const quadrado = imagemParaCanvasQuadrado(img);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texturaSkybox);
        gl.texImage2D(skyboxFaceTargets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, quadrado);
    });
}).catch((err) => console.error('Falha ao carregar skybox:', err));

const criarNo = function() {
    return {
        localMatrix: twgl.m4.identity(),
        worldMatrix: twgl.m4.identity(),
        filhos: [],
        bufferInfo: null,
        uniforms: { u_color: [1, 1, 1, 1], u_hasTexture: false, u_texture: null }
    };
};


// ==========================================
// BLOCO 3: MONTAGEM DO MUNDO E FROTA AUTÓNOMA
// ==========================================
const chao = criarNo();
chao.bufferInfo = bufferInfoChao;
chao.uniforms.u_color = [0.2, 0.6, 0.2, 1.0]; 
chao.localMatrix = twgl.m4.translation([0, 0, 0]);

const chassi = criarNo();
chassi.bufferInfo = bufferInfoCubo; 
chassi.uniforms.u_color = [0.8, 0.8, 0.8, 1.0]; 

const cabine = criarNo();
cabine.bufferInfo = bufferInfoEsfera; 
cabine.uniforms.u_color = [0.2, 0.2, 0.8, 0.5]; 

const helice = criarNo();
helice.bufferInfo = bufferInfoCilindro;
helice.uniforms.u_color = [0.1, 0.1, 0.1, 1.0]; 

chassi.filhos.push(cabine, helice);

const predios = [];

const nosDaRua = []; 
const mapaCoordenadasRua = new Map();

for (let x = -tamanhoCidade/2 + 10; x < tamanhoCidade/2 - 10; x += tamanhoLote) {
    for (let z = -tamanhoCidade/2 + 10; z < tamanhoCidade/2 - 10; z += tamanhoLote) {
        
        let isRoadX = Math.abs(x) % 30 < tamanhoLote;
        let isRoadZ = Math.abs(z) % 30 < tamanhoLote;

        if (isRoadX || isRoadZ) {
            const rua = criarNo();
            rua.bufferInfo = bufferInfoLote;
            rua.uniforms.u_hasTexture = true; 
            rua.uniforms.u_color = [1, 1, 1, 1]; 
            
            if (isRoadX && isRoadZ) {
                rua.uniforms.u_texture = (Math.random() > 0.5) ? texturasMapa.cruzamento1 : texturasMapa.cruzamento2; 
            } else {
                rua.uniforms.u_texture = texturasMapa.asphalt; 
                if (!isRoadX) rua.localMatrix = twgl.m4.rotationY(Math.PI / 2);
            }
            
            let matrizTranslacao = twgl.m4.translation([x, 0.05, z]);
            rua.localMatrix = twgl.m4.multiply(matrizTranslacao, rua.localMatrix);
            rua.worldMatrix = rua.localMatrix;
            
            predios.push(rua);

            const noNavegavel = { x: x, z: z, vizinhos: [] };
            nosDaRua.push(noNavegavel);
            mapaCoordenadasRua.set(`${x},${z}`, noNavegavel);
            
            continue; 
        }

        if (Math.random() > 0.8) {
            const asfalto = criarNo();
            asfalto.bufferInfo = bufferInfoLote;
            asfalto.uniforms.u_hasTexture = true;
            asfalto.uniforms.u_texture = texturasMapa.asphalt;
            asfalto.uniforms.u_color = [1, 1, 1, 1];
            asfalto.localMatrix = twgl.m4.translation([x, 0.03, z]); 
            asfalto.worldMatrix = asfalto.localMatrix;
            predios.push(asfalto);
            continue; 
        }

        const predio = criarNo();
        predio.bufferInfo = bufferInfoCubo;
        const tom = 0.3 + Math.random() * 0.5;
        predio.uniforms.u_color = [tom, tom * 0.9, tom * 0.8, 1.0]; 
        const escalaX = 0.8 + Math.random() * 1.5; 
        const escalaY = 0.5 + Math.random() * 6.0; 
        const escalaZ = 0.8 + Math.random() * 1.5;
        const offsetX = (Math.random() - 0.5) * 2;
        const offsetZ = (Math.random() - 0.5) * 2;

        let matriz = twgl.m4.translation([x + offsetX, escalaY, z + offsetZ]);
        matriz = twgl.m4.scale(matriz, [escalaX, escalaY, escalaZ]);
        predio.localMatrix = matriz;
        predio.worldMatrix = predio.localMatrix; 
        predios.push(predio);
    }
}

// CONSTRUIR AS ARESTAS DO GRAFO
nosDaRua.forEach(no => {
    const vizinhosPossiveis = [
        mapaCoordenadasRua.get(`${no.x + tamanhoLote},${no.z}`), 
        mapaCoordenadasRua.get(`${no.x - tamanhoLote},${no.z}`), 
        mapaCoordenadasRua.get(`${no.x},${no.z + tamanhoLote}`), 
        mapaCoordenadasRua.get(`${no.x},${no.z - tamanhoLote}`)  
    ];
    vizinhosPossiveis.forEach(v => {
        if (v) no.vizinhos.push(v);
    });
});

// DIJKSTRA OTIMIZADO PARA DESTINOS ALEATÓRIOS (Sem "Overhead" na CPU)
function calcularRotaAleatoria(grafo, noOrigem) {
    const noDestino = grafo[Math.floor(Math.random() * grafo.length)];
    if (noOrigem === noDestino) return [noOrigem];

    const visitados = new Set();
    const anteriores = new Map();
    const fila = [noOrigem]; 

    visitados.add(noOrigem);
    let encontrou = false;

    // Procura em largura (BFS) que aborta instantaneamente quando acha o destino
    while (fila.length > 0) {
        const atual = fila.shift();
        
        if (atual === noDestino) {
            encontrou = true;
            break;
        }

        atual.vizinhos.forEach(vizinho => {
            if (!visitados.has(vizinho)) {
                visitados.add(vizinho);
                anteriores.set(vizinho, atual);
                fila.push(vizinho);
            }
        });
    }

    if (!encontrou) return [noOrigem];

    // Constrói a rota do destino de volta à origem
    const rota = [];
    let rAtual = noDestino;
    while (rAtual) {
        rota.unshift(rAtual);
        rAtual = anteriores.get(rAtual);
    }
    return rota;
}

// INSTANCIAÇÃO DA FROTA
const frota = [];
const quantidadeCarros = 30; 
const paletaDeCores = [
    [0.8, 0.1, 0.1, 1.0], // Vermelho
    [0.1, 0.2, 0.8, 1.0], // Azul
    [0.9, 0.8, 0.1, 1.0], // Amarelo Táxi
    [0.9, 0.9, 0.9, 1.0], // Branco
    [0.1, 0.8, 0.3, 1.0]  // Verde
];

for(let i = 0; i < quantidadeCarros; i++) {
    const carro = criarNo();
    carro.bufferInfo = bufferInfoCubo;
    carro.uniforms.u_color = paletaDeCores[Math.floor(Math.random() * paletaDeCores.length)];
    carro.uniforms.u_hasTexture = false;

    const noInicio = nosDaRua[Math.floor(Math.random() * nosDaRua.length)];
    
    frota.push({
        no: carro,
        rota: calcularRotaAleatoria(nosDaRua, noInicio), // Define logo um destino dinâmico
        indiceAlvo: 0,
        posX: noInicio.x,
        posZ: noInicio.z,
        rotacaoY: 0,
        velocidade: 0.2 + Math.random() * 0.4 
    });
}

const objetosNaCena = [chao, chassi, ...frota.map(c => c.no), ...predios]; 


// ==========================================
// BLOCO 4: ESTADO E CONTROLES DE INPUT
// ==========================================
const teclas = {};
let zepX = 0;
let zepY = 15; 
let zepZ = 0;
const velocidade = 0.25; 

let cameraAtiva = 3; 
let indiceVisaoLateral = 0; 
const distanciaCamera = 15;
let luzLigada = true; 

let cameraYaw = 0;
let cameraPitch = 0.5; 
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mousemove', (e) => {
    if (isDragging && cameraAtiva === 3) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        cameraYaw -= deltaX * 0.005;
        cameraPitch += deltaY * 0.005;
        cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraPitch));
    }
});

window.addEventListener('keydown', (e) => {
    teclas[e.code] = true;
    if (e.code === 'Digit1') cameraAtiva = 1;
    if (e.code === 'Digit2') cameraAtiva = 2;
    if (e.code === 'Digit3') cameraAtiva = 3; 
    if (e.code === 'KeyC' && cameraAtiva === 2) indiceVisaoLateral = (indiceVisaoLateral + 1) % 4; 
    if (e.code === 'KeyL') luzLigada = !luzLigada; 
});
window.addEventListener('keyup', (e) => { teclas[e.code] = false; });


// ==========================================
// BLOCO 5: MOTOR DE RENDERIZAÇÃO
// ==========================================
function desenharNohEFilhos(gl, no, viewProjectionMatrix, programInfo, cameraPosition, direcaoLuz, luzEstado) {
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
        u_hasTexture: no.uniforms.u_hasTexture
    };
    
    if (no.uniforms.u_hasTexture) uniformsAEnviar.u_texture = no.uniforms.u_texture;

    twgl.setUniforms(programInfo, uniformsAEnviar);
    twgl.setBuffersAndAttributes(gl, programInfo, no.bufferInfo);
    twgl.drawBufferInfo(gl, no.bufferInfo);

    no.filhos.forEach(filho => {
        desenharNohEFilhos(gl, filho, viewProjectionMatrix, programInfo, cameraPosition, direcaoLuz, luzEstado);
    });
}

function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    gl.enable(gl.DEPTH_TEST); 
    gl.clearColor(0.53, 0.81, 0.92, 1.0); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ==========================================
    // FÍSICA DO ZEPPELIN E FROTA
    // ==========================================
    if (teclas['ArrowUp']) zepZ -= velocidade;
    if (teclas['ArrowDown']) zepZ += velocidade;
    if (teclas['ArrowLeft']) zepX -= velocidade;
    if (teclas['ArrowRight']) zepX += velocidade;

    frota.forEach(carro => {
        if (carro.indiceAlvo < carro.rota.length) {
            const alvo = carro.rota[carro.indiceAlvo];
            const distZ = alvo.z - carro.posZ;
            const distX = alvo.x - carro.posX;
            const distanciaRestante = Math.sqrt(distX * distX + distZ * distZ);

            if (distanciaRestante < carro.velocidade) {
                carro.posX = alvo.x;
                carro.posZ = alvo.z;
                carro.indiceAlvo++;
            } else {
                carro.posX += (distX / distanciaRestante) * carro.velocidade;
                carro.posZ += (distZ / distanciaRestante) * carro.velocidade;
                carro.rotacaoY = Math.atan2(distX, distZ);
            }
        } else {
            // QUANDO CHEGAR AO DESTINO: O carro escolhe um NOVO local aleatório
            carro.rota = calcularRotaAleatoria(nosDaRua, carro.rota[carro.rota.length - 1]);
            carro.indiceAlvo = 0;
        }

        let matrizCarroTrans = twgl.m4.translation([carro.posX, 1.0, carro.posZ]); 
        let matrizCarroRot = twgl.m4.rotationY(carro.rotacaoY);
        carro.no.localMatrix = twgl.m4.scale(twgl.m4.multiply(matrizCarroTrans, matrizCarroRot), [1.0, 0.6, 2.0]);
        carro.no.worldMatrix = carro.no.localMatrix;
    });

    const fov = 60 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = twgl.m4.perspective(fov, aspect, 0.1, 2000.0); 

    const target = [zepX, zepY, zepZ]; 
    const up = [0, 1, 0];
    let cameraPosition = [0, 0, 0];

    if (cameraAtiva === 1) {
        cameraPosition = [zepX, zepY + distanciaCamera, zepZ + 0.1];
    } else if (cameraAtiva === 2) {
        const alturaCamera = 4;
        switch (indiceVisaoLateral) {
            case 0: cameraPosition = [zepX, zepY + alturaCamera, zepZ - distanciaCamera]; break; 
            case 1: cameraPosition = [zepX, zepY + alturaCamera, zepZ + distanciaCamera]; break; 
            case 2: cameraPosition = [zepX + distanciaCamera, zepY + alturaCamera, zepZ]; break; 
            case 3: cameraPosition = [zepX - distanciaCamera, zepY + alturaCamera, zepZ]; break; 
        }
    } else if (cameraAtiva === 3) {
        const raio = 25; 
        const camX = zepX + raio * Math.cos(cameraPitch) * Math.sin(cameraYaw);
        const camY = zepY + raio * Math.sin(cameraPitch);
        const camZ = zepZ + raio * Math.cos(cameraPitch) * Math.cos(cameraYaw);
        cameraPosition = [camX, camY, camZ];
    }

    const cameraMatrix = twgl.m4.lookAt(cameraPosition, target, up);
    let viewMatrix = twgl.m4.inverse(cameraMatrix);
    const viewProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrix);

    // SKYBOX
    gl.useProgram(skyboxProgramInfo.program);
    gl.disable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    let viewMatrixCeu = twgl.m4.copy(viewMatrix);
    viewMatrixCeu[12] = 0; viewMatrixCeu[13] = 0; viewMatrixCeu[14] = 0;
    let viewDirectionProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrixCeu);
    twgl.setUniforms(skyboxProgramInfo, {
        u_viewDirectionProjection: viewDirectionProjectionMatrix,
        u_skybox: texturaSkybox,
    });
    twgl.setBuffersAndAttributes(gl, skyboxProgramInfo, bufferInfoSkybox);
    twgl.drawBufferInfo(gl, bufferInfoSkybox);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);

    // CIDADE E OBJETOS NORMAIS
    gl.useProgram(programInfo.program);
    const direcaoDaLuz = twgl.v3.normalize([0.5, 1.0, 0.5]);

    chao.worldMatrix = chao.localMatrix; 
    
    chassi.localMatrix = twgl.m4.translation([zepX, zepY, zepZ]); 
    chassi.worldMatrix = chassi.localMatrix;
    cabine.localMatrix = twgl.m4.translation([0, 1, 0]); 
    cabine.worldMatrix = twgl.m4.multiply(chassi.worldMatrix, cabine.localMatrix);
    let translacaoHelice = twgl.m4.translation([0, 0, 1.5]); 
    let rotacaoHelice = twgl.m4.rotationZ(time * 0.005); 
    helice.localMatrix = twgl.m4.multiply(translacaoHelice, rotacaoHelice);
    helice.worldMatrix = twgl.m4.multiply(chassi.worldMatrix, helice.localMatrix);

    objetosNaCena.forEach(no => {
        desenharNohEFilhos(gl, no, viewProjectionMatrix, programInfo, cameraPosition, direcaoDaLuz, luzLigada);
    });

    requestAnimationFrame(render);
}

requestAnimationFrame(render);