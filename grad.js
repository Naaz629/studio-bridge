'use strict';
/* IDEA9301 Graduation Studio - content taken from the course's Canvas site (Unit Outline, Unit Schedule, Modules). */
const GRAD = {
  name: 'Graduation Studio', code: 'IDEA9301',
  los: [
    'Formulate, plan and execute an individual/group design project in response to a design brief',
    'Choose appropriate methods as part of a human-centred design process to suit the problem space',
    'Analyse data from multiple sources to understand the problem space and idea, iterate and improve potential design interventions or solutions',
    'Document and report research-led design work',
    'Deliver evidence-based design presentations that are clear, confident and engaging to an external audience',
    'Critically analyse and reflect upon self and peer practices to identify and improve personal accountability in relation to the ethics and values of the discipline and profession'
  ],
  topics: {
    1: ['Introduction', 'Design Briefs'], 2: ['Planet: Design Frameworks & Life Centred Design', 'Frameworks for Design'],
    3: ['Building the Project', 'Charette'], 4: ['Profit: Costing the project', 'Budget'],
    5: ['Design Communication', 'Pitching Projects'], 6: ['What does "good" look like?', 'Project Evaluation Approaches'],
    7: ['Planet: design tactics', 'Creating Design Opportunity'], 8: ['Profit: Earning the First Dollar', 'Your Portfolio'],
    9: ['People: accessible technology', 'Ideating and Prototyping'], 10: ['People: designing for social good', 'Client Needs, Social Good'],
    11: ['People: codesign and communities', 'Validation with clients and peers'], 12: ['Responsible Design', 'Ethical Reflection'],
    13: ['Final exhibition and presentations', 'Final exhibition and presentations']
  },
  files: {
    1: ['Week 1 Tutorial Slides'], 2: ['Masterclass and tutorial slides (W02)', 'Team Agreement'], 3: ['Podclass: Tom Rivard'],
    4: ['Week 4 Masterclass slides', 'Tutorial slides template', 'Project budget example'], 5: ['Week 5 Tutorial Slides', 'Reverse brief template', 'W05 slides'],
    6: ['Week 6 Masterclass and tutorial slides'], 7: ['W07 codesign workshop slides'], 8: ['Lecture: Clarity & Communication (Rivard)'],
    9: ['Week 9 lecture slides', 'Grad Show prompts'], 10: ['Wk10 Lecture and tutorial slides', 'Lifeline / critique cards'],
    11: ['Cooper validation slides', 'Wk11 materials'], 12: ['W12 Tutorial slides', 'Cooper lecture slides', 'Colour, Type, Gestalt resources'], 13: []
  }
};

function gradSlides(w) {
  const [topic, tut] = GRAD.topics[w];
  return [
    { title: topic, body: `Week ${w} masterclass`, activities: [] },
    { title: `Tutorial: ${tut}`, body: `Week ${w} tutorial`, activities: [] },
    { title: 'Work-in-Progress updates', body: 'WIP followed by tutorial', activities: [] }
  ]
    .concat(GRAD.files[w].map(f => ({ title: f, body: 'Canvas resource', activities: [] })))
    .concat([{ title: 'Studio & Retrospective', body: 'Practical, then team retrospective', activities: [] }]);
}

function makeGradStudio() {
  const s = makeSubject(GRAD.name, GRAD.code);
  s.isGrad = true;
  s.slides = gradSlides(state.week);
  s.gradWeek = state.week;
  s.prompts['Concept Development'] = ['What does "good" look like for your project?', 'Which criteria would a client use?', 'How will you evidence success?', 'What would you change after feedback?', 'Summarise your evaluation approach.'];
  s.questions = [
    { id: 1, text: 'Can our WIP update include prototypes that are not finished?', askers: ['Amira K.', 'Ben T.', 'Dev P.', 'Grace L.'], answered: false },
    { id: 2, text: 'How is the group reflection marked against LO6?', askers: ['Chloe R.', 'Hamza N.'], answered: false },
    { id: 3, text: 'What should the budget show for the client brief?', askers: ['Elena S.'], answered: false }
  ];
  const ev = [
    ['How does your team\'s method suit this problem space?', [['Amira K.', 'We used interviews because the problem is about lived experience.', true], ['Ben T.', 'We picked a survey because it was quick.', false], ['Chloe R.', 'Co-design workshops let the client shape the brief.', true]]],
    ['What evidence supports your design decision?', [['Dev P.', 'Three interviews and a competitor audit pointed the same way.', true], ['Elena S.', 'It felt right to the group.', false]]]
  ];
  const art = s.weeks[1].artefacts;
  for (let w = 1; w <= 13; w++) {
    s.weeks[w] = { artefacts: art, los: GRAD.los.map((t, i) => mkLO('LO' + (i + 1), t, w + i, ev)) };
  }
  return s;
}
