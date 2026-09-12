import { CreditCard, Check } from 'lucide-react';
import { saasStore } from '../services/saasStore';
import './Subscriptions.css';

export function Subscriptions() {
  const currentCompany = saasStore.getCompanies()[0]; // Defaulting to the first company for the dashboard
  const allPlans = saasStore.getPlans();
  const currentPlan = allPlans.find(p => p.name === currentCompany?.plan) || allPlans[0];

  if (!currentCompany) {
    return <div className="subscriptions-page">No active agreement found.</div>;
  }

  // Conversion rate applied (rough estimate 1 USD = 83 INR)
  const priceInINR = currentPlan.priceMonth * 83;

  return (
    <div className="subscriptions-page">
      <div className="subscriptions-header">
        <h1>
          <CreditCard size={28} />
          Current Agreement
        </h1>
        <p>Your current subscription plan and usage details</p>
      </div>

      <div className="current-agreement-card">
        <div className="agreement-header">
          <h2>{currentCompany.name}</h2>
          <span className={`status-badge ${currentCompany.status}`}>
            {currentCompany.status === 'active' ? '✓ ' : currentCompany.status === 'trial' ? '⚠ ' : '⊘ '}
            {currentCompany.status.toUpperCase()}
          </span>
        </div>

        <div className="agreement-details">
          <div className="detail-item">
            <span className="detail-label">Active Plan</span>
            <span className="detail-value plan-name">{currentCompany.plan}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Monthly Cost</span>
            <span className="detail-value price">₹{priceInINR.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="usage-stats-grid">
          <div className="usage-stat-box">
            <span className="stat-icon">👥</span>
            <div className="stat-content">
              <span className="stat-title">Team Users</span>
              <span className="stat-numbers">
                {currentCompany.activeUsersCount} <span className="stat-limit">/ {currentCompany.maxUsers}</span>
              </span>
            </div>
          </div>

          <div className="usage-stat-box">
            <span className="stat-icon">📱</span>
            <div className="stat-content">
              <span className="stat-title">WhatsApp Lines</span>
              <span className="stat-numbers">
                {currentCompany.activeSessionsCount} <span className="stat-limit">/ {currentCompany.maxSessions}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="plan-features">
          <h3>Included Features</h3>
          <ul className="plan-features-list">
            {(currentPlan?.features || []).map((feature, idx) => (
              <li key={idx} className="plan-feature-item">
                <Check className="feature-check" size={16} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
