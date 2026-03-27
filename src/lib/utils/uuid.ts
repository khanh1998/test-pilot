export function safeRandomUuid(): string {
  const maybeCrypto = globalThis.crypto as Crypto | undefined;

  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }

  // Lightweight fallback for environments where Web Crypto randomUUID is unavailable.
  const randomChunk = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const part1 = randomChunk();
  const part2 = randomChunk().slice(0, 4);
  const part3 = `4${randomChunk().slice(1, 4)}`;
  const variantNibble = ((Math.random() * 4) | 8).toString(16);
  const part4 = `${variantNibble}${randomChunk().slice(1, 4)}`;
  const part5 = `${randomChunk()}${randomChunk().slice(0, 4)}`;

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}
