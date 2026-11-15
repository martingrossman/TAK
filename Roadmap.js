/**
 * Product roadmap storage. Uses one optional "Roadmap" tab that is created on the first roadmap save.
 * It never reads or writes the task tabs, and it is not part of the task schema readiness check.
 */
var TAK_ROADMAP_TAB_ = 'Roadmap';
var TAK_ROADMAP_HEADERS_ = ['ID', 'Type', 'Stream ID', 'Title', 'Start Date', 'End Date', 'Color', 'Notes', 'Order', 'Revision', 'Updated At'];

function roadmapSheet_(book, create) {
  var sheet = book.getSheetByName(TAK_ROADMAP_TAB_);
  if (!sheet) {
    if (!create) return null;
    sheet = book.insertSheet(TAK_ROADMAP_TAB_);
    sheet.getRange(1, 1, 1, TAK_ROADMAP_HEADERS_.length).setValues([TAK_ROADMAP_HEADERS_]).setFontWeight('bold');
    sheet.getRange(1, 1, sheet.getMaxRows(), TAK_ROADMAP_HEADERS_.length).setNumberFormat('@');
    sheet.setFrozenRows(1);
    return sheet;
  }
  var headers = sheet.getRange(1, 1, 1, TAK_ROADMAP_HEADERS_.length).getValues()[0];
  if (headers.join('|') !== TAK_ROADMAP_HEADERS_.join('|')) throw new Error('The Roadmap tab has different column headers. Restore them as ' + TAK_ROADMAP_HEADERS_.join(', ') + ', or rename that tab.');
  return sheet;
}

function roadmapText_(value, book) {
  if (value instanceof Date) return Utilities.formatDate(value, book.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(value == null ? '' : value).trim();
}

function readRoadmap_(book) {
  var sheet = roadmapSheet_(book, false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, TAK_ROADMAP_HEADERS_.length).getValues();
  var items = [];
  rows.forEach(function (row, index) {
    var id = roadmapText_(row[0], book);
    if (!id) return;
    items.push({
      id: id, type: roadmapText_(row[1], book), streamId: roadmapText_(row[2], book), title: roadmapText_(row[3], book),
      startDate: roadmapText_(row[4], book), endDate: roadmapText_(row[5], book), color: roadmapText_(row[6], book),
      notes: roadmapText_(row[7], book), order: Number(row[8]) || 0, version: String(Number(row[9]) || 0), _row: index + 2
    });
  });
  return items;
}

function clientRoadmapItem_(item) {
  return browserValue_({ id: item.id, type: item.type, streamId: item.streamId, title: item.title, startDate: item.startDate, endDate: item.endDate, color: item.color, notes: item.notes, order: item.order, version: item.version });
}

function getRoadmap() {
  return withLock_(function () {
    authorizationService_().require('read');
    var book = getBook_();
    return browserValue_({ items: readRoadmap_(book).map(clientRoadmapItem_) });
  });
}

function nextRoadmapId_(items) {
  var highest = 0;
  items.forEach(function (item) { var match = /^RM-(\d+)$/.exec(item.id); if (match) highest = Math.max(highest, Number(match[1])); });
  return 'RM-' + (highest + 1);
}

function saveRoadmapItem(input, expectedVersion) {
  return withLock_(function () {
    authorizationService_().require('write');
    if (!input || typeof input !== 'object') throw new Error('Nothing to save.');
    var book = getBook_(), sheet = roadmapSheet_(book, true), items = readRoadmap_(book);
    var current = input.id ? items.filter(function (item) { return item.id === input.id; })[0] : null;
    if (input.id && !current) throw new Error('This roadmap item no longer exists. Refresh the roadmap.');
    if (current && String(expectedVersion) !== current.version) throw new Error('This roadmap item changed elsewhere. Refresh, then apply your change again.');
    if (current && input.type && input.type !== current.type) throw new Error('A roadmap item cannot change its type. Create a new item instead.');
    var item = TrackerCore.prepareRoadmapItem(input, current);
    if (!current) {
      item.id = nextRoadmapId_(items);
      if (item.type === 'Stream' && !(Number(input.order) > 0)) item.order = items.filter(function (other) { return other.type === 'Stream'; }).reduce(function (max, other) { return Math.max(max, other.order); }, 0) + 1;
    }
    TrackerCore.validateRoadmapItem(item, items);
    var revision = current ? Number(current.version) + 1 : 1;
    var row = current ? current._row : sheet.getLastRow() + 1;
    var values = [item.id, item.type, item.streamId, item.title, item.startDate, item.endDate, item.color, item.notes, item.order, revision, new Date().toISOString()];
    var range = sheet.getRange(row, 1, 1, TAK_ROADMAP_HEADERS_.length);
    if (!current) range.setNumberFormat('@');
    range.setValues([values]);
    item.version = String(revision);
    return clientRoadmapItem_(item);
  });
}

function deleteRoadmapItem(id, expectedVersion) {
  return withLock_(function () {
    authorizationService_().require('write');
    var book = getBook_(), sheet = roadmapSheet_(book, false), items = sheet ? readRoadmap_(book) : [];
    var current = items.filter(function (item) { return item.id === id; })[0];
    if (!current) throw new Error('This roadmap item no longer exists. Refresh the roadmap.');
    if (String(expectedVersion) !== current.version) throw new Error('This roadmap item changed elsewhere. Refresh before deleting it.');
    if (current.type === 'Stream' && items.some(function (item) { return item.streamId === current.id; })) throw new Error('Move or delete this stream’s items before deleting the stream.');
    sheet.deleteRow(current._row);
    return { id: id, deleted: true };
  });
}
