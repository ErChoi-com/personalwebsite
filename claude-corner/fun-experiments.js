// ═══════════════════════════════════════════════════════
// Fun experiments — little programs inspired by the codebase
// Run any of these in a browser console or Node.js
// ═══════════════════════════════════════════════════════


// ──────────────────────────────────────────────────────
// 1. BRAILLE GAME OF LIFE
//    Conway's Game of Life rendered in braille characters.
//    Each "pixel" is a braille dot. Fits a 48×16 grid
//    into just 24×4 characters. Run it and watch patterns
//    emerge in your terminal title bar (or console).
// ──────────────────────────────────────────────────────

function brailleLife(width = 24, height = 16, generations = 200) {
  // width must be even, height must be multiple of 4
  let grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => Math.random() < 0.35 ? 1 : 0)
  );

  const neighbors = (g, r, c) => {
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = (r + dr + height) % height;
        const nc = (c + dc + width) % width;
        n += g[nr][nc];
      }
    return n;
  };

  for (let gen = 0; gen < generations; gen++) {
    // Render to braille
    let output = '';
    for (let row = 0; row < height; row += 4) {
      for (let col = 0; col < width; col += 2) {
        let t = 0;
        if (grid[row]?.[col])       t |= 1;
        if (grid[row+1]?.[col])     t |= 2;
        if (grid[row+2]?.[col])     t |= 4;
        if (grid[row]?.[col+1])     t |= 8;
        if (grid[row+1]?.[col+1])   t |= 16;
        if (grid[row+2]?.[col+1])   t |= 32;
        if (grid[row+3]?.[col])     t |= 64;
        if (grid[row+3]?.[col+1])   t |= 128;
        output += String.fromCharCode(0x2800 + t);
      }
      output += '\n';
    }
    console.clear();
    console.log(`Generation ${gen + 1}:\n${output}`);

    // Step
    const next = grid.map((row, r) =>
      row.map((cell, c) => {
        const n = neighbors(grid, r, c);
        return cell ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      })
    );
    grid = next;

    // Synchronous delay (for console demo; use setTimeout in real code)
    const start = Date.now();
    while (Date.now() - start < 150) {}
  }
}


// ──────────────────────────────────────────────────────
// 2. ONE-LINER PERLIN TERRAIN (ASCII art)
//    A minimal terrain renderer. No imports needed.
//    Prints a cross-section of pseudo-Perlin hills.
// ──────────────────────────────────────────────────────

function asciiTerrain(width = 80, height = 20) {
  // Simple value noise (not true Perlin, but close enough for ASCII)
  const hash = (x) => Math.sin(x * 127.1 + x * 311.7) * 43758.5453 % 1;
  const smoothNoise = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3 - 2 * f); // smoothstep
    return hash(i) * (1 - t) + hash(i + 1) * t;
  };
  const fbm = (x) => {
    let v = 0, amp = 1, freq = 1;
    for (let o = 0; o < 4; o++) {
      v += smoothNoise(x * freq) * amp;
      amp *= 0.5; freq *= 2;
    }
    return v;
  };

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const h = fbm(x * 0.05) * height * 0.7;
      const ground = height - 1 - Math.round(h);
      if (y === ground) line += '▓';
      else if (y > ground) line += '░';
      else line += ' ';
    }
    console.log(line);
  }
}


// ──────────────────────────────────────────────────────
// 3. CLICKSPARK BUT IN THE TERMINAL
//    Renders a spark burst using Unicode Box-drawing
//    characters. Purely for fun.
// ──────────────────────────────────────────────────────

function terminalSpark(cx = 15, cy = 8, radius = 7) {
  const W = 31, H = 17;
  const canvas = Array.from({ length: H }, () => Array(W).fill(' '));

  const arms = [
    { char: '|',  dx: 0,  dy: -1 },  // up
    { char: '|',  dx: 0,  dy: 1  },  // down
    { char: '─',  dx: -1, dy: 0  },  // left
    { char: '─',  dx: 1,  dy: 0  },  // right
    { char: '╲',  dx: -1, dy: -1 },  // up-left
    { char: '╱',  dx: 1,  dy: -1 },  // up-right
    { char: '╱',  dx: -1, dy: 1  },  // down-left
    { char: '╲',  dx: 1,  dy: 1  },  // down-right
  ];

  for (const arm of arms) {
    for (let r = 2; r <= radius; r++) {
      const x = cx + arm.dx * r;
      const y = cy + arm.dy * r;
      if (x >= 0 && x < W && y >= 0 && y < H) {
        canvas[y][x] = r <= radius * 0.6 ? arm.char : '·';
      }
    }
  }

  canvas[cy][cx] = '✦';

  console.log('┌' + '─'.repeat(W) + '┐');
  for (const row of canvas) {
    console.log('│' + row.join('') + '│');
  }
  console.log('└' + '─'.repeat(W) + '┘');
}


// ──────────────────────────────────────────────────────
// 4. ELASTIC EASING VISUALIZER
//    Draws a graph of the elastic.out curve that CardSwap
//    uses. See the bounce in ASCII.
// ──────────────────────────────────────────────────────

function elasticGraph(width = 60, height = 20, amplitude = 0.6, period = 0.9) {
  const elastic = (t) => {
    if (t === 0 || t === 1) return t;
    const p = period / (2 * Math.PI) * Math.asin(1 / amplitude);
    return amplitude * Math.pow(2, -10 * t) * Math.sin((t - p) * (2 * Math.PI) / period) + 1;
  };

  const canvas = Array.from({ length: height }, () => Array(width).fill(' '));

  // Draw axis
  for (let x = 0; x < width; x++) canvas[height - 1][x] = '─';
  for (let y = 0; y < height; y++) canvas[y][0] = '│';
  canvas[height - 1][0] = '└';

  // Plot the curve
  for (let x = 1; x < width; x++) {
    const t = x / (width - 1);
    const val = elastic(t);
    const y = height - 1 - Math.round(val * (height - 2));
    if (y >= 0 && y < height) {
      canvas[y][x] = '●';
    }
  }

  // Add 1.0 line
  const oneLine = height - 1 - Math.round(1.0 * (height - 2));
  for (let x = 1; x < width; x++) {
    if (canvas[oneLine][x] === ' ') canvas[oneLine][x] = '┄';
  }

  console.log('  elastic.out(0.6, 0.9) — the CardSwap curve\n');
  for (const row of canvas) console.log('  ' + row.join(''));
  console.log('\n  t → 0' + ' '.repeat(width - 6) + '1');
  console.log('  Overshoot at ~1.05 then settle. That\'s the "bounce".');
}


// ──────────────────────────────────────────────────────
// 5. DECK SHUFFLE FAIRNESS TEST
//    Is the TerminalCards Fisher-Yates shuffle actually
//    fair? Let's run it a million times and check.
// ──────────────────────────────────────────────────────

function shuffleFairnessTest(n = 6, trials = 1_000_000) {
  // Count how often each element ends up in each position
  const counts = Array.from({ length: n }, () => Array(n).fill(0));

  for (let t = 0; t < trials; t++) {
    const arr = Array.from({ length: n }, (_, i) => i);
    // Fisher-Yates (the TerminalCards version)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    for (let pos = 0; pos < n; pos++) {
      counts[arr[pos]][pos]++;
    }
  }

  const expected = trials / n;
  console.log(`Shuffle fairness (${trials.toLocaleString()} trials, ${n} elements):`);
  console.log(`Expected frequency per cell: ${expected.toFixed(0)}\n`);

  // Header
  let header = '     ';
  for (let p = 0; p < n; p++) header += `Pos${p}    `;
  console.log(header);

  for (let elem = 0; elem < n; elem++) {
    let row = `[${elem}]  `;
    for (let pos = 0; pos < n; pos++) {
      const pct = ((counts[elem][pos] / expected - 1) * 100).toFixed(1);
      const sign = pct >= 0 ? '+' : '';
      row += `${counts[elem][pos]}(${sign}${pct}%) `;
    }
    console.log(row);
  }

  console.log('\nIf all deviations are < ±1%, the shuffle is fair. ✓');
}


// ──────────────────────────────────────────────────────
// To run: uncomment one and paste in a console/Node.js
// ──────────────────────────────────────────────────────
// brailleLife();
// asciiTerrain();
// terminalSpark();
// elasticGraph();
// shuffleFairnessTest();
