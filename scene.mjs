import { WIDTH, HEIGHT, CENTER, SHELTER, battleArena, bossPrepRemaining, houndPhase } from './battle.mjs';

const PIXEL_SCALE = 0.5;
const TWO_PI = Math.PI * 2;
const INK = '#121b20';
const AMBER = '#ffd26e';
const ICE = '#a8c2ff';
const FROST = '#d6edff';
const CAR_PALETTE = {
  base: ['#765135', '#ce9551', '#ffcc78', '#384f4e', '#92d1c9'],
  rapid: ['#704039', '#bf5940', '#f49c65', '#73382f', '#ffd695'],
  arc: ['#29535c', '#378496', '#83d4cd', '#265264', '#a4fff0'],
  shock: ['#64435e', '#a66577', '#eea496', '#57394e', '#ffd2b0'],
  armor: ['#3c4b76', '#637fac', '#9eb4ec', '#273a5e', FROST],
};
const ENEMY_PALETTE = {
  walker: ['#4b6445', '#a6bd79', '#6b5345', '#9c805a'],
  runner: ['#5c653d', '#c2bb77', '#874b40', '#bf7861'],
  brute: ['#435a4a', '#a0b592', '#465564', '#7d8d98'],
  hound: ['#604b35', '#be944f', '#71553a', '#d7b66a'],
  chimera: ['#505a55', '#aebb75', '#645d69', '#9d859a'],
  crawler: ['#5c5033', '#b39857', '#796947', '#dbc980'],
};
const CHILLED_ENEMY_PALETTE = ['#62799f', FROST, '#465e83', '#93aed8'];
const ENEMY_SPRITES = { hound, chimera, crawler };

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function path(ctx, points, color, width, closed = false) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  if (width) {
    if (closed) ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function railLine(ctx, segments, offset, width, color, shiftX = 0, shiftY = 0) {
  const points = segments.map(({ x, y, normalX, normalY }, index) => {
    const before = segments[(index + segments.length - 1) % segments.length];
    const miter = offset / (1 + before.normalX * normalX + before.normalY * normalY);
    return [
      x + (before.normalX + normalX) * miter + shiftX,
      y + (before.normalY + normalY) * miter + shiftY,
    ];
  });
  path(ctx, points, color, width, true);
}

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function floor(ctx) {
  rect(ctx, 0, 0, 400, 500, '#202c2e');
  path(ctx, [[0, 95], [94, 87], [153, 118], [224, 78], [400, 106], [400, 386],
    [302, 413], [225, 390], [121, 422], [0, 376]], '#2b3939');
  path(ctx, [[0, 220], [129, 208], [177, 218], [222, 211], [400, 199], [400, 274],
    [259, 271], [197, 262], [112, 282], [0, 281]], '#343f3d');
  path(ctx, [[165, 0], [233, 0], [232, 117], [219, 190], [228, 305], [250, 500],
    [151, 500], [171, 352], [164, 253], [177, 129]], '#34413e');
  path(ctx, [[0, 279], [112, 279], [195, 263], [270, 272], [400, 274]], '#424945', 2);
  path(ctx, [[162, 500], [178, 363], [171, 274]], '#48514a', 2);
  path(ctx, [[233, 0], [221, 123], [226, 186]], '#454d45', 2);

  const noise = randomSequence(31);
  const grit = ['#253233', '#293736', '#424c45', '#474d43', '#354940'];
  for (let i = 0; i < 820; i += 1) {
    const x = Math.floor(noise() * 200) * 2;
    const y = Math.floor(noise() * 250) * 2;
    rect(ctx, x, y, 2 + Math.floor(noise() * 3) * 2, noise() > 0.9 ? 4 : 2, grit[i % grit.length]);
  }
  const cracks = [
    [[6, 233], [34, 228], [51, 240], [74, 234]], [[339, 238], [354, 234], [375, 246], [395, 242]],
    [[183, 72], [192, 88], [182, 112]], [[217, 395], [201, 420], [205, 444]],
    [[72, 308], [60, 315], [60, 344]], [[338, 149], [351, 161], [354, 185]],
  ];
  for (const points of cracks) path(ctx, points, '#252d2e', 2);
  for (let x = 14; x < 400; x += 25) {
    if (x < 86 || x > 314) rect(ctx, x, 249, 10, 2, '#645f48');
  }
  for (let y = 104; y < 462; y += 25) {
    if (y < 132 || y > 367) rect(ctx, 198, y, 2, 10, '#625f4d');
  }
}

function roof(ctx, x, y, w, h, colors, depth = 19) {
  const [shadow, sheet, flash] = colors;
  const front = y + h;
  path(ctx, [[x + 8, y + 6], [x + w + 12, y + 6],
    [x + w + 34, front + depth + 10], [x + 28, front + depth + 10]], '#10191e82');
  path(ctx, [[x + w, y], [x + w + 10, y + 6], [x + w + 10, front + depth - 6],
    [x + w, front + depth]], '#242e30');
  rect(ctx, x - 3, front - 4, w + 5, depth + 7, INK);
  rect(ctx, x, front - 4, w, depth + 4, shadow);
  rect(ctx, x + 2, front, w - 4, 3, sheet);
  rect(ctx, x + 2, front + depth - 3, w - 4, 2, '#202a2b');
  for (let i = 8; i < w - 5; i += 13) rect(ctx, x + i, front + 5, 2, depth - 10, '#20282a');
  rect(ctx, x - 3, y - 3, w + 6, h + 6, INK);
  rect(ctx, x, y, w, h, shadow);
  rect(ctx, x + 2, y + 2, w - 4, Math.floor(h * 0.65), sheet);
  for (let i = 4; i < w - 3; i += 8) {
    rect(ctx, x + i, y + 2, 2, h - 4, shadow);
    rect(ctx, x + i + 2, y + 2, 2, h - 6, sheet);
    if ((i + x) % 3 === 0) rect(ctx, x + i + 2, y + 2, 2, h / 3, flash);
  }
  rect(ctx, x + 2, y + 1, w - 4, 2, flash);
  rect(ctx, x + 2, front - 4, w - 4, 2, flash);
}

function barricade(ctx, x, y, w) {
  rect(ctx, x + 2, y + 3, w + 2, 9, '#1c292a');
  rect(ctx, x, y, w, 8, '#7f6850');
  rect(ctx, x, y + 6, w, 2, '#584738');
  for (let i = 2; i < w - 3; i += 8) {
    path(ctx, [[x + i, y + 1], [x + i + 4, y + 1], [x + i + 2, y + 6], [x + i - 1, y + 6]], '#242c2c');
  }
  rect(ctx, x, y + 8, 4, 4, '#464942');
  rect(ctx, x + w - 4, y + 8, 4, 4, '#464942');
}

function verge(ctx) {
  path(ctx, [[0, 12], [117, 12], [146, 47], [125, 72], [0, 99]], '#253332');
  path(ctx, [[252, 23], [400, 14], [400, 151], [351, 131], [329, 96]], '#223132');
  roof(ctx, 17, 23, 90, 45, ['#603e34', '#86533d', '#ab7353']);
  rect(ctx, 31, 69, 28, 14, '#1b2425');
  rect(ctx, 64, 70, 13, 3, '#9c784c');
  roof(ctx, 111, 24, 30, 25, ['#3a4540', '#5e6860', '#74836d']);
  roof(ctx, 278, 27, 90, 31, ['#284144', '#466564', '#5c7a6e']);
  roof(ctx, 324, 65, 44, 28, ['#374846', '#5d6a62', '#828878']);
  rect(ctx, 291, 67, 11, 19, '#252d2c');
  rect(ctx, 290, 65, 14, 3, '#647a70');
  rect(ctx, 290, 69, 14, 3, '#485b55');
  rect(ctx, 18, 117, 10, 59, '#182528');
  rect(ctx, 22, 120, 2, 45, '#54665c');
  barricade(ctx, 26, 160, 38);
  barricade(ctx, 337, 169, 40);
  barricade(ctx, 45, 330, 32);
  barricade(ctx, 320, 320, 32);

  path(ctx, [[0, 398], [60, 369], [105, 399], [124, 450], [113, 500], [0, 500]], '#243432');
  path(ctx, [[400, 377], [352, 380], [321, 411], [288, 461], [288, 500], [400, 500]], '#233131');
  roof(ctx, 10, 422, 77, 33, ['#3c4841', '#586252', '#777762']);
  roof(ctx, 305, 424, 75, 39, ['#5d4239', '#7a5042', '#9f7158']);
  roof(ctx, 267, 448, 26, 26, ['#3c4b48', '#566561', '#708779']);
  rect(ctx, 346, 466, 18, 12, '#20292b');
  rect(ctx, 323, 469, 8, 3, '#b48457');
  const noise = randomSequence(72);
  for (let i = 0; i < 84; i += 1) {
    const x = Math.round(noise() * 61) * 2 + (i % 2 ? 265 : 4);
    const y = Math.round(noise() * 244) * 2;
    if (x > 78 && x < 326 && y > 99 && y < 380) continue;
    const color = i % 3 ? '#495747' : '#647053';
    rect(ctx, x + 2, y + 4, 6, 2, '#1e2c29');
    rect(ctx, x + 2, y, 2, 4, color);
    rect(ctx, x + 4, y + 2, 2, 2, color);
  }
}

function riverBridge(ctx) {
  rect(ctx, 0, 0, 400, 500, '#24383d');
  path(ctx, [[0, 62], [110, 77], [143, 135], [123, 408], [75, 447], [0, 422]], '#1a333c');
  path(ctx, [[400, 37], [304, 62], [276, 125], [299, 381], [350, 424], [400, 395]], '#1a333c');
  const noise = randomSequence(44);
  for (let index = 0; index < 90; index++) {
    const x = Math.round(noise() * 104) + (index % 2 === 0 ? 6 : 294);
    const y = Math.round(noise() * 320) + 74;
    rect(ctx, x, y, 3 + Math.round(noise() * 19), 1, index % 3 === 0 ? '#365760' : '#27464f');
  }
  path(ctx, [[139, 0], [262, 0], [285, 234], [261, 500], [136, 500], [110, 254]], '#35433f');
  path(ctx, [[0, 212], [400, 204], [400, 279], [0, 287]], '#3c4944');
  path(ctx, [[0, 212], [400, 204]], '#657169', 2);
  path(ctx, [[0, 287], [400, 279]], '#273535', 2);
  for (let y = 90; y < 408; y += 22) {
    rect(ctx, 119, y, 5, 12, '#5c6258');
    rect(ctx, 276, y, 5, 12, '#5c6258');
  }
  for (const [x, y] of [[120, 70], [267, 69], [120, 412], [267, 412]]) {
    rect(ctx, x, y, 11, 23, '#263032');
    rect(ctx, x + 2, y, 7, 4, '#b48b50');
    rect(ctx, x + 3, y + 8, 5, 3, '#f0cf78');
  }
  roof(ctx, 27, 36, 45, 29, ['#344a45', '#546c60', '#7e8573']);
  roof(ctx, 330, 429, 43, 28, ['#5a493a', '#80654b', '#aa885b']);
}

function tracks(ctx, arena) {
  const segments = arena.segments.map(segment => ({ ...segment,
    normalX: -segment.dy / segment.length, normalY: segment.dx / segment.length }));
  railLine(ctx, segments, 0, 42, '#12212482', 5, 8);
  railLine(ctx, segments, 0, 37, '#252b2a', 1, 5);
  railLine(ctx, segments, 0, 34, '#78624a');
  railLine(ctx, segments, 0, 29, '#514539', 0, -2);
  for (const { x, y, dx, dy, length, normalX, normalY } of segments) {
    const ties = Math.max(1, Math.round(length / 11));
    for (let i = 0; i < ties; i += 1) {
      const position = (i + 0.5) / ties;
      const centerX = x + dx * position;
      const centerY = y + dy * position;
      const a = [centerX - normalX * 14, centerY - normalY * 14];
      const b = [centerX + normalX * 14, centerY + normalY * 14];
      path(ctx, [[a[0] + 1, a[1] + 2], [b[0] + 1, b[1] + 2]], '#262425', 6);
      path(ctx, [a, b], i % 4 === 0 ? '#aa855e' : '#83644c', 4);
    }
  }
  for (const inset of [-8, 8]) {
    railLine(ctx, segments, inset, 5, '#343d3e', 1, 2);
    railLine(ctx, segments, inset, 3, '#a3a192');
    railLine(ctx, segments, inset, 1, '#dfc7a1', 0, -1);
  }
}

function shelterPlatform(ctx) {
  path(ctx, [[148, 197], [241, 197], [269, 221], [273, 275], [246, 300], [153, 300], [132, 275], [132, 220]], '#1c2a2b');
  path(ctx, [[148, 192], [241, 192], [269, 215], [269, 270], [244, 293], [154, 293], [132, 270], [132, 215]], '#4b584e');
  path(ctx, [[134, 267], [157, 290], [242, 290], [266, 267]], '#677364', 2);
  path(ctx, [[142, 217], [157, 200], [233, 200], [258, 218]], '#899277', 2);
  rect(ctx, 179, 279, 42, 4, '#7a7e69');
  rect(ctx, 175, 284, 50, 3, '#4e5e54');
}

function buildShelterLayer(ctx, painter) {
  ctx.save();
  ctx.translate(CENTER.x, CENTER.y);
  ctx.scale(0.56, 0.56);
  ctx.translate(-200, -244);
  painter(ctx);
  ctx.restore();
}

function shelterBoundary(ctx, color) {
  const left = CENTER.x - SHELTER.halfWidth - SHELTER.contactPadding;
  const top = CENTER.y - SHELTER.halfHeight - SHELTER.contactPadding;
  const width = 2 * (SHELTER.halfWidth + SHELTER.contactPadding);
  const height = 2 * (SHELTER.halfHeight + SHELTER.contactPadding);
  for (const [x, y, xSign, ySign] of [
    [left, top, 1, 1], [left + width, top, -1, 1],
    [left, top + height, 1, -1], [left + width, top + height, -1, -1],
  ]) {
    path(ctx, [[x, y + 10 * ySign], [x, y], [x + 10 * xSign, y]], color, 2);
  }
}

function shelter(ctx) {
  roof(ctx, 149, 187, 102, 42, ['#43544d', '#647b68', '#9aa28a'], 43);
  rect(ctx, 154, 235, 96, 4, '#869482');
  rect(ctx, 154, 263, 96, 6, '#2d3b37');
  rect(ctx, 157, 242, 17, 15, '#23312f');
  rect(ctx, 159, 243, 13, 4, '#849683');
  rect(ctx, 227, 242, 17, 15, '#23312f');
  rect(ctx, 229, 243, 13, 4, '#849683');
  rect(ctx, 180, 237, 39, 34, '#17252a');
  rect(ctx, 184, 242, 31, 28, '#374b4b');
  rect(ctx, 185, 243, 30, 2, '#8a9989');
  for (let x = 186; x <= 212; x += 6) rect(ctx, x, 246, 2, 24, '#526461');
  rect(ctx, 179, 271, 43, 5, '#7a8779');
  rect(ctx, 177, 276, 47, 4, '#44524b');
  roof(ctx, 175, 199, 50, 13, ['#435952', '#7b9380', '#a0ae96'], 10);
  for (let x = 180; x <= 213; x += 10) rect(ctx, x, 214, 5, 4, '#283b3a');
  roof(ctx, 134, 244, 15, 14, ['#654f3d', '#9c8157', '#bb9e69'], 12);
  roof(ctx, 252, 241, 14, 18, ['#476050', '#738664', '#9aa675'], 14);
  barricade(ctx, 153, 275, 18);
  barricade(ctx, 228, 275, 18);
  path(ctx, [[165, 193], [165, 171], [181, 160]], '#232c2c', 4);
  path(ctx, [[157, 171], [177, 171]], '#a1ac8f', 2);
  rect(ctx, 161, 187, 8, 4, '#87927b');
}

function signals(ctx, time, armor) {
  for (const [x, y] of [[166, 265], [231, 265], [101, 210], [300, 280]]) {
    rect(ctx, x - 2, y - 1, 6, 3, '#f7ad4650');
    rect(ctx, x, y, 2, 2, AMBER);
  }
  for (let i = 0; i < 3; i += 1) {
    const x = 182 + 14 * i;
    rect(ctx, x, 232, 8, 3, i < armor ? '#91cb98' : '#433832');
  }
  rect(ctx, 164, 168, 3, 3, Math.floor(time * 2) % 2 ? '#d06c45' : AMBER);
}

function makeLayer(canvas) {
  const layer = canvas.ownerDocument.createElement('canvas');
  layer.width = WIDTH * PIXEL_SCALE;
  layer.height = HEIGHT * PIXEL_SCALE;
  const ctx = layer.getContext('2d');
  ctx.scale(PIXEL_SCALE, PIXEL_SCALE);
  return [layer, ctx];
}

function car(ctx, at, kind, moving) {
  const [edge, body, rim, glass, bright] = CAR_PALETTE[kind];
  ctx.save();
  ctx.translate(Math.round(at.x), Math.round(at.y));
  ctx.rotate(at.angle);
  const long = kind === 'base' ? 36 : 28;
  const half = long / 2;
  rect(ctx, -half + 2, -7, long + 8, 24, '#101a1cc7');
  rect(ctx, -half - 1, -9, long + 5, 22, '#182225');
  for (const x of [-half + 2, half - 10]) {
    rect(ctx, x, -12, 8, 6, '#22282b');
    rect(ctx, x, 6, 8, 6, '#22282b');
    rect(ctx, x + 1, 8, 6, 2, '#59605b');
    rect(ctx, x + 1, -11, 6, 2, '#59605b');
  }
  rect(ctx, -half - 3, -3, long + 6, 6, '#62695c');
  rect(ctx, -half, -9, long, 18, edge);
  rect(ctx, -half + 2, -8, long - 4, 14, body);
  rect(ctx, -half + 3, -8, long - 7, 2, rim);
  rect(ctx, -half + 3, 6, long - 5, 4, edge);
  rect(ctx, -half + 3, 5, long - 7, 2, rim);
  if (kind === 'base') {
    rect(ctx, -half + 3, -7, 13, 13, glass);
    rect(ctx, -half + 5, -5, 9, 2, bright);
    rect(ctx, -half + 13, -5, 2, 8, bright);
    rect(ctx, half - 12, -6, 9, 11, edge);
    for (let x = half - 12; x <= half - 6; x += 3) rect(ctx, x, -4, 1, 7, rim);
    rect(ctx, half - 1, -5, 3, 3, '#fff4cb');
    rect(ctx, half - 1, 3, 3, 3, '#fff4cb');
    if (moving) {
      path(ctx, [[half, -6], [half + 16, -10], [half + 16, 10], [half, 6]], '#f9cc711c');
      path(ctx, [[half, -4], [half + 9, -7], [half + 9, 7], [half, 4]], '#f9cc7130');
    }
  } else if (kind === 'armor') {
    rect(ctx, -10, -6, 19, 12, glass);
    for (const x of [-8, -4, 0, 4]) rect(ctx, x, -4, 2, 8, rim);
    rect(ctx, 8, -4, 5, 8, glass);
    rect(ctx, 11, -3, 4, 6, bright);
  } else if (kind === 'shock') {
    rect(ctx, -10, -6, 20, 12, glass);
    rect(ctx, -7, -4, 10, 8, rim);
    rect(ctx, 1, -2, 14, 4, bright);
    rect(ctx, 11, -4, 4, 8, edge);
  } else {
    rect(ctx, -8, -6, 15, 12, glass);
    rect(ctx, -6, -5, 11, 10, '#263538');
    rect(ctx, -3, -4, 12, 3, bright);
    rect(ctx, kind === 'rapid' ? -3 : 0, 2, kind === 'rapid' ? 12 : 4, 3, bright);
    rect(ctx, -half, -5, 2, 3, rim);
    rect(ctx, -half, 3, 2, 3, rim);
  }
  ctx.restore();
}

function hound(ctx, unit, time, reducedMotion, [shade, skin, coat, seam]) {
  const phase = houndPhase(unit);
  const windup = phase === 'windup';
  const rushing = phase === 'rush';
  const stride = reducedMotion || windup ? 0 : Math.round(Math.sin(time * (rushing ? 26 : 16) + unit.id) * 4);
  const back = rushing ? -3 : 0;
  const shoulder = windup ? -12 : -18;
  const head = rushing ? 4 : windup ? -3 : 0;

  path(ctx, [[-22, 1], [14, -3], [26, 1], [19, 7], [-12, 8], [-23, 5]], '#10191db8');
  if (rushing && !reducedMotion) {
    rect(ctx, -30, -8, 12, 2, '#dfb1738c');
    rect(ctx, -32, 0, 8, 2, '#dfb1736b');
  }

  // Far legs stay dim so the two near paws are readable at phone size.
  path(ctx, [[-15, -10], [-9, -9], [-8, 0], [-14 - stride, 2], [-17 - stride, -1]], INK);
  path(ctx, [[9, -12], [13, -9], [15 + stride, -1], [10 + stride, 1], [8, -3]], INK);
  path(ctx, [[-19, -12], [-17, -17], [-10, shoulder - 1], [4, shoulder], [12, shoulder + 4],
    [15, -8], [7, -5], [-16, -6]], INK);
  path(ctx, [[-17, -12], [-10, shoulder + 1], [3, shoulder + 2], [9, shoulder + 5], [11, -8],
    [0, -7], [-14, -8]], coat);
  path(ctx, [[-22, -11], [-28, -19], [-25, -22], [-20, -16], [-15, -15], [-16, -11]], shade);
  path(ctx, [[-15, shoulder + 4], [2, shoulder + 2], [7, shoulder + 5], [1, -10], [-11, -10]], seam);
  path(ctx, [[-13, -10], [-8, -8], [-10 - stride + back, 3], [-16 - stride + back, 4],
    [-17 - stride + back, 1], [-15, -3]], shade);
  path(ctx, [[4, -11], [9, -10], [11 + stride, 1], [17 + stride, 1], [17 + stride, 5],
    [8 + stride, 5], [4, -4]], shade);
  rect(ctx, 11 + stride, 3, 6, 2, seam);

  ctx.save();
  ctx.translate(head, windup ? 5 : 0);
  path(ctx, [[8, -21], [10, -27], [15, -24], [17, -20], [24, -18], [24, -12],
    [20, -9], [11, -10], [7, -15]], INK);
  path(ctx, [[10, -21], [12, -24], [15, -21], [18, -18], [22, -17], [21, -12], [12, -11], [9, -15]],
    unit.hitFlash > 0 ? '#f3efcf' : skin);
  rect(ctx, 16, -18, 3, 2, windup ? '#ff8358' : '#fff0a9');
  rect(ctx, 20, -16, 4, 2, shade);
  rect(ctx, 17, -12, 4, 2, '#fff0c3');
  ctx.restore();

  if (windup) {
    rect(ctx, 0, -39, 10, 14, '#432923');
    rect(ctx, 3, -37, 4, 6, '#ff9b62');
    rect(ctx, 3, -29, 4, 2, '#ffe0a1');
    path(ctx, [[13, 10], [22, 7], [18, 4]], '#ff9b62', 2);
  }
}

function chimera(ctx, unit, time, reducedMotion, [shade, skin, shell, seam]) {
  const step = reducedMotion ? 0 : Math.round(Math.sin(time * 7 + unit.id) * 3);
  const bright = unit.hitFlash > 0 ? '#f3efcf' : skin;
  path(ctx, [[-24, 0], [20, -4], [32, 1], [22, 10], [-18, 11], [-27, 6]], '#10191db8');
  path(ctx, [[-13, -18], [-4, -16], [-6 - step, -2], [-13 - step, 6], [-20 - step, 6],
    [-20 - step, 1], [-15, -7]], INK);
  path(ctx, [[6, -19], [17, -17], [17 + step, -3], [23 + step, 1], [23 + step, 7], [11 + step, 7],
    [8, -2]], INK);
  rect(ctx, 13 + step, 2, 9, 3, seam);
  path(ctx, [[-18, -36], [1, -38], [14, -34], [23, -24], [17, -11], [5, -7], [-14, -10],
    [-23, -23]], INK);
  path(ctx, [[-16, -33], [2, -35], [12, -31], [20, -23], [15, -13], [4, -10], [-12, -12],
    [-19, -23]], shell);
  path(ctx, [[-12, -28], [8, -27], [8, -15], [1, -12], [-9, -15]], shade);
  rect(ctx, -8, -23, 11, 3, seam);
  rect(ctx, -6, -18, 7, 2, seam);

  for (const [x, y, w] of [[-20, -44, 13], [-7, -47, 14]]) {
    path(ctx, [[x, y + 4], [x + 4, y], [x + w - 3, y], [x + w, y + 4], [x + w, y + 12],
      [x + w - 4, y + 16], [x + 2, y + 16], [x, y + 10]], INK);
    rect(ctx, x + 2, y + 4, w - 4, 9, shade);
    rect(ctx, x + 3, y + 3, w - 6, 6, bright);
    rect(ctx, x + 5, y + 3, 4, 2, '#ffdf87');
  }

  path(ctx, [[-17, -28], [-9, -25], [-14, -18], [-21, -8], [-28, -9], [-30, -15],
    [-24, -25]], INK);
  path(ctx, [[-22, -24], [-16, -24], [-21, -17], [-27, -15], [-25, -20]], seam);
  path(ctx, [[12, -26], [19, -25], [21, -20], [29, -17], [29, -10], [21, -8], [14, -14],
    [9, -19]], INK);
  path(ctx, [[21, -18], [27, -16], [27, -11], [21, -10], [17, -14]], bright);
  path(ctx, [[12, -36], [21, -36], [26, -32], [25, -24], [17, -21], [11, -25]], INK);
  path(ctx, [[14, -34], [20, -34], [24, -31], [23, -26], [17, -24], [14, -27]], bright);
  rect(ctx, 20, -31, 5, 2, '#3a4f39');
  rect(ctx, 23, -31, 2, 2, '#fff0a9');
}

function crawler(ctx, unit, time, reducedMotion, [shade, skin, shell, seam]) {
  const step = reducedMotion ? 0 : Math.round(Math.sin(time * 20 + unit.id) * 2);
  path(ctx, [[-12, 0], [10, -2], [16, 3], [7, 6], [-10, 5]], '#10191db8');
  path(ctx, [[-11, -6], [-9, -13], [-3, -16], [5, -14], [7, -11], [13, -10], [15, -6],
    [11, -2], [-7, -2]], INK);
  path(ctx, [[-9, -7], [-7, -12], [-2, -14], [4, -12], [5, -7], [-2, -4]], shell);
  path(ctx, [[-7, -6], [-9 - step, 2], [-15 - step, 3], [-13 - step, -2]], shade);
  path(ctx, [[0, -6], [3 + step, 1], [9 + step, 3], [4 + step, 5], [-1, 0]], shade);
  rect(ctx, -5, -12, 8, 3, seam);
  rect(ctx, 6, -9, 7, 5, unit.hitFlash > 0 ? '#f3efcf' : skin);
  rect(ctx, 10, -8, 3, 2, '#fff0a9');
}

function enemyHealthBar(ctx, unit, width, y) {
  if (unit.hp >= unit.maxHp) return;
  rect(ctx, -width / 2, y, width, 3, '#26262b');
  rect(ctx, -width / 2, y, width * unit.hp / unit.maxHp, 3, '#d18e61');
}

function gateBoss(ctx, unit, time, reducedMotion, shielded) {
  const step = reducedMotion || shielded ? 0 : Math.round(Math.sin(time * 7) * 4);
  const light = unit.hitFlash > 0 ? '#fff0b2' : '#b9946d';
  const glow = shielded ? '#ffe38b' : '#ff9563';
  path(ctx, [[-42, 0], [-25, -8], [30, -8], [47, 3], [26, 15], [-26, 13]], '#11181dd4');
  path(ctx, [[-31, -27], [-5, -25], [-13 - step, 6], [-37 - step, 6], [-39 - step, -1]], INK);
  path(ctx, [[8, -25], [31, -26], [39 + step, 3], [34 + step, 9], [11 + step, 9]], INK);
  rect(ctx, -36 - step, -2, 20, 4, '#756758');
  rect(ctx, 15 + step, 2, 19, 4, '#756758');
  path(ctx, [[-30, -66], [-13, -73], [18, -73], [33, -62], [42, -29], [24, -10], [-22, -12], [-41, -34]], INK);
  path(ctx, [[-26, -64], [-12, -70], [17, -70], [30, -60], [37, -32], [22, -14], [-19, -16], [-36, -35]], '#62534b');
  rect(ctx, -25, -63, 17, 8, '#ab7956');
  rect(ctx, 11, -63, 16, 8, '#ab7956');
  path(ctx, [[-13, -66], [-11, -80], [10, -84], [19, -73], [16, -58], [-8, -57]], INK);
  rect(ctx, -7, -77, 20, 13, light);
  rect(ctx, -8, -72, 21, 3, '#392722');
  rect(ctx, -5, -72, 6, 2, glow);
  rect(ctx, 6, -72, 5, 2, glow);
  rect(ctx, 0, -64, 9, 3, '#6e4b38');
  if (shielded) {
    path(ctx, [[-43, -51], [41, -51], [45, -44], [42, -20], [-40, -20], [-45, -30]], '#242c36');
    rect(ctx, -40, -47, 80, 23, '#9d6a4f');
    rect(ctx, -40, -47, 80, 5, '#dca46b');
    for (let x = -32; x < 36; x += 13) {
      rect(ctx, x, -42, 4, 17, '#443b3a');
      rect(ctx, x + 4, -40, 4, 4, glow);
    }
    const border = reducedMotion || Math.floor(time * 3) % 2 === 0 ? '#ffd486' : '#b7785c';
    path(ctx, [[-50, -57], [48, -57], [52, -47], [49, -14], [-46, -14], [-52, -25]], border, 2, true);
  } else {
    path(ctx, [[-39, -48], [-11, -48], [-2, -38], [-14, -24], [-41, -25]], '#9d6a4f');
    path(ctx, [[12, -48], [39, -46], [42, -27], [21, -24], [8, -32]], '#9d6a4f');
    rect(ctx, -38, -46, 21, 4, '#dca46b');
    rect(ctx, 16, -46, 21, 4, '#dca46b');
    rect(ctx, -7, -40, 14, 12, '#372725');
    rect(ctx, -3, -37, 7, 5, glow);
  }
  if (unit.chillTime > 0) {
    spark(ctx, -19, 4, 5, FROST);
    spark(ctx, 30, 8, 4, ICE);
  }
  rect(ctx, -34, -93, 68, 5, INK);
  rect(ctx, -33, -92, 66 * unit.hp / unit.maxHp, 3, glow);
}

function enemy(ctx, unit, time, reducedMotion, bossShielded) {
  const chilled = unit.chillTime > 0;
  const palette = chilled ? CHILLED_ENEMY_PALETTE : ENEMY_PALETTE[unit.kind];
  const facing = unit.x <= CENTER.x ? 1 : -1;
  const sprite = ENEMY_SPRITES[unit.kind];
  ctx.save();
  ctx.translate(Math.round(unit.x), Math.round(unit.y));
  if (unit.kind === 'boss') {
    gateBoss(ctx, unit, time, reducedMotion, bossShielded);
    ctx.restore();
    return;
  }
  if (sprite) {
    if (unit.kind === 'chimera') enemyHealthBar(ctx, unit, 32, -53);
    ctx.scale(facing, 1);
    sprite(ctx, unit, time, reducedMotion, palette);
    if (chilled) {
      spark(ctx, -11, 2, 5, FROST);
      spark(ctx, 14, 4, 4, ICE);
    }
    ctx.restore();
    return;
  }

  const [skinShade, skin, shirt, seam] = palette;
  const running = unit.kind === 'runner';
  const heavy = unit.kind === 'brute';
  const size = heavy ? 1.24 : running ? 0.95 : 1.04;
  const stride = reducedMotion ? 0 : Math.round(Math.sin(time * (running ? 15 : 9) + unit.id) * 4);
  const stoop = running ? 4 : 0;
  const lift = Math.abs(stride) >= 3 ? 2 : 0;
  const flashed = unit.hitFlash > 0;
  const bright = flashed ? '#f3efcf' : skin;
  const facingAway = unit.y > CENTER.y + 45 && Math.abs(unit.x - CENTER.x) < 45;
  path(ctx, [[-13 * size, 0], [9 * size, -3], [22 * size, 2], [11 * size, 8], [-10 * size, 7]], '#10191db8');
  ctx.scale(facing * size, size);

  // Boots and shoulders give the walk a visible silhouette at phone scale.
  path(ctx, [[-8, -11], [-1, -11], [stride, 0], [stride - 9, 3]], '#222c33');
  rect(ctx, stride - 9, 1, 11, 4, INK);
  path(ctx, [[1, -12], [8, -10], [9 - stride, 0], [2 - stride, 3]], '#404341');
  rect(ctx, 2 - stride, 1, 11, 4, INK);
  rect(ctx, 7 - stride, 1, 6, 2, '#77776b');
  if (chilled) {
    spark(ctx, -11, 2, 5, FROST);
    spark(ctx, 14, 4, 4, ICE);
  }

  ctx.translate(stoop, -lift);
  path(ctx, [[2, -21], [10, -20], [14, -15], [20, -16], [20, -10], [10, -9], [5, -15]], INK);
  path(ctx, [[6, -19], [12, -17], [15, -13], [20, -14], [19, -11], [12, -11]], skinShade);
  const shoulder = heavy ? 14 : 11;
  path(ctx, [[-shoulder, -22], [3, -23], [10, -18], [9, -7], [-9, -6],
    [-13, -11]], INK);
  path(ctx, [[-shoulder + 2, -21], [3, -21], [8, -17], [7, -9], [-8, -8],
    [-11, -13]], shirt);
  rect(ctx, -shoulder + 3, -21, shoulder + 1, 3, seam);
  path(ctx, [[-4, -20], [3, -19], [4, -10], [0, -10]], '#ddd3aa80');
  rect(ctx, -8, -12, 6, 3, '#292d30');

  // Near arm reaches ahead of the collar, with a pale hand separate from its sleeve.
  path(ctx, [[-6, -19], [2, -19], [9, -16], [17, -19], [24, -18], [24, -12],
    [15, -12], [6, -10], [-2, -13]], INK);
  path(ctx, [[-4, -18], [1, -18], [9, -14], [6, -12], [0, -14]], seam);
  path(ctx, [[8, -15], [15, -16], [18, -18], [24, -17], [22, -14], [13, -13]], bright);
  rect(ctx, 19, -15, 3, 2, skinShade);

  rect(ctx, -5, -32, 16, 13, INK);
  path(ctx, [[-3, -31], [9, -31], [10, -26], [7, -20], [-3, -21]], skinShade);
  path(ctx, [[0, -30], [8, -30], [10, -26], [8, -22], [0, -22]], facingAway ? skinShade : bright);
  rect(ctx, -2, -31, 9, 3, '#27362d');
  if (!facingAway) {
    rect(ctx, 3, -27, 6, 2, '#344737');
    rect(ctx, 7, -27, 2, 2, running ? '#ffc37e' : '#f4f7bb');
    rect(ctx, 6, -24, 3, 2, '#3f503c');
  }
  if (heavy) enemyHealthBar(ctx, unit, 20, -38);
  ctx.restore();
}

function spark(ctx, x, y, radius, color) {
  path(ctx, [[x, y - radius], [x + radius * 0.31, y - radius * 0.31], [x + radius, y],
    [x + radius * 0.31, y + radius * 0.31], [x, y + radius], [x - radius * 0.31, y + radius * 0.31],
    [x - radius, y], [x - radius * 0.31, y - radius * 0.31]], color);
}

function frostPulse(ctx, effect, progress, reducedMotion) {
  const { x, y } = effect;
  const radius = effect.radius * (reducedMotion ? 1 : 0.47 + progress * 0.53);
  const diagonal = radius * 0.71;
  const facets = [[x, y - radius], [x + diagonal, y - diagonal], [x + radius, y],
    [x + diagonal, y + diagonal], [x, y + radius], [x - diagonal, y + diagonal],
    [x - radius, y], [x - diagonal, y - diagonal]];
  path(ctx, facets, '#849de543');
  path(ctx, facets, ICE, 2, true);
  for (let i = 0; i < facets.length; i += 2) {
    const [cx, cy] = facets[i];
    spark(ctx, cx, cy, 5, FROST);
  }
}

function tracer(ctx, fx, life) {
  const { fromX, fromY, x, y, kind } = fx;
  if (kind === 'armor') {
    path(ctx, [[fromX, fromY], [x, y]], '#849de563', 7 * life);
    for (const distance of [0, 0.22, 0.52, 0.8]) {
      spark(ctx, x + (fromX - x) * distance, y + (fromY - y) * distance, 3 + 3 * life, FROST);
    }
    return;
  }
  const beam = kind === 'arc' ? '#83e8e6' : kind === 'rapid' ? '#ff9a59' :
    kind === 'shock' ? '#ff96a9' : '#fbc881';
  const start = [fromX, fromY];
  const end = [x, y];
  if (fx.type === 'arc' || kind === 'arc') {
    const dx = x - fromX;
    const dy = y - fromY;
    const length = Math.hypot(dx, dy) || 1;
    const points = [start];
    for (let i = 1; i <= 5; i += 1) {
      const offset = (i % 2 === 0 ? 1 : -1) * Math.min(7, length / 7);
      points.push([fromX + dx * i / 6 - dy / length * offset, fromY + dy * i / 6 + dx / length * offset]);
    }
    points.push(end);
    path(ctx, points, '#448b995e', 8 * life);
    path(ctx, points, beam, 3 * life);
    path(ctx, points, '#e0fff3', 1.4 * life);
    return;
  }
  const point = [x + (fromX - x) * life * 0.45, y + (fromY - y) * life * 0.45];
  path(ctx, [point, end], beam, (kind === 'rapid' ? 5 : 4) * life);
  path(ctx, [point, end], '#fff1bf', 2 * life);
  spark(ctx, fromX, fromY, 2 + life * 7, beam);
}

function bursts(ctx, effect, progress, reducedMotion) {
  const { x, y, type, kind } = effect;
  const heavy = type === 'kill' || type === 'breach' || type === 'install' || type === 'blast' || type === 'split' ||
    type === 'boss-start' || type === 'boss-prep-fail';
  const count = type === 'blast' ? 15 : heavy ? 9 : 5;
  const color = type === 'breach' || type === 'boss-prep-fail' ? '#ff875f' : type === 'split' ? '#cde18f' : kind === 'armor' ? ICE :
    kind === 'arc' ? '#a1f9e9' : kind === 'shock' ? '#ff9eaf' : '#ffca75';
  const radius = (effect.radius ?? (heavy ? 29 : 16)) * progress;
  const size = 4 * (1 - progress) + 1;
  if (progress < 0.35) spark(ctx, x, y, (heavy ? 13 : 7) * (1 - 2 * progress), color);
  if (reducedMotion) return;
  if (heavy) {
    ctx.strokeStyle = color;
    ctx.lineWidth = type === 'blast' ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.stroke();
  }
  for (let i = 0; i < count; i += 1) {
    const angle = i / count * TWO_PI + x / 17;
    const distance = radius * (0.5 + (i % 3) * 0.23);
    const cx = Math.round(x + Math.cos(angle) * distance);
    const cy = Math.round(y + Math.sin(angle) * distance + 6 * progress * progress);
    rect(ctx, cx, cy, size + (heavy ? 2 : 0), size, i % 3 === 0 ? '#fff3cb' : color);
  }
}

const EFFECT_DURATIONS = {
  shot: 0.14, arc: 0.19, hit: 0.18, kill: 0.34, star: 0.27,
  breach: 0.72, install: 0.5, blast: 0.46, chill: 0.62, split: 0.42, 'boss-start': 0.72, 'boss-prep-fail': 0.8,
};

export function createScene(canvas) {
  const screen = canvas.getContext('2d');
  const [backdrop, back] = makeLayer(canvas);
  const [station, building] = makeLayer(canvas);
  const [frame, ctx] = makeLayer(canvas);
  buildShelterLayer(building, shelter);
  let effects = [];
  let lastElapsed = 0;
  let currentArena;

  function drawBackdrop(arena) {
    back.save();
    back.scale(WIDTH / 400, HEIGHT / 500);
    if (arena.theme === 'bridge') riverBridge(back);
    else {
      floor(back);
      verge(back);
    }
    back.restore();
    tracks(back, arena);
    buildShelterLayer(back, shelterPlatform);
  }

  function render(state, dt, events, reducedMotion = false) {
    const arena = battleArena(state);
    if (arena !== currentArena) {
      drawBackdrop(arena);
      currentArena = arena;
      effects = [];
    }
    if (state.elapsed < lastElapsed || state.phase === 'ready') effects = [];
    lastElapsed = state.elapsed;
    const calmTime = reducedMotion ? 0 : state.elapsed;
    for (const effect of effects) effect.age += dt;
    effects = effects.filter(effect => effect.age < effect.duration);
    for (const event of events) {
      const duration = EFFECT_DURATIONS[event.type];
      if (duration && Number.isFinite(event.x) && Number.isFinite(event.y)) {
        effects.push({ ...event, age: 0, duration });
      }
    }
    if (effects.length > 48) effects.splice(0, effects.length - 48);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backdrop, 0, 0, WIDTH, HEIGHT);
    for (const drop of state.drops) {
      const radius = 5 + (Math.sin(calmTime * 9 + drop.x / 14) + 1) * 1.3;
      spark(ctx, drop.x, drop.y, radius * 1.6, '#ffbc5d47');
      spark(ctx, drop.x, drop.y, radius, AMBER);
      rect(ctx, drop.x - 1, drop.y - 1, 3, 3, '#fff8cf');
    }
    const subjects = [state.train, ...state.cars, ...state.enemies].sort((a, b) => a.y - b.y);
    const bossShielded = bossPrepRemaining(state) > 0;
    const drawSubject = (subject) => {
      if (subject.hp === undefined) car(ctx, subject, subject.kind ?? 'base', subject === state.train && !reducedMotion);
      else enemy(ctx, subject, calmTime, reducedMotion, bossShielded);
    };
    let front = 0;
    while (front < subjects.length && subjects[front].y < CENTER.y + SHELTER.halfHeight) drawSubject(subjects[front++]);
    ctx.drawImage(station, 0, 0, WIDTH, HEIGHT);
    buildShelterLayer(ctx, layer => signals(layer, calmTime, state.armor));
    shelterBoundary(ctx, effects.some(effect => effect.type === 'breach' || effect.type === 'boss-prep-fail') ? '#fc8767' : '#d9bb7f');
    while (front < subjects.length) drawSubject(subjects[front++]);

    let shake = 0;
    for (const effect of effects) {
      const progress = effect.age / effect.duration;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      if (effect.type === 'shot' || effect.type === 'arc') {
        if (Number.isFinite(effect.fromX) && Number.isFinite(effect.fromY)) tracer(ctx, effect, 1 - progress);
      } else if (effect.type === 'chill') {
        frostPulse(ctx, effect, progress, reducedMotion);
      } else {
        bursts(ctx, effect, progress, reducedMotion);
        if (!reducedMotion && (effect.type === 'breach' || effect.type === 'kill' || effect.type === 'blast')) {
          shake = Math.max(shake, (effect.type === 'breach' || effect.type === 'blast' ? 2.6 : 1.4) * (1 - progress));
        }
        if (!reducedMotion && effect.type === 'boss-prep-fail') shake = Math.max(shake, 4 * (1 - progress));
      }
    }
    ctx.globalAlpha = 1;

    screen.imageSmoothingEnabled = false;
    if (shake > 0) rect(screen, 0, 0, canvas.width, canvas.height, '#172224');
    const xOffset = Math.round(Math.sin(calmTime * 88) * shake * canvas.width / WIDTH);
    const yOffset = Math.round(Math.cos(calmTime * 74) * shake * canvas.height / HEIGHT);
    screen.drawImage(frame, xOffset, yOffset, canvas.width, canvas.height);
  }

  return { render };
}
