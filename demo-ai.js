'use strict';
/* Demo AI for the browser version. The desktop app has the real AI choices (Ollama, Claude); in a browser this built-in stand-in
   reads the slide text and writes a Bloom's-taxonomy ladder of example questions and a class insight, so every screen can be shown. */
(function () {
  const NL = String.fromCharCode(10);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shortSentence = (t, n = 20) => { const w = String(t).replace(/\s+/g, ' ').trim().split(' '); return w.slice(0, n).join(' ').replace(/[,;:]$/, '') + (w.length > n ? '…' : ''); };
  async function generate(p = {}) {
    await wait(1800);
    const lines = String(p.text || '').split(NL).map(l => l.trim()).filter(Boolean).filter(l => !/^Slide \d+ - /.test(l));
    const sents = lines.filter(l => l.split(' ').length >= 5 && l.length <= 200 && !/acknowledg|gadigal|elders|sovereignty|traditional custodians|copyright|all rights reserved|^page \d|^week \d+$/i.test(l));
    let title = String(p.title || '').replace(/^Weeks*d+s*[:-–]?s*/i, '').trim();
    if (!title || /^this week/i.test(title)) title = shortSentence(sents[0] || 'this idea', 6);
    const core = shortSentence(sents[0] || ('It is the main idea of ' + title + '.'));
    const alt = shortSentence(sents[1] || 'You use it to check your own project against evidence.', 16);
    const outs = Array.isArray(p.outs) ? p.outs : [];
    const bag = new Set((String(p.text || '') + ' ' + title).toLowerCase().match(/[a-z]{5,}/g) || []);
    let lo = outs[0] ? outs[0].lo : undefined, best = -1;
    for (const o of outs) { const n = (String(o.out).toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => bag.has(w)).length; if (n > best) { best = n; lo = o.lo; } }
    const mc = (text, right, wrongs) => ({ type: 'mc', text, options: [{ t: right, ok: true }].concat(wrongs.map(t => ({ t, ok: false }))) });
    const questions = [
      Object.assign({ level: 'identify' }, mc('Which sentence best explains the main idea of "' + shortSentence(title, 8) + '"?', core, ['It is a step you can skip when time is short.', 'It only matters at the very end of a project.', 'It means choosing the idea you like most.'])),
      { level: 'apply', type: 'open', text: 'Use the idea from "' + shortSentence(title, 8) + '" in your own project. Give one real example.', hint: 'In my project, I used this idea to…' },
      Object.assign({ level: 'analyse' }, mc('Which team used this idea well?', 'The team tested their plan with real users, then changed it.', ['The team kept the plan because they liked it.', 'The team asked no one and finished early.', 'The team copied the plan of another group.'])),
      { level: 'evaluate', type: 'scale', text: 'How strong is this evidence for your choice: "' + alt + '"? Rate it from 1 to 5.', lo: 'Very weak', hi: 'Very strong' },
      { level: 'create', type: 'open', text: 'Write 1 to 2 sentences that use "' + shortSentence(title, 8) + '" to improve your project.', hint: 'To improve my project, I will…' }
    ];
    return { questions, lo, terms: [], model: 'demo', provider: 'demo' };
  }
  async function insight(p = {}) {
    await wait(900);
    const right = (p.total || 0) - (p.stuckN || 0);
    const gl = Array.isArray(p.groups) && p.groups.length === 3 ? p.groups[0].pct + '% of students are getting started, ' + p.groups[1].pct + '% are developing and ' + p.groups[2].pct + '% are fluent. ' : '';
    const weak = String(p.weakest || 'the weakest step').replace(/\s*\(.*$/, '');
    const quote = (p.gaps || [])[0] && String(p.gaps[0]).split(' ').length > 5 ? ' One weak answer was: "' + shortSentence(String(p.gaps[0]).replace(/^[^:]*:\s*/, ''), 12) + '".' : '';
    return { summary: gl + right + ' of ' + p.total + ' students got the "' + weak + '" step right. ' + (p.stuckN || 0) + ' are stuck there: their answers stay general and do not link the idea to their own project.' + quote, stuck: '', why: '' };
  }
  window.demoAI = { status: async () => ({ provider: 'demo', enabled: true }), generate, insight };
})();
