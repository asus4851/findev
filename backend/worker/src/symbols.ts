// Символи вигаданих інструментів. Wasm працює з індексами, а назви формує воркер.
const NAMES = ['ALFA', 'BETA', 'GAMA', 'DELT', 'EPSI', 'ZETA', 'ETAA', 'THET', 'IOTA', 'KAPA'];

export function symbolFor(index: number): string {
    return NAMES[index] ?? `SYM${String(index + 1).padStart(2, '0')}`;
}

export function symbolsFor(count: number): string[] {
    return Array.from({ length: count }, (_, index) => symbolFor(index));
}
