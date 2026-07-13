import './style.css';
import { overviewPanel } from './ui/overview';
import { keygenPanel } from './ui/keygen';
import { encryptDecryptPanel } from './ui/encrypt-decrypt';
import { roundTripPanel } from './ui/round-trip';
import { signVerifyPanel } from './ui/sign-verify';
import { whatBreaksPanel } from './ui/what-breaks';
import { realWorldPanel } from './ui/real-world';
import { relatedPanel } from './ui/related';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing');

app.append(
  introHeader(),
  overviewPanel(),
  keygenPanel(),
  encryptDecryptPanel(),
  roundTripPanel(),
  signVerifyPanel(),
  whatBreaksPanel(),
  realWorldPanel(),
  relatedPanel(),
);

function introHeader(): HTMLElement {
  const h = document.createElement('header');
  h.className = 'cl-hero';
  h.innerHTML = `
    <div class="cl-hero-main">
      <h1 class="cl-hero-title">RSA</h1>
      <p class="cl-hero-sub">Public-Key Cryptosystem · multiply-easy / factor-hard trapdoor</p>
      <p class="cl-hero-desc">Generate a key (n, φ, e, d) from real small primes, then encrypt, decrypt,
      and sign step by step — and watch a weak key get factored while a 2048-bit key holds.</p>
    </div>
    <aside class="cl-hero-why" aria-label="Why it matters">
      <span class="cl-hero-why-label">WHY IT MATTERS</span>
      <p class="cl-hero-why-text">RSA secures TLS handshakes, code signing, and email. Its safety rests
      entirely on factoring being infeasible at scale — and on padding like OAEP, since textbook RSA is
      broken in practice.</p>
    </aside>`;
  return h;
}
