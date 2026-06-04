import React, { useState } from 'react';
import { Landmark, ArrowRight, Download, Check, Copy } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Settlements({ analytics, token, onRefresh }) {
  const [copiedUpi, setCopiedUpi] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  if (!analytics) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading ledger data...</p>
      </div>
    );
  }

  const {
    month,
    total_spend,
    shared_spend,
    user_breakdown,
    fairness_ledger
  } = analytics;

  const {
    average_share,
    balances,
    settlements
  } = fairness_ledger;

  const handleCopyUpi = (upiId) => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(upiId);
    setTimeout(() => setCopiedUpi(null), 2000);
  };

  // Export handlers
  const handleExport = async (format) => {
    setExportLoading(true);
    try {
      // In production, we request the binary stream from backend.
      // To make it immediately work in the prototype, we trigger the browser window download location:
      window.open(`${API_BASE}/api/analytics/export/${format}?token=${token}&month=${month}`, '_blank');
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setExportLoading(false), 1500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Export Section */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Fairness Ledger & Settlements</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Calculated balances based on shared expenses logged for {month}.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-secondary" 
            onClick={() => handleExport('pdf')}
            disabled={exportLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
          >
            <Download size={16} /> Export PDF Report
          </button>
          
          <button 
            className="btn-secondary" 
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
          >
            <Download size={16} /> Export Excel Report
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        
        {/* Left Card: Ledger Balance */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Contribution Ledger</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Shared Spending: <strong>₹{(shared_spend || 0).toFixed(2)}</strong>. Average share: <strong>₹{(average_share || 0).toFixed(2)}</strong> per member.</p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 6px' }}>Member</th>
                  <th style={{ padding: '10px 6px' }}>Shared Paid</th>
                  <th style={{ padding: '10px 6px' }}>Fair Share</th>
                  <th style={{ padding: '10px 6px', textAlign: 'right' }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map(b => (
                  <tr key={b.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img 
                        src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${(b.name || '').replace(' ', '')}`} 
                        alt="Avatar" 
                        style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} 
                      />
                      <span>{b.name}</span>
                    </td>
                    <td style={{ padding: '12px 6px', fontWeight: 500 }}>₹{(b.paid_shared || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px 6px', color: 'var(--text-secondary)' }}>₹{(average_share || 0).toFixed(2)}</td>
                    <td style={{ 
                      padding: '12px 6px', textAlign: 'right', fontWeight: 'bold',
                      color: b.balance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'
                    }}>
                      {b.balance >= 0 ? '+' : ''}₹{(b.balance || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Card: Settlements */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Settlement Suggestions</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Non-confrontational peer-to-peer transfers to balance the room ledger.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {settlements.length === 0 ? (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 0' }}>
                <Check size={36} style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
                <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>All Settled Up!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Everyone has paid their exact share. No transfers required.</p>
              </div>
            ) : (
              settlements.map((s, idx) => (
                <div key={idx} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.from_user}</span>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.to_user}</span>
                    </div>
                    
                    <strong style={{ fontSize: '15px', color: 'var(--color-accent)' }}>
                      ₹{(s.amount || 0).toFixed(2)}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UPI ID: <strong>{s.upi_id}</strong></span>
                    
                    <button 
                      onClick={() => handleCopyUpi(s.upi_id)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: copiedUpi === s.upi_id ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', borderColor: copiedUpi === s.upi_id ? 'var(--color-primary)' : 'var(--border-color)' }}
                    >
                      {copiedUpi === s.upi_id ? (
                        <><Check size={12} style={{ color: 'var(--color-primary)' }} /> Copied</>
                      ) : (
                        <><Copy size={12} /> Copy UPI</>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default Settlements;
