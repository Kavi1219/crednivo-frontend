import { useEffect, useMemo, useRef } from 'react';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, formatIndianMobile, toInputDate } from '../../utils/finance';
import { getRiskTier } from '../../utils/collectionTargets';
import CustomerProfileLink from '../common/CustomerProfileLink';
import './RiskyOverdueCustomers.css';

/**
 * Touch hand-off for an inner scroll box: the finger scrolls the list until
 * it reaches its last (or first) row, then the SAME swipe continues scrolling
 * the page — no need to lift the finger and swipe again.
 */
function useScrollHandOff(ref) {
  useEffect(() => {
    const list = ref.current;
    if (!list) return undefined;
    let lastY = null;
    const page = () => document.scrollingElement || document.documentElement;

    const onStart = (event) => { lastY = event.touches[0]?.clientY ?? null; };
    const onMove = (event) => {
      const y = event.touches[0]?.clientY;
      if (lastY == null || y == null) return;
      const dy = lastY - y; // > 0: swiping up (content moves down)
      lastY = y;
      if (!dy) return;
      const atTop = list.scrollTop <= 0;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      if ((dy > 0 && atBottom) || (dy < 0 && atTop)) {
        event.preventDefault();
        page().scrollBy(0, dy);
      }
    };
    const onEnd = () => { lastY = null; };

    list.addEventListener('touchstart', onStart, { passive: true });
    list.addEventListener('touchmove', onMove, { passive: false });
    list.addEventListener('touchend', onEnd, { passive: true });
    list.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      list.removeEventListener('touchstart', onStart);
      list.removeEventListener('touchmove', onMove);
      list.removeEventListener('touchend', onEnd);
      list.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);
}

function balanceOf(item) {
  return Math.max(0, Number(item?.dueAmount || 0) - Number(item?.paidAmount || 0));
}

export default function RiskyOverdueCustomers() {
  const { customers, collections } = useCrednivo();
  const today = toInputDate();

  const riskyCustomers = useMemo(() => {
    const customerById = new Map(
      (customers || []).map((customer) => [String(customer.id || ''), customer]),
    );
    const pendingByCustomer = new Map();

    (collections || []).forEach((item) => {
      const status = String(item?.status || '').trim().toLowerCase();
      if (status === 'cancelled' || status === 'canceled') return;

      const dueDate = String(item?.date || '').slice(0, 10);
      if (!dueDate || dueDate > today) return;

      const pendingAmount = balanceOf(item);
      if (pendingAmount <= 0) return;

      const customerId = String(item?.customerId || '');
      if (!customerId) return;

      const current = pendingByCustomer.get(customerId) || {
        customerId,
        pendingAmount: 0,
        pendingDueCount: 0,
        hasOverdue: false,
        fallbackName: item?.customerName || '',
      };

      current.pendingAmount += pendingAmount;
      current.pendingDueCount += 1;
      current.hasOverdue = current.hasOverdue || dueDate < today;
      if (!current.fallbackName && item?.customerName) current.fallbackName = item.customerName;
      pendingByCustomer.set(customerId, current);
    });

    return Array.from(pendingByCustomer.values())
      .filter((item) => item.hasOverdue && getRiskTier(item.pendingDueCount) === 'Risky')
      .map((item) => {
        const customer = customerById.get(item.customerId);
        return {
          ...item,
          name: customer?.name || item.fallbackName || item.customerId,
          mobile: customer?.mobile || '',
        };
      })
      .sort((a, b) => (
        b.pendingDueCount - a.pendingDueCount
        || b.pendingAmount - a.pendingAmount
        || String(a.name).localeCompare(String(b.name))
      ));
  }, [collections, customers, today]);

  const listRef = useRef(null);
  useScrollHandOff(listRef);

  return (
    <section className="risky-overdue-card app-card" aria-labelledby="risky-overdue-heading">
      <div className="risky-overdue-head">
        <div>
          <h2 id="risky-overdue-heading">Risky Overdue Customers</h2>
          <p>Customers with 3 or more unpaid dues</p>
        </div>
        <span className="risky-overdue-count">{riskyCustomers.length}</span>
      </div>

      <div className="risky-overdue-list" ref={listRef}>
        {riskyCustomers.length ? riskyCustomers.map((customer) => (
          <div
            className="risky-overdue-row"
            key={customer.customerId}
          >
            <div className="risky-overdue-identity">
              <strong>
                <CustomerProfileLink customerId={customer.customerId}>{customer.name}</CustomerProfileLink>
              </strong>
              <span>{formatIndianMobile(customer.mobile)}</span>
            </div>
            <div className="risky-overdue-pending">
              <strong>{formatCurrency(customer.pendingAmount)} / {customer.pendingDueCount} due</strong>
            </div>
          </div>
        )) : (
          <div className="risky-overdue-empty">No risky overdue customers.</div>
        )}
      </div>
    </section>
  );
}
