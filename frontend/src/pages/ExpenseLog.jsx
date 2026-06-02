import React, { useState, useEffect } from 'react';
import { Sparkles, Upload, FileSpreadsheet, Trash2, HelpCircle, Eye, Search, Filter } from 'lucide-react';

const API_BASE = '';

const DEFAULT_CATEGORIES = [
  'vegetables', 'non-veg', 'online delivery', 'rent', 'household supplies'
];

const getLearnedCategories = (expensesList) => {
  const customCounts = {};
  (expensesList || []).forEach(exp => {
    const cat = (exp.category || '').toLowerCase().trim();
    if (cat && !['vegetables', 'non-veg', 'online delivery', 'rent', 'household supplies', 'other'].includes(cat)) {
      if (!customCounts[cat]) {
        customCounts[cat] = {
          count: 0,
          months: new Set()
        };
      }
      customCounts[cat].count += 1;
      if (exp.date) {
        customCounts[cat].months.add(exp.date.slice(0, 7));
      }
    }
  });

  const learned = [];
  Object.keys(customCounts).forEach(cat => {
    const data = customCounts[cat];
    // Learning rule: custom category is added to the list if total count >= 2
    if (data.count >= 2) {
      learned.push(cat);
    }
  });
  return learned;
};

const PAYMENT_MODES = ['UPI', 'Card', 'Cash'];

function ExpenseLog({ token, room, onRefresh, isOffline, user, expenses, setExpenses }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser, setFilterUser] = useState('');

  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('online delivery');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isShared, setIsShared] = useState(true);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  
  // OCR & Import State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');

  // Dynamically compute active category list
  const learnedCategories = getLearnedCategories(expenses);
  const dropdownCategories = [
    ...DEFAULT_CATEGORIES,
    ...learnedCategories,
    'other'
  ];

  const handleFetchExpenses = async () => {
    if (isOffline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/expenses/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchExpenses();
  }, [token, isOffline]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount)) return;

    const finalCategory = category === 'other' ? customCategoryInput.trim().toLowerCase() : category;
    if (!finalCategory) return;

    setSubmitting(true);
    
    // Parse tags (split by comma/space)
    const tagList = tags.split(/[\s,]+/).map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);

    if (isOffline) {
      const newExpense = {
        id: Date.now(),
        user_id: user?.id || 1,
        user_name: user?.name || "Jithendra Kumar (Offline)",
        amount: parseFloat(amount),
        category: finalCategory,
        vendor: vendor || 'General Vendor',
        payment_mode: paymentMode,
        date,
        is_shared: isShared,
        tags: tagList,
        notes
      };
      setExpenses(prev => [newExpense, ...prev]);
      setAmount('');
      setVendor('');
      setTags('');
      setNotes('');
      setCustomCategoryInput('');
      setCategory('online delivery');
      setIsShared(true);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/expenses/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          category: finalCategory,
          vendor: vendor || 'General Vendor',
          payment_mode: paymentMode,
          date,
          is_shared: isShared,
          tags: tagList,
          notes
        })
      });

      if (res.ok) {
        // Reset form
        setAmount('');
        setVendor('');
        setTags('');
        setNotes('');
        setCustomCategoryInput('');
        setCategory('online delivery');
        setIsShared(true);
        handleFetchExpenses();
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    if (isOffline) {
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        handleFetchExpenses();
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // OCR Upload handler
  const handleOcrFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setOcrLoading(true);
    setOcrMessage('Scanning receipt details...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/expenses/ocr`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        // Auto fill
        if (data.amount) setAmount(data.amount);
        if (data.vendor) setVendor(data.vendor);
        if (data.category && dropdownCategories.includes(data.category)) setCategory(data.category);
        if (data.date) setDate(data.date);
        if (data.payment_mode) setPaymentMode(data.payment_mode);
        
        setOcrMessage(`Successfully extracted: ₹${data.amount} from ${data.vendor} (${Math.round(data.confidence * 100)}% confidence).`);
      } else {
        setOcrMessage('Failed to scan receipt. Please enter details manually.');
      }
    } catch (err) {
      setOcrMessage('Scan connection error.');
    } finally {
      setOcrLoading(false);
    }
  };

  // CSV Import handler
  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    
    setCsvLoading(true);
    setCsvMessage('Importing transactions...');
    
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch(`${API_BASE}/api/expenses/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setCsvMessage(data.message);
        setCsvFile(null);
        // Clear input element
        document.getElementById('csv-input').value = '';
        handleFetchExpenses();
        onRefresh();
      } else {
        setCsvMessage('CSV import failed. Check file format.');
      }
    } catch (err) {
      setCsvMessage('CSV connection error.');
    } finally {
      setCsvLoading(false);
    }
  };

  // Filtering expenses
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      (exp.vendor || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = filterCategory === '' || exp.category === filterCategory;
    const matchesUser = filterUser === '' || String(exp.user_id) === filterUser;
    
    return matchesSearch && matchesCategory && matchesUser;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '32px' }}>
      
      {/* Left side: Logging Forms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Form 1: Manual Expense Log */}
        <div className="card">
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Log New Expense</h3>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label>Amount (₹) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  required 
                  placeholder="0.00" 
                />
              </div>
              
              <div>
                <label>Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {dropdownCategories.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
              {category === 'other' && (
                <div style={{ gridColumn: 'span 2', marginTop: '4px' }}>
                  <label>Custom Category Name *</label>
                  <input 
                    type="text" 
                    value={customCategoryInput} 
                    onChange={(e) => setCustomCategoryInput(e.target.value)} 
                    required 
                    placeholder="e.g. travel, medical, gym" 
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
              <div>
                <label>Vendor / Payee *</label>
                <input 
                  type="text" 
                  value={vendor} 
                  onChange={(e) => setVendor(e.target.value)} 
                  required 
                  placeholder="e.g. Zepto, Amul Store, BESCOM" 
                />
              </div>
              
              <div>
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  {PAYMENT_MODES.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label>Transaction Date *</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <input 
                type="checkbox" 
                checked={isShared} 
                onChange={(e) => setIsShared(e.target.checked)} 
                id="isShared" 
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <label htmlFor="isShared" style={{ margin: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Shared Household Expense</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Split equally among all room members. Uncheck if personal.</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <div>
                <label>Tags (space/comma separated)</label>
                <input 
                  type="text" 
                  value={tags} 
                  onChange={(e) => setTags(e.target.value)} 
                  placeholder="e.g. #bulk, #dinner" 
                />
              </div>
              
              <div>
                <label>Optional Notes</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="e.g. Guest dinner catering details..." 
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: '6px' }}>
              {submitting ? 'Logging Expense...' : 'Log Expense'}
            </button>
          </form>
        </div>

        {/* OCR Receipt Scanner */}
        <div className="card" style={{ border: '1px dashed var(--border-color)', background: 'rgba(99,102,241,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-secondary)' }} />
            <h3 style={{ fontSize: '15px' }}>OCR Smart Scan Receipt</h3>
          </div>
          
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', border: '2px dashed rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Drag & drop or click to upload a receipt photo</p>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Automatically autofills amount, category, & vendor.</span>
            
            <input 
              type="file" 
              accept="image/*,application/pdf"
              onChange={handleOcrFileChange}
              disabled={ocrLoading}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
            />
          </div>
          
          {ocrMessage && (
            <p style={{ fontSize: '11px', color: ocrMessage.includes('extracted') ? 'var(--color-primary)' : 'var(--text-secondary)', marginTop: '10px', textAlign: 'center' }}>
              {ocrLoading ? 'Scanning...' : ''} {ocrMessage}
            </p>
          )}
        </div>

        {/* CSV Import */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '15px' }}>Bulk Import CSV</h3>
          </div>
          
          <form onSubmit={handleCsvUpload} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="file" 
              id="csv-input"
              accept=".csv"
              required
              onChange={(e) => setCsvFile(e.target.files[0])}
              style={{ flex: 1, padding: '8px' }}
            />
            <button type="submit" className="btn-secondary" disabled={csvLoading || !csvFile} style={{ padding: '8px 16px', fontSize: '13px' }}>
              Import
            </button>
          </form>
          {csvMessage && (
            <p style={{ fontSize: '11px', color: csvMessage.includes('Successfully') ? 'var(--color-primary)' : 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
              {csvMessage}
            </p>
          )}
        </div>

      </div>

      {/* Right side: Detailed Log Table */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Expense Logs</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Logged history for room: {room?.name}</p>
          </div>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1, minWidth: '180px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search vendor or category..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)} 
            style={{ width: 'auto', minWidth: '130px' }}
          >
            <option value="">All Categories</option>
            {dropdownCategories.filter(c => c !== 'other').map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>

          <select 
            value={filterUser} 
            onChange={(e) => setFilterUser(e.target.value)}
            style={{ width: 'auto', minWidth: '130px' }}
          >
            <option value="">All Members</option>
            {room?.members?.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Table Container */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)', padding: '24px 0', textAlign: 'center' }}>Loading expense history...</p>
          ) : filteredExpenses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>No expenses found matching the criteria.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 8px' }}>Date</th>
                  <th style={{ padding: '12px 8px' }}>Category</th>
                  <th style={{ padding: '12px 8px' }}>Vendor</th>
                  <th style={{ padding: '12px 8px' }}>Amount</th>
                  <th style={{ padding: '12px 8px' }}>Paid By</th>
                  <th style={{ padding: '12px 8px' }}>Mode</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Shared?</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>{exp.date}</td>
                    <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>
                      <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{exp.vendor}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>₹{(exp.amount || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px 8px' }}>{exp.user_name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{exp.payment_mode}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {exp.is_shared ? '✅' : '👤'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDelete(exp.id)}
                        style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                        className="btn-trash-hover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .table-row-hover:hover {
          background: rgba(255,255,255,0.02);
        }
        .btn-trash-hover:hover {
          background: rgba(239, 68, 68, 0.1) !important;
        }
      `}</style>

    </div>
  );
}

export default ExpenseLog;
