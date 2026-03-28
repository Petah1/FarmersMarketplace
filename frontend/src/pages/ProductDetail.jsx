import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

const s = {
  page: { maxWidth: 600, margin: '40px auto', padding: 24 },
  card: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 8px #0001' },
  name: { fontSize: 28, fontWeight: 700, color: '#2d6a4f', marginBottom: 4 },
  farmer: { color: '#888', marginBottom: 16 },
  desc: { color: '#555', marginBottom: 24, lineHeight: 1.6 },
  price: { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  input: { width: 80, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 16, textAlign: 'center' },
  btn: { background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', cursor: 'pointer', fontWeight: 600, fontSize: 16 },
  total: { background: '#f0faf4', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 15 },
  err: { color: '#c0392b', fontSize: 14, marginTop: 8 },
  success: { background: '#d8f3dc', borderRadius: 8, padding: 16, color: '#2d6a4f' },
  confirming: { background: '#fff8e1', borderRadius: 8, padding: 16, color: '#856404', textAlign: 'center' },
  bar: { height: 6, background: '#e0e0e0', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  barFill: { height: '100%', background: '#f9a825', borderRadius: 3, transition: 'width 3s linear' },
};

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(null); // { orderId, startedAt }
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => { api.getProduct(id).then(setProduct).catch(() => navigate('/marketplace')); }, [id]);

  // Poll for confirmation when in confirming state
  useEffect(() => {
    if (!confirming) return;
    setProgress(5);

    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - confirming.startedAt;
      setProgress(Math.min(95, (elapsed / TIMEOUT_MS) * 100));

      if (elapsed > TIMEOUT_MS) {
        clearInterval(pollRef.current);
        setConfirming(null);
        setError('Payment confirmation timed out. Check your wallet for the transaction.');
        setLoading(false);
        return;
      }

      try {
        const status = await api.getOrderStatus(confirming.orderId);
        if (status.status === 'paid') {
          clearInterval(pollRef.current);
          setConfirming(null);
          setProgress(100);
          setResult(status);
          setLoading(false);
        } else if (status.status === 'failed') {
          clearInterval(pollRef.current);
          setConfirming(null);
          setError('Payment failed. Please try again.');
          setLoading(false);
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [confirming]);

  if (!product) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  const total = (product.price * qty).toFixed(2);

  async function handleBuy() {
    if (!user) return navigate('/login');
    if (user.role === 'farmer') return setError('Farmers cannot place orders');
    setLoading(true);
    setError('');
    try {
      const res = await api.placeOrder({ product_id: product.id, quantity: qty });
      setConfirming({ orderId: res.orderId, startedAt: Date.now() });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={s.success}>
            <strong>Payment confirmed!</strong>
            <p style={{ marginTop: 8, fontSize: 14 }}>Order #{result.id} · {result.total_price} XLM paid</p>
            {result.stellar_tx_hash && (
              <p style={{ marginTop: 4, fontSize: 12, wordBreak: 'break-all', color: '#555' }}>TX: {result.stellar_tx_hash}</p>
            )}
          </div>
          <button style={{ ...s.btn, marginTop: 20, background: '#555' }} onClick={() => navigate('/marketplace')}>Back to Marketplace</button>
        </div>
      </div>
    );
  }

  if (confirming) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div style={s.confirming}>
            <strong>Confirming payment...</strong>
            <p style={{ marginTop: 8, fontSize: 14 }}>Waiting for Stellar network confirmation. This usually takes a few seconds.</p>
            <div style={s.bar}><div style={{ ...s.barFill, width: `${progress}%` }} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🥬</div>
        <div style={s.name}>{product.name}</div>
        <div style={s.farmer}>Sold by {product.farmer_name}</div>
        <div style={s.desc}>{product.description || 'Fresh from the farm.'}</div>
        <div style={s.price}>{product.price} XLM <span style={{ fontSize: 14, fontWeight: 400 }}>/ {product.unit}</span></div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{product.quantity} {product.unit} in stock</div>

        <div style={s.row}>
          <label style={{ fontSize: 14 }}>Quantity:</label>
          <input style={s.input} type="number" min={1} max={product.quantity} value={qty}
            onChange={e => setQty(Math.max(1, Math.min(product.quantity, parseInt(e.target.value) || 1)))} />
          <span style={{ fontSize: 13, color: '#888' }}>{product.unit}</span>
        </div>

        <div style={s.total}>Total: <strong>{total} XLM</strong></div>

        {error && <div style={s.err}>{error}</div>}

        <button style={s.btn} onClick={handleBuy} disabled={loading}>
          {loading ? 'Submitting...' : `Buy Now · ${total} XLM`}
        </button>
      </div>
    </div>
  );
}
