import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ComposedChart } from 'recharts';
import { TrendingUp, Sparkles, AlertTriangle, Landmark } from 'lucide-react';

const COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', 
  '#a855f7', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16', 
  '#eab308', '#64748b'
];

function Analytics({ analytics, token }) {
  if (!analytics) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading financial charts...</p>
      </div>
    );
  }

  const {
    total_spend,
    category_share,
    vendor_breakdown,
    trends,
    prediction_band,
    predictions
  } = analytics;

  // Custom tooltips for Recharts
  const renderCustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{payload[0].name}</p>
          <p style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            ₹{(payload[0].value || 0).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Process historical trend and append next month predictions
  // The API returns historical trends in `trends` (list of objects: {month: 'YYYY-MM', cat1: val, cat2: val}).
  // It also returns the predictions list.
  // Let's create data points for a Composed Trend Chart.
  // We can select the top 3 categories to show in the line trend to avoid visual clutter,
  // or show total monthly spend trend with prediction intervals!
  // Let's show Total Monthly Spend Trend with its prediction interval band for next month.
  // To do this, let's sum category values for historical months, and use predicted total with CI for next month:
  const trendData = trends.map(t => {
    // Sum all categories in the trend
    const month = t.month;
    let total = 0;
    Object.keys(t).forEach(k => {
      if (k !== 'month' && k !== 'is_prediction') {
        total += (t[k] || 0);
      }
    });
    return {
      month,
      amount: total,
      is_prediction: false,
      lower: total,
      upper: total
    };
  });

  // Append next month prediction onto the trend lines
  if (prediction_band && trendData.length > 0) {
    const nextMonth = prediction_band.month;
    const forecasts = prediction_band.forecasts;
    const lowers = prediction_band.lower_bounds;
    const uppers = prediction_band.upper_bounds;
    
    let pred_total = 0;
    let pred_lower = 0;
    let pred_upper = 0;
    
    Object.keys(forecasts).forEach(k => {
      if (k !== 'month' && k !== 'is_prediction') {
        pred_total += forecasts[k] || 0;
        pred_lower += lowers[k] || 0;
        pred_upper += uppers[k] || 0;
      }
    });

    // To connect the line smoothly, we add the predicted month
    trendData.push({
      month: nextMonth + ' (AI)',
      amount: Math.round(pred_total),
      is_prediction: true,
      lower: Math.round(pred_lower),
      upper: Math.round(pred_upper)
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Time-series forecasting textual ticker */}
      <div className="card" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Sparkles size={20} style={{ color: 'var(--color-primary)', animation: 'float 3s ease-in-out infinite' }} />
          <h3 style={{ fontSize: '18px' }}>Bachelor Home Predictive Intelligence</h3>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          By processing historical transaction frequencies and seasonal spikes, the machine learning pipeline forecasts next month's categories:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {predictions && predictions.length > 0 ? (
            predictions.map((p, idx) => (
              <div key={idx} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <span style={{ textTransform: 'capitalize', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.category} Forecast</span>
                <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '4px 0', color: 'var(--color-primary)' }}>
                  ₹{(p.predicted_amount || 0).toFixed(2)}
                </p>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Expected range: ₹{(p.confidence_lower || 0).toFixed(0)} - ₹{(p.confidence_upper || 0).toFixed(0)}
                </span>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Log more historical data to generate forecasting models.</p>
          )}
        </div>
      </div>

      {/* Main Charts Split */}
      <div className="responsive-grid-equal">
        
        {/* Pie Chart: Category share */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '420px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Category Share breakdown</h3>
          
          <div style={{ flex: 1, minHeight: 0 }}>
            {(category_share || []).length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No categories logged yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={category_share || []}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {(category_share || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={renderCustomTooltip} />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconSize={10}
                    iconType="circle"
                    formatter={(value) => <span style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart: Vendor spend */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '420px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Vendor-level spend (Zepto vs Blinkit vs local)</h3>
          
          <div style={{ flex: 1, minHeight: 0 }}>
            {(vendor_breakdown || []).length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No vendor data available.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendor_breakdown || []} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="vendor" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                            <p style={{ fontSize: '12px', fontWeight: 600 }}>{payload[0].payload.vendor}</p>
                            <p style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: 'bold' }}>₹{(payload[0].value || 0).toFixed(2)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {(vendor_breakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.vendor.toLowerCase().includes('zepto') ? '#eab308' : entry.vendor.toLowerCase().includes('blinkit') ? '#10b981' : entry.vendor.toLowerCase().includes('swiggy') ? '#f97316' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Historical Trend Composed Chart */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '380px' }}>
        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>6-Month Room Spend Trend & Next-Month Forecast</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>The shaded region represents the ML confidence range (upper/lower margin limits).</p>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {trendData.length === 0 ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Not enough historical months data to generate trend.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const isPred = payload[0].payload.is_prediction;
                      return (
                        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isPred ? 'AI Prediction Month' : 'Historical Month'}</p>
                          <p style={{ fontSize: '13px', fontWeight: 'bold' }}>{payload[0].payload.month}</p>
                          <p style={{ fontSize: '13px', color: 'var(--color-secondary)', fontWeight: 'bold', margin: '4px 0 2px 0' }}>
                            {isPred ? 'Forecasted Total: ' : 'Total Spend: '} ₹{(payload[0].value || 0).toLocaleString('en-IN')}
                          </p>
                          {isPred && (
                            <span style={{ fontSize: '10px', color: 'var(--color-primary)' }}>
                              Confidence Interval: ₹{(payload[0].payload.lower || 0).toLocaleString('en-IN')} - ₹{(payload[0].payload.upper || 0).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Confidence Interval band for next month */}
                <Area 
                  type="monotone" 
                  dataKey="upper"
                  stroke="none"
                  fill="rgba(99, 102, 241, 0.12)"
                  activeDot={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="lower"
                  stroke="none"
                  fill="var(--bg-card)"
                  activeDot={false}
                />

                {/* Spend value line */}
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="var(--color-secondary)" 
                  strokeWidth={3}
                  dot={{ r: 4, stroke: 'var(--bg-primary)', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
}

export default Analytics;
