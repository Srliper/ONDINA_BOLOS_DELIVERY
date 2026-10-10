import type { CSSProperties } from 'react'

/** Índice de escalonamento lido pelo CSS (`--i`) para atrasar entradas em sequência. */
export const stagger = (index: number): CSSProperties => ({ '--i': index }) as CSSProperties
