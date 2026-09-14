// Shared helpers for matching a loan/collection/payment row back to its
// parent loan record. Different API responses use different field names for
// the same loan (id, loanId, loanCode, ...), so every "does this row belong
// to that loan" check needs to compare across all of them.
//
// Previously duplicated identically in CollectionTable.jsx and
// Collection.jsx — consolidated here so a future fix only has to happen once.

export function keyOf(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function loanIdentityKeys(loan) {
  return [
    loan?.id,
    loan?.loanId,
    loan?.loanCode,
    loan?.code,
    loan?.loanDbId,
    loan?.dbLoanId,
  ].map(keyOf).filter(Boolean);
}

export function isPrecloseMarker(value) {
  const marker = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');

  return marker === 'PRECLOSE' || marker === 'PRECLOSED';
}
