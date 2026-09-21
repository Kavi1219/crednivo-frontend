import { Search, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrednivo } from '../../context/CrednivoContext';
import CustomerAvatar from '../common/CustomerAvatar';
import './DashboardQuickSearch.css';

export default function DashboardQuickSearch() {
  const { customers } = useCrednivo();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (customers || [])
      .filter((c) => `${c.name} ${c.id} ${c.mobile}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [customers, query]);

  const openCustomer = (id) => {
    setQuery('');
    navigate(`/customers/${id}`);
  };

  return (
    <section className="dashboard-quick-search app-card">
      <h2>Find a Customer</h2>
      <label className="dashboard-quick-search-input">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ID or mobile..."
        />
      </label>
      {query.trim() && (
        results.length ? (
          <div className="dashboard-quick-search-results">
            {results.map((c) => (
              <button key={c.id} type="button" className="dashboard-quick-search-row" onClick={() => openCustomer(c.id)}>
                <CustomerAvatar photo={c.photo} name={c.name} />
                <div className="dashboard-quick-search-identity">
                  <strong>{c.name}</strong>
                  <span>{c.id} · {c.mobile}</span>
                </div>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="dashboard-quick-search-empty">No customers match "{query}".</div>
        )
      )}
    </section>
  );
}
