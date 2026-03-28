import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const s = {
  page:    { maxWidth: 640, margin: '0 auto', padding: 24 },
  title:   { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 8 },
  sub:     { color: '#888', fontSize: 14, marginBottom: 32 },
  card:    { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 8px #0001', marginBottom: 24 },
  section: { fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 4 },
  desc:    { fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.5 },
  btnDanger: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnGhost:  { background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:     { background: '#fff', borderRadius: 14, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 8px 32px #0003' },
  modalTitle:{ fontSize: 18, fontWeight: 700, color: '#c0392b', marginBottom: 12 },
  warning:   { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#856404', lineHeight: 1.5 },
  balanceBox:{ background: '#fee', border: '1px solid #f5c6cb', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#721c24', lineHeight: 1.5 },
  input:     { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 4 },
  label:     { display: 'block', fontSize: 13, color: '#555', marginBottom: 6 },
  row:       { display: 'flex', gap: 10, marginTop: 20 },
  errMsg:    { color: '#c0392b', fontSize: 13, marginTop: 8 },
};

const CONFIRM_PHRASE = 'delete my account';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showModal, setShowModal]       = useState(false);
  const [step, setStep]                 = useState('confirm'); // 'confirm' | 'balance_warning'
  const [balanceInfo, setBalanceInfo]   = useState(null); // { balance, publicKey }
  const [confirmText, setConfirmText]   = useState('');
  const [deleting, setDeleting]         = useState(false);
  const [error, setError]               = useState('');

  function openModal() {
    setStep('confirm');
    setConfirmText('');
    setBalanceInfo(null);
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    if (deleting) return;
    setShowModal(false);
  }

  async function handleDelete(force = false) {
    setDeleting(true);
    setError('');
    try {
      await api.deleteAccount(force);
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      if (e.status === 409 && e.data?.code === 'balance_warning') {
        setBalanceInfo({ balance: e.data.balance, publicKey: e.data.publicKey });
        setStep('balance_warning');
      } else {
        setError(e.message || 'Deletion failed. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  }

  const confirmValid = confirmText.trim().toLowerCase() === CONFIRM_PHRASE;

  return (
    <div style={s.page}>
      <div style={s.title}>Settings</div>
      <div style={s.sub}>Manage your account preferences.</div>

      <div style={s.card}>
        <div style={s.section}>Account Information</div>
        <div style={{ fontSize: 14, color: '#555', marginBottom: 4 }}>
          <strong>Name:</strong> {user?.name}
        </div>
        <div style={{ fontSize: 14, color: '#555', marginBottom: 4 }}>
          <strong>Email:</strong> {user?.email}
        </div>
        <div style={{ fontSize: 14, color: '#555' }}>
          <strong>Role:</strong> {user?.role}
        </div>
      </div>

      <div style={{ ...s.card, border: '1px solid #f5c6cb' }}>
        <div style={{ ...s.section, color: '#c0392b' }}>Danger Zone</div>
        <div style={s.desc}>
          Permanently delete your account and all associated data including orders, products, and profile information.
          Your Stellar wallet will be abandoned — make sure to withdraw any funds first.
        </div>
        <button style={s.btnDanger} onClick={openModal}>
          Delete Account
        </button>
      </div>

      {showModal && (
        <div style={s.overlay} onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div style={s.modal} onClick={e => e.stopPropagation()}>

            {step === 'confirm' && (
              <>
                <div style={s.modalTitle} id="modal-title">Delete Account</div>
                <div style={s.warning}>
                  <strong>This action is permanent and cannot be undone.</strong> All your data will be deleted including orders, listings, and your profile.
                </div>
                <p style={{ fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 1.5 }}>
                  Your Stellar wallet (<code style={{ fontSize: 11 }}>{user?.publicKey?.slice(0, 10)}...</code>) will be abandoned on the ledger.
                  Please withdraw any remaining XLM before proceeding.
                </p>
                <label style={s.label}>
                  Type <strong>{CONFIRM_PHRASE}</strong> to confirm
                </label>
                <input
                  style={s.input}
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoFocus
                />
                {error && <div style={s.errMsg}>{error}</div>}
                <div style={s.row}>
                  <button style={s.btnGhost} onClick={closeModal} disabled={deleting}>Cancel</button>
                  <button
                    style={{ ...s.btnDanger, opacity: confirmValid ? 1 : 0.5 }}
                    disabled={!confirmValid || deleting}
                    onClick={() => handleDelete(false)}
                  >
                    {deleting ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </>
            )}

            {step === 'balance_warning' && balanceInfo && (
              <>
                <div style={s.modalTitle} id="modal-title">Wallet Balance Detected</div>
                <div style={s.balanceBox}>
                  Your Stellar wallet still holds <strong>{balanceInfo.balance.toFixed(4)} XLM</strong>.
                  If you delete your account now, these funds will be permanently inaccessible.
                </div>
                <p style={{ fontSize: 13, color: '#555', marginBottom: 8, lineHeight: 1.5 }}>
                  We recommend withdrawing your funds first. Go to your{' '}
                  <span
                    style={{ color: '#2d6a4f', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => { closeModal(); navigate('/wallet'); }}
                  >
                    Wallet
                  </span>{' '}
                  to send XLM to another address.
                </p>
                <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                  Public key: <code style={{ wordBreak: 'break-all' }}>{balanceInfo.publicKey}</code>
                </p>
                {error && <div style={s.errMsg}>{error}</div>}
                <div style={s.row}>
                  <button style={s.btnGhost} onClick={closeModal} disabled={deleting}>Cancel</button>
                  <button
                    style={{ ...s.btnDanger }}
                    disabled={deleting}
                    onClick={() => handleDelete(true)}
                  >
                    {deleting ? 'Deleting...' : 'Delete Anyway'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
