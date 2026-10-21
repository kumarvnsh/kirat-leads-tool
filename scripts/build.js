'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assets = ['lead-core.js', 'browser-store.js'];
function build() {
  const dir = path.join(root, 'dist');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  fs.copyFileSync(path.join(root, 'kirat-lead-desk.html'), path.join(dir, 'index.html'));
  for (const file of assets) fs.copyFileSync(path.join(root, file), path.join(dir, file));
  fs.mkdirSync(path.join(dir,'assets'));
  for(const file of ['kirat-logo.svg','kirat-icon.png']) fs.copyFileSync(path.join(root,'assets',file),path.join(dir,'assets',file));
  fs.cpSync(path.join(root,'assets/vendor'),path.join(dir,'assets/vendor'),{recursive:true});
  fs.writeFileSync(path.join(dir, '.nojekyll'), '');
  return dir;
}
if (require.main === module) console.log('Built static application: ' + build());
module.exports = { build };
