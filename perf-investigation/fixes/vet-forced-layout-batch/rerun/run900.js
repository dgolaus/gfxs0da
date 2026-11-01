const { visual } = require('./bench.js');
const v = require('../variants.json');
(async () => { for (let i = 0; i < 3; i++) { const r = await visual(v, [900, 1400]); console.log(i, JSON.stringify(r)); } })();
