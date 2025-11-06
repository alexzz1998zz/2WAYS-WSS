export const USDC_DEC = 6;

const POW10: Record<number, bigint> = {};
export function pow10(d: number): bigint {
    if (POW10[d] !== undefined) return POW10[d];
    let x = 1n;
    for (let i = 0; i < d; i++) x *= 10n;
    POW10[d] = x;
    return x;
}

export function toUnits(s: string, d: number): bigint {
    const m = s.trim().match(/^(\d+)(?:\.(\d+))?$/);
    if (!m) throw new Error(`Invalid decimal: "${s}"`);
    const whole = m[1];
    const frac = (m[2] || '').padEnd(d, '0').slice(0, d);
    return BigInt(whole ?? 0) * pow10(d) + BigInt(frac || '0');
}

export function fromUnits(n: bigint, d: number): string {
    const base = pow10(d);
    const i = n / base;
    const r = n % base;
    const frac = r.toString().padStart(d, '0').replace(/0+$/, '');
    return frac ? `${i}.${frac}` : i.toString();
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
