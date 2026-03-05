export function wavesRender(x, y, f, po, direction) {
    let colorMatrix = [];
    for (let j = 0; j < y; j++) {
        colorMatrix[j] = [];
        for (let i = 0; i < x; i++) {
            if (direction === 'x') {
                let c = (Math.sin(f*i + po) + 1) * 255/2;
                colorMatrix[j][i] = {r : c, g : c, b : c};
            }
            else if (direction === 'y') {
                let c = (Math.sin(f*j + po) + 1) * 255/2;
                colorMatrix[j][i] = {r : c, g : c, b : c};
            }
        }
    }
    return colorMatrix;
}

export function circleRender(x, y, f, po) {
    let k = po[0];
    let m = po[1];
    let colorMatrix = [];
    let radius;
    let c;
    for (let j = 0; j < y; j++) {
        colorMatrix[j] = [];
        for (let i = 0; i < y; i++) {
            radius = Math.sqrt(Math.pow(i - m, 2) + Math.pow(j - k, 2));
            c =  (1/ (0.2 * (radius + 5))) * Math.sin(f * radius + 1) * 255/2;
            colorMatrix[j][i] = {r : c, g : c, b : c}
        }
    }
    return colorMatrix;
}

export function centralRender(renderCase, x, y, f, po, direction) {
    return renderCase == 'circle' && renderCase != 'waves' ? circleRender(x, y, f, po, direction) : wavesRender(x, y, f, po, direction);
}
