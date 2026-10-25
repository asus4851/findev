// Символи вигаданих інструментів. Wasm працює з індексами, назви з'являються у воркері.
const NAMES = ['ALFA', 'BETA', 'GAMA', 'DELT', 'EPSI', 'ZETA', 'ETAA', 'THET', 'IOTA', 'KAPA'];

// Перші десять інструментів мають імена, решта нумерується: SYM11, SYM12, ...
export function getSymbol(index: number): string {
    if (index < NAMES.length) return NAMES[index];
    return 'SYM' + String(index + 1).padStart(2, '0');
}
