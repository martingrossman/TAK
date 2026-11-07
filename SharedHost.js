/** Shared host requests select a workbook explicitly; never store a global selection. */
var takSharedRequest_ = null;
function sharedHost_() { return typeof TAK_SHARED_HOST_ !== 'undefined' && TAK_SHARED_HOST_ === true; }
function sharedRequest_() {
  if (!takSharedRequest_) throw new Error('Open TAK from your copied spreadsheet. No tracker was selected.');
  return takSharedRequest_;
}
function sharedSheetId_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(value)) throw new Error('Open TAK from your copied spreadsheet to select a tracker.');
  return value;
}
function sharedActor_() {
  var email = Session.getActiveUser().getEmail();
  if (!email || email !== Session.getEffectiveUser().getEmail()) throw new Error('Sign in with the Google account that owns or can edit this copy.');
  return { id: email, email: email, role: 'editor', authenticated: true };
}
function sharedCapability_(capability) {
  var request = sharedRequest_();
  if (capability !== 'read' && capability !== 'write') throw new Error('Administration is available only in the spreadsheet’s attached script.');
  return request.actor;
}
/** Google enforces the accessing user's file/range permissions, including on writes. */
function sharedTrackerRpc(sheetId, method, args) {
  if (!sharedHost_()) throw new Error('This project is not the shared TAK app.');
  var methods = {
    getProject: getProject, saveIssue: saveIssue, createIssuesBatch: createIssuesBatch,
    updateIssuesBatch: updateIssuesBatch, deleteIssuesBatch: deleteIssuesBatch, deleteIssue: deleteIssue, moveIssue: moveIssue,
    duplicateIssue: duplicateIssue, undoDuplicateIssues: undoDuplicateIssues,
    getTaskComments: getTaskComments, addTaskComment: addTaskComment, updateTaskComment: updateTaskComment
  };
  if (!Object.prototype.hasOwnProperty.call(methods, method) || !Array.isArray(args) || args.length > 6) throw new Error('Unsupported tracker operation.');
  if (takSharedRequest_) throw new Error('A tracker request is already running.');
  sheetId = sharedSheetId_(sheetId);
  var actor = sharedActor_(), book;
  try { book = SpreadsheetApp.openById(sheetId); }
  catch (error) { throw new Error('TAK cannot access this spreadsheet. Sign in with the account that owns your copy, or ask its owner for access.'); }
  var issues = book.getSheetByName('Issues'), system = book.getSheetByName('_System');
  if (!issues || !system) throw new Error('This is not a TAK starter copy. Open a fresh copy of the starter template.');
  assertHeaders_(issues);
  var rows = system.getLastRow() > 1 ? system.getRange(2, 1, system.getLastRow() - 1, 2).getValues() : [];
  var markers = rows.filter(function (row) { return row[0] === 'TAK_SHARED_STORAGE_V1'; });
  if (markers.length !== 1 || markers[0][1] !== 'legacy') throw new Error('This tracker has not been prepared for the shared app. Use the updated starter template.');
  if (!SheetFlowSchema.report(book, rows).ready) throw new Error('This copy has missing or changed setup tabs. Restore them before opening TAK.');
  if (book.getSheetByName('Tasks').getLastRow() > 1 || book.getSheetByName('Projects and Epics').getLastRow() > 1) throw new Error('This tracker contains versioned records. Use its existing app; the shared starter app uses Issues storage.');
  takSharedRequest_ = { book: book, actor: actor };
  try { return methods[method].apply(null, args); }
  finally { takSharedRequest_ = null; }
}
/** Read fresh operational state inside the existing mutation lock. */
function sharedOperationalContext_() {
  return workbookCounterContext_(sharedRequest_().book);
}
function workbookCounterContext_(book) {
  var system = book.getSheetByName('_System');
  var rows = system.getLastRow() > 1 ? system.getRange(2, 1, system.getLastRow() - 1, 2).getValues() : [];
  var config = { SPREADSHEET_ID: book.getId(), SHEETFLOW_MODE: 'team' };
  rows.forEach(function (row) { if (row[0] === 'TAK_LAST_ISSUE_NUMBER') config.LAST_ISSUE_NUMBER = String(row[1]); });
  return { config: config, properties: {
    getProperty: function (key) { return config[key] || ''; },
    setProperty: function (key, value) {
      if (key !== 'LAST_ISSUE_NUMBER') throw new Error('Unsupported shared tracker preference.');
      var fresh = system.getLastRow() > 1 ? system.getRange(2, 1, system.getLastRow() - 1, 2).getValues() : [];
      var index = fresh.findIndex(function (row) { return row[0] === 'TAK_LAST_ISSUE_NUMBER'; });
      system.getRange(index < 0 ? system.getLastRow() + 1 : index + 2, 1, 1, 3).setValues([['TAK_LAST_ISSUE_NUMBER', String(value), new Date()]]);
      config[key] = String(value);
    }
  } };
}
function sharedLauncherUrl_() {
  var url = typeof TAK_SHARED_LAUNCH_URL_ === 'string' ? TAK_SHARED_LAUNCH_URL_ : '';
  if (!url) return '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error('The shared TAK app address is not configured correctly.');
  return url;
}
