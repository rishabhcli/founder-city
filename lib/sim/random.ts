export type SeededRandom = () => number;

function xmur3(seed: string) {
  let hash = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return function nextHash() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): SeededRandom {
  let state = seed >>> 0;

  return function nextRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: string): SeededRandom {
  const seedFactory = xmur3(seed);
  return mulberry32(seedFactory());
}

export function randomInt(
  random: SeededRandom,
  minInclusive: number,
  maxExclusive: number,
) {
  return Math.floor(random() * (maxExclusive - minInclusive)) + minInclusive;
}

export function pickOne<T>(items: readonly T[], random: SeededRandom): T {
  if (!items.length) {
    throw new Error("Cannot pick from an empty collection.");
  }

  return items[randomInt(random, 0, items.length)];
}

export function shuffle<T>(items: readonly T[], random: SeededRandom): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function pickMany<T>(
  items: readonly T[],
  count: number,
  random: SeededRandom,
) {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

export function randomId(
  prefix: string,
  random: SeededRandom,
  length = 6,
) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";

  for (let index = 0; index < length; index += 1) {
    suffix += alphabet[randomInt(random, 0, alphabet.length)];
  }

  return `${prefix}-${suffix}`;
}
