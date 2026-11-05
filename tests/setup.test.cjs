const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const C = require('../Core.js');

function setupHarness({ standalone = false, data = [], frozenReturn } = {}) {
  const rows = data.length ? [C.fields.map(f => f.label), ...data] : [];
  const properties = new Map(), triggers = [], formatting = {};
  let exists = data.length > 0, maxRows = 20, maxColumns = 5, filter = null;
  let createdBooks = 0, acquired = 0, released = 0;
  let dialog = null, sidebar = null;
  let alert = null;
  const menus = [];
  function createMenu(name) {
    const menu = { name, items: [], addItem: (label, handler) => { menu.items.push({ label, handler }); return menu; }, addSeparator: () => { menu.items.push({ separator: true }); return menu; }, addSubMenu: child => { menu.items.push({ submenu: child }); return menu; }, addToUi: () => { menus.push(menu); } };
    return menu;
  }
  function builder(methods) {
    const result = { build: () => ({}) };
    methods.forEach(name => { result[name] = () => result; });
    return result;
  }
  function range(row, column, height = 1, width = 1) {
    const result = {
      getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => rows[row - 1 + r]?.[column - 1 + c] ?? '')),
      setValues: values => { values.forEach((line, r) => { rows[row - 1 + r] = [...line]; }); return result; },
      createFilter: () => { filter = { remove: () => { filter = null; } }; return filter; }
    };
    ['setBackground', 'setFontColor', 'setFontWeight', 'setWrap', 'setFontFamily', 'setFontSize', 'setVerticalAlignment', 'setNumberFormat', 'setDataValidation'].forEach(name => { result[name] = () => result; });
    return result;
  }
  const sheet = {
    getLastRow: () => rows.length, getRange: range, getMaxRows: () => maxRows, getMaxColumns: () => maxColumns,
    insertRowsAfter: (_, count) => { maxRows += count; return sheet; },
    insertColumnsAfter: (_, count) => { maxColumns += count; return sheet; },
    // These Google Sheet methods return void, not the Sheet. Match the reported null return too.
    setFrozenRows: count => { formatting.frozenRows = count; return frozenReturn; },
    setFrozenColumns: count => { formatting.frozenColumns = count; return frozenReturn; },
    setRowHeight: (row, height) => { formatting.rowHeight = [row, height]; return sheet; },
    setColumnWidth: () => sheet, getFilter: () => filter,
    setConditionalFormatRules: rules => { formatting.rules = rules.length; }
  };
  const book = {
    getId: () => 'tracker-book', getUrl: () => 'https://docs.google.com/spreadsheets/d/tracker-book/edit',
    getSheetByName: () => exists ? sheet : null,
    insertSheet: name => { assert.equal(name, 'Issues'); exists = true; return sheet; }
  };
  const context = vm.createContext({ console: { log() {} }, TrackerCore: C,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => standalone ? null : book,
      getUi: () => ({ createMenu, showModalDialog: (output, title) => { dialog = { output, title }; }, showSidebar: output => { sidebar = output; }, alert: message => { alert = message; } }),
      openById: id => { assert.equal(id, book.getId()); return book; },
      create: () => { createdBooks++; return book; },
      newDataValidation: () => builder(['requireDate', 'setAllowInvalid', 'requireNumberGreaterThanOrEqualTo', 'requireValueInList', 'requireNumberBetween']),
      newConditionalFormatRule: () => builder(['whenTextEqualTo', 'setBackground', 'setRanges', 'whenFormulaSatisfied', 'setFontColor'])
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => { properties.set(key, value); } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => acquired++, releaseLock: () => released++ }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger: handler => ({ forSpreadsheet: target => { assert.equal(target, book); return { onEdit: () => ({ create: () => { triggers.push({ getHandlerFunction: () => handler, getTriggerSourceId: () => book.getId() }); } }) }; } })
    },
    HtmlService: { createHtmlOutputFromFile: name => { assert.equal(name, 'Help'); return { setTitle: title => ({ title }) }; }, createTemplateFromFile: name => {
      assert.equal(name, 'Index');
      const output = { setTitle: () => output, addMetaTag: () => output, setWidth: width => { output.width = width; return output; }, setHeight: height => { output.height = height; return output; } };
      const template = { initialView: '', evaluate: () => { output.initialView = template.initialView; return output; } };
      return template;
    } }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../Code.js'), 'utf8'), context);
  return { api: context, properties, rows, triggers, formatting, menus, createdBooks: () => createdBooks, dialog: () => dialog, sidebar: () => sidebar, alert: () => alert, balanced: () => acquired === released };
}

test('TAK menu keeps everyday actions prominent and moves setup into Help', () => {
  const h = setupHarness();
  h.api.onOpen();
  assert.equal(h.menus.length, 1);
  assert.equal(h.menus[0].name, '🔷 TAK');
  assert.deepEqual(h.menus[0].items.slice(0, 2).map(item => item.label), ['Open tracker', 'Quick add work item']);
  assert.deepEqual(h.menus[0].items.slice(2).map(item => item.label || 'separator'), ['separator', 'Help & setup']);
  h.api.openHelpSetup();
  assert.equal(h.sidebar().title, 'TAK — Help & setup');
});

test('Help status reads a fresh copy and its completed setup without writes', () => {
  const h = setupHarness();
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.getTrackerSetupStatus())), { state: 'not-set-up', message: 'This copy is ready to be set up.', canRepair: true });
  assert.equal(h.rows.length, 0); assert.equal(h.triggers.length, 0); assert.equal(h.properties.size, 0);
  h.api.setupTracker();
  const beforeRows = JSON.stringify(h.rows), beforeProps = [...h.properties], beforeTriggers = h.triggers.length;
  assert.equal(h.api.getTrackerSetupStatus().state, 'ready');
  assert.equal(JSON.stringify(h.rows), beforeRows); assert.deepEqual([...h.properties], beforeProps); assert.equal(h.triggers.length, beforeTriggers);
});

test('Help status blocks the wrong workbook and bad headers before repair', () => {
  const wrong = setupHarness(); wrong.properties.set('SPREADSHEET_ID', 'original-book');
  assert.deepEqual(JSON.parse(JSON.stringify(wrong.api.getTrackerSetupStatus())), { state: 'wrong-workbook', message: 'This copy points to another tracker. Start from the TAK starter template instead.', canRepair: false });
  assert.equal(wrong.rows.length, 0); assert.equal(wrong.triggers.length, 0);
  const bad = setupHarness({ data: [C.fields.map(() => '')] }); bad.properties.set('SPREADSHEET_ID', 'tracker-book'); bad.rows[0][0] = 'Wrong ID';
  assert.equal(bad.api.getTrackerSetupStatus().state, 'needs-review');
  assert.equal(bad.api.getTrackerSetupStatus().canRepair, false);
});

test('Help status reports missing setup pieces and respects configure permission', () => {
  const h = setupHarness(); h.properties.set('SPREADSHEET_ID', 'tracker-book');
  assert.equal(h.api.getTrackerSetupStatus().state, 'needs-repair');
  h.api.SheetFlowAuth = { require: capability => { if (capability === 'configure') throw new Error('viewer'); } };
  assert.equal(h.api.getTrackerSetupStatus().canRepair, false);
});

test('Help status asks for review when a support tab has unexpected headers', () => {
  const h = setupHarness(); h.api.setupTracker();
  h.api.SheetFlowSchema = { report: () => ({ ready: false, tabs: { Tasks: { headersMatch: false } } }) };
  assert.equal(h.api.getTrackerSetupStatus().state, 'needs-review');
  assert.equal(h.api.getTrackerSetupStatus().canRepair, false);
});

test('Help sidebar checks status without repair and requires an in-panel confirmation', () => {
  const html = fs.readFileSync(require.resolve('../Help.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const ids = ['status', 'check', 'repair', 'confirmation', 'cancel', 'confirm-repair'];
  const elements = Object.fromEntries(ids.map(id => [id, { hidden: false, disabled: false, textContent: '', classList: { toggle() {} }, listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; }, focus() {} }]));
  let statusCalls = 0, repairCalls = 0;
  const google = { script: { run: { withSuccessHandler(success) { return { withFailureHandler() { return {
    getTrackerSetupStatus() { statusCalls++; success({ state: 'ready', message: 'Connected', canRepair: true }); },
    setupTracker() { repairCalls++; success({ message: 'Ready' }); }
  }; } }; } } } };
  vm.runInNewContext(script, { document: { getElementById: id => elements[id] }, google });
  assert.equal(statusCalls, 1); assert.equal(repairCalls, 0);
  elements.repair.listeners.click(); assert.equal(repairCalls, 0); assert.equal(elements.confirmation.hidden, false);
  elements.cancel.listeners.click(); assert.equal(repairCalls, 0); assert.equal(elements.confirmation.hidden, true);
  elements.repair.listeners.click(); elements['confirm-repair'].listeners.click();
  assert.equal(repairCalls, 1); assert.equal(statusCalls, 2);
});

for (const frozenReturn of [null, undefined]) {
  test(`setup completes when frozen pane setters return ${String(frozenReturn)}`, () => {
    const h = setupHarness({ frozenReturn });
    const result = h.api.setupTracker();
    assert.equal(result.spreadsheetUrl, 'https://docs.google.com/spreadsheets/d/tracker-book/edit');
    assert.deepEqual(h.rows[0], C.fields.map(f => f.label));
    assert.deepEqual(h.formatting, { frozenRows: 1, frozenColumns: 1, rowHeight: [1, 40], rules: 6 });
    assert.equal(h.properties.get('EDIT_TRIGGER_INSTALLED'), 'true');
    assert.ok(h.balanced());
  });
}
test('re-running standalone setup reuses the spreadsheet and edit trigger', () => {
  const h = setupHarness({ standalone: true });
  h.api.setupTracker(); h.api.setupTracker();
  assert.equal(h.createdBooks(), 1); assert.equal(h.triggers.length, 1); assert.ok(h.balanced());
});
test('setup repairs formatting without modifying existing issue rows', () => {
  const issue = C.sample('2026-10-27')[0];
  const row = C.fields.map(f => issue[f.key]);
  const h = setupHarness({ data: [row] });
  h.api.setupTracker();
  assert.deepEqual(h.rows[1], row); assert.equal(h.rows.length, 2); assert.ok(h.balanced());
});
test('setup in a copied spreadsheet refuses a stored ID for another workbook', () => {
  const h = setupHarness();
  h.properties.set('SPREADSHEET_ID', 'original-book');
  assert.throws(() => h.api.setupTracker(), /still linked to another tracker/);
  assert.equal(h.properties.get('SPREADSHEET_ID'), 'original-book');
  assert.equal(h.rows.length, 0);
  assert.equal(h.triggers.length, 0);
  assert.ok(h.balanced());
});
test('Open tracker initializes a fresh bound copy and opens the three-view dialog', () => {
  const h = setupHarness();
  h.api.openTracker();
  assert.equal(h.properties.get('SPREADSHEET_ID'), 'tracker-book');
  assert.equal(h.triggers.length, 1);
  assert.equal(h.dialog().title, 'TAK — Project tracker');
  assert.equal(h.dialog().output.width, 1100);
  assert.equal(h.dialog().output.height, 720);
  assert.equal(h.dialog().output.initialView, 'kanban');
  assert.ok(h.balanced());
});
test('Open tracker refuses to open a copied workbook linked to the original', () => {
  const h = setupHarness();
  h.properties.set('SPREADSHEET_ID', 'original-book');
  h.api.openTracker();
  assert.match(h.alert(), /linked to another tracker/);
  assert.equal(h.dialog(), null);
  assert.equal(h.rows.length, 0);
});
