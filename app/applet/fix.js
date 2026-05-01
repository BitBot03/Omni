const fs = require('fs');
let c = fs.readFileSync('/app/applet/omni-fitness/js/tabs/nutrition.js', 'utf8');
c = c.replace(/\\\${/g, '${');
fs.writeFileSync('/app/applet/omni-fitness/js/tabs/nutrition.js', c);
