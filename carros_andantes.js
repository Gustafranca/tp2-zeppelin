export function calcularRotaAleatoria(grafo, noOrigem) {
    // Essa função calcula um caminho entre dois pontos da malha viária da cidade. 
    // O destino é escolhido ao acaso; o caminho em si é o menor número de ruas possíveis.
    // BFS — Breadth-First Search
    const noDestino = grafo[Math.floor(Math.random() * grafo.length)];
    if (noOrigem === noDestino) return [noOrigem];

    const visitados = new Set();
    const anteriores = new Map();
    const fila = [noOrigem]; 

    visitados.add(noOrigem);
    let encontrou = false;

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

    const rota = [];
    let rAtual = noDestino;
    while (rAtual) {
        rota.unshift(rAtual);
        rAtual = anteriores.get(rAtual);
    }
    return rota;
}