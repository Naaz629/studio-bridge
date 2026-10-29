'use strict';
/* Hover a design word anywhere (slides, questions, answers) to see its plain-English meaning and its Chinese meaning in a design context. */
const GLOSSARY = {
  insight: ['a new understanding found in research', '洞察：从研究中发现的深层理解'],
  finding: ['a fact you saw in your research', '发现：研究中观察到的事实'],
  brief: ['a short document that says what the project must do', '设计任务书：说明项目目标的简短文件'],
  persona: ['an invented user that stands for a real group', '用户画像：代表一类真实用户的虚构人物'],
  stakeholder: ['anyone who is affected by or cares about the project', '利益相关者：与项目有关的人或组织'],
  prototype: ['a quick early model you can test', '原型：可用于测试的早期模型'],
  ideation: ['coming up with many ideas', '构思：产生大量创意'],
  iteration: ['making it better again and again', '迭代：反复改进'],
  iterate: ['to improve step by step', '迭代：逐步改进'],
  empathy: ['understanding how users feel', '同理心：理解用户的感受'],
  synthesis: ['putting your research together to find meaning', '综合：整合研究以得出意义'],
  assumption: ['something you believe but have not checked', '假设：尚未验证的想法'],
  hypothesis: ['an idea you can test', '假说：可以被检验的想法'],
  journey: ['the steps a user goes through', '旅程：用户经历的步骤'],
  touchpoint: ['a moment where the user meets the service', '接触点：用户与服务接触的时刻'],
  wireframe: ['a simple drawing of a screen layout', '线框图：屏幕布局的简单草图'],
  usability: ['how easy something is to use', '可用性：使用的难易程度'],
  affordance: ['a clue that shows how to use something', '功能可见性：提示如何使用的线索'],
  heuristic: ['a rule of thumb for judging design', '启发式：评判设计的经验法则'],
  framework: ['a structure that guides your thinking', '框架：指导思考的结构'],
  deliverable: ['something you must hand in', '交付物：需要提交的成果'],
  artefact: ['something you made as evidence of your work', '成果物：作为工作证据的作品'],
  artifact: ['something you made as evidence of your work', '成果物：作为工作证据的作品'],
  critique: ['giving helpful feedback on a design', '评审：对设计给出有益的反馈'],
  rationale: ['the reason behind a choice', '设计理由：做出选择的原因'],
  methodology: ['the way you did your research', '方法论：研究所用的方法'],
  qualitative: ['about opinions and stories, not numbers', '定性的：关于观点和故事而非数字'],
  quantitative: ['about numbers and counts', '定量的：关于数字和统计'],
  ethnography: ['watching people in their real life', '民族志：观察人们的真实生活'],
  codesign: ['designing together with users', '共同设计：与用户一起设计'],
  'co-design': ['designing together with users', '共同设计：与用户一起设计'],
  storyboard: ['a set of drawings that tell a story', '故事板：讲述故事的系列画面'],
  mockup: ['a realistic picture of the final design', '效果图：接近最终设计的图'],
  moodboard: ['a collage of images that shows a style', '情绪板：展示风格的图片拼贴'],
  typography: ['the style and layout of text', '字体排印：文字的样式和排版'],
  hierarchy: ['what the eye sees first, second, third', '层级：视觉上的先后顺序'],
  accessibility: ['design that everyone can use', '无障碍：让所有人都能使用'],
  inclusive: ['made for many kinds of people', '包容性的：面向各类人群'],
  constraint: ['a limit you must work within', '限制条件：必须遵守的约束'],
  scope: ['how much the project includes', '范围：项目包含的内容'],
  milestone: ['an important step or date in a project', '里程碑：项目中的重要节点'],
  pitch: ['a short talk to sell your idea', '提案演讲：推销想法的简短陈述'],
  reflection: ['thinking about what you learned', '反思：回顾所学'],
  evidence: ['facts that show something is true', '证据：证明事实的依据'],
  validate: ['to check that it is right', '验证：确认其正确'],
  validation: ['checking that it is right', '验证：确认其正确'],
  evaluation: ['judging how good it is', '评估：判断其好坏'],
  outcome: ['the result you want', '成果：期望达到的结果'],
  opportunity: ['a gap where design can help', '机会点：设计可以发挥作用的空白'],
  reframe: ['to look at the problem in a new way', '重新定义问题：换个角度看问题'],
  reframing: ['looking at the problem in a new way', '重新定义问题：换个角度看问题'],
  workshop: ['a hands-on group session', '工作坊：动手参与的小组活动'],
  sprint: ['a short, fast round of work', '冲刺：短而快的工作周期'],
  cluster: ['to group similar things', '聚类：把相似内容归类'],
  affinity: ['grouping notes that are alike', '亲和图：将相似的便签归组'],
  concept: ['the main idea of a design', '概念：设计的核心想法'],
  studio: ['a class where you make design work', '工作室课：动手做设计的课程']
};
const glossEntry = w => {
  const k = w.toLowerCase().replace(/^-+|-+$/g, '');
  return GLOSSARY[k] || GLOSSARY[k.replace(/ies$/, 'y')] || GLOSSARY[k.replace(/(es|s|ed|ing)$/, '')] || GLOSSARY[k.replace(/(ing|ed)$/, 'e')] || null;
};
(function () {
  let tip = null, last = '';
  const hide = () => { if (tip) tip.style.display = 'none'; last = ''; };
  document.addEventListener('mousemove', e => {
    const x = e.clientX, y = e.clientY, el = e.target;
    if (!el || (el.closest && el.closest('input,textarea,select,button,.gtip'))) return hide();
    let r = null;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p && p.offsetNode.nodeType === 3) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.setEnd(p.offsetNode, p.offset); } }
    else if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
    if (!r || r.startContainer.nodeType !== 3) return hide();
    const t = r.startContainer.textContent, i = r.startOffset;
    let a = i, b = i;
    while (a > 0 && /[A-Za-z-]/.test(t[a - 1])) a--;
    while (b < t.length && /[A-Za-z-]/.test(t[b])) b++;
    const w = t.slice(a, b), g = w.length > 3 && glossEntry(w);
    if (!g) return hide();
    const rg = document.createRange(); rg.setStart(r.startContainer, a); rg.setEnd(r.startContainer, b);
    const box = rg.getBoundingClientRect();
    if (x < box.left - 2 || x > box.right + 2 || y < box.top - 2 || y > box.bottom + 2) return hide();
    if (!tip) { tip = document.createElement('div'); tip.className = 'gtip'; document.body.appendChild(tip); }
    if (last !== w) { tip.innerHTML = '<b></b><span></span><i lang="zh-Hans"></i>'; tip.children[0].textContent = w; tip.children[1].textContent = g[0]; tip.children[2].textContent = g[1]; last = w; }
    tip.style.display = 'block';
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, box.left)) + 'px';
    tip.style.top = (box.bottom + 8 + tip.offsetHeight > innerHeight ? box.top - tip.offsetHeight - 8 : box.bottom + 8) + 'px';
  });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('mouseleave', hide);
})();
