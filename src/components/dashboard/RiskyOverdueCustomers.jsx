import { useMemo } from 'react';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, formatIndianMobile, toInputDate } from '../../utils/finance';
import { getRiskTier } from '../../utils/collectionTargets';
import CustomerProfileLink from '../common/CustomerProfileLink';
import './RiskyOverdueCustomers.css';

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

  return (
    <section className="risky-overdue-card app-card" aria-labelledby="risky-overdue-heading">
      <div className="risky-overdue-head">
        <div>
          <h2 id="risky-overdue-heading">Risky Overdue Customers</h2>
          <p>Customers with 3 or more unpaid dues</p>
        </div>
        <span className="risky-overdue-count">{riskyCustomers.length}</span>
      </div>

      <div className="risky-overdue-list">
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
