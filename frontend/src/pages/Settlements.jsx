import React, { useState, useEffect } from 'react';
import { Landmark, ArrowRight, Download, Check, Copy, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Settlements({ analytics, token, onRefresh, isOffline, room, expenses }) {
  const [copiedUpi, setCopiedUpi] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [loadingPool, setLoadingPool] = useState(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Load monthly pool contributions
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

  const { month } = analytics;

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

  // Breakdown maths: Base Pool Share vs Extra Due Split
  const extraDue = deficit / memberList.length;
  const poolBaseShare = (totalSpent > startingPool)
    ? (startingPool / memberList.length)
    : poolFairShare;

  const poolBalances = memberList.map(m => {
    const contributed = contributions
      .filter(c => String(c.user_id) === String(m.id))
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    
    // Net balance = contributed - (baseShare + extraDue)
    const balance = contributed - poolFairShare;

    return {
      user_id: m.id,
      name: m.name,
      avatar: m.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.name}`,
      upi_id: m.upi_id || `${m.name.toLowerCase()}@okaxis`,
      contributed,
      baseShare: poolBaseShare,
      extraDue,
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
      
      {/* Top Header & Exporters */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Monthly Pool Settlements</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Prepaid budget pool reconciliation and deficit distribution for {currentMonthName}.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-secondary" 
            onClick={() => handleExport('pdf')}
            disabled={exportLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
          >
            Export PDF
          </button>
          
          <button 
            className="btn-secondary" 
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Deficit Alert Warning Banner */}
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
            {deficit > 0 ? 'Pool Deficit Alert' : 'Pool Surplus (Within Budget)'}
          </span>
          <p style={{ color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
            {deficit > 0 
              ? `Expenses (₹${totalSpent.toLocaleString()}) exceeded the monthly pool (₹${startingPool.toLocaleString()}) by ₹${deficit.toLocaleString()}. An extra ₹${extraDue.toFixed(2)} is distributed to each member.`
              : `Total room expenses (₹${totalSpent.toLocaleString()}) are fully covered by the pool (₹${startingPool.toLocaleString()}) with a surplus of ₹${(startingPool - totalSpent).toLocaleString()} remaining.`}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Left Card: Pool Ledger Table */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Contributions & Dues Ledger</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Prepaid pool deposits compared against base shares and extra expenses splits.</p>
          </div>

          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 6px' }}>Member</th>
                  <th style={{ padding: '10px 6px' }}>Contributed</th>
                  <th style={{ padding: '10px 6px' }}>Base Pool Share</th>
                  <th style={{ padding: '10px 6px' }}>Extra Due</th>
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
                    <td style={{ padding: '12px 6px', color: 'var(--text-secondary)' }}>₹{b.baseShare.toFixed(2)}</td>
                    <td style={{ padding: '12px 6px', color: b.extraDue > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }}>
                      ₹{b.extraDue.toFixed(2)}
                    </td>
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

        {/* Right Card: Rebalancing Transfers */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Peer-to-peer Settlements</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>UPI transfer instructions to balance the ledger and clear extra spend deficits.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {poolSettlementsList.length === 0 ? (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 0' }}>
                <Check size={36} style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
                <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px' }}>All Settled Up!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>All members contributed their exact split. No transfers required.</p>
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
  );
}

export default Settlements;
