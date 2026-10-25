// Символы вымышленных инструментов. Wasm работает с индексами, названия появляются в воркере.
const NAMES = ['ALFA', 'BETA', 'GAMA', 'DELT', 'EPSI', 'ZETA', 'ETAA', 'THET', 'IOTA', 'KAPA'];

// Первые десять инструментов имеют имена, остальные нумеруются: SYM11, SYM12, ...
export function getSymbol(index: number): string {
    if (index < NAMES.length) return NAMES[index];
    return 'SYM' + String(index + 1).padStart(2, '0');
}
