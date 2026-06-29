// Renders an ordered list of derivation steps and the square-and-multiply trace.

import type { KeygenStep } from '../rsa/keygen';
import type { ModexpStep } from '../rsa/bigint-math';
import { el } from './dom';

export function renderSteps(steps: KeygenStep[]): HTMLElement {
  const rows = steps.map((s) =>
    el('div', { class: 'step' }, [
      el('span', { class: 'step__label' }, [s.label]),
      el('span', { class: 'step__value' }, [s.value]),
      ...(s.note ? [el('span', { class: 'step__note' }, [s.note])] : []),
    ]),
  );
  return el('div', { class: 'steps' }, rows);
}

/** Expandable modular-exponentiation trace: one row per exponent bit (LSB→MSB). */
export function renderModexp(base: bigint, exp: bigint, mod: bigint, steps: ModexpStep[]): HTMLElement {
  const header = el('p', { class: 'modexp__head' }, [
    `Computing ${base} ^ ${exp} mod ${mod} by square-and-multiply (`,
    el('span', { class: 'mono' }, [`${exp} = 0b${exp.toString(2)}`]),
    `), reading exponent bits right→left:`,
  ]);
  const rows = steps.map((s, i) =>
    el('div', { class: 'modexp__row' }, [
      el('span', { class: 'mono' }, [`bit ${i} = ${s.bit}`]),
      el('span', {}, [s.multiplied ? '× multiply in' : '· skip multiply']),
      el('span', { class: 'mono' }, [`acc = ${s.acc}`]),
      el('span', { class: 'mono dim' }, [`(sq → ${s.square})`]),
    ]),
  );
  return el('div', { class: 'modexp' }, [header, ...rows]);
}
