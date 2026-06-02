import React, { useState } from 'react';
import { Landmark, ArrowRight, TrendingUp, AlertTriangle, Sparkles, Check, DollarSign } from 'lucide-react';

function BudgetPool({ expenses, isOffline }) {
  const [startingPoolInput, setStartingPoolInput] = useState('');
  const [startingPool, setStartingPool] = useState(() => {
    const saved = localStorage.getItem('monthly_pool_limit');
    return saved ? parseFloat(saved) : 50000;
  });
  const [isUpdatingPool, setIsUpdatingPool] = useState(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Filter expenses that are in the current month
  const currentMonthExpenses = expenses.filter(exp => (exp.date || '').slice(0, 7) === currentMonthStr);
  const totalSpend = currentMonthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const remainingAmount = startingPool - totalSpend;
  const pctUsed = Math.min(100, Math.round((totalSpend / startingPool) * 100));

  // AI Burn Rate Forecasting
  const today = new Date();
  const currentDay = today.getDate();
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dailyBurnRate = currentDay > 0 ? totalSpend / currentDay : totalSpend;
  const expectedMonthSpend = dailyBurnRate * totalDays;
  const expectedRemaining = startingPool - expectedMonthSpend;
  const isOverBudgetRisk = expectedMonthSpend > startingPool;
  
  // Calculate run out day
  const runOutDay = isOverBudgetRisk && dailyBurnRate > 0 
    ? Math.floor(startingPool / dailyBurnRate)
    : null;

  const handleUpdatePool = (e) => {
    e.preventDefault();
    if (!startingPoolInput || isNaN(startingPoolInput) || parseFloat(startingPoolInput) <= 0) return;
    const value = parseFloat(startingPoolInput);
    setStartingPool(value);
    localStorage.setItem('monthly_pool_limit', value.toString());
    setStartingPoolInput('');
    setIsUpdatingPool(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Export Section */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Monthly Budget Pool</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Track your monthly budget and forecast remaining runway for {currentMonthName}.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {isUpdatingPool ? (
            <form onSubmit={handleUpdatePool} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="number" 
                value={startingPoolInput}
                onChange={(e) => setStartingPoolInput(e.target.value)}
                placeholder="Starting Amount (₹)"
                style={{ padding: '8px 12px', fontSize: '13px', width: '180px' }}
                autoFocus
                required
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={16} /> Save
              </button>
              <button type="button" className="btn-secondary" onClick={() => setIsUpdatingPool(false)} style={{ padding: '8px 12px' }}>
                Cancel
              </button>
            </form>
          ) : (
            <button 
              className="btn-primary" 
              onClick={() => setIsUpdatingPool(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
            >
              <Landmark size={16} /> Set Monthly Pool
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
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Starting Monthly Pool</span>
            <h3 style={{ fontSize: '24px', margin: '4px 0 2px 0' }}>₹{startingPool.toLocaleString('en-IN')}</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Initial allocation</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        
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
        </div>

        {/* Right Side: Contributing Transactions list */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Contributing Expenses</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>List of expenses registered in the current month.</p>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
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
