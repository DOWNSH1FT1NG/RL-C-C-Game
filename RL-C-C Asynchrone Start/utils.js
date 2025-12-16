// utils.js

// Убедитесь, что перед КАЖДОЙ функцией стоит 'export'

export function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

export function seededRandom(x, y, seed) {
    const dot = x * 12.9898 + y * 78.233 + seed * 45.543;
    let sin = Math.sin(dot) * 43758.5453;
    return sin - Math.floor(sin);
}

export function createAlea(seed) {
    const seedStr = String(seed);

    function mash(data) {
        let n = 0xefc8249d;
        for (let i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            let h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000;
        }
        return (n >>> 0) * 2.3283064365386963e-10;
    }

    let s0 = mash(' ');
    let s1 = mash(' ');
    let s2 = mash(' ');
    let c = 1;

    s0 -= mash(seedStr);
    if (s0 < 0) { s0 += 1; }
    s1 -= mash(seedStr);
    if (s1 < 0) { s1 += 1; }
    s2 -= mash(seedStr);
    if (s2 < 0) { s2 += 1; }

    return function () {
        const t = 2091639 * s0 + c * 2.3283064365386963e-10;
        s0 = s1;
        s1 = s2;
        return s2 = t - (c = t | 0);
    };
}