import React, { useState, useEffect } from 'react';
import { Landmark, ArrowRight, Download, Check, Copy, AlertTriangle, Users, DollarSign } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function Settlements({ analytics, token, onRefresh, isOffline, room, expenses }) {
  const [copiedUpi, setCopiedUpi] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeLedger, setActiveLedger] = useState('pool'); // 'pool' | 'shared'
  const [contributions, setContributions] = useState([]);
  const [loadingPool, setLoadingPool] = useState(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Load monthly pool contributions (sync with BudgetPool.jsx)
  const fetchContributions = async () => {
    if (isOffline) {
      const saved = localStorage.getItem('monthly_pool_contributions');
      if (saved) {
        setContributions(JSON.parse(saved));
      } else {
        setContributions([
          { id: 1, user_id: 1, user_name: 'Akhil', amount: 20000, month: currentMonthStr },
          { id: 2, user_id: 2, user_name: 'Vikas', amount: 15000, month: currentMonthStr },
          { id: 3, user_id: 3, user_name: 'Jithu', amount: 15000, month: currentMonthStr },
        ]);
      }
      return;
    }

    setLoadingPool(true);
    try {
      const res = await fetch(`${API_BASE}/api/budgets/pool?month=${currentMonthStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContributions(data);
      }
    } catch (err) {
      console.error("Error fetching pool contributions in settlements:", err);
    } finally {
      setLoadingPool(false);
    }
  };

  useEffect(() => {
    fetchContributions();
  }, [token, isOffline, room?.id]);

  if (!analytics) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading ledger data...</p>
      </div>
    );
  }

  const {
    month,
    shared_spend,
    fairness_ledger
  } = analytics;

  const {
    average_share,
    balances: sharedBalances,
    settlements: sharedSettlements
  } = fairness_ledger;

  const handleCopyUpi = (upiId) => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(upiId);
    setTimeout(() => setCopiedUpi(null), 2000);
  };

  const handleExport = async (format) => {
    setExportLoading(true);
    try {
      window.open(`${API_BASE}/api/analytics/export/${format}?token=${token}&month=${month}`, '_blank');
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setExportLoading(false), 1500);
    }
  };

  // --- Monthly Pool Settlements Mathematics ---
  const memberList = room?.members || [
    { id: 1, name: 'Akhil', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Akhil', upi_id: 'akhil@okaxis' },
    { id: 2, name: 'Vikas', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Vikas', upi_id: 'vikas@okicici' },
    { id: 3, name: 'Jithu', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jithu', upi_id: 'jithu@oksbi' },
    { id: 4, name: 'Bhanu', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bhanu', upi_id: 'bhanu@okaxis' },
    { id: 5, name: 'Jagan', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jagan', upi_id: 'jagan@okicici' }
  ];

  const currentMonthExpenses = (expenses || []).filter(exp => (exp.date || '').slice(0, 7) === currentMonthStr);
  const totalSpent = currentMonthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const startingPool = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const deficit = Math.max(0, totalSpent - startingPool);
  const poolFairShare = totalSpent / memberList.length;

  const poolBalances = memberList.map(m => {
    const contributed = contributions
      .filter(c => String(c.user_id) === String(m.id))
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const balance = contributed - poolFairShare; // positive = refund, negative = owes

    return {
      user_id: m.id,
      name: m.name,
      avatar: m.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.name}`,
      upi_id: m.upi_id || `${m.name.toLowerCase()}@okaxis`,
      contributed,
      fairShare: poolFairShare,
      balance
    };
  });

  // Calculate peer-to-peer transfers to clear pool balances
  const poolSettlementsList = [];
  const poolDebtors = poolBalances.filter(b => b.balance < -0.01).map(d => ({ ...d, owed: -d.balance }));
  const poolCreditors = poolBalances.filter(b => b.balance > 0.01).map(c => ({ ...c, credit: c.balance }));

  let dIdx = 0;
  let cIdx = 0;
  while (dIdx < poolDebtors.length && cIdx < poolCreditors.length) {
    const d = poolDebtors[dIdx];
    const c = poolCreditors[cIdx];
    
    const amt = Math.min(d.owed, c.credit);
    if (amt > 0.05) {
      poolSettlementsList.push({
        from_user: d.name,
        to_user: c.name,
        amount: amt,
        upi_id: c.upi_id
      });
    }
    
    d.owed -= amt;
    c.credit -= amt;
    
    if (d.owed <= 0.05) dIdx++;
    if (c.credit <= 0.05) cIdx++;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header & Toggles */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Settlements & Net Dues</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Choose between prepaid pool balances and out-of-pocket log ledgers for {month}.</p>
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

      {/* Switch Toggle */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.18)', padding: '6px', borderRadius: '24px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
        <button
          onClick={() => setActiveLedger('pool')}
          style={{
            background: activeLedger === 'pool' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            border: activeLedger === 'pool' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
            color: activeLedger === 'pool' ? 'var(--color-primary)' : 'var(--text-secondary)',
            borderRadius: '20px',
            padding: '8px 18px',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          🏦 Monthly Pool Settlements
        </button>
        <button
          onClick={() => setActiveLedger('shared')}
          style={{
            background: activeLedger === 'shared' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            border: activeLedger === 'shared' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            color: activeLedger === 'shared' ? '#fff' : 'var(--text-secondary)',
            borderRadius: '20px',
            padding: '8px 18px',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          📄 Individual Log Settlements
        </button>
      </div>

      {/* DUAL LEDGER VIEWS */}
      {activeLedger === 'pool' ? (
        // VIEW 1: MONTHLY PREPAID POOL LEDGER
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Deficit Alert Warning */}
          <div className="card" style={{ 
            background: deficit > 0 ? 'rgba(239, 68, 68, 0.04)' : 'rgba(16, 185, 129, 0.04)', 
            border: `1px solid ${deficit > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`, 
            padding: '16px 20px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px' 
          }}>
            <AlertTriangle size={22} style={{ color: deficit > 0 ? 'var(--color-danger)' : 'var(--color-primary)', flexShrink: 0 }} />
            <div style={{ fontSize: '13px' }}>
              <span style={{ fontWeight: 'bold', color: deficit > 0 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                {deficit > 0 ? 'Pool Deficit Detected' : 'Pool Surplus (Within Budget)'}
              </span>
              <p style={{ color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                {deficit > 0 
                  ? `Total expenses (₹${totalSpent.toLocaleString()}) exceeded the collected pool (₹${startingPool.toLocaleString()}) by ₹${deficit.toLocaleString()}. This extra spend has been distributed equally (₹${(deficit / memberList.length).toFixed(2)} per person).`
                  : `Total room expenses (₹${totalSpent.toLocaleString()}) are fully covered by the pool (₹${startingPool.toLocaleString()}) with a surplus of ₹${(startingPool - totalSpent).toLocaleString()} remaining.`}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }} className="responsive-grid-pool">
            {/* Left Card: Pool Ledger */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Monthly Pool Ledger</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Prepaid contributions compared against your equal share of spent cash (₹{poolFairShare.toFixed(2)} each).</p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 6px' }}>Member</th>
                      <th style={{ padding: '10px 6px' }}>Contributed</th>
                      <th style={{ padding: '10px 6px' }}>Fair Share</th>
                      <th style={{ padding: '10px 6px', textAlign: 'right' }}>Net Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolBalances.map(b => (
                      <tr key={b.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img 
                            src={b.avatar} 
                            alt="Avatar" 
                            style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} 
                          />
                          <span>{b.name}</span>
                        </td>
                        <td style={{ padding: '12px 6px', fontWeight: 500 }}>₹{b.contributed.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 6px', color: 'var(--text-secondary)' }}>₹{poolFairShare.toFixed(2)}</td>
                        <td style={{ 
                          padding: '12px 6px', textAlign: 'right', fontWeight: 'bold',
                          color: b.balance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'
                        }}>
                          {b.balance >= 0 ? `Refund: +₹${b.balance.toFixed(2)}` : `Owes: -₹${Math.abs(b.balance).toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Card: Transfer Guidelines */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Pool Rebalancing Transfers</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Direct peer-to-peer transactions to resolve all pool dues.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {poolSettlementsList.length === 0 ? (
                  <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 0' }}>
                    <Check size={36} style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
                    <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>Prepaid Pool Settled!</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>All members contributed their exact split. No transfers needed.</p>
                  </div>
                ) : (
                  poolSettlementsList.map((s, idx) => (
                    <div key={idx} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.from_user}</span>
                          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.to_user}</span>
                        </div>
                        
                        <strong style={{ fontSize: '14px', color: 'var(--color-accent)' }}>
                          ₹{s.amount.toFixed(2)}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>UPI: <strong>{s.upi_id}</strong></span>
                        <button 
                          onClick={() => handleCopyUpi(s.upi_id)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', background: copiedUpi === s.upi_id ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', borderColor: copiedUpi === s.upi_id ? 'var(--color-primary)' : 'var(--border-color)' }}
                        >
                          {copiedUpi === s.upi_id ? 'Copied' : 'Copy UPI'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // VIEW 2: SPLITWISE STYLE OUT-OF-POCKET EXPENSES LEDGER
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }} className="responsive-grid-pool">
          
          {/* Left Card: Ledger Balance */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Shared Log Ledger</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Shared Out-of-pocket: <strong>₹{(shared_spend || 0).toFixed(2)}</strong>. Average share: <strong>₹{(average_share || 0).toFixed(2)}</strong> per member.</p>
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
                  {sharedBalances.map(b => (
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
              <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Shared Log Transfers</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Non-confrontational transfers to settle the shared out-of-pocket log.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {sharedSettlements.length === 0 ? (
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 0' }}>
                  <Check size={36} style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
                  <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>All Settled Up!</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Everyone has paid their exact share of logged expenses.</p>
                </div>
              ) : (
                sharedSettlements.map((s, idx) => (
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
                        {copiedUpi === s.upi_id ? 'Copied' : 'Copy UPI'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Settlements;
