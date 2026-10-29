/* Copies the browser version into web/ so it can be hosted on any static host (Vercel, GitHub Pages, Netlify). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'web');
fs.rmSync(out, { recursive: true, force: true });
const copy = (rel) => { const s = path.join(root, rel), d = path.join(out, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.cpSync(s, d, { recursive: true }); };
['index.html', 'styles.css', 'app.js', 'bloom.js', 'data.js', 'slides.js', 'outline.js', 'demo-ai.js', 'vendor', 'slides',
  'assets/logo.png', 'assets/icon-256.png', 'assets/units.js', 'assets/cards', 'assets/artefacts'].forEach(copy);
console.log('web/ is ready:', fs.readdirSync(out).join(', '));
