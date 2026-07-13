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

/**
 * Progressive square-and-multiply visual. Instead of a dense grid of bookkeeping,
 * we show the exponent in binary with each bit lighting as it is consumed and a
 * running accumulator, framed by the actual lesson: this is why RSA is fast. The
 * per-step math is real (from modexpTraced); we only render it.
 */
export function renderModexp(base: bigint, exp: bigint, mod: bigint, steps: ModexpStep[]): HTMLElement {
  const bits = exp.toString(2);
  const width = bits.length;
  const multiplies = steps.filter((s) => s.multiplied).length;

  // Binary strip, MSB→LSB (how humans read a number). We consume bits LSB→MSB in
  // the algorithm, so mark bit i from the right.
  const strip = el('div', { class: 'sam-bits', 'aria-hidden': 'true' },
    bits.split('').map((ch, idxFromLeft) => {
      const bitIndex = width - 1 - idxFromLeft; // position from the right (LSB=0)
      const set = ch === '1';
      return el('span', { class: `sam-bit ${set ? 'one' : 'zero'}` }, [
        el('span', { class: 'sam-bit__val' }, [ch]),
        el('span', { class: 'sam-bit__idx' }, [String(bitIndex)]),
      ]);
    }),
  );

  const header = el('div', { class: 'sam-head' }, [
    el('p', {}, [
      'Computing ',
      el('span', { class: 'mono' }, [`${base}^${exp} mod ${mod}`]),
      ' the fast way: square the base each step, and only multiply it into the answer where the exponent has a 1-bit.',
    ]),
    el('p', { class: 'sam-lesson' }, [
      `${steps.length} squarings + ${multiplies} multiplies `,
      el('span', { class: 'sam-lesson__x' }, [`= ${steps.length + multiplies} operations, not ${exp} `]),
      '— that is why RSA is fast even with a 300-digit exponent.',
    ]),
    el('p', { class: 'sam-strip-cap mono' }, [`${exp} in binary (bit index below each digit):`]),
    strip,
  ]);

  // One row per exponent bit, LSB→MSB, showing the running accumulator.
  const rows = steps.map((s, i) =>
    el('div', { class: `sam-row ${s.multiplied ? 'used' : 'skip'}` }, [
      el('span', { class: 'sam-row__bit mono' }, [`bit ${i} = ${s.bit}`]),
      el('span', { class: 'sam-row__act' }, [
        s.multiplied ? '× multiply base into accumulator' : '· 0-bit → skip multiply',
      ]),
      el('span', { class: 'sam-row__acc mono' }, [`acc = ${s.acc}`]),
      el('span', { class: 'sam-row__sq mono dim' }, [`base² → ${s.square}`]),
    ]),
  );

  return el('div', { class: 'sam' }, [header, el('div', { class: 'sam-rows' }, rows)]);
}
