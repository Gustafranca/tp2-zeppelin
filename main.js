import { vs, fs, skyboxVs, skyboxFs } from './shaders.js';
import { criarTexturaSkybox, desenharNohEFilhos } from './engine.js';
import { calcularRotaAleatoria } from './carros_andantes.js';
import { construirZeppelin, construirMundo, construirFrota } from './world.js';

const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl2");

if (!gl) alert("Infelizmente o seu navegador não suporta WebGL2.");

const programInfo = twgl.createProgramInfo(gl, [vs, fs]);
const skyboxProgramInfo = twgl.createProgramInfo(gl, [skyboxVs, skyboxFs]);

const geometrias = {
    chao: twgl.primitives.createPlaneBufferInfo(gl, 2000, 2000),
    lote: twgl.primitives.createPlaneBufferInfo(gl, 6, 6),
    cubo: twgl.primitives.createCubeBufferInfo(gl, 2),
    esfera: twgl.primitives.createSphereBufferInfo(gl, 1, 24, 12),
    cilindro: twgl.primitives.createCylinderBufferInfo(gl, 0.5, 2, 24, 2),
    skybox: twgl.primitives.createCubeBufferInfo(gl, 1)
};
const texturefolder = 'textures/';
const texturasMapa = twgl.createTextures(gl, {
    asphalt:     { src: texturefolder + 'asphalt.png', wrapS: gl.REPEAT, wrapT: gl.REPEAT },
    cruzamento1: { src: texturefolder + 'cruzamento1.png', wrapS: gl.REPEAT, wrapT: gl.REPEAT },
    cruzamento2: { src: texturefolder + 'cruzamento2.png', wrapS: gl.REPEAT, wrapT: gl.REPEAT }
});

const skyboxFaceUrls = [
    'skybox/clouds1_east.bmp', 'skybox/clouds1_west.bmp', 'skybox/clouds1_up.bmp',
    'skybox/clouds1_down.bmp', 'skybox/clouds1_south.bmp', 'skybox/clouds1_north.bmp',
];
const texturaSkybox = criarTexturaSkybox(gl, skyboxFaceUrls);

const { chao, predios, nosDaRua } = construirMundo(geometrias, texturasMapa);
const { chassi, cabine, helice } = construirZeppelin(geometrias);
const frota = construirFrota(geometrias, nosDaRua, 300);

const objetosNaCena = [chao, chassi, ...frota.map(c => c.no), ...predios];

const teclas = {};
let zepX = 0, zepY = 15, zepZ = 0;
const velocidade = 0.25; 
let cameraAtiva = 3; 
let indiceVisaoLateral = 0; 
const distanciaCamera = 15;
let luzLigada = true; 

let cameraYaw = 0, cameraPitch = 0.5, isDragging = false, lastMouseX = 0, lastMouseY = 0;

canvas.addEventListener('mousedown', e => { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; });
canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mousemove', e => {
    if (isDragging && cameraAtiva === 3) {
        cameraYaw -= (e.clientX - lastMouseX) * 0.005;
        cameraPitch += (e.clientY - lastMouseY) * 0.005;
        cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraPitch));
        lastMouseX = e.clientX; lastMouseY = e.clientY;
    }
});
window.addEventListener('keydown', e => {
    teclas[e.code] = true;
    if (e.code === 'Digit1') cameraAtiva = 1;
    if (e.code === 'Digit2') cameraAtiva = 2;
    if (e.code === 'Digit3') cameraAtiva = 3; 
    if (e.code === 'KeyC' && cameraAtiva === 2) indiceVisaoLateral = (indiceVisaoLateral + 1) % 4; 
    if (e.code === 'KeyL') luzLigada = !luzLigada; 
});
window.addEventListener('keyup', e => teclas[e.code] = false);

// Loop Principal
function render(time) {
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST); 
    gl.clearColor(0.53, 0.81, 0.92, 1.0); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ==========================================
    // SISTEMA DE DIA E NOITE (15 Minutos)
    // ==========================================
    const aceleradorTempo = 10.0; // Mude para 1.0 para ter exatamente 15 min reais. Está a 10x para testes.
    const tempoEmSegundos = (time / 1000) * aceleradorTempo;
    
    const cicloTotal = 900;
    const duracaoDia = 600;
    const duracaoNoite = 300;// 5 minutos
    
    let instante = tempoEmSegundos % cicloTotal;
    let anguloSol = 0;

    if (instante < duracaoDia) {
        anguloSol = (instante / duracaoDia) * Math.PI; 
    } else {
        anguloSol = Math.PI + ((instante - duracaoDia) / duracaoNoite) * Math.PI; 
    }

    // Calcular as posições e luz baseadas no ângulo
    let sunY = Math.sin(anguloSol);
    let sunX = Math.cos(anguloSol);
    const direcaoDaLuz = twgl.v3.normalize([sunX, sunY, 0.3]); // 0.3 dá uma ligeira inclinação à luz

    let luzIntensidade = Math.max(0.0, sunY); // O sol apaga quando a altura Y é negativa
    let luzAmbienteBase = 0.1 + Math.max(0.0, sunY) * 0.3; // De dia é 0.4, de noite baixa para 0.1
    
    // Transições de Cor do Céu e Iluminação
    let skyTint = [1, 1, 1];
    if (sunY > 0.2) {
        // Dia Claro
        skyTint = [1.0, 1.0, 1.0]; 
    } else if (sunY > 0.0) {
        // Pôr do sol / Amanhecer (Céu alaranjado)
        let factor = sunY / 0.2; 
        skyTint = twgl.v3.lerp([1.0, 0.3, 0.1], [1.0, 1.0, 1.0], factor);
    } else if (sunY > -0.2) {
        // Crepúsculo noturno
        let factor = (sunY + 0.2) / 0.2;
        skyTint = twgl.v3.lerp([0.02, 0.02, 0.05], [1.0, 0.3, 0.1], factor);
    } else {
        // Noite escura
        skyTint = [0.02, 0.02, 0.05]; 
    }


    if (teclas['ArrowUp']) zepZ -= velocidade;
    if (teclas['ArrowDown']) zepZ += velocidade;
    if (teclas['ArrowLeft']) zepX -= velocidade;
    if (teclas['ArrowRight']) zepX += velocidade;

    // Atualização da Frota IA
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
            carro.rota = calcularRotaAleatoria(nosDaRua, carro.rota[carro.rota.length - 1]);
            carro.indiceAlvo = 0;
        }

        let matrizCarroTrans = twgl.m4.translation([carro.posX, 1.0, carro.posZ]); 
        let matrizCarroRot = twgl.m4.rotationY(carro.rotacaoY);
        carro.no.localMatrix = twgl.m4.scale(twgl.m4.multiply(matrizCarroTrans, matrizCarroRot), [1.0, 0.6, 2.0]);
        carro.no.worldMatrix = carro.no.localMatrix;
    });

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = twgl.m4.perspective(60 * Math.PI / 180, aspect, 0.1, 2000.0); 
    const target = [zepX, zepY, zepZ]; 
    let cameraPosition = [0, 0, 0];

    if (cameraAtiva === 1) {
        cameraPosition = [zepX, zepY + distanciaCamera, zepZ + 0.1];
    } else if (cameraAtiva === 2) {
        const alt = 4;
        switch (indiceVisaoLateral) {
            case 0: cameraPosition = [zepX, zepY + alt, zepZ - distanciaCamera]; break; 
            case 1: cameraPosition = [zepX, zepY + alt, zepZ + distanciaCamera]; break; 
            case 2: cameraPosition = [zepX + distanciaCamera, zepY + alt, zepZ]; break; 
            case 3: cameraPosition = [zepX - distanciaCamera, zepY + alt, zepZ]; break; 
        }
    } else if (cameraAtiva === 3) {
        cameraPosition = [
            zepX + 25 * Math.cos(cameraPitch) * Math.sin(cameraYaw),
            zepY + 25 * Math.sin(cameraPitch),
            zepZ + 25 * Math.cos(cameraPitch) * Math.cos(cameraYaw)
        ];
    }

    const cameraMatrix = twgl.m4.lookAt(cameraPosition, target, [0, 1, 0]);
    const viewMatrix = twgl.m4.inverse(cameraMatrix);
    const viewProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrix);

    // Skybox (Renderizado com o u_skyTint do ciclo de tempo)
    gl.useProgram(skyboxProgramInfo.program);
    gl.disable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    let viewMatrixCeu = twgl.m4.copy(viewMatrix);
    viewMatrixCeu[12] = 0; viewMatrixCeu[13] = 0; viewMatrixCeu[14] = 0;
    twgl.setUniforms(skyboxProgramInfo, {
        u_viewDirectionProjection: twgl.m4.multiply(projectionMatrix, viewMatrixCeu),
        u_skybox: texturaSkybox,
        u_skyTint: skyTint
    });
    twgl.setBuffersAndAttributes(gl, skyboxProgramInfo, geometrias.skybox);
    twgl.drawBufferInfo(gl, geometrias.skybox);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);

    // Objetos Normais
    gl.useProgram(programInfo.program);
    chao.worldMatrix = chao.localMatrix; 
    
    chassi.localMatrix = twgl.m4.translation([zepX, zepY, zepZ]); 
    chassi.worldMatrix = chassi.localMatrix;
    cabine.localMatrix = twgl.m4.translation([0, 1, 0]); 
    cabine.worldMatrix = twgl.m4.multiply(chassi.worldMatrix, cabine.localMatrix);
    helice.localMatrix = twgl.m4.multiply(twgl.m4.translation([0, 0, 1.5]), twgl.m4.rotationZ(time * 0.005));
    helice.worldMatrix = twgl.m4.multiply(chassi.worldMatrix, helice.localMatrix);

    // Passar os novos parâmetros de tempo para o motor
    objetosNaCena.forEach(no => {
        desenharNohEFilhos(gl, no, viewProjectionMatrix, programInfo, cameraPosition, direcaoDaLuz, luzLigada, luzAmbienteBase, luzIntensidade);
    });

    requestAnimationFrame(render);
}
requestAnimationFrame(render);