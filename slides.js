'use strict';
/* Reads uploaded slide files so the app knows what is on each slide.
   PDF  -> every page is drawn as an image and its text is extracted (PDF.js)
   PPTX -> the text of every slide (and its speaker notes) is extracted (JSZip + XML)
   Image -> shown as a slide; no text can be read from a picture
   Returns [{ name, url, title, text }] - one entry per slide. */

const stripExt = n => String(n).replace(/\.[a-z0-9]+$/i, '');
const tidy = t => String(t || '').replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

/* the title of a page is its largest line of text (ties go to the topmost) */
function pageTitle(rows) {
  const lines = rows.map(r => ({ size: r.size, t: r.parts.slice().sort((a, b) => a.x - b.x).map(p => p.s).join(' ').trim() })).filter(l => l.t.length > 2);
  if (!lines.length) return '';
  const mx = Math.max(...lines.map(l => l.size));
  return (lines.find(l => l.size >= mx - 0.01) || lines[0]).t;
}

async function readPdf(file, onProgress) {
  const pdfjs = await import('./vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', document.baseURI).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out = [];
  // PDF.js paces its drawing with animation frames, which stop in a hidden window: use a timer instead while reading
  const realRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
  try {
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    // text, grouped into lines by vertical position
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 4);
      let r = rows.find(r => r.y === y);
      if (!r) rows.push(r = { y, parts: [], size: 0 });
      r.parts.push({ x: it.transform[4], s: it.str });
      r.size = Math.max(r.size, Math.abs(it.transform[3]) || it.height || 0);
    }
    rows.sort((a, b) => b.y - a.y);
    const lines = rows.map(r => ({ size: r.size, t: r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ').trim() })).filter(l => l.t);
    // picture of the page
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    out.push({ name: `${file.name} · page ${n}`, url: canvas.toDataURL('image/jpeg', 0.82), title: '', text: '', _lines: lines });
    if (onProgress) onProgress(n, doc.numPages);
  }
  } finally { window.requestAnimationFrame = realRaf; }
  // headers, footers and menu labels repeat on most pages: they say nothing about the slide, so leave them out
  const seen = {};
  out.forEach(p => new Set(p._lines.map(l => l.t)).forEach(t => { seen[t] = (seen[t] || 0) + 1; }));
  const repeatAt = Math.max(3, Math.ceil(out.length * 0.4));
  out.forEach((p, i) => {
    const own = p._lines.filter(l => out.length < 3 || seen[l.t] < repeatAt);
    const keep = own.length ? own : p._lines;
    const mx = Math.max(0, ...keep.map(l => l.size));
    p.title = (keep.find(l => l.t.length > 2 && l.size >= mx - 0.01) || keep.find(l => l.t.length > 2) || { t: `Page ${i + 1}` }).t;
    p.text = tidy(keep.map(l => l.t).join('\n'));
    delete p._lines;
  });
  return out;
}

async function readPptx(file) {
  if (typeof JSZip === 'undefined') throw new Error('PowerPoint reader not loaded');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const num = p => +(p.match(/(\d+)\.xml$/) || [0, 0])[1];
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  const parse = xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.getElementsByTagName('a:p')].map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join('')).map(s => s.trim()).filter(Boolean);
  };
  const out = [];
  for (const n of names) {
    const lines = parse(await zip.file(n).async('string'));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${num(n)}.xml`);
    const notes = notesFile ? parse(await notesFile.async('string')).filter(l => !/^\d+$/.test(l)) : [];
    const text = tidy(lines.concat(notes).join('\n'));
    out.push({ name: `${file.name} · slide ${num(n)}`, url: null, title: lines[0] || `Slide ${num(n)}`, text });
  }
  return out;
}

async function readSlideFile(file, onProgress) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return readPdf(file, onProgress);
  if (ext === 'pptx') return readPptx(file);
  if (file.type.startsWith('image/')) return [{ name: file.name, url: URL.createObjectURL(file), title: stripExt(file.name), text: '' }];
  return null; // .ppt / .key and other formats can't be read
}
