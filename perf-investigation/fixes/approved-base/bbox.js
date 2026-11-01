const L = require('./lib');
(async () => {
  const [a, b] = process.argv.slice(2);
  console.log(a, b, JSON.stringify(await L.diff(a, b)));
})();
