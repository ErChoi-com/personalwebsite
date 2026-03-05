export function gaussianRender(x, y, mean, stdev) {
    let c;
    let colorMatrix = [];
    for (let j = 0; j < y; j++) {
        colorMatrix[j] = [];
        for (let i = 0; i < x; i++) {
            c = mean + stdev * Math.random();
            colorMatrix[j][i] = {r : c, g : c, b : c};
        }
    }
    return colorMatrix;
}
