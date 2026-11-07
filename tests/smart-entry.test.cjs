const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../Core.js');
const defaults = { today: '2026-11-06', assignees: ['Martin Novak', 'Alex Morgan', 'Alex Chen', 'Žofie Černá', '李 小龍'] };
const parse = (text, options = {}) => C.parseQuickEntry(text, { ...defaults, ...options });

test('smart entry resolves metadata with original UTF-16 offsets and readable chips', () => {
  const text = '🚀 Ship @martin 5d !HIGH';
  const result = parse(text);
  assert.equal(result.summary, '🚀 Ship');
  assert.deepEqual(result.updates, { assignee: 'Martin Novak', priority: 'High', startDate: '2026-11-06', dueDate: '2026-11-12' });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.tokens.map(t => [t.kind, t.value]), [['assignee', 'Martin Novak'], ['duration', 5], ['priority', 'High']]);
  for (const token of result.tokens) {
    assert.equal(text.slice(token.start, token.end), token.raw);
  }
  assert.equal(result.tokens[0].start, 8);
});

test('weekdays are inclusive, weekend starts advance, and weeks mean five workdays', () => {
  for (const [startDate, duration, start, due] of [
    ['2026-11-06', '1d', '2026-11-06', '2026-11-06'],
    ['2026-11-06', '2d', '2026-11-06', '2026-11-09'],
    ['2026-11-06', '5d', '2026-11-06', '2026-11-12'],
    ['2026-11-07', '5d', '2026-11-09', '2026-11-13'],
    ['2026-11-08', '1d', '2026-11-09', '2026-11-09'],
    ['2026-11-09', '2w', '2026-11-09', '2026-11-20'],
    ['2026-11-06', '2w', '2026-11-06', '2026-11-19'],
    ['2024-02-28', '3d', '2024-02-28', '2024-03-01'],
    ['2026-03-27', '2d', '2026-03-27', '2026-03-30'],
    ['2026-10-23', '2d', '2026-10-23', '2026-10-26'],
    ['2026-12-31', '2d', '2026-12-31', '2027-01-01']
  ]) {
    const result = parse('Plan ' + duration, { startDate });
    assert.deepEqual(result.errors, [], startDate + ' ' + duration);
    assert.deepEqual(result.updates, { startDate: start, dueDate: due });
  }
  assert.equal(parse('Plan 1d', { startDate: 'not a date' }).updates.startDate, defaults.today);
});

test('constant-time workday arithmetic agrees with a simple weekday oracle', () => {
  for (let offset = 0; offset < 14; offset++) {
    const startDate = C.addDays('2026-10-23', offset);
    for (const count of [1, 2, 4, 5, 6, 10, 11, 99, 1000]) {
      let current = new Date(startDate + 'T00:00:00Z');
      const weekend = () => current.getUTCDay() === 0 || current.getUTCDay() === 6;
      while (weekend()) current.setUTCDate(current.getUTCDate() + 1);
      const expectedStart = current.toISOString().slice(0, 10);
      for (let n = 1; n < count; n++) {
        do { current.setUTCDate(current.getUTCDate() + 1); } while (weekend());
      }
      const result = parse('Plan ' + count + 'd', { startDate });
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.updates, { startDate: expectedStart, dueDate: current.toISOString().slice(0, 10) });
    }
  }
});

test('explicit deadlines are calendar dates and never advance a weekend start', () => {
  for (const [token, dueDate] of [['due:today', '2026-11-07'], ['due:tomorrow', '2026-11-08'], ['due:2024-02-29', '2024-02-29']]) {
    const result = parse('Plan ' + token, { today: '2026-11-07', startDate: '2026-11-07' });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.updates, { dueDate });
  }
  assert.equal(parse('Plan due:tomorrow', { today: '2026-12-31' }).updates.dueDate, '2027-01-01');
  assert.deepEqual(parse('Plan 5d due:2026-11-12').errors, []);
  assert.match(parse('Plan 5d due:2026-11-13').errors.join(' '), /conflict/i);
});

test('known full names, unique first words and Unicode quotes resolve without changing canonical spelling', () => {
  for (const [token, name] of [['@MARTIN', 'Martin Novak'], ['@"martin novak"', 'Martin Novak'], ['@“ŽOFIE ČERNÁ”', 'Žofie Černá'], ['@‘李 小龍’', '李 小龍'], ["@'Alex Chen'", 'Alex Chen']]) {
    const result = parse('Plan ' + token);
    assert.deepEqual(result.errors, []);
    assert.equal(result.updates.assignee, name);
    assert.equal(result.summary, 'Plan');
  }
  assert.match(parse('Plan @Alex').errors.join(' '), /ambiguous/i);
  assert.deepEqual(parse('Plan @Alex', { assignees: ['Alex', 'Alex Chen'] }).updates, { assignee: 'Alex' });
  assert.equal(parse('Plan @martin', { assignees: ['Martin Novak', 'MARTIN NOVAK'] }).updates.assignee, 'Martin Novak');
});

test('unknown words, partial tokens, punctuation, emails and plain relative words remain literal', () => {
  for (const text of [
    'Contact a@martin.test today tomorrow', 'Plan @unknown !urgent due:soon',
    'Plan 5days 2weeks due:', 'Plan x5d x!high (!high) 5d, @Martin,',
    'Plan @"Unknown Person"', 'Plan @“Unknown !high”', 'Plan due:2026-11-06,',
    'Plan @"Martin Novak"suffix', 'Plan 5d!high', 'Plan due:next-week'
  ]) {
    const result = parse(text);
    // ISO-looking but invalid dates deliberately block rather than silently changing the title.
    assert.equal(result.summary, text);
    assert.deepEqual(result.updates, {});
    assert.deepEqual(result.tokens, []);
    if (!text.includes('due:2026-11-06,')) assert.deepEqual(result.errors, []);
  }
});

test('literal escape removes one backslash and prevents interpretation, including quoted names', () => {
  const text = String.raw`Plan \@"Martin Novak" \5d \!high \due:today \0d`;
  const result = parse(text);
  assert.equal(result.summary, 'Plan @"Martin Novak" 5d !high due:today 0d');
  assert.deepEqual(result.updates, {});
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.tokens, []);
  assert.equal(parse(String.raw`Path C:\work \folder`).summary, String.raw`Path C:\work \folder`);
  const original = '🚀 Plan @“Žofie Černá” !high 5d';
  for (const token of parse(original).tokens) {
    const escaped = original.slice(0, token.start) + '\\' + original.slice(token.start);
    const result = parse(escaped);
    assert.ok(result.summary.includes(token.raw));
    assert.ok(!result.tokens.some(t => t.kind === token.kind));
  }
});

test('only whitespace around removed metadata is normalized', () => {
  assert.equal(parse('  Plan:  keep   spacing!  ').summary, 'Plan:  keep   spacing!');
  assert.equal(parse('  !high Plan:  keep   spacing!  5d  ').summary, 'Plan:  keep   spacing!');
  assert.equal(parse('Plan  !high   next:  keep!').summary, 'Plan next:  keep!');
  assert.equal(parse('Plan\t!high\tnext:  keep!').summary, 'Plan next:  keep!');
  assert.equal(parse('!high 5d @martin').summary, '');
});

test('duplicate identical values are accepted and differing values block with original title intact', () => {
  for (const text of ['Plan !high !HIGH', 'Plan 1w 5d', 'Plan @martin @"Martin Novak"', 'Plan due:today due:2026-11-06']) {
    assert.deepEqual(parse(text).errors, []);
    assert.equal(parse(text).summary, 'Plan');
  }
  for (const text of ['Plan !high !low', 'Plan 1w 6d', 'Plan @martin @"Alex Chen"', 'Plan due:today due:tomorrow', 'Plan 2d due:today']) {
    const result = parse(text);
    assert.match(result.errors.join(' '), /conflict/i);
    assert.equal(result.summary, text);
  }
});

test('invalid durations and dates never throw or discard original text', () => {
  for (const token of ['0d', '-1d', '1.5d', '.5w', '1.0d', '+2d', '1e3d', '999999999999999999999999w', '9'.repeat(400) + 'd', 'due:2026-02-29', 'due:2026-04-31', 'due:2026-1-1', 'due:1899-12-31', 'due:2201-01-01']) {
    const text = 'Plan ' + token + ' !high';
    const result = parse(text);
    assert.ok(result.errors.length, token);
    assert.equal(result.summary, text);
  }
  assert.ok(parse('Plan 2d', { startDate: '2200-12-31' }).errors.length);
  assert.ok(parse('Plan due:tomorrow', { today: '2200-12-31' }).errors.length);
  assert.ok(parse('Plan 1d', { today: 'invalid' }).errors.length);
  assert.ok(parse('Plan due:today', { today: 'invalid' }).errors.length);
  assert.deepEqual(parse('Plan 1d', { startDate: '1900-01-01' }).updates, { startDate: '1900-01-01', dueDate: '1900-01-01' });
  assert.deepEqual(parse('Plan due:2200-12-31').errors, []);
  assert.deepEqual(C.parseQuickEntry(null), { summary: '', updates: {}, tokens: [], errors: [] });
});

test('parser accepts frozen inputs and leaves calendar addDays unchanged', () => {
  const options = Object.freeze({ ...defaults, assignees: Object.freeze([...defaults.assignees]) });
  assert.deepEqual(C.parseQuickEntry('Plan 2w @martin', options).updates, { assignee: 'Martin Novak', startDate: '2026-11-06', dueDate: '2026-11-19' });
  assert.equal(C.addDays('2026-11-06', 5), '2026-11-11');
  assert.deepEqual(parse('Plan !highest !highest').updates, { priority: 'Highest' });
  for (const priority of C.priorities) assert.equal(parse('Plan !' + priority.toLowerCase()).updates.priority, priority);
  for (const text of ['Plan', 'Plan @martin !low 2w', 'Plan due:today']) {
    assert.ok(Object.keys(parse(text).updates).every(key => ['assignee', 'priority', 'startDate', 'dueDate'].includes(key)));
  }
});
