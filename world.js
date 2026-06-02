import { criarNo } from './engine.js';
import { calcularRotaAleatoria } from './carros_andantes.js';

export const tamanhoCidade = 800;
export const tamanhoLote = 6;

export function construirZeppelin(geometrias) {
    const chassi = criarNo();
    chassi.bufferInfo = geometrias.cubo; 
    chassi.uniforms.u_color = [0.8, 0.8, 0.8, 1.0]; 

    const cabine = criarNo();
    cabine.bufferInfo = geometrias.esfera; 
    cabine.uniforms.u_color = [0.2, 0.2, 0.8, 0.5]; 

    const helice = criarNo();
    helice.bufferInfo = geometrias.cilindro;
    helice.uniforms.u_color = [0.1, 0.1, 0.1, 1.0]; 

    chassi.filhos.push(cabine, helice);
    return { chassi, cabine, helice };
}

export function construirMundo(geometrias, texturasMapa) {
    const chao = criarNo();
    chao.bufferInfo = geometrias.chao;
    chao.uniforms.u_hasTexture = true;
    chao.uniforms.u_texture = texturasMapa.grass;
    chao.uniforms.u_uvScale = 400.0;
    chao.uniforms.u_color = [1, 1, 1, 1];


    // Heightmap
    chao.uniforms.u_useHeightmap = true;
    chao.uniforms.u_heightmap = texturasMapa.heightmap;
    chao.uniforms.u_heightScale = 150.0; 


    chao.localMatrix = twgl.m4.translation([0, 0, 0]);

    const predios = [];
    const nosDaRua = []; 
    const mapaCoordenadasRua = new Map();
    // Cidade é um grid de linhas e colunas de tamanhoLote
    for (let x = -tamanhoCidade/2 + 10; x < tamanhoCidade/2 - 10; x += tamanhoLote) {
        for (let z = -tamanhoCidade/2 + 10; z < tamanhoCidade/2 - 10; z += tamanhoLote) {
            
            let isRoadX = Math.abs(x) % 30 < tamanhoLote;
            let isRoadZ = Math.abs(z) % 30 < tamanhoLote;

            // Ruas e Cruzamentos
            if (isRoadX || isRoadZ) {
                const rua = criarNo();
                rua.bufferInfo = geometrias.lote;
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

            // Prédios Base
            const predio = criarNo();
            predio.bufferInfo = geometrias.cubo;
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

    // Liga as Arestas do Grafo
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

    return { chao, predios, nosDaRua };
}

export function construirFrota(geometrias, nosDaRua, quantidadeCarros) {
    const frota = [];
    const paletaDeCores = [
        [0.8, 0.1, 0.1, 1.0], [0.1, 0.2, 0.8, 1.0], 
        [0.9, 0.8, 0.1, 1.0], [0.9, 0.9, 0.9, 1.0], 
        [0.1, 0.8, 0.3, 1.0]
    ];

    for(let i = 0; i < quantidadeCarros; i++) {
        const carro = criarNo();
        carro.bufferInfo = geometrias.cubo;
        carro.uniforms.u_color = paletaDeCores[Math.floor(Math.random() * paletaDeCores.length)];
        carro.uniforms.u_hasTexture = false;

        const noInicio = nosDaRua[Math.floor(Math.random() * nosDaRua.length)];
        
        frota.push({
            no: carro,
            rota: calcularRotaAleatoria(nosDaRua, noInicio),
            indiceAlvo: 0,
            posX: noInicio.x,
            posZ: noInicio.z,
            rotacaoY: 0,
            velocidade: 0.2 + Math.random() * 0.4 
        });
    }
    return frota;
}