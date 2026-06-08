# TP2 — Concrete Jungle

Simulação 3D em **WebGL 2** de um zeppelin sobrevoando uma cidade procedural. O jogador controla o dirigível sobre um mapa com ruas, prédios, carros em movimento e ciclo dia/noite.

## Controles

| Tecla / Ação | Função |
|---|---|
| **Setas** | Mover o zeppelin (eixo X e Z) |
| **1** | Câmera traseira (seguindo o zeppelin) |
| **2** | Câmera lateral (4 posições) |
| **3** | Câmera livre (clique e arraste para orbitar) |
| **C** | Alternar visão lateral (com câmera 2 ativa) |
| **L** | Ligar / desligar iluminação |

## Estrutura do projeto

```
├── index.html          # Página principal e UI de controles
├── main.js             # Loop de renderização, câmeras e animações
├── engine.js           # Motor gráfico: nós da cena, carregamento OBJ, skybox
├── world.js            # Geração do mundo, zeppelin e frota de carros
├── carros_andantes.js  # Pathfinding (BFS) para rotas dos carros
├── shaders.js          # Vertex e fragment shaders (iluminação, heightmap, skybox)
├── textures/           # Texturas de asfalto, cruzamentos, grama e heightmap
├── skybox/             # Faces da skybox (nuvens)
└── blender/            # Modelos 3D (.obj): carros, prédios e postes
```

## Tecnologias

- **WebGL 2** — renderização 3D
- **[TWGL.js](https://twgljs.org/)** — utilitários WebGL (matrizes, buffers, texturas)
- **GLSL** — shaders customizados para iluminação, relevo e skybox

---

## Requisitos obrigatórios

### Mundo

- **3 tipos de prédio** distribuídos uniformemente pela malha da cidade
- **1 tipo de carro com várias variações** (modelos e cores aleatórias)
- **Texturas de asfalto** e **texturas de cruzamento** nas interseções
- **Zeppelin hierárquico** composto por chassi, balão, cabine, hélice e leme

### Câmera

- **3 tipos de câmera obrigatórios:**
  1. Traseira — posicionada atrás do zeppelin
  2. Lateral — quatro ângulos alternáveis com a tecla **C**
  3. Livre — orbita o zeppelin com o mouse (clique e arraste)
- Câmera livre adicionada para facilitar a observação durante o desenvolvimento

### Gráficos

- **Iluminação** direcional com componentes difusa e ambiente
- **Postes** Tentativa de fazer um spotlight com os postes

---

## Features extras

### Mundo

- **Relevo usando textura (height map)** — deslocamento de vértices no chão via shader
- **Skybox** — cubo de céu com texturas de nuvens e tinte dinâmico
- **Modelos em formato `.obj`** — carros importados do Blender (`blender/car_*.obj`)
- **Objetos animados** — frota de ~300 carros percorrendo rotas aleatórias pelas ruas (pathfinding BFS)

### Gráficos

- **Ciclo dia/noite** — sol animado, variação de intensidade luminosa, céu com tons de pôr do sol e noite, postes acendem à noite
- **Câmera extra** — câmera livre controlada pelo mouse (além das 3 exigidas no roteiro)
