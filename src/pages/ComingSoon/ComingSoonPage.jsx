import { Construction } from 'lucide-react';
import './ComingSoonPage.css';

export default function ComingSoonPage({ title }) {
  return (
    <div className="coming-page app-card">
      <span><Construction size={28} /></span>
      <h1>{title}</h1>
      <p>This page is already routed and ready for the next CREDNIVO frontend development stage.</p>
    </div>
  );
}
