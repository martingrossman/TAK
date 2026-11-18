/** Optional append-only mutation history and persistent idempotency receipts. */
var SheetFlowHistory = (function () {
  'use strict';
  var receiptPrefix = 'IDEMPOTENCY:';
  var reservationPrefix = 'IDEMPOTENCY_PENDING:';
  var updateReservationPrefix = 'IDEMPOTENCY_UPDATE_PENDING:';
  function prepareRecord(book, event) {
    if (typeof trackerMode_ === 'function' && trackerMode_() === 'personal') return null;
    var sheet = book.getSheetByName('Change History');
    if (!sheet) return null;
    var row = [
      event.eventId || Utilities.getUuid(), event.operationId || Utilities.getUuid(),
      event.entityKind || 'Task', event.entityId || '', event.eventKind || 'updated',
      event.actorId || actorId_(), new Date(event.timestamp || Date.now()),
      event.beforeRevision || '', event.afterRevision || '',
      JSON.stringify(event.changedFields || []), JSON.stringify(event.details || {})
    ];
    return { range: sheet.getRange(Math.max(2, sheet.getLastRow() + 1), 1, 1, row.length), values: [row], eventId: row[0] };
  }
  function prepareReceipt(book, operationId, result, systemRows) {
    if (!operationId) return;
    var sheet = book.getSheetByName('_System');
    if (!sheet) return;
    var key = receiptPrefix + operationId;
    var lastRow = sheet.getLastRow();
    var rows = systemRows || (lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : []);
    var value = JSON.stringify({ savedAt: new Date().toISOString(), result: result });
    var index = rows.findIndex(function (row) { return String(row[0]) === key; });
    return index >= 0
      ? { range: sheet.getRange(index + 2, 2), values: [[value]] }
      : { range: sheet.getRange(Math.max(2, lastRow + 1), 1, 1, 3), values: [[key, value, new Date()]] };
  }
  function writePrepared(entry) { if (entry) entry.range.setValues(entry.values); }
  function record(book, event) {
    var entry = prepareRecord(book, event); writePrepared(entry);
    return entry ? entry.eventId : null;
  }
  function receipt(book, operationId, result, systemRows) {
    writePrepared(prepareReceipt(book, operationId, result, systemRows));
  }
  /** Resolve both destinations before writing so a metadata read cannot flush the first write. Caller holds the script lock. */
  function recordAndReceipt(book, event, operationId, result, systemRows) {
    var historyEntry = prepareRecord(book, event);
    var receiptEntry = prepareReceipt(book, operationId, result, systemRows);
    writePrepared(historyEntry);
    writePrepared(receiptEntry);
    return historyEntry ? historyEntry.eventId : null;
  }
  function ensureRecordAndReceipt(book, event, operationId, result, systemRows) {
    var sheet = book.getSheetByName('Change History');
    var alreadyRecorded = false;
    if (sheet && sheet.getLastRow() > 1) {
      var operations = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
      alreadyRecorded = operations.some(function (row) { return String(row[0]) === String(operationId); });
    }
    if (alreadyRecorded) return receipt(book, operationId, result, systemRows);
    return recordAndReceipt(book, event, operationId, result, systemRows);
  }
  function findReceipt(book, operationId, systemRows) {
    if (!operationId) return null;
    var sheet = book.getSheetByName('_System');
    if (!sheet || sheet.getLastRow() < 2) return null;
    var key = receiptPrefix + operationId;
    var rows = systemRows || sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === key) {
      try { return JSON.parse(rows[i][1]); } catch (ignore) { return null; }
    }
    return null;
  }
  function findCreateReservation(book, operationId, systemRows) {
    if (!operationId) return null;
    var sheet = book.getSheetByName('_System');
    if (!sheet) throw new Error('Operation recovery is unavailable: _System is missing.');
    var rows = systemRows || (sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : []);
    var key = reservationPrefix + operationId;
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === key) {
      try {
        var value = JSON.parse(rows[i][1]);
        if (value && value.id && value.fingerprint && value.createdAt) return value;
      } catch (ignore) {}
      throw new Error('Operation recovery record is unreadable. Do not retry this create until the project is reviewed.');
    }
    return null;
  }
  function reserveCreate(book, operationId, reservation, systemRows) {
    if (!operationId) return null;
    var existing = findCreateReservation(book, operationId, systemRows);
    if (existing) return existing;
    var sheet = book.getSheetByName('_System');
    sheet.getRange(Math.max(2, sheet.getLastRow() + 1), 1, 1, 3)
      .setValues([[reservationPrefix + operationId, JSON.stringify(reservation), new Date()]]);
    return reservation;
  }
  function findUpdateReservation(book, operationId, systemRows) {
    if (!operationId) return null;
    var sheet = book.getSheetByName('_System');
    if (!sheet) throw new Error('Operation recovery is unavailable: _System is missing.');
    var rows = systemRows || (sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : []);
    var key = updateReservationPrefix + operationId;
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === key) {
      try {
        var value = JSON.parse(rows[i][1]);
        if (value && value.id && value.fingerprint && value.stateFingerprint && value.updatedAt) return value;
      } catch (ignore) {}
      throw new Error('Operation recovery record is unreadable. Do not retry this update until the project is reviewed.');
    }
    return null;
  }
  function reserveUpdate(book, operationId, reservation, systemRows) {
    if (!operationId) return null;
    var existing = findUpdateReservation(book, operationId, systemRows);
    if (existing) return existing;
    var sheet = book.getSheetByName('_System');
    sheet.getRange(Math.max(2, sheet.getLastRow() + 1), 1, 1, 3)
      .setValues([[updateReservationPrefix + operationId, JSON.stringify(reservation), new Date()]]);
    return reservation;
  }
  function list(book, entityId, limit, offset) {
    var sheet = book.getSheetByName('Change History');
    if (!sheet || sheet.getLastRow() < 2) return { items: [], nextOffset: null };
    limit = Math.max(1, Math.min(Number(limit) || 50, 200)); offset = Math.max(0, Number(offset) || 0);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues().filter(function (row) { return !entityId || String(row[3]) === String(entityId); });
    rows.reverse();
    var items = rows.slice(offset, offset + limit).map(function (row) { return { eventId: row[0], operationId: row[1], entityKind: row[2], entityId: row[3], eventKind: row[4], actorId: row[5], timestamp: row[6], beforeRevision: row[7], afterRevision: row[8], changedFields: row[9], details: row[10] }; });
    return { items: items, nextOffset: offset + items.length < rows.length ? offset + items.length : null };
  }
  function actorId_() { try { return Session.getActiveUser().getEmail() || 'unknown'; } catch (ignore) { return 'unknown'; } }
  return { record: record, receipt: receipt, recordAndReceipt: recordAndReceipt, ensureRecordAndReceipt: ensureRecordAndReceipt, findReceipt: findReceipt, findCreateReservation: findCreateReservation, reserveCreate: reserveCreate, findUpdateReservation: findUpdateReservation, reserveUpdate: reserveUpdate, list: list };
})();

function getTaskHistory(entityId, limit, offset) {
  if (typeof SheetFlowAuth !== 'undefined') SheetFlowAuth.require('read');
  return browserValue_(SheetFlowHistory.list(getBook_(), entityId, limit, offset));
}
