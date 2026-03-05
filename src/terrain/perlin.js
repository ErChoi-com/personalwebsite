class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    return_vector() {
        return this.x + this.y;
    }
}

function shuffle(arrayShuffle) {
    for (let x = 0; x < arrayShuffle.length - 1; x++) {
        let index = Math.floor(Math.random() * (x + 1));
        let temp = arrayShuffle[x];
        arrayShuffle[x] = arrayShuffle[index];
        arrayShuffle[index] = temp;
    }
}

function MakePermutation() {
    let permutation = [];
    for (let i = 0; i < 256; i++) {
        permutation.push(i);
    }

    shuffle(permutation);

    for (let i = 0; i < 256; i++) {
        permutation.push(permutation[i]);
    }

    return permutation;
}

const Permutation = MakePermutation();

function getVector(v) {
    let h = v & 3;

    if (h === 0) {
        return new Vector(1, 1);
    } else if (h === 1) {
        return new Vector(-1, 1);
    } else if (h === 2) {
        return new Vector(-1, -1);
    } else {
        return new Vector(1, -1);
    }
}

function fade(t) {
    return ((6 * t - 15) * t + 10) * Math.pow(t, 3);
}

function lerp(t, a, b) {
    return a + t * (b - a);
}

function Noise2D(x, y) {
    let X = Math.floor(x) & 255;
    let Y = Math.floor(y) & 255;
    let xf = x - Math.floor(x);
    let yf = y - Math.floor(y);

    let topRight = new Vector(xf - 1, yf - 1);
    let topLeft = new Vector(xf, yf - 1);
    let bottomRight = new Vector(xf - 1, yf);
    let bottomLeft = new Vector(xf, yf);

    let valueTopRight = Permutation[Permutation[X + 1] + Y + 1];
    let valueTopLeft = Permutation[Permutation[X] + Y + 1];
    let valueBottomRight = Permutation[Permutation[X + 1] + Y];
    let valueBottomLeft = Permutation[Permutation[X] + Y];

    function dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    let dotTopRight = dot(getVector(valueTopRight), topRight);
    let dotTopLeft = dot(getVector(valueTopLeft), topLeft);
    let dotBottomRight = dot(getVector(valueBottomRight), bottomRight);
    let dotBottomLeft = dot(getVector(valueBottomLeft), bottomLeft);

    let u = fade(xf);
    let v = fade(yf);

    return lerp(u, lerp(v, dotBottomLeft, dotTopLeft), lerp(v, dotBottomRight, dotTopRight));
}

function brownianfractal(x, y, numOctaves) {
    let result = 0;
    let amplitude = 1;
    let frequency = 0.005;

    for (let i = 0; i < numOctaves; i++) {
        result += Noise2D(x * frequency, y * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return result;
}

export function perlinRender(xrange, yrange, o) {
    let colorMatrix = [];
    for (let y = 0; y < yrange; y++) {
        colorMatrix[y] = [];
        for (let x = 0; x < xrange; x++) {
            let n = brownianfractal(x, y, o);
            n = (n + 1) / 2;

            let c = Math.floor(n * 255);
            colorMatrix[y][x] = { r: c, g: c, b: c };
        }
    }
    return colorMatrix;
}
