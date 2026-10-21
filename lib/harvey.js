'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {atomicWrite} = require('./research');
const root = path.resolve(__dirname, '..');
const checkout = path.join(root, '.local/harvey');
const pin = '0041b6a3a9930426fb8f9beba64eb62438c96711';
const python = path.join(root, '.local/venv/bin/python');
function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {cwd:root, encoding:'utf8', timeout:600000, ...options});
  if (r.error || r.status !== 0) throw new Error(r.error?.message || `${cmd} failed (${r.status}):\n${r.stderr || r.stdout || ''}`);
  return r.stdout;
}
function setup(runtime = 'python3.12') {
  fs.mkdirSync(path.dirname(checkout), {recursive:true});
  if (!fs.existsSync(checkout)) run('git', ['clone','https://github.com/ethanplusai/harvey.git',checkout], {stdio:'inherit'});
  const actual = run('git',['-C',checkout,'rev-parse','HEAD']).trim();
  if (actual !== pin) {
    if (run('git',['-C',checkout,'status','--porcelain']).trim()) throw new Error('Harvey checkout has changes; preserve them before selecting the pinned version.');
    run('git',['-C',checkout,'checkout','--detach',pin], {stdio:'inherit'});
  }
  run(runtime,['-c','import sys; assert sys.version_info >= (3,11), "Python 3.11+ required"']);
  if (!fs.existsSync(python)) run(runtime,['-m','venv',path.dirname(path.dirname(python))], {stdio:'inherit'});
  run(python,['-m','pip','install',checkout], {stdio:'inherit'});
  run(python,['-m','pip','install','-r',path.join(root,'requirements-local.txt')], {stdio:'inherit'});
  // Repo-centric runtime imports the exact checkout, not the installed package's data directory.
  const config = path.join(checkout,'harvey.local.yaml');
  if (!fs.existsSync(config)) run(python, ['-c', `import yaml, pathlib
p=pathlib.Path(${JSON.stringify(checkout)})
c=yaml.safe_load((p/'harvey.yaml').read_text())
c['persona'].update(company='Kirat Creations', name='Kirat Research', email='', linkedin='')
c['product'].update(name='Kirat signage and displays', description='Signage, graphics, retail displays and installation for Indian retail businesses.', pricing='Quoted per project', key_benefits=['Retail signage and installation'])
c['icp'].update(industries=['retail'], geography=['New Delhi, India'], company_size='Local businesses and retail chains', titles=['Projects Manager','Retail Expansion Manager'], geo_coordinates={'New Delhi, India':'28.6139,77.2090,15'})
c['channels']['email']['enabled']=False
c['channels']['linkedin']['enabled']=False
c['usage']['quiet_hours']['timezone']='Asia/Kolkata'
(p/'harvey.local.yaml').write_text(yaml.safe_dump(c))`]);
  console.log('Harvey installed at pinned commit '+pin+'. Email and LinkedIn disabled.');
}
function discover(city = 'New Delhi, India', limit = 5, exportOnly = false) {
  if (!fs.existsSync(python)) throw new Error('Run node bin/kirat.js harvey-setup first.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Candidate limit must be 1–25.');
  const output = run(python,[path.join(root,'scripts/harvey-bridge.py'),checkout,exportOnly?'export':'discover',city,String(limit)], {cwd:checkout});
  const line = output.split('\n').find(l => l.startsWith('KIRAT_CANDIDATES_JSON='));
  if (!line) throw new Error('Harvey did not return candidates; prior output was retained.');
  const candidates = JSON.parse(line.slice('KIRAT_CANDIDATES_JSON='.length));
  const target = path.join(root,'.local/candidates.json');
  atomicWrite(target,JSON.stringify({source:'Harvey',commit:pin,candidates},null,2));
  console.log(output.split('\n').filter(l => !l.startsWith('KIRAT_CANDIDATES_JSON=')).join('\n'));
  console.log(`${candidates.length} unqualified candidates saved to ${target}`);
}
module.exports = {setup,discover,pin};
