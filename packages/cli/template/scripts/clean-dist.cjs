#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const distPkgPath = path.join(__dirname, '..', 'dist', 'package.json');
if(!fs.existsSync(distPkgPath)) process.exit(0);
const pkg = JSON.parse(fs.readFileSync(distPkgPath,'utf8'));
['scripts','devDependencies'].forEach(k=> delete pkg[k]);
fs.writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2));
console.log('[clean-dist] pruned scripts & devDependencies');
