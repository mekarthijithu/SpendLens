import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, ComposedChart } from 'recharts';
import { TrendingUp, Sparkles, AlertTriangle, Landmark, Apple, Heart, Activity } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', 
  '#a855f7', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16', 
  '#eab308', '#64748b'
];

function Analytics({ analytics, token, isOffline, expenses, room }) {
  if (!analytics) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading financial charts...</p>
      </div>
    );
  }

  const [contributions, setContributions] = useState([]);
  const [dietGoal, setDietGoal] = useState('balanced'); // 'muscle_gain' | 'weight_loss' | 'balanced'
  
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  
  useEffect(() => {
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
      try {
        const res = await fetch(`${API_BASE}/api/budgets/pool?month=${currentMonthStr}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setContributions(data);
        }
      } catch (err) {
        console.error("Error loading pool inside Analytics:", err);
      }
    };
    fetchContributions();
  }, [token, isOffline, room?.id]);

  const getDietRecommendation = () => {
    const activeExpenses = (expenses || []).filter(e => (e.date || '').slice(0, 7) === currentMonthStr);
    const totalSpent = activeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const startingPool = contributions.reduce((sum, c) => sum + (c.amount || 0), 0) || 30000;
    const remaining = startingPool - totalSpent;
    
    const today = new Date();
    const currentDay = today.getDate();
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, totalDays - currentDay);
    
    const dailyAllowance = remaining / daysLeft;
    
    let status = 'healthy';
    let statusText = 'Healthy Surplus';
    let statusColor = 'var(--color-primary)';
    
    if (remaining <= 5000 || dailyAllowance < 150) {
      status = 'critical';
      statusText = 'Critical Budget';
      statusColor = 'var(--color-danger)';
    } else if (dailyAllowance < 450) {
      status = 'moderate';
      statusText = 'Moderate / Balanced';
      statusColor = 'var(--color-accent)';
    }
    
    const recommendations = {
      muscle_gain: {
        tips: [
          "With a healthy pool budget remaining, focus on premium high-quality proteins.",
          "Integrate fresh chicken breasts, lean fish cuts, paneer, and Greek yogurt into daily meals.",
          "Consuming 3-4 whole eggs daily will provide excellent healthy fats and high biological-value protein."
        ],
        shopping: [
          { item: "Whole Eggs", qty: "24 eggs / week", cost: "₹180" },
          { item: "Chicken Breast / Fish", qty: "2 kg", cost: "₹500" },
          { item: "Paneer (Low Fat)", qty: "1 kg", cost: "₹400" },
          { item: "Double Toned Milk", qty: "7 Liters", cost: "₹350" }
        ],
        banner: "High protein bulk is fully affordable this week. Focus on lean mass building!"
      },
      weight_loss: {
        tips: [
          "Healthy budget surplus: buy low-calorie volume foods to fill you up.",
          "Fill up on leafy greens, colored bell peppers, broccoli, and exotic seasonal fruits.",
          "Utilize lean fish cuts and egg whites for protein slots while maintaining a calorie deficit."
        ],
        shopping: [
          { item: "Whole Eggs", qty: "12 eggs / week", cost: "₹90" },
          { item: "Leafy Greens & Peppers", qty: "3 kg", cost: "₹240" },
          { item: "Exotic Fruits (Apples, Berries)", qty: "2 kg", cost: "₹350" },
          { item: "Rolled Oats (Bulk)", qty: "1 kg", cost: "₹160" }
        ],
        banner: "Calorie deficit volume eating is easy. Stock up on healthy fresh produce and fiber!"
      },
      balanced: {
        tips: [
          "Budget is healthy. Maintain a rich, balanced diet with premium ingredients.",
          "Include diverse carbohydrates (brown rice, whole wheat atta) and healthy fats (almonds, walnuts).",
          "Incorporate moderate servings of paneer, vegetables, and fruit variety."
        ],
        shopping: [
          { item: "Whole Eggs", qty: "12 eggs / week", cost: "₹90" },
          { item: "Whole Wheat Atta / Brown Rice", qty: "3 kg", cost: "₹160" },
          { item: "Mixed Nuts (Almonds, Walnuts)", qty: "500 g", cost: "₹350" },
          { item: "Paneer & Green Vegetables", qty: "2 kg", cost: "₹280" }
        ],
        banner: "A rich, balanced diet is fully within budget. Balance dynamic macronutrients easily."
      }
    };
    
    const database = {
      muscle_gain: {
        healthy: recommendations.muscle_gain,
        moderate: {
          tips: [
            "Remaining budget is moderate. Shift focus to high-value, cost-efficient proteins.",
            "Purchase whole chicken or chicken drumsticks (significantly cheaper than boneless breasts).",
            "Use low-cost Greek yogurt or local curd for probiotics and dairy protein slots."
          ],
          shopping: [
            { item: "Whole Eggs", qty: "18 eggs / week", cost: "₹135" },
            { item: "Whole Chicken / Drumsticks", qty: "1.5 kg", cost: "₹300" },
            { item: "Fresh Local Curd", qty: "3 kg", cost: "₹180" },
            { item: "Double Toned Milk", qty: "5 Liters", cost: "₹250" }
          ],
          banner: "Moderate budget: prioritize bulk eggs and whole chicken to sustain protein goals without overspending."
        },
        critical: {
          tips: [
            "Budget is highly critical. Rely heavily on plant-based protein boosters.",
            "Incorporate Soy chunks (52% protein content, extremely cheap) and Kala Chana (black chickpea) sprouts.",
            "Use standard brown lentils (dal) and keep egg consumption to a steady 2 eggs/day."
          ],
          shopping: [
            { item: "Whole Eggs", qty: "12 eggs / week", cost: "₹90" },
            { item: "Soy Chunks / Nutrela", qty: "1 kg", cost: "₹110" },
            { item: "Lentils / Chickpeas (Raw)", qty: "2 kg", cost: "₹220" },
            { item: "Toned Milk", qty: "3 Liters", cost: "₹150" }
          ],
          banner: "Critical budget alert: cut premium dairy and meat. Rebuild target macros using soy chunks, dal, and cheap eggs."
        }
      },
      weight_loss: {
        healthy: recommendations.weight_loss,
        moderate: {
          tips: [
            "Budget is balanced: stick to affordable local volume vegetables (cabbage, cucumber, carrots).",
            "Purchase local seasonal fruits (bananas, papayas, local apples) instead of imported berries.",
            "Eggs and sprouts remain your best budget-friendly low-calorie fillers."
          ],
          shopping: [
            { item: "Whole Eggs", qty: "12 eggs / week", cost: "₹90" },
            { item: "Cabbage, Cucumber, Carrots", qty: "3 kg", cost: "₹150" },
            { item: "Local Fruits (Papaya, Banana)", qty: "3 kg", cost: "₹160" },
            { item: "Green Gram / Sprouts", qty: "1 kg", cost: "₹100" }
          ],
          banner: "Select local fiber sources and sprouts to keep full and save dynamic cash."
        },
        critical: {
          tips: [
            "Critical budget constraint: optimize fiber volume at the lowest cost point.",
            "Base your meals on high-volume vegetables like cabbage and cheap cucumbers.",
            "Drink plenty of water and use cheap eggs as your main clean protein."
          ],
          shopping: [
            { item: "Whole Eggs", qty: "8 eggs / week", cost: "₹60" },
            { item: "Cabbage / Carrots / Onions", qty: "3 kg", cost: "₹110" },
            { item: "Local Sprouts (Raw)", qty: "1 kg", cost: "₹90" },
            { item: "Peanuts (Roasted)", qty: "500 g", cost: "₹70" }
          ],
          banner: "Critical tier: stay hydrated. Focus on cabbage, onions, sprouts, and basic eggs to maintain nutritional balance."
        }
      },
      balanced: {
        healthy: recommendations.balanced,
        moderate: {
          tips: [
            "Moderate budget: focus on whole food staples like wheat flour, white rice, and local lentils.",
            "Maintain moderate egg consumption and focus on seasonal green leafy vegetables (spinach, coriander).",
            "Include roasted chana as a highly nutritional, low-cost mid-day snack."
          ],
          shopping: [
            { item: "Whole Eggs", qty: "10 eggs / week", cost: "₹75" },
            { item: "Standard Atta / Rice", qty: "3 kg", cost: "₹120" },
            { item: "Yellow Moong / Masoor Dal", qty: "1.5 kg", cost: "₹180" },
            { item: "Green Leafy Veg & Spinach", qty: "2 kg", cost: "₹120" }
          ],
          banner: "Standard staples (dal-chawal, roti-sabzi) are fully covered. Keep snacks budget-friendly."
        },
        critical: {
          tips: [
            "Critical budget tier: prioritize simple carbs and legume proteins to sustain daily energy.",
            "Favour simple Khichdi (rice, dal, and minimal veggies) as it is highly nutritious and extremely cheap.",
            "Stick to absolute basic vegetables like potatoes and onions to keep expenses minimal."
          ],
          shopping: [
            { item: "Whole Eggs", qty: "6 eggs / week", cost: "₹45" },
            { item: "Basic White Rice / Wheat", qty: "4 kg", cost: "₹140" },
            { item: "Masoor Dal (Red Lentil)", qty: "1 kg", cost: "₹110" },
            { item: "Potatoes & Onions", qty: "3 kg", cost: "₹90" }
          ],
          banner: "Critical budget: focus on simple Khichdi and basic carbs to carry you through the month sustainably."
        }
      }
    };
    
    const goalData = database[goal] || database.balanced;
    const details = goalData[status] || goalData.balanced;
    
    return {
      remaining,
      daysLeft,
      dailyAllowance,
      statusText,
      statusColor,
      status,
      ...details
    };
  };

  const rec = getDietRecommendation();

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

      {/* AI Diet & Health Budget Assistant */}
      <div className="card" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Apple size={22} style={{ color: 'var(--color-secondary)' }} />
            <div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>AI Diet & Health Assistant</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0 0' }}>Smart nutritional suggestions mapped to your remaining household budget.</p>
            </div>
          </div>

          {/* Goal Selector Buttons */}
          <div className="goal-selector-buttons" style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {[
              { id: 'balanced', label: '🌾 Balanced Sabzi/Roti', icon: '🌾' },
              { id: 'muscle_gain', label: '🍗 Muscle Gain', icon: '🍗' },
              { id: 'weight_loss', label: '🥗 Weight Loss', icon: '🥗' }
            ].map(g => (
              <button
                key={g.id}
                onClick={() => setDietGoal(g.id)}
                style={{
                  background: dietGoal === g.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: 'none',
                  color: dietGoal === g.id ? '#fff' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  fontSize: '11.5px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: dietGoal === g.id ? 'bold' : '500',
                  transition: 'all 0.2s'
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Budget Alert Banner */}
        <div style={{ padding: '12px 16px', background: rec.status === 'critical' ? 'rgba(239,68,68,0.08)' : rec.status === 'moderate' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', borderLeft: `4px solid ${rec.statusColor}`, borderRadius: 'var(--radius-sm)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Activity size={16} style={{ color: rec.statusColor }} />
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: rec.statusColor, textTransform: 'uppercase' }}>
              {rec.statusText} Status (₹{Math.round(rec.remaining).toLocaleString()} left, {rec.daysLeft} days remaining)
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
            {rec.banner}
          </p>
        </div>

        {/* Split Recommendations: Left tips, Right suggested groceries */}
        <div className="grid-2-col">
          {/* Left panel: Diet & Health Tips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '14px', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Heart size={14} style={{ color: 'var(--color-danger)' }} /> AI Nutritional Tips for the Week
            </h4>
            <ul style={{ paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '8px', margin: 0 }}>
              {rec.tips.map((tip, idx) => (
                <li key={idx} style={{ lineHeight: '1.4' }}>{tip}</li>
              ))}
            </ul>
          </div>

          {/* Right panel: Suggested Grocery list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '14px', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              🛒 Suggested Grocery list
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rec.shopping.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.item}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Suggested Qty: {item.qty}</span>
                  </div>
                  <strong style={{ fontSize: '13px', color: 'var(--color-primary)' }}>{item.cost}</strong>
                </div>
              ))}
            </div>
          </div>
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
