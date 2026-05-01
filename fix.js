const fs = require('fs');
let c = fs.readFileSync('omni-fitness/js/tabs/nutrition.js', 'utf8');
c = c.replace(/\\\${/g, '${');
fs.writeFileSync('omni-fitness/js/tabs/nutrition.js', c);
