import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

const s = {
  page: { maxWidth: 1000, margin: '0 auto', padding: 24 },
  title: { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
  stat: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 8px #0001', textAlign: 'center' },
  statVal: { fontSize: 28, fontWeight: 700, color: '#2d6a4f' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 8px #0001' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #eee', color: '#555', fontWeight: 600 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f0f0f0' },
  badge: (role) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    background: role === 'admin' ? '#ffeaa7' : role === 'farmer' ? '#d8f3dc' : '#dfe6e9',
    color: role === 'admin' ? '#b8860b' : role === 'farmer' ? '#2d6a4f' : '#555',
  }),
  deactivate: { background: '#fee', color: '#c0392b', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  inactive: { color: '#aaa', fontSize: 12, fontStyle: 'italic' },
  pagination: { display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' },
  pgBtn: (disabled) => ({ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#aaa' : '#333' }),
  err: { color: '#c0392b', fontSize: 14, marginBottom: 12 },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');
  const [contracts, setContracts] = useState([]);
  const [contractForm, setContractForm] = useState({ contract_id: '', name: '', type: 'escrow', network: 'testnet' });
  const [contractMsg, setContractMsg] = useState('');
  const [contractFilter, setContractFilter] = useState({ network: '', type: '' });

  async function loadStats() {
    try {
      const res = await api.adminGetStats();
      setStats(res.data);
    } catch (e) { setError(e.message); }
  }

  async function loadUsers(page = 1) {
    try {
      const res = await api.adminGetUsers(page);
      setUsers(res.data);
      setPagination(res.pagination);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    loadStats();
    loadUsers(1);
    loadContracts();
  }, []);

  async function loadContracts(filters = contractFilter) {
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
      const res = await api.adminGetContracts(params ? `?${params}` : '');
      setContracts(res.data ?? []);
    } catch (e) { setContractMsg(e.message); }
  }

  async function handleRegisterContract(e) {
    e.preventDefault();
    setContractMsg('');
    try {
      await api.adminRegisterContract(contractForm);
      setContractForm({ contract_id: '', name: '', type: 'escrow', network: 'testnet' });
      setContractMsg('Contract registered.');
      loadContracts();
    } catch (err) { setContractMsg(err.message); }
  }

  async function handleDeregisterContract(id) {
    if (!confirm('Deregister this contract?')) return;
    try {
      await api.adminDeregisterContract(id);
      loadContracts();
    } catch (e) { setContractMsg(e.message); }
  }

  async function handleDeactivate(id, name) {
    if (!confirm(`Deactivate user "${name}"?`)) return;
    try {
      await api.adminDeactivateUser(id);
      loadUsers(pagination.page);
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={s.page}>
      <div style={s.title}>🛡️ Admin Dashboard</div>
      {error && <div style={s.err}>{error}</div>}

      {stats && (
        <div style={s.grid}>
          <div style={s.stat}>
            <div style={s.statVal}>{stats.users}</div>
            <div style={s.statLabel}>Total Users</div>
          </div>
          <div style={s.stat}>
            <div style={s.statVal}>{stats.products}</div>
            <div style={s.statLabel}>Products Listed</div>
          </div>
          <div style={s.stat}>
            <div style={s.statVal}>{stats.orders}</div>
            <div style={s.statLabel}>Total Orders</div>
          </div>
          <div style={s.stat}>
            <div style={s.statVal}>{Number(stats.total_revenue_xlm).toFixed(2)}</div>
            <div style={s.statLabel}>Revenue (XLM)</div>
          </div>
        </div>
      )}

      <div style={s.card}>
        <h3 style={{ marginBottom: 16, color: '#333' }}>Users ({pagination.total})</h3>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>ID</th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Joined</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={s.td}>{u.id}</td>
                <td style={s.td}>{u.name}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}><span style={s.badge(u.role)}>{u.role}</span></td>
                <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={s.td}>
                  {u.active === 0
                    ? <span style={s.inactive}>Inactive</span>
                    : <span style={{ color: '#2d6a4f', fontSize: 12 }}>Active</span>}
                </td>
                <td style={s.td}>
                  {u.role !== 'admin' && u.active !== 0 && (
                    <button style={s.deactivate} onClick={() => handleDeactivate(u.id, u.name)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={s.pagination}>
          <button
            style={s.pgBtn(pagination.page <= 1)}
            disabled={pagination.page <= 1}
            onClick={() => loadUsers(pagination.page - 1)}
          >← Prev</button>
          <span style={{ fontSize: 13, color: '#666' }}>Page {pagination.page} of {pagination.pages}</span>
          <button
            style={s.pgBtn(pagination.page >= pagination.pages)}
            disabled={pagination.page >= pagination.pages}
            onClick={() => loadUsers(pagination.page + 1)}
          >Next →</button>
        </div>
      </div>

      {/* Contract Registry */}
      <div style={{ ...s.card, marginTop: 32 }}>
        <h3 style={{ marginBottom: 16, color: '#333' }}>🔗 Contract Registry</h3>
        {contractMsg && <div style={{ ...s.err, marginBottom: 12 }}>{contractMsg}</div>}
        <form onSubmit={handleRegisterContract} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <input style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, flex: '2 1 200px' }}
            placeholder="Contract ID (e.g. CB...)" value={contractForm.contract_id}
            onChange={e => setContractForm(f => ({ ...f, contract_id: e.target.value }))} required />
          <input style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, flex: '1 1 120px' }}
            placeholder="Name" value={contractForm.name}
            onChange={e => setContractForm(f => ({ ...f, name: e.target.value }))} required />
          <select style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
            value={contractForm.type} onChange={e => setContractForm(f => ({ ...f, type: e.target.value }))}>
            <option value="escrow">Escrow</option>
            <option value="token">Token</option>
            <option value="other">Other</option>
          </select>
          <select style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
            value={contractForm.network} onChange={e => setContractForm(f => ({ ...f, network: e.target.value }))}>
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
          <button type="submit" style={{ ...s.deactivate, background: '#2d6a4f', color: '#fff', padding: '7px 16px' }}>Register</button>
        </form>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
            value={contractFilter.network} onChange={e => { const f = { ...contractFilter, network: e.target.value }; setContractFilter(f); loadContracts(f); }}>
            <option value="">All Networks</option>
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
          <select style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
            value={contractFilter.type} onChange={e => { const f = { ...contractFilter, type: e.target.value }; setContractFilter(f); loadContracts(f); }}>
            <option value="">All Types</option>
            <option value="escrow">Escrow</option>
            <option value="token">Token</option>
            <option value="other">Other</option>
          </select>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Contract ID</th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Network</th>
              <th style={s.th}>Deployed</th>
              <th style={s.th}>By</th>
              <th style={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0
              ? <tr><td colSpan={7} style={{ ...s.td, color: '#aaa', textAlign: 'center' }}>No contracts registered.</td></tr>
              : contracts.map(c => (
                <tr key={c.id}>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{c.contract_id.slice(0, 16)}…</td>
                  <td style={s.td}>{c.name}</td>
                  <td style={s.td}><span style={{ ...s.badge('buyer'), background: c.type === 'escrow' ? '#d8f3dc' : c.type === 'token' ? '#cce5ff' : '#eee' }}>{c.type}</span></td>
                  <td style={s.td}><span style={{ ...s.badge('buyer'), background: c.network === 'mainnet' ? '#ffeaa7' : '#eee' }}>{c.network}</span></td>
                  <td style={s.td}>{new Date(c.deployed_at).toLocaleDateString()}</td>
                  <td style={s.td}>{c.deployed_by_name || '—'}</td>
                  <td style={s.td}><button style={s.deactivate} onClick={() => handleDeregisterContract(c.id)}>Remove</button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
