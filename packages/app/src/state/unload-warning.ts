/**
 * The beforeunload listener of a page that holds unsaved changes: it asks
 * the browser for its own warning before a reload or a close of the tab.
 * Add it only while there are changes, and remove it after.
 */
export function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Older browsers ask only when this is set.
  event.returnValue = true;
}
