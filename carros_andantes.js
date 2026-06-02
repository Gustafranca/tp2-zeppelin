export function calcularRotaAleatoria(grafo, noOrigem) {
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