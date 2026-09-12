import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  X,
  Smartphone,
  MessageSquare,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { saasStore, type SaaSUser } from '../services/saasStore';
import { sessionApi, type Session } from '../services/api';
import { useRole } from '../hooks/useRole';
import './CompanyTeam.css';

export function CompanyTeam() {
  const { isSuperAdmin } = useRole();
  const [users, setUsers] = useState<SaaSUser[]>(saasStore.getUsers());
  const [availableSessions, setAvailableSessions] = useState<Session[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'companyadmin' | 'viewer'>('user');

  const companies = saasStore.getCompanies();
  const currentCompanyName = sessionStorage.getItem('leadweave_company_name');
  const currentCompany = companies.find(
    c => c.name.toLowerCase() === currentCompanyName?.toLowerCase(),
  ) || companies[0];

  const [selectedCompanyId, setSelectedCompanyId] = useState(currentCompany?.id || 'cmp-1');

  useEffect(() => {
    saasStore.syncWithSupabase();
    return saasStore.subscribe(() => {
      setUsers(saasStore.getUsers());
    });
  }, []);

  useEffect(() => {
    if (currentCompany?.id && !isSuperAdmin) {
      setSelectedCompanyId(currentCompany.id);
    }
  }, [currentCompany, isSuperAdmin]);

  useEffect(() => {
    sessionApi.list().then(setAvailableSessions).catch(() => {});
  }, []);

  // Filter users by company unless superadmin
  const visibleUsers = isSuperAdmin
    ? users
    : users.filter(u => u.companyId === currentCompany?.id);

  const totalAgents = visibleUsers.length;
  const totalSessions = visibleUsers.reduce((acc, u) => acc + (u.activeSessionsCount || 0), 0);
  const totalSent = visibleUsers.reduce((acc, u) => acc + (u.messagesSentCount || 0), 0);
  const totalResponses = visibleUsers.reduce((acc, u) => acc + (u.responseCount || 0), 0);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email) return;

    saasStore.addUser({
      companyId: isSuperAdmin ? selectedCompanyId : (currentCompany?.id || selectedCompanyId),
      name,
      username,
      email,
      role,
    });

    setIsModalOpen(false);
    setName('');
    setUsername('');
    setEmail('');
  };

  return (
    <div className="team-page">
      {/* Header */}
      <div className="team-header">
        <div className="header-title-group">
          <h1>
            <Users size={28} />
            Team Members & Agent Performance Monitoring
          </h1>
          <p>Track active WhatsApp sessions, message throughput, and response metrics per agent</p>
        </div>

        <button className="btn-invite-member" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} />
          Add Team Member
        </button>
      </div>

      {/* Monitoring Summary Cards */}
      <div className="monitoring-cards-grid">
        <div className="monitor-card">
          <div className="monitor-icon">
            <Users size={22} />
          </div>
          <div className="monitor-info">
            <span className="monitor-val">{totalAgents}</span>
            <span className="monitor-lbl">Total Team Members</span>
          </div>
        </div>

        <div className="monitor-card">
          <div className="monitor-icon" style={{ color: '#0284c7', background: '#e0f2fe' }}>
            <Smartphone size={22} />
          </div>
          <div className="monitor-info">
            <span className="monitor-val">{totalSessions}</span>
            <span className="monitor-lbl">Active Phone Lines</span>
          </div>
        </div>

        <div className="monitor-card">
          <div className="monitor-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>
            <MessageSquare size={22} />
          </div>
          <div className="monitor-info">
            <span className="monitor-val">{totalSent.toLocaleString()}</span>
            <span className="monitor-lbl">Messages Dispatched</span>
          </div>
        </div>

        <div className="monitor-card">
          <div className="monitor-icon" style={{ color: '#16a34a', background: '#dcfce7' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="monitor-info">
            <span className="monitor-val">{totalResponses.toLocaleString()}</span>
            <span className="monitor-lbl">Responses Handled</span>
          </div>
        </div>
      </div>

      {/* Team Table with Detailed User Monitoring */}
      <div className="team-table-card">
        <table className="team-table">
          <thead>
            <tr>
              <th>Agent Member</th>
              <th>Company</th>
              <th>Active Lines</th>
              <th>Messages Sent / In</th>
              <th>Responses</th>
              <th>Avg Speed</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="user-avatar-cell">
                    <div className="user-avatar-circle">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        @{u.username} • {u.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{u.companyName}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="stat-badge">
                      <Smartphone size={14} color="#0284c7" />
                      {u.role === 'companyadmin' ? 'All Company Lines' : `${u.assignedSessions?.length || 0} Assigned Line(s)`}
                    </span>
                    {u.role !== 'companyadmin' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                        {u.assignedSessions?.map(sessId => {
                          const sess = availableSessions.find(s => s.id === sessId);
                          return (
                            <span
                              key={sessId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '1px 5px',
                              }}
                            >
                              {sess?.name || sessId.slice(0, 8)}
                              <button
                                type="button"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#ef4444', fontWeight: 'bold' }}
                                onClick={() => saasStore.unassignSessionFromUser(u.id, sessId)}
                                title="Remove session assignment"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        {availableSessions.filter(s => !(u.assignedSessions || []).includes(s.id)).length > 0 && (
                          <select
                            aria-label="Assign WhatsApp line"
                            style={{ fontSize: '11px', padding: '1px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            value=""
                            onChange={e => {
                              if (e.target.value) {
                                saasStore.assignSessionToUser(u.id, e.target.value);
                              }
                            }}
                          >
                            <option value="">+ Assign line</option>
                            {availableSessions
                              .filter(s => !(u.assignedSessions || []).includes(s.id))
                              .map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name}{s.phone ? ` (${s.phone})` : ''}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    📤 {u.messagesSentCount || 0} / 📥 {u.messagesReceivedCount || 0}
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>
                    {u.responseCount || 0} handled
                  </span>
                </td>
                <td>
                  <span className="stat-badge">
                    <Clock size={13} color="#64748b" />
                    {u.avgResponseTime || '35s'}
                  </span>
                </td>
                <td>
                  <span className={`role-pill ${u.role}`}>
                    {u.role === 'companyadmin' ? 'Company Admin' : u.role === 'user' ? 'Agent' : 'Viewer'}
                  </span>
                </td>
                <td>
                  <button
                    style={{
                      border: '1px solid #e2e8f0',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 6,
                      color: '#ef4444',
                    }}
                    onClick={() => {
                      if (window.confirm(`Remove ${u.name}?`)) {
                        saasStore.deleteUser(u.id);
                      }
                    }}
                    title="Remove user"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Team Member</h2>
              <button
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Company Workspace</label>
                <select
                  aria-label="Company Workspace"
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.activeUsersCount}/{c.maxUsers} Users)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Green"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Username (Login)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rachel_g"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="rachel@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  aria-label="Role"
                  value={role}
                  onChange={e => setRole(e.target.value as 'user' | 'companyadmin' | 'viewer')}
                >
                  <option value="user">Agent (Chat Operator)</option>
                  <option value="companyadmin">Company Admin</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Save Team Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
