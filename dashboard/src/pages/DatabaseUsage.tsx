import { useState, useEffect } from 'react';
import { Database, HardDrive, Cpu, Activity } from 'lucide-react';
import { saasStore, type SaaSCompany } from '../services/saasStore';
import './DatabaseUsage.css';

export function DatabaseUsage() {
  const [companies, setCompanies] = useState<SaaSCompany[]>(saasStore.getCompanies());

  useEffect(() => {
    return saasStore.subscribe(() => {
      setCompanies(saasStore.getCompanies());
    });
  }, []);

  return (
    <div className="database-usage-page">
      <div className="db-usage-header">
        <h1>
          <Database size={28} />
          Database & Multi-Tenant Platform Usage
        </h1>
        <p>Live resource consumption, SQLite disk health, active sockets, and tenant storage allocation</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">
            <HardDrive size={16} /> Total SQLite Storage
          </div>
          <div className="metric-value">284.5 MB</div>
          <div className="metric-subtitle">🟢 100% Local Fast NVMe Cache</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <Activity size={16} /> Total Monthly Messages
          </div>
          <div className="metric-value">42,890</div>
          <div className="metric-subtitle">+18.4% from last week</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <Cpu size={16} /> Server Node Heap
          </div>
          <div className="metric-value">118 MB</div>
          <div className="metric-subtitle">🟢 Low memory footprint</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <Activity size={16} /> Active WebSocket Connections
          </div>
          <div className="metric-value">14 Realtime Clients</div>
          <div className="metric-subtitle">Sub-5ms message latency</div>
        </div>
      </div>

      <div className="storage-breakdown-card">
        <h2>Storage Distribution by Tenant</h2>

        <div className="storage-bar-wrapper">
          <div className="storage-bar">
            <div className="bar-segment" style={{ width: '45%', background: '#3b82f6' }} title="Acme Logistics (45%)" />
            <div className="bar-segment" style={{ width: '35%', background: '#8b5cf6' }} title="Globex Health (35%)" />
            <div
              className="bar-segment"
              style={{ width: '20%', background: '#f59e0b' }}
              title="Apex Real Estate (20%)"
            />
          </div>
        </div>

        <div className="storage-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#3b82f6' }} />
            <span>Acme Logistics: 128 MB (45%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#8b5cf6' }} />
            <span>Globex Health: 99.5 MB (35%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#f59e0b' }} />
            <span>Apex Real Estate: 57 MB (20%)</span>
          </div>
        </div>

        <table className="tenants-usage-table">
          <thead>
            <tr>
              <th>Tenant Name</th>
              <th>Plan</th>
              <th>Users Allocation</th>
              <th>WhatsApp Numbers</th>
              <th>Estimated Disk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong> ({c.slug})
                </td>
                <td>{c.plan}</td>
                <td>
                  {c.activeUsersCount} / {c.maxUsers} Users
                </td>
                <td>
                  {c.activeSessionsCount} / {c.maxSessions} Numbers
                </td>
                <td>{c.plan === 'Pro' ? '128 MB' : c.plan === 'Growth' ? '99.5 MB' : '57 MB'}</td>
                <td>
                  <span style={{ color: c.status === 'active' ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                    {c.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
