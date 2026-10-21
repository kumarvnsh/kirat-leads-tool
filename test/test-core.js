// node test-core.js — checks the pure helpers behind Kirat Lead Desk. Fictional data only.
const K = require('../lead-core.js');
const assert = require('assert');
let n = 0; const id = () => 'id-' + (++n);

const base = (o = {}) => Object.assign({
  id: null, company: 'Fictional Tea Co', domain: 'https://www.Fictional-Tea.example/about', branch_project: 'Test outlet A',
  segment: 'ncr_local', city: 'Noida', state: 'Uttar Pradesh', website: 'https://fictional-tea.example/',
  signal_type: 'opening', opportunity: 'Inferred: storefront signage.', services: ['Signage'],
  publication_date: '2026-10-01', event_date: null, researched_on: '2026-10-19',
  evidence: [{ url: 'https://fictional-tea.example/news', title: 'News', summary: 'Announces outlet.' }],
  contacts: [], buyer_role: 'Projects team', score: { service_fit: 2, project_evidence: 2, timing: 1, contactability: 0 },
  confidence: 'medium', next_action: 'Verify.', owner: '', status: 'New', follow_up_date: null, notes: '', studio_reference: ''
}, o);
const env = (leads, extra = {}) => JSON.stringify(Object.assign({ schema_version: 1, batch_date: '2026-10-19', leads }, extra));
function importAll(reg, text, actions = {}) {
  const p = K.parseEnvelope(text); assert(!p.fatal, p.fatal);
  const prev = K.classify(p.rows, reg).map(r => Object.assign(r, actions[r.index] || {}));
  return { p, prev, res: K.applyImport(reg, prev, p.kind, id) };
}

// empty batch changes nothing
let r = importAll([], env([]));
assert.strictEqual(r.res.leads.length, 0);
// malformed JSON / wrong schema rejected before anything
assert(K.parseEnvelope('{bad').fatal);
assert(K.parseEnvelope(env([], { schema_version: 2 })).fatal);
assert(K.parseEnvelope('x'.repeat(5 * 1024 * 1024 + 1)).fatal.includes('5 MB'));
// missing evidence / out-of-range score → row errors, other rows still valid
let p = K.parseEnvelope(env([base({ evidence: [] }), base({ score: { service_fit: 4, project_evidence: 1, timing: 0, contactability: 0 } }), base()]));
assert(p.rows[0].errors.some(e => /evidence/.test(e)));
assert(p.rows[1].errors.some(e => /service_fit/.test(e)));
assert(p.rows[2].lead && !p.rows[2].errors.length);
assert(K.parseEnvelope(env([base({ researched_on: '2026-02-30' })])).rows[0].errors.length);
assert(K.parseEnvelope(env([base({ contacts: [{ type: 'email', value: 'a@b.example', source_url: 'https://b.example', verification: 'verified' }] })])).rows[0].errors.some(e => /verification_evidence/.test(e)));
// unknown fields dropped; domain normalised
assert.strictEqual(p.rows[2].lead.domain, 'fictional-tea.example');
assert(!('evil' in K.parseEnvelope(env([base({ evil: '<script>' })])).rows[0].lead));

// add one, then duplicate defaults to skip; related branch kept separate
r = importAll([], env([base()]));
let reg = r.res.leads; assert.strictEqual(reg.length, 1); const lid = reg[0].id;
reg[0] = Object.assign({}, reg[0], { notes: 'Called, wants quote', status: 'Contacted', owner: 'Asha', follow_up_date: '2026-10-25', studio_reference: 'KS-1' });
r = importAll(reg, env([base({ domain: 'fictional-tea.example' }), base({ branch_project: 'Test outlet B' })]));
assert.strictEqual(r.prev[0].kind, 'duplicate'); assert.strictEqual(r.prev[0].action, 'skip');
assert.strictEqual(r.prev[1].kind, 'related'); assert.strictEqual(r.prev[1].action, 'add');
assert.strictEqual(r.res.leads.length, 2);
// same id → duplicate; merge keeps sales fields, unions evidence, never empties
r = importAll(reg, env([base({ id: lid, branch_project: 'Renamed', evidence: [{ url: 'https://fictional-tea.example/news2', title: '', summary: 'More.' }], contacts: [] })]), { 0: { action: 'merge' } });
let m = r.res.leads[0];
assert.strictEqual(r.prev[0].kind, 'duplicate');
assert.strictEqual(m.id, lid); assert.strictEqual(m.notes, 'Called, wants quote'); assert.strictEqual(m.status, 'Contacted');
assert.strictEqual(m.owner, 'Asha'); assert.strictEqual(m.studio_reference, 'KS-1'); assert.strictEqual(m.follow_up_date, '2026-10-25');
assert.strictEqual(m.evidence.length, 2); assert.strictEqual(m.branch_project, 'Renamed');
assert(K.diffLead(reg[0], m).some(d => d.field === 'branch_project'));
// research batch cannot inject sales fields
assert.strictEqual(K.parseEnvelope(env([base({ notes: 'x', status: 'Closed' })])).rows[0].lead.status, 'New');

// JSON round-trip: export, restore into empty register
const backup = K.backupJson(reg);
r = importAll([], backup);
assert.strictEqual(r.p.kind, 'backup');
assert.deepStrictEqual(r.res.leads.map(K.pickLead), reg.map(K.pickLead));
// restore over existing: merge keeps local sales unless replaceSales
const local = [Object.assign({}, reg[0], { notes: 'local edit' })];
assert.strictEqual(importAll(local, backup, { 0: { action: 'merge' } }).res.leads[0].notes, 'local edit');
assert.strictEqual(importAll(local, backup, { 0: { action: 'merge', replaceSales: true } }).res.leads[0].notes, 'Called, wants quote');

// CSV escaping + formula protection
const evil = Object.assign({}, reg[0], { company: '=1+1', notes: 'a, "b"\nc', owner: ' @x', branch_project: '-5', city: '+91' });
const csv = K.toCsv([evil]);
assert(csv.includes(`"a, ""b""\nc"`));
assert(csv.includes(",'=1+1,")); assert(csv.includes(",' @x,")); assert(csv.includes(",'-5,")); assert(csv.includes(",'+91,"));
assert.strictEqual(K.csvCell('\tcmd'), "'\tcmd");
assert.strictEqual(K.csvCell(7), '7');

// dates: no day shift, Kolkata today, follow-ups due
assert.strictEqual(K.formatDate('2026-10-19'), '19 Oct 2026');
assert.strictEqual(K.todayInKolkata(new Date('2026-10-19T19:00:00Z')), '2026-10-20'); // 00:30 IST next day
assert.strictEqual(K.todayInKolkata(new Date('2026-10-19T18:00:00Z')), '2026-10-19');
assert(K.isFollowUpDue({ status: 'Follow-up', follow_up_date: '2026-10-19' }, '2026-10-19'));
assert(!K.isFollowUpDue({ status: 'Closed', follow_up_date: '2026-10-01' }, '2026-10-19'));
assert(K.isStale({ researched_on: '2026-06-01' }, '2026-10-19'));

// filters
const two = r = importAll([], env([base(), base({ company: 'Fictional Shoes', domain: 'shoes.example', segment: 'national_retail', city: 'Mumbai', services: ['Graphics'], score: { service_fit: 1, project_evidence: 1, timing: 0, contactability: 0 } })])).res.leads;
assert.strictEqual(K.filterLeads(two, { segment: 'national_retail' }, '2026-10-19').length, 1);
assert.strictEqual(K.filterLeads(two, { city: 'noida' }, '2026-10-19').length, 1);
assert.strictEqual(K.filterLeads(two, { service: 'Graphics' }, '2026-10-19').length, 1);
assert.strictEqual(K.filterLeads(two, { minScore: 5 }, '2026-10-19').length, 1);
assert.strictEqual(K.filterLeads(two, { q: 'shoes' }, '2026-10-19').length, 1);
assert.strictEqual(K.filterLeads(two, { status: 'New' }, '2026-10-19').length, 2);

console.log('lead-core: all checks passed');

// person contacts need a role and keep it through validation and CSV
const withPerson = base({ contacts: [{ type: 'person', value: 'Test Person', role: 'Managing Director', source_url: 'https://chai.example/news', verification: 'published_only' }] });
const pv = K.parseEnvelope(env([withPerson, base({ contacts: [{ type: 'person', value: 'No Role', source_url: 'https://chai.example/news', verification: 'published_only' }] })]));
assert.strictEqual(pv.rows[0].lead.contacts[0].role, 'Managing Director');
assert(pv.rows[1].errors.some(e => /role/.test(e)));
assert(K.toCsv([Object.assign(pv.rows[0].lead, { id: 'x' })]).includes('person: Test Person (Managing Director)'));
console.log('person contacts: ok');
