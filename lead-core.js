/* Kirat Lead Desk \u2014 pure helpers: validation, scoring, dedupe, merge, export, dates.
   No DOM, no network, no storage. Loaded by index.html and by test-core.js under node. */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var MAX_BYTES = 5 * 1024 * 1024;
  var STALE_DAYS = 90;
  var SEGMENTS = ['national_retail', 'ncr_local'];
  var SIGNALS = ['opening', 'expansion', 'renovation', 'rebranding', 'other'];
  var CONFIDENCE = ['low', 'medium', 'high'];
  var SERVICES = ['Signage', 'Graphics', 'Display Units', 'Turnkey Solutions', 'Installation', 'Maintenance'];
  var STATUSES = ['New', 'Reviewed', 'Contacted', 'Follow-up', 'Qualified', 'Closed'];
  var CONTACT_TYPES = ['email', 'phone', 'contact_page', 'person'];
  var VERIFICATION = ['published_only', 'verified'];
  var SCORE_RANGES = { service_fit: 3, project_evidence: 3, timing: 2, contactability: 2 };
  var RESEARCH_FIELDS = ['company', 'domain', 'branch_project', 'segment', 'city', 'state', 'website',
    'signal_type', 'opportunity', 'services', 'publication_date', 'event_date', 'researched_on',
    'evidence', 'contacts', 'buyer_role', 'score', 'confidence', 'next_action'];
  var SALES_FIELDS = ['owner', 'status', 'follow_up_date', 'notes', 'studio_reference'];
  var LEAD_FIELDS = ['id'].concat(RESEARCH_FIELDS, SALES_FIELDS);

  // ---------- primitives ----------
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }

  function isISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function isHttpUrl(s) {
    if (typeof s !== 'string' || !s.trim()) return false;
    try { var u = new URL(s.trim()); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname; }
    catch (e) { return false; }
  }

  function normDomain(s) {
    if (typeof s !== 'string') return '';
    return s.trim().toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/^[^@/]*@/, '')
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, '')
      .replace(/^www\./, '')
      .replace(/\.$/, '');
  }

  function normText(s) {
    if (typeof s !== 'string') return '';
    return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // ---------- dates (date-only strings never pass through a Date in local time) ----------
  function todayInKolkata(now) {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(now || new Date());
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatDate(iso) {
    if (!isISODate(iso)) return '\u2014';
    return +iso.slice(8, 10) + ' ' + MONTHS[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
  }

  function daysBetween(fromIso, toIso) {
    if (!isISODate(fromIso) || !isISODate(toIso)) return null;
    var a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
    var b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }

  // ---------- scoring ----------
  function scoreTotal(score) {
    if (!isObj(score)) return 0;
    return Object.keys(SCORE_RANGES).reduce(function (t, k) { return t + (Number.isInteger(score[k]) ? score[k] : 0); }, 0);
  }

  function isFollowUpDue(lead, today) {
    return lead.status !== 'Closed' && isISODate(lead.follow_up_date) && lead.follow_up_date <= today;
  }

  function isStale(lead, today) {
    var d = daysBetween(lead.researched_on, today);
    return d !== null && d > STALE_DAYS;
  }

  // ---------- validation ----------
  // mode: 'batch' (research output: sales fields ignored, fresh defaults) or 'backup' (restore: id + sales kept)
  function validateLead(raw, mode) {
    var errors = [], warnings = [];
    var lead = {};
    if (!isObj(raw)) return { lead: null, errors: ['Row is not an object.'], warnings: warnings };

    RESEARCH_FIELDS.concat(['id']).forEach(function (k) { if (!has(raw, k)) errors.push('Missing field "' + k + '".'); });

    function reqText(k, label) {
      if (typeof raw[k] !== 'string' || !raw[k].trim()) errors.push(label + ' is required (non-empty text).');
      lead[k] = str(raw[k]);
    }
    function optText(k, label) {
      if (raw[k] != null && typeof raw[k] !== 'string') errors.push(label + ' must be text or null.');
      lead[k] = str(raw[k]);
    }
    function optDate(k, label) {
      if (raw[k] == null || raw[k] === '') { lead[k] = null; return; }
      if (!isISODate(raw[k])) errors.push(label + ' must be a real YYYY-MM-DD date or null (got ' + JSON.stringify(raw[k]) + ').');
      lead[k] = isISODate(raw[k]) ? raw[k] : null;
    }
    function oneOf(k, list, label) {
      if (list.indexOf(raw[k]) < 0) errors.push(label + ' must be one of: ' + list.join(', ') + ' (got ' + JSON.stringify(raw[k]) + ').');
      lead[k] = raw[k];
    }

    // id
    if (mode === 'backup') {
      if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_.~:@+-]{1,120}$/.test(raw.id)) errors.push('Backup rows need a stable text id.');
      lead.id = typeof raw.id === 'string' ? raw.id : null;
    } else {
      if (raw.id != null && typeof raw.id !== 'string') errors.push('id must be null or a known lead id.');
      lead.id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null;
    }

    reqText('company', 'Company');
    optText('domain', 'Domain');
    lead.domain = normDomain(lead.domain);
    reqText('branch_project', 'Branch/project');
    oneOf('segment', SEGMENTS, 'Segment');
    reqText('city', 'City');
    optText('state', 'State');
    if (raw.website != null && raw.website !== '' && !isHttpUrl(raw.website)) errors.push('Website must be an http(s) URL or null.');
    lead.website = isHttpUrl(raw.website) ? raw.website.trim() : '';
    oneOf('signal_type', SIGNALS, 'Signal type');
    reqText('opportunity', 'Opportunity');

    if (!Array.isArray(raw.services) || !raw.services.length) errors.push('Services must be a non-empty list.');
    else raw.services.forEach(function (s) { if (SERVICES.indexOf(s) < 0) errors.push('Unknown service ' + JSON.stringify(s) + '.'); });
    lead.services = Array.isArray(raw.services) ? raw.services.filter(function (s) { return SERVICES.indexOf(s) >= 0; })
      .filter(function (s, i, a) { return a.indexOf(s) === i; }) : [];

    optDate('publication_date', 'Publication date');
    optDate('event_date', 'Event date');
    if (!isISODate(raw.researched_on)) errors.push('Research date must be a real YYYY-MM-DD date.');
    lead.researched_on = isISODate(raw.researched_on) ? raw.researched_on : null;

    // evidence
    lead.evidence = [];
    if (!Array.isArray(raw.evidence) || !raw.evidence.length) errors.push('At least one evidence source is required.');
    else raw.evidence.forEach(function (e, i) {
      var n = 'Evidence ' + (i + 1);
      if (!isObj(e)) { errors.push(n + ' is not an object.'); return; }
      if (!isHttpUrl(e.url)) errors.push(n + ': url must be http(s).');
      if (typeof e.summary !== 'string' || !e.summary.trim()) errors.push(n + ': summary is required.');
      if (e.title != null && typeof e.title !== 'string') errors.push(n + ': title must be text.');
      lead.evidence.push({ url: str(e.url), title: str(e.title), summary: str(e.summary) });
    });

    // contacts
    lead.contacts = [];
    if (!Array.isArray(raw.contacts)) errors.push('Contacts must be a list (use [] when unknown).');
    else raw.contacts.forEach(function (c, i) {
      var n = 'Contact ' + (i + 1);
      if (!isObj(c)) { errors.push(n + ' is not an object.'); return; }
      if (CONTACT_TYPES.indexOf(c.type) < 0) errors.push(n + ': type must be email, phone, contact_page or person.');
      if (c.type === 'person' && (typeof c.role !== 'string' || !c.role.trim())) errors.push(n + ': a person needs a role (their title as stated in the source).');
      if (typeof c.value !== 'string' || !c.value.trim()) errors.push(n + ': value is required.');
      if (!isHttpUrl(c.source_url)) errors.push(n + ': source_url must be http(s).');
      var ver = c.verification == null ? 'published_only' : c.verification;
      if (VERIFICATION.indexOf(ver) < 0) errors.push(n + ': verification must be published_only or verified.');
      var out = { type: c.type, value: str(c.value), source_url: str(c.source_url), verification: ver };
      if (c.type === 'person') out.role = str(c.role);
      if (ver === 'verified') {
        if (typeof c.verification_evidence !== 'string' || !c.verification_evidence.trim())
          errors.push(n + ': "verified" needs a verification_evidence explanation.');
        out.verification_evidence = str(c.verification_evidence);
      }
      ['checked_on', 'scope', 'person_name', 'source_excerpt', 'email_status'].forEach(function (k) {
        if (c[k] == null) return;
        if (typeof c[k] !== 'string') errors.push(n + ': ' + k + ' must be text.');
        else out[k] = c[k].trim();
      });
      if (c.role != null && c.type !== 'person') out.role = str(c.role);
      if (out.checked_on && !isISODate(out.checked_on)) errors.push(n + ': checked_on must be an ISO date.');
      if (out.scope && ['direct', 'company', 'unknown'].indexOf(out.scope) < 0) errors.push(n + ': invalid contact scope.');
      if (out.email_status && ['published_only', 'verified', 'risky', 'guess', 'invalid'].indexOf(out.email_status) < 0) errors.push(n + ': invalid email status.');
      if (out.email_status === 'verified' && ver !== 'verified') errors.push(n + ': verified email status needs verification evidence.');
      if (out.scope === 'direct' && (!out.person_name || !out.role || !out.source_excerpt)) errors.push(n + ': direct contact needs person_name, role and source_excerpt.');
      lead.contacts.push(out);
    });

    optText('buyer_role', 'Buyer role');

    // score
    lead.score = {};
    if (!isObj(raw.score)) errors.push('Score must be an object with service_fit, project_evidence, timing, contactability.');
    Object.keys(SCORE_RANGES).forEach(function (k) {
      var v = isObj(raw.score) ? raw.score[k] : undefined;
      if (!Number.isInteger(v) || v < 0 || v > SCORE_RANGES[k]) errors.push('Score ' + k + ' must be a whole number 0\u2013' + SCORE_RANGES[k] + ' (got ' + JSON.stringify(v) + ').');
      lead.score[k] = Number.isInteger(v) ? Math.max(0, Math.min(SCORE_RANGES[k], v)) : 0;
    });
    if (lead.score.service_fit < 1) errors.push('Not qualified: service_fit must be at least 1.');
    if (lead.score.project_evidence < 1) errors.push('Not qualified: project_evidence must be at least 1.');
    if (isObj(raw.score) && has(raw.score, 'total')) warnings.push('Supplied score total ignored; total is derived.');

    oneOf('confidence', CONFIDENCE, 'Confidence');
    optText('next_action', 'Next action');

    // sales fields
    if (mode === 'backup') {
      lead.owner = str(raw.owner);
      lead.status = STATUSES.indexOf(raw.status) >= 0 ? raw.status : 'New';
      if (raw.status != null && STATUSES.indexOf(raw.status) < 0) errors.push('Status must be one of: ' + STATUSES.join(', ') + '.');
      optDate('follow_up_date', 'Follow-up date');
      lead.notes = typeof raw.notes === 'string' ? raw.notes : '';
      lead.studio_reference = str(raw.studio_reference);
    } else {
      var salesSet = SALES_FIELDS.some(function (k) { return raw[k] != null && raw[k] !== '' && !(k === 'status' && raw[k] === 'New'); });
      if (salesSet) warnings.push('Sales fields in a research batch are ignored; they start fresh here.');
      lead.owner = ''; lead.status = 'New'; lead.follow_up_date = null; lead.notes = ''; lead.studio_reference = '';
    }

    return { lead: errors.length ? null : lead, errors: errors, warnings: warnings };
  }

  // Parse + validate a pasted/uploaded envelope. Never throws.
  function parseEnvelope(text) {
    var bytes = typeof Blob !== 'undefined' ? new Blob([text]).size : Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_BYTES) return { fatal: 'Input is ' + (bytes / 1048576).toFixed(1) + ' MB. The limit is 5 MB.' };
    if (!String(text).trim()) return { fatal: 'Nothing to import. Paste JSON or choose a file.' };
    var data;
    try { data = JSON.parse(text); }
    catch (e) { return { fatal: 'This is not valid JSON: ' + e.message + '. Nothing was changed.' }; }
    if (!isObj(data)) return { fatal: 'Expected a JSON object with schema_version and leads.' };
    if (data.schema_version !== SCHEMA_VERSION) return { fatal: 'Unsupported schema_version ' + JSON.stringify(data.schema_version) + '. Expected 1. Nothing was changed.' };
    if (!Array.isArray(data.leads)) return { fatal: '"leads" must be a list. Nothing was changed.' };
    var kind = has(data, 'exported_at') ? 'backup' : 'batch';
    if (kind === 'batch' && !isISODate(data.batch_date)) return { fatal: 'batch_date must be a real YYYY-MM-DD date.' };
    var rows = data.leads.map(function (raw, i) {
      var r = validateLead(raw, kind);
      return { index: i, company: isObj(raw) && typeof raw.company === 'string' ? raw.company : '(no company)', lead: r.lead, errors: r.errors, warnings: r.warnings };
    });
    return { kind: kind, batch_date: data.batch_date || null, exported_at: data.exported_at || null, rows: rows };
  }

  // ---------- identity / dedupe ----------
  function companyKey(l) { return normDomain(l.domain) || 'name:' + normText(l.company); }
  function siteKey(l) { return normText(l.branch_project) + '|' + normText(l.city); }
  function dupKey(l) { return companyKey(l) + '|' + siteKey(l) + '|' + l.signal_type; }

  // Classify valid rows against the register. Returns preview rows with default actions.
  function classify(rows, register) {
    var byId = {}, byKey = {}, byCompany = {};
    register.forEach(function (l) {
      byId[l.id] = l; byKey[dupKey(l)] = l;
      (byCompany[companyKey(l)] = byCompany[companyKey(l)] || []).push(l);
    });
    var seen = {};
    return rows.filter(function (r) { return r.lead; }).map(function (r) {
      var l = r.lead, k = dupKey(l);
      var match = (l.id && byId[l.id]) || byKey[k] || null;
      var out = { index: r.index, lead: l, match: match, warnings: r.warnings.slice() };
      if (seen[k] !== undefined) {
        out.kind = 'batch_duplicate'; out.action = 'skip';
        out.reason = 'Same company, site and signal as row ' + (seen[k] + 1) + ' in this file.';
      } else if (match) {
        out.kind = 'duplicate'; out.action = 'skip';
        out.reason = l.id && byId[l.id] ? 'Same id as a saved lead.' : 'Same company, site and signal as a saved lead.';
      } else if (byCompany[companyKey(l)]) {
        out.kind = 'related'; out.action = 'add';
        out.reason = 'Same brand as ' + byCompany[companyKey(l)].length + ' saved lead(s) at another site.';
      } else {
        out.kind = 'new'; out.action = 'add';
      }
      seen[k] = r.index;
      return out;
    });
  }

  function unionBy(a, b, keyFn) {
    var seen = {}, out = [];
    a.concat(b).forEach(function (x) { var k = keyFn(x); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }
  var evidenceKey = function (e) { return e.url.trim().replace(/\/+$/, '').toLowerCase(); };
  var contactKey = function (c) { return c.type + ':' + c.value.trim().toLowerCase(); };

  function mergeContactList(existing, incoming) { return unionBy(existing || [], incoming || [], contactKey); }

  // Merge incoming research into an existing lead. Sales fields kept unless replaceSales.
  function mergeLead(existing, incoming, replaceSales) {
    var m = JSON.parse(JSON.stringify(existing));
    RESEARCH_FIELDS.forEach(function (k) {
      var v = incoming[k];
      if (k === 'evidence') m.evidence = unionBy(existing.evidence || [], v || [], evidenceKey);
      else if (k === 'contacts') m.contacts = unionBy(existing.contacts || [], v || [], contactKey);
      else if (k === 'services') m.services = unionBy(existing.services || [], v || [], String);
      else if (v === null || v === '' || (Array.isArray(v) && !v.length)) { /* never overwrite with empty */ }
      else m[k] = JSON.parse(JSON.stringify(v));
    });
    if (replaceSales) SALES_FIELDS.forEach(function (k) { m[k] = incoming[k]; });
    m.id = existing.id;
    return m;
  }

  function describe(v) {
    if (v == null || v === '') return '\u2014';
    if (Array.isArray(v)) return v.length + ' item(s)';
    if (isObj(v)) return Object.keys(v).map(function (k) { return k + ' ' + v[k]; }).join(', ');
    return String(v);
  }

  function diffLead(before, after) {
    return LEAD_FIELDS.filter(function (k) { return JSON.stringify(before[k]) !== JSON.stringify(after[k]); })
      .map(function (k) { return { field: k, from: describe(before[k]), to: describe(after[k]) }; });
  }

  // Apply confirmed preview. Returns { leads, changed } \u2014 changed = leads to write.
  // action: skip | add | separate | merge. kind 'backup' keeps incoming ids when free.
  function applyImport(register, preview, kind, newId) {
    var leads = register.slice(), idx = {}, changed = [];
    leads.forEach(function (l, i) { idx[l.id] = i; });
    preview.forEach(function (p) {
      if (p.action === 'skip') return;
      if (p.action === 'merge' && p.match && idx[p.match.id] !== undefined) {
        var m = mergeLead(leads[idx[p.match.id]], p.lead, !!p.replaceSales);
        leads[idx[p.match.id]] = m; changed.push(m); return;
      }
      var l = JSON.parse(JSON.stringify(p.lead));
      if (!(kind === 'backup' && l.id && idx[l.id] === undefined)) l.id = newId();
      idx[l.id] = leads.length; leads.push(l); changed.push(l);
    });
    return { leads: leads, changed: changed };
  }

  // ---------- filtering ----------
  function filterLeads(leads, f, today) {
    var q = normText(f.q || '');
    return leads.filter(function (l) {
      if (f.segment && l.segment !== f.segment) return false;
      if (f.city && normText(l.city) !== normText(f.city)) return false;
      if (f.service && (l.services || []).indexOf(f.service) < 0) return false;
      if (f.status && l.status !== f.status) return false;
      if (f.minScore && scoreTotal(l.score) < +f.minScore) return false;
      if (f.due && !isFollowUpDue(l, today)) return false;
      if (q) {
        var hay = normText([l.company, l.domain, l.branch_project, l.city, l.state, l.opportunity, l.notes, l.owner, l.studio_reference].join(' '));
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function summarize(leads, today) {
    return {
      total: leads.length,
      fresh: leads.filter(function (l) { return l.status === 'New'; }).length,
      qualified: leads.filter(function (l) { return l.status === 'Qualified'; }).length,
      due: leads.filter(function (l) { return isFollowUpDue(l, today); }).length
    };
  }

  // ---------- exports ----------
  function pickLead(l) {
    var o = {}; LEAD_FIELDS.forEach(function (k) { o[k] = l[k] === undefined ? null : l[k]; }); return o;
  }

  function backupJson(leads, now) {
    return JSON.stringify({ schema_version: SCHEMA_VERSION, exported_at: (now || new Date()).toISOString(), leads: leads.map(pickLead) }, null, 2);
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (typeof v === 'string' && /^(?:[\s\x00-\x1f]*[=+\-@]|[\x00-\x1f])/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  var CSV_COLUMNS = [
    ['ID', function (l) { return l.id; }],
    ['Company', function (l) { return l.company; }],
    ['Domain', function (l) { return l.domain; }],
    ['Branch / project', function (l) { return l.branch_project; }],
    ['Segment', function (l) { return l.segment; }],
    ['City', function (l) { return l.city; }],
    ['State', function (l) { return l.state; }],
    ['Website', function (l) { return l.website; }],
    ['Signal', function (l) { return l.signal_type; }],
    ['Opportunity (inferred)', function (l) { return l.opportunity; }],
    ['Services', function (l) { return (l.services || []).join('; '); }],
    ['Publication date', function (l) { return l.publication_date; }],
    ['Event date', function (l) { return l.event_date; }],
    ['Researched on', function (l) { return l.researched_on; }],
    ['Evidence', function (l) { return (l.evidence || []).map(function (e) { return (e.title ? e.title + ' \u2014 ' : '') + e.url + ' \u2014 ' + e.summary; }).join('\n'); }],
    ['Contacts (published, not verified unless stated)', function (l) { return (l.contacts || []).map(function (c) { return c.type + ': ' + c.value + (c.role ? ' (' + c.role + ')' : '') + ' [' + c.verification + '] source ' + c.source_url; }).join('\n'); }],
    ['Buyer role to seek', function (l) { return l.buyer_role; }],
    ['Service fit', function (l) { return l.score.service_fit; }],
    ['Project evidence', function (l) { return l.score.project_evidence; }],
    ['Timing', function (l) { return l.score.timing; }],
    ['Contactability', function (l) { return l.score.contactability; }],
    ['Score /10', function (l) { return scoreTotal(l.score); }],
    ['Confidence', function (l) { return l.confidence; }],
    ['Contact evidence', function (l) { return JSON.stringify(l.contacts || []); }],
    ['Next action', function (l) { return l.next_action; }],
    ['Owner', function (l) { return l.owner; }],
    ['Status', function (l) { return l.status; }],
    ['Follow-up date', function (l) { return l.follow_up_date; }],
    ['Notes', function (l) { return l.notes; }],
    ['Studio reference', function (l) { return l.studio_reference; }]
  ];

  function toCsv(leads) {
    var lines = [CSV_COLUMNS.map(function (c) { return csvCell(c[0]); }).join(',')];
    leads.forEach(function (l) { lines.push(CSV_COLUMNS.map(function (c) { return csvCell(c[1](l)); }).join(',')); });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION, MAX_BYTES: MAX_BYTES, STALE_DAYS: STALE_DAYS,
    SEGMENTS: SEGMENTS, SIGNALS: SIGNALS, CONFIDENCE: CONFIDENCE, SERVICES: SERVICES, STATUSES: STATUSES,
    SCORE_RANGES: SCORE_RANGES, LEAD_FIELDS: LEAD_FIELDS, SALES_FIELDS: SALES_FIELDS,
    isISODate: isISODate, isHttpUrl: isHttpUrl, normDomain: normDomain, normText: normText,
    todayInKolkata: todayInKolkata, formatDate: formatDate, daysBetween: daysBetween,
    scoreTotal: scoreTotal, isFollowUpDue: isFollowUpDue, isStale: isStale,
    validateLead: validateLead, parseEnvelope: parseEnvelope,
    mergeContactList: mergeContactList, dupKey: dupKey, classify: classify, mergeLead: mergeLead, diffLead: diffLead, applyImport: applyImport,
    filterLeads: filterLeads, summarize: summarize, pickLead: pickLead, backupJson: backupJson,
    csvCell: csvCell, toCsv: toCsv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KiratCore = api;
})(this);
