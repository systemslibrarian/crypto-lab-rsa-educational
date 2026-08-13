// Section 5 — What breaks at scale. Factor the small key (ALARM on success);
// project, never run, the 2048-bit cost.

import { breakKey, projectFactoringYears } from '../rsa/factor';
import { modexp } from '../rsa/bigint-math';
import { el, clear, codeBox } from './dom';
import { LINKS } from '../rsa/links';
import { onKey } from './store';

export function whatBreaksPanel(): HTMLElement {
  const out = el('div', { class: 'break-out' });
  const small = el('div', { class: 'scale-card weak' });
  const big = el('div', { class: 'scale-card strong' });

  let renderSmall = () => {};
  onKey((k) => {
    renderSmall = () => {
      clear(small);
      // `out` is a persistent node re-appended below, so clearing `small` alone
      // does NOT clear it: a previous break result survived the key change and
      // stayed on screen under the new card. A learner who factored n = 67591
      // and then generated a smaller key saw "Your key — n = 15" directly above
      // "Recovered primes p, q: 257 × 263" and a reconstructed d for a modulus
      // no longer displayed anywhere. A stale result is worse than none here,
      // because the whole panel's claim is that THIS key is the one that fell.
      clear(out);
      small.append(
        el('h3', {}, ['Your key — ', el('span', { class: 'mono' }, [`n = ${k.pub.n}`])]),
        el('p', {}, [`${k.pub.n.toString(2).length} bits. Small enough to factor on this page.`]),
        el('button', {
          type: 'button',
          class: 'btn danger',
          onclick: () => runBreak(k.pub.n, k.pub.e),
        }, ['💥 Factor it!']),
        out,
      );
    };
    renderSmall();
  });

  function runBreak(n: bigint, e: bigint): void {
    clear(out);
    const t0 = performance.now();
    const broken = breakKey({ n, e });
    const ms = performance.now() - t0;
    if (!broken) {
      out.append(el('div', { class: 'verdict bad' }, ['Could not factor (try a smaller key).']));
      return;
    }
    const { factors, d } = broken;
    const probe = 42n % n;
    const c = modexp(probe, e, n);
    const recovered = modexp(c, d, n);
    out.append(
      el('div', { class: 'verdict alarm' }, [`🚨 KEY BROKEN in ${ms.toFixed(1)} ms — private key recovered`]),
      el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Recovered primes p, q']), codeBox(`${factors.p} × ${factors.q}`, 'factors')]),
      el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Reconstructed private d']), codeBox(d.toString(), 'd')]),
      el('div', { class: 'io-row' }, [el('span', { class: 'io-row__label' }, ['Anyone can now decrypt']), codeBox(`${c} → ${recovered}`, 'decrypt')]),
      el('p', { class: 'fine' }, [`Strategy: ${factors.strategy}, ${factors.iterations} iterations. This is why real keys are not 16 bits.`]),
    );
  }

  function renderBig(): void {
    const years = projectFactoringYears(2048);
    const exp = Math.floor(Math.log10(years));
    big.append(
      el('h3', {}, ['A real key — ', el('span', { class: 'mono' }, ['n = 2048 bits'])]),
      el('p', {}, ['617 decimal digits. The “Factor it!” button is deliberately disabled here.']),
      el('button', { type: 'button', class: 'btn', disabled: true }, ['Factor it (infeasible)']),
      el('div', { class: 'verdict good' }, ['✓ SECURE — factoring is computationally infeasible']),
      el('p', { class: 'fine' }, [
        `Projected cost (GNFS heuristic, 10¹² ops/sec): ~10`,
        el('sup', {}, [String(exp)]),
        ` years — astronomically longer than the age of the universe. This is a projection; nothing is actually run.`,
      ]),
    );
  }

  renderBig();

  return el('section', { class: 'panel', id: 'breaks' }, [
    el('h2', {}, ['5 · What breaks at scale']),
    el('p', { class: 'lede' }, ['The same algorithm, two key sizes. Small keys fall in milliseconds; 2048-bit keys do not fall at all.']),
    el('div', { class: 'scale-grid' }, [small, big]),
    el('p', { class: 'fine' }, [
      'Want to go deeper on attacking RSA? See the ',
      el('a', { href: LINKS.rsaForge, target: '_blank', rel: 'noopener' }, ['RSA Forge attack lab']),
      '. This panel only demonstrates that small keys are breakable — it is not an attack toolkit.',
    ]),
  ]);
}
