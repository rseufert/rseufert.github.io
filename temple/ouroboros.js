// The ouroboros: run the poem on the page, type out what it says, and compare.
// The poem is shown from temple/ouroboros/poem.js; its text is read back from the
// page, evaluated as an expression, and the answer set beside it a few letters a frame.
(function () {
  const code = document.querySelector('#ouro-src code');
  const run = document.getElementById('ouro-run');
  const out = document.getElementById('ouro-out');
  const said = out.querySelector('code');
  const verdict = document.getElementById('ouro-verdict');
  if (!code || !run) return;
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0;

  run.addEventListener('click', function () {
    const src = code.textContent;
    let answer;
    try {
      answer = (0, eval)(src);
    } catch (e) {
      verdict.textContent = 'it would not run here: ' + e.message;
      return;
    }
    cancelAnimationFrame(frame);
    out.hidden = false;
    verdict.textContent = 'it says…';
    const done = function () {
      said.textContent = answer;
      verdict.textContent = answer === src
        ? answer.length + ' of ' + src.length + ' characters, the same, letter for letter.'
        : 'not the same: ' + answer.length + ' characters against ' + src.length + '.';
    };
    if (still) { done(); return; }
    let i = 0;
    const step = function () {
      i = Math.min(answer.length, i + 5);
      said.textContent = answer.slice(0, i);
      if (i < answer.length) frame = requestAnimationFrame(step);
      else done();
    };
    step();
  });
})();
