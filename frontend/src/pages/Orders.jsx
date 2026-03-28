import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const STATUSES = ['all', 'pending', 'paid', 'failed'];

const STATUS_STYLE = {
  paid:    { bg: '#d8f3dc', color: '#2d6a4f' },
  pending: { bg: '#fff3cd', color: '#856404' },
  failed:  { bg: '#fee2e2', color: '#c0392b' },
};

const STATUS_ICON = { paid: '✅', pending: '⏳', failed: '❌' };

const s = {
  page:       { maxWidth: 900, margin: '0 auto', padding: 24 },
  title:      { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 4 },
  sub:        { color: '#888', fontSize: 14, marginBottom: 24 },
  stats:      { display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  statCard:   { flex: '1 1 140px', background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 8px #0001', textAlign: 'center' },
  statNum:    { fontSize: 28, fontWeight: 700, color: '#2d6a4f' },
  statLabel:  { fontSize: 12, color: '#888', marginTop: 4 },
  tabs:       { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  tab:        { padding: '7px 18px', borderRadius: 20, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#f5f5f5', color: '#555', transition: 'all 0.15s' },
  tabActive:  { background: '#2d6a4f', color: '#fff', border: '1px solid #2d6a4f' },
  card:       { background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px #0001', overflow: 'hidden' },
  row:        { display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f0f0f0', alignItems: 'start' },
  rowHover:   { background: '#fafafa' },
  name:       { fontWeight: 600, fontSize: 15, marginBottom: 4, color: '#222' },
  meta:       { fontSize: 13, color: '#666', marginBottom: 2 },
  orderId:    { fontSize: 11, color: '#bbb', marginTop: 2 },
  hash:       { fontSize: 11, color: '#aaa', fontFamily: 'monospace', marginTop: 6, wordBreak: 'break-all' },
  badge:      { fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' },
  empty:      { padding: '48px 20px', textAlign: 'center', color: '#aaa', fontSize: 15 },
  right:      { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  price:      { fontWeight: 700, fontSize: 16, color: '#2d6a4f' },
  errorBox:   { background: '#fee2e2', color: '#c0392b', borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  retryBtn:   { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};

function formatDate(raw) {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}

export default function Orders() {
  const [allOrders, setAllOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [hovered, setHovered]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrders();
      setAllOrders(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (e) {
      setError(e.message || 'Failed to load orders');
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total:   allOrders.length,
    paid:    allOrders.filter(o => o.status === 'paid').length,
    pending: allOrders.filter(o => o.status === 'pending').length,
    failed:  allOrders.filter(o => o.status === 'failed').length,
    spent:   allOrders
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0),
  };

  const visible = activeTab === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === activeTab);

  return (
    <div style={s.page}>
      <div style={s.title}>📦 My Orders</div>
      <div style={s.sub}>Track your purchases and verify transactions</div>

      {error && (
        <div style={s.errorBox} role="alert">
          <span>⚠️ {error}</span>
          <button style={s.retryBtn} onClick={load}>Retry</button>
        </div>
      )}

      {/* Summary stats */}
      <div style={s.stats}>
        <div style={s.statCard}>
          <div style={s.statNum}>{stats.total}</div>
          <div style={s.statLabel}>Total Orders</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#2d6a4f' }}>{stats.paid}</div>
          <div style={s.statLabel}>Paid</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#856404' }}>{stats.pending}</div>
          <div style={s.statLabel}>Pending</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#c0392b' }}>{stats.failed}</div>
          <div style={s.statLabel}>Failed</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{stats.spent.toFixed(2)}</div>
          <div style={s.statLabel}>XLM Spent</div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={s.tabs} role="tablist" aria-label="Filter orders by status">
        {STATUSES.map(status => {
          const count = status === 'all'
            ? allOrders.length
            : allOrders.filter(o => o.status === status).length;
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              role="tab"
              aria-selected={isActive}
              style={{ ...s.tab, ...(isActive ? s.tabActive : {}) }}
              onClick={() => setActiveTab(status)}
            >
              {status === 'all'
                ? '🗂 All'
                : `${STATUS_ICON[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`}
              {' '}
              <span style={{ opacity: 0.75 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      <div style={s.card} role="tabpanel">
        {loading ? (
          <div style={s.empty} aria-live="polite">Loading orders…</div>
        ) : visible.length === 0 ? (
          <div style={s.empty}>
            {activeTab === 'all'
              ? 'No orders yet. Head to the marketplace to make a purchase.'
              : `No ${activeTab} orders.`}
          </div>
        ) : (
          visible.map(o => {
            const st = STATUS_STYLE[o.status] || { bg: '#eee', color: '#333' };
            return (
              <div
                key={o.id}
                style={{ ...s.row, ...(hovered === o.id ? s.rowHover : {}) }}
                onMouseEnter={() => setHovered(o.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Left: product info */}
                <div>
                  <div style={s.name}>{o.product_name}</div>
                  <div style={s.meta}>
                    Qty: <strong>{o.quantity}</strong> {o.unit}
                    &nbsp;·&nbsp;
                    Farmer: {o.farmer_name}
                  </div>
                  <div style={s.meta}>
                    {formatDate(o.created_at)}
                  </div>
                  <div style={s.orderId}>Order #{o.id}</div>
                  {o.stellar_tx_hash && (
                    <div style={s.hash}>
                      TX:{' '}
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${o.stellar_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2d6a4f' }}
                        title="View transaction on Stellar Explorer"
                      >
                        {o.stellar_tx_hash}
                      </a>
                    </div>
                  )}
                </div>

                {/* Right: status + price */}
                <div style={s.right}>
                  <span
                    style={{ ...s.badge, background: st.bg, color: st.color }}
                    aria-label={`Status: ${o.status}`}
                  >
                    {STATUS_ICON[o.status]} {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                  </span>
                  <span style={s.price}>
                    {parseFloat(o.total_price).toFixed(2)} XLM
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
