import './style.css';
import { overviewPanel } from './ui/overview';
import { keygenPanel } from './ui/keygen';
import { encryptDecryptPanel } from './ui/encrypt-decrypt';
import { signVerifyPanel } from './ui/sign-verify';
import { whatBreaksPanel } from './ui/what-breaks';
import { realWorldPanel } from './ui/real-world';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing');

app.append(
  introHeader(),
  overviewPanel(),
  keygenPanel(),
  encryptDecryptPanel(),
  signVerifyPanel(),
  whatBreaksPanel(),
  realWorldPanel(),
);

function introHeader(): HTMLElement {
  const h = document.createElement('div');
  h.className = 'intro';
  h.innerHTML = `
    <h1>Educational RSA</h1>
    <p class="subtitle">Walk through RSA with real (small) numbers — generate a key, encrypt, sign,
    then watch a weak key get factored while a 2048-bit key holds.</p>`;
  return h;
}
