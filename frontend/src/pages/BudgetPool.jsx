import React, { useState, useEffect } from 'react';
import { Landmark, TrendingUp, AlertTriangle, Sparkles, Check, Plus, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_OFFLINE_CONTRIBUTIONS = [
  { id: 1, user_id: 1, user_name: 'Akhil', amount: 20000, month: new Date().toISOString().slice(0, 7) },
  { id: 2, user_id: 2, user_name: 'Vikas', amount: 15000, month: new Date().toISOString().slice(0, 7) },
  { id: 3, user_id: 3, user_name: 'Jithu', amount: 15000, month: new Date().toISOString().slice(0, 7) },
];

function BudgetPool({ expenses, isOffline, room, token, user }) {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonthName, setSelectedMonthName] = useState(() => {
    return MONTH_NAMES[new Date().getMonth()];
  });

  const getMonthStrFromName = (name) => {
    const monthIndex = MONTH_NAMES.indexOf(name);
    if (monthIndex === -1) return new Date().toISOString().slice(0, 7);
    const monthNum = String(monthIndex + 1).padStart(2, '0');
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${monthNum}`;
  };

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Load contributions
  const fetchContributions = async () => {
    if (isOffline) {
      const saved = localStorage.getItem('monthly_pool_contributions');
      if (saved) {
        setContributions(JSON.parse(saved));
      } else {
        setContributions(DEFAULT_OFFLINE_CONTRIBUTIONS);
        localStorage.setItem('monthly_pool_contributions', JSON.stringify(DEFAULT_OFFLINE_CONTRIBUTIONS));
      }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/budgets/pool?month=${currentMonthStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContributions(data);
      }
    } catch (err) {
      console.error("Error fetching pool contributions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load contributions
  useEffect(() => {
    fetchContributions();
  }, [token, isOffline, room?.id]);

  // Set default selected user when room members or current user details are available
  useEffect(() => {
    if (room?.members?.length > 0) {
      const hasUser = room.members.some(m => String(m.id) === String(user?.id));
      setSelectedUserId(String(hasUser ? user.id : room.members[0].id));
    }
  }, [room?.members, user?.id]);

  // Calculate starting pool as the sum of contributions
  const startingPool = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);

  // Filter expenses that are in the current month
  const currentMonthExpenses = expenses.filter(exp => (exp.date || '').slice(0, 7) === currentMonthStr);
  const totalSpend = currentMonthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const remainingAmount = startingPool - totalSpend;
  const pctUsed = startingPool > 0 ? Math.min(100, Math.round((totalSpend / startingPool) * 100)) : 0;

  // AI Burn Rate Forecasting
  const today = new Date();
  const currentDay = today.getDate();
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dailyBurnRate = currentDay > 0 ? totalSpend / currentDay : totalSpend;
  const expectedMonthSpend = dailyBurnRate * totalDays;
  const expectedRemaining = startingPool - expectedMonthSpend;
  const isOverBudgetRisk = startingPool > 0 && expectedMonthSpend > startingPool;
  
  // Calculate run out day
  const runOutDay = isOverBudgetRisk && dailyBurnRate > 0 && startingPool > 0
    ? Math.floor(startingPool / dailyBurnRate)
    : null;

  const handleAddContribution = async (e) => {
    e.preventDefault();
    const userIdVal = selectedUserId || (room?.members?.length > 0 ? String(room.members[0].id) : '');
    if (!amountInput || isNaN(amountInput) || parseFloat(amountInput) <= 0 || !userIdVal) return;
    
    setSubmitting(true);
    const amount = parseFloat(amountInput);
    const targetMonth = getMonthStrFromName(selectedMonthName);

    if (isOffline) {
      const selectedMember = room?.members?.find(m => String(m.id) === userIdVal) || { name: 'Offline Member' };
      const newContribution = {
        id: Date.now(),
        user_id: parseInt(userIdVal),
        user_name: selectedMember.name,
        amount,
        month: targetMonth,
        created_at: new Date().toISOString()
      };
      const updated = [newContribution, ...contributions];
      setContributions(updated);
      localStorage.setItem('monthly_pool_contributions', JSON.stringify(updated));
      setAmountInput('');
      setSelectedMonthName(MONTH_NAMES[new Date().getMonth()]);
      setIsAdding(false);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/budgets/pool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: parseInt(userIdVal),
          amount,
          month: targetMonth
        })
      });

      if (res.ok) {
        setAmountInput('');
        setSelectedMonthName(MONTH_NAMES[new Date().getMonth()]);
        setIsAdding(false);
        fetchContributions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteContribution = async (id) => {
    if (!confirm('Are you sure you want to delete this pool contribution?')) return;

    if (isOffline) {
      const updated = contributions.filter(c => c.id !== id);
      setContributions(updated);
      localStorage.setItem('monthly_pool_contributions', JSON.stringify(updated));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/budgets/pool/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchContributions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Top Section */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Monthly Budget Pool</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Track your monthly budget and forecast remaining runway for {currentMonthName}.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {isAdding ? (
            <form onSubmit={handleAddContribution} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select 
                value={selectedUserId || (room?.members?.length > 0 ? String(room.members[0].id) : '')} 
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px', width: '150px' }}
                required
              >
                {(room?.members || []).map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <select 
                value={selectedMonthName} 
                onChange={(e) => setSelectedMonthName(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px', width: '130px' }}
                required
              >
                {MONTH_NAMES.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <input 
                type="number" 
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Amount (₹)"
                style={{ padding: '8px 12px', fontSize: '13px', width: '130px' }}
                autoFocus
                required
              />
              <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={16} /> Add
              </button>
              <button type="button" className="btn-secondary" onClick={() => setIsAdding(false)} style={{ padding: '8px 12px' }}>
                Cancel
              </button>
            </form>
          ) : (
            <button 
              className="btn-primary" 
              onClick={() => setIsAdding(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
            >
              <Plus size={16} /> Add Money to Pool
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        {/* Metric 1: Starting Pool */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-secondary)', borderRadius: 'var(--radius-md)' }}>
            <Landmark size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Monthly Pool</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0' }}>₹{startingPool.toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From {contributions.length} contributions</span>
          </div>
        </div>

        {/* Metric 2: Total Spent */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Spent</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0', color: 'var(--color-danger)' }}>₹{totalSpend.toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{currentMonthExpenses.length} expenses logged</span>
          </div>
        </div>

        {/* Metric 3: Remaining Pool */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            padding: '12px', 
            background: remainingAmount >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            color: remainingAmount >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', 
            borderRadius: 'var(--radius-md)' 
          }}>
            <Landmark size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Remaining Pool</span>
            <h3 style={{ 
              fontSize: '24px', margin: '4px 0 2px 0', 
              color: remainingAmount >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'
            }}>
              ₹{remainingAmount.toLocaleString('en-IN')}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {remainingAmount >= 0 ? 'Surplus balance' : 'Deficit (over budget)'}
            </span>
          </div>
        </div>

        {/* Metric 4: Burn Rate */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-accent)', borderRadius: 'var(--radius-md)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Daily Burn Rate</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0', color: 'var(--color-accent)' }}>₹{Math.round(dailyBurnRate).toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average spend per day</span>
          </div>
        </div>
      </div>

      {/* Main Budget Analysis Splits */}
      <div className="responsive-grid-pool">
        
        {/* Left Side: Progress & Forecasting */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Progress Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Budget Exhaustion Progress</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>You have consumed {pctUsed}% of your monthly pool budget.</p>
            </div>
            
            <div style={{ padding: '12px 0' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', height: '20px', width: '100%', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div 
                  style={{ 
                    width: `${pctUsed}%`, 
                    height: '100%', 
                    background: pctUsed > 85 ? 'var(--color-danger)' : pctUsed > 60 ? 'var(--color-accent)' : 'var(--color-primary)', 
                    transition: 'width 0.5s ease-in-out' 
                  }}
                ></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span>Spent: ₹{totalSpend.toLocaleString('en-IN')}</span>
                <span>Limit: ₹{startingPool.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* AI Forecasting & Burn Analysis */}
          <div className="card" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sparkles size={18} style={{ color: 'var(--color-secondary)' }} />
              <h3 style={{ fontSize: '16px' }}>Predictive Spend Analytics</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Days Elapsed:</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{currentDay} of {totalDays} days ({Math.round((currentDay/totalDays)*100)}%)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Expected Spend (Month End):</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: isOverBudgetRisk ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                  ₹{Math.round(expectedMonthSpend).toLocaleString('en-IN')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Projected Surplus/Deficit:</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: expectedRemaining >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                  {expectedRemaining >= 0 ? '+' : ''}₹{Math.round(expectedRemaining).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* AI Warning or Success alert */}
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: 'var(--radius-sm)', background: isOverBudgetRisk ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)', borderLeft: `3px solid ${isOverBudgetRisk ? 'var(--color-danger)' : 'var(--color-primary)'}`, display: 'flex', gap: '10px' }}>
              {isOverBudgetRisk ? (
                <>
                  <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Exhaustion Risk Detected</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                      At the current rate of ₹{Math.round(dailyBurnRate)}/day, you will exceed the ₹{startingPool.toLocaleString()} budget pool by ₹{Math.round(Math.abs(expectedRemaining)).toLocaleString()}. 
                      {runOutDay && ` You are projected to run out of money on Day ${runOutDay} of this month.`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Check size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Healthy Spend Pace</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                      Your spending is under control! At the current pace, you will finish the month with a surplus of approximately ₹{Math.round(expectedRemaining).toLocaleString()}.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Contributions Ledger List */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Pool Contributions Ledger</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Members who have added money to this month's pool.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
              {loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>Loading ledger...</p>
              ) : contributions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>No contributions have been added yet.</p>
              ) : (
                contributions.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>💰</span>
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600 }}>{item.user_name}</h4>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Contributed</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--color-primary)' }}>₹{item.amount.toLocaleString('en-IN')}</strong>
                      <button 
                        onClick={() => handleDeleteContribution(item.id)}
                        style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', padding: '2px', cursor: 'pointer' }}
                        title="Delete Contribution"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Contributing Transactions list */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Contributing Expenses</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>List of expenses registered in the current month.</p>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '550px', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
            {currentMonthExpenses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>No expenses logged for this month.</p>
            ) : (
              currentMonthExpenses.map(exp => (
                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 500 }}>{exp.vendor}</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{exp.date} • {exp.category}</span>
                  </div>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>₹{exp.amount}</strong>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default BudgetPool;
