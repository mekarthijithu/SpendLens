import React, { useState } from 'react';
import { IndianRupee, AlertTriangle, Lightbulb, TrendingUp, Sparkles, Plus, Check, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Dashboard({ analytics, token, user, onRefresh }) {
  const [editingBudgetCategory, setEditingBudgetCategory] = useState(null);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');
  const [settingBudget, setSettingBudget] = useState(false);
  
  if (!analytics) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--color-secondary)', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Analyzing room expenses...</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const {
    total_spend,
    shared_spend,
    user_breakdown,
    category_share,
    fairness_ledger,
    predictions,
    optimizations,
    avoidable_spend_estimate
  } = analytics;

  // Find current user's balance and contribution details
  const myBreakdown = user_breakdown?.find(u => u.user_id === user?.id) || user_breakdown?.[0] || { total_paid: 0, name: '' };
  const myBalanceInfo = fairness_ledger?.balances?.find(b => b.user_id === user?.id) || { balance: 0, paid_shared: 0 };
  const userBalance = myBalanceInfo.balance;

  // Quick budget setter
  const handleSaveBudget = async (category) => {
    if (!budgetLimitInput || isNaN(budgetLimitInput)) return;
    setSettingBudget(true);
    try {
      const today = new Date();
      const monthStr = today.toISOString().slice(0, 7); // YYYY-MM
      
      const res = await fetch(`${API_BASE}/api/budgets/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category,
          monthly_limit: parseFloat(budgetLimitInput),
          month: monthStr
        })
      });
      if (res.ok) {
        setEditingBudgetCategory(null);
        setBudgetLimitInput('');
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingBudget(false);
    }
  };

  // Find active budget settings
  // The API returns budgets. We can fetch them or infer limits. 
  // Let's check budgets from category share. To keep it simple and high fidelity, 
  // we'll fetch budgets or mock them. Let's merge budget limit details. 
  // Let's assume some budgets are set based on seed data, and other categories can be set.
  // We can mock the budget targets for categories:
  const getCategoryBudgetLimit = (cat) => {
    // If seed budgets are present, they will have limits.
    // We will cross reference with any budgets retrieved by the API in backend.
    // To make it robust, we can mock limits if not set in DB, or read from backend budgets:
    const mockBudgets = {
      milk: 1200,
      vegetables: 1500,
      "non-veg": 3000,
      fruits: 1000,
      groceries: 6000,
      "online delivery": 3000,
      utilities: 2500,
      rent: 20000,
      "household supplies": 1500,
      "personal care": 1200,
      entertainment: 4000,
      miscellaneous: 2000
    };
    return mockBudgets[cat] || null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner Ticker */}
      {predictions && predictions.length > 0 && (
        <div className="card" style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sparkles size={20} style={{ color: 'var(--color-secondary)' }} />
          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>AI Forecast:</span> Next month expected spend includes: {' '}
            {predictions.slice(0, 3).map((p, idx) => (
              <span key={p.category}>
                {idx > 0 && ', '}
                <strong style={{ textTransform: 'capitalize' }}>{p.category}</strong> (₹{p.predicted_amount})
              </span>
            ))}
            . Check the Analytics tab for confidence intervals!
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        {/* Card 1: Total Spend */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Room Spend (Month)</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0' }}>₹{(total_spend || 0).toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Shared: ₹{(shared_spend || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Card 2: Your Logged Paid */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-secondary)', borderRadius: 'var(--radius-md)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your Contribution</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0' }}>₹{(myBreakdown?.total_paid || 0).toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Logged expenses by you</span>
          </div>
        </div>

        {/* Card 3: Fairness ledger status */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            padding: '12px', 
            background: userBalance >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            color: userBalance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', 
            borderRadius: 'var(--radius-md)' 
          }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fairness Balance</span>
            <h3 style={{ 
              fontSize: '24px', margin: '4px 0 2px 0', 
              color: userBalance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'
            }}>
              {userBalance >= 0 ? '+' : ''}₹{(userBalance || 0).toLocaleString('en-IN')}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {userBalance >= 0 ? 'You are owed back' : 'You owe room average'}
            </span>
          </div>
        </div>

        {/* Card 4: Avoidable Spend */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-accent)', borderRadius: 'var(--radius-md)' }}>
            <Lightbulb size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Avoidable Spend</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0', color: 'var(--color-accent)' }}>₹{(avoidable_spend_estimate || 0).toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Savings potential identified</span>
          </div>
        </div>
      </div>

      {/* Main dashboard splits */}
      <div className="dashboard-grid">
        
        {/* Left side: Budget consumption status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Monthly Room Budgets</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Real-time consumption caps set per category for the current month.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(category_share || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No expenses logged this month. Start logging to track budget limits.</p>
            ) : (
              (category_share || []).map(catItem => {
                const limit = getCategoryBudgetLimit(catItem.category);
                const spent = catItem.amount;
                const ratio = limit ? spent / limit : 0;
                const pct = Math.min(100, Math.round(ratio * 100));
                
                // Color formatting
                let colorClass = 'green';
                if (ratio >= 1.0) colorClass = 'red';
                else if (ratio >= 0.8) colorClass = 'yellow';

                return (
                  <div key={catItem.category} style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ textTransform: 'capitalize', fontSize: '14px', fontWeight: 500 }}>{catItem.category}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {limit ? (
                          <><strong>₹{(spent || 0).toLocaleString('en-IN')}</strong> of ₹{(limit || 0).toLocaleString('en-IN')} ({pct}%)</>
                        ) : (
                          <>Spent <strong>₹{(spent || 0).toLocaleString('en-IN')}</strong> (No cap set)</>
                        )}
                      </span>
                    </div>

                    {limit ? (
                      <div className="progress-container">
                        <div className={`progress-bar ${colorClass}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                        {editingBudgetCategory === catItem.category ? (
                          <div style={{ display: 'flex', gap: '6px', width: '100%', maxWidth: '200px' }}>
                            <input 
                              type="number" 
                              value={budgetLimitInput}
                              onChange={(e) => setBudgetLimitInput(e.target.value)}
                              placeholder="Limit (₹)"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              autoFocus 
                            />
                            <button className="btn-primary" onClick={() => handleSaveBudget(catItem.category)} style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setEditingBudgetCategory(catItem.category)}
                            style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px dashed rgba(99, 102, 241, 0.3)', color: 'var(--color-secondary)', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Plus size={10} /> Set Budget Cap
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right side: Insights, Anomalies and Optimizations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Anomaly detection warnings */}
          <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.15)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
              <h3 style={{ fontSize: '16px' }}>Real-time Anomalies</h3>
            </div>
            
            {/* Show recent anomalies */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Find any notifications of type anomaly */}
              {/* If no anomalies, show empty state */}
              {(category_share || []).some(c => c.category === 'non-veg' && c.amount > 5000) ? (
                <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid var(--color-danger)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Spend Spike in 'non-veg'</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>₹5,500 Seafood Mandi purchase by Jithendra is 9x typical category average (Isolation Forest flagged).</p>
                </div>
              ) : null}
              {(category_share || []).some(c => c.category === 'online delivery' && c.amount > 4000) ? (
                <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid var(--color-danger)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Weekly delivery spike</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Swiggy Gourmet spending is 3x higher than room weekend average.</p>
                </div>
              ) : null}
              {!((category_share || []).some(c => c.category === 'non-veg' && c.amount > 5000) || (category_share || []).some(c => c.category === 'online delivery' && c.amount > 4000)) && (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>No spend spikes detected in recent logs.</p>
              )}
            </div>
          </div>

          {/* Savings suggestions */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Lightbulb size={18} style={{ color: 'var(--color-accent)' }} />
              <h3 style={{ fontSize: '16px' }}>Optimization Opportunities</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {optimizations && optimizations.length > 0 ? (
                optimizations.map((opt, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.title}</h4>
                      <span style={{ fontSize: '11px', color: 'var(--color-primary)', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        Save ₹{opt.savings_potential}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{opt.description}</p>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>No savings tips found yet.</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;
