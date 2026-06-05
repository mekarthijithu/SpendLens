import React, { useState, useEffect } from 'react';
import { Sparkles, Upload, FileSpreadsheet, Trash2, HelpCircle, Eye, Search, Filter, Lock, FileText, Image, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const DEFAULT_CATEGORIES = [
  'vegetables', 'non-veg', 'eggs', 'water', 'room rent', 'household supplies'
];

const getLearnedCategories = (expensesList) => {
  const customCounts = {};
  (expensesList || []).forEach(exp => {
    const cat = (exp.category || '').toLowerCase().trim();
    if (cat && !['vegetables', 'non-veg', 'eggs', 'water', 'room rent', 'household supplies', 'other'].includes(cat)) {
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
  const [category, setCategory] = useState('vegetables');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [deliveryType, setDeliveryType] = useState('offline');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isShared, setIsShared] = useState(true);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  
  // Receipt uploads & view lightbox
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState('');
  const [activeReceiptUrl, setActiveReceiptUrl] = useState(null);
  
  // Month selector for filter/export
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  
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
        delivery_type: deliveryType,
        date,
        is_shared: isShared,
        tags: tagList,
        notes,
        receipt_url: receiptUrl
      };
      setExpenses(prev => [newExpense, ...prev]);
      setAmount('');
      setVendor('');
      setTags('');
      setNotes('');
      setCustomCategoryInput('');
      setCategory('vegetables');
      setDeliveryType('offline');
      setIsShared(true);
      setReceiptUrl('');
      setReceiptUploadError('');
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
          delivery_type: deliveryType,
          date,
          is_shared: isShared,
          tags: tagList,
          notes,
          receipt_url: receiptUrl
        })
      });

      if (res.ok) {
        // Reset form
        setAmount('');
        setVendor('');
        setTags('');
        setNotes('');
        setCustomCategoryInput('');
        setCategory('vegetables');
        setDeliveryType('offline');
        setIsShared(true);
        setReceiptUrl('');
        setReceiptUploadError('');
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
        if (data.delivery_type) setDeliveryType(data.delivery_type);
        
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

  // Receipt File upload handler (manual entry)
  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingReceipt(true);
    setReceiptUploadError('');
    
    if (isOffline) {
      setTimeout(() => {
        setReceiptUrl('https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60');
        setUploadingReceipt(false);
      }, 800);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/expenses/upload-receipt`, {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setReceiptUrl(data.receipt_url);
      } else {
        const errorData = await res.json();
        setReceiptUploadError(errorData.detail || 'Failed to upload receipt');
      }
    } catch (err) {
      setReceiptUploadError('Connection error during upload');
      console.error(err);
    } finally {
      setUploadingReceipt(false);
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
    const matchesMonth = filterMonth === '' || (exp.date && exp.date.startsWith(filterMonth));
    
    return matchesSearch && matchesCategory && matchesUser && matchesMonth;
  });

  return (
    <div className="responsive-grid-2">
      
      {/* Left side: Logging Forms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Form 1: Manual Expense Log */}
        <div className="card">
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Log New Expense</h3>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2-col">
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
                <div className="custom-category-field" style={{ gridColumn: 'span 2', marginTop: '4px' }}>
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

            <div className="grid-3-col">
              <div>
                <label>Vendor / Payee</label>
                <input 
                  type="text" 
                  value={vendor} 
                  onChange={(e) => setVendor(e.target.value)} 
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

              <div>
                <label>Purchase Type</label>
                <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
                  <option value="offline">Offline</option>
                  <option value="online delivery">Online delivery</option>
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

            {/* Optional Receipt Attachment */}
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '12px', marginTop: '4px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Attach Receipt (Image or PDF - Optional)</label>
              
              {!receiptUrl ? (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '42px', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '4px', background: 'rgba(0,0,0,0.1)' }}>
                  {uploadingReceipt ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Uploading receipt file...</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={14} /> Choose receipt photo or PDF</span>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={handleReceiptUpload}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                      />
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '8px 12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--color-primary)' }}>📄</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {receiptUrl.split('/').pop()}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setReceiptUrl('')} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', fontSize: '11px', cursor: 'pointer', padding: '2px 6px' }}
                  >
                    Remove
                  </button>
                </div>
              )}
              {receiptUploadError && (
                <span style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '6px', display: 'block' }}>{receiptUploadError}</span>
              )}
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
          
          <form onSubmit={handleCsvUpload} className="csv-upload-form" style={{ display: 'flex', gap: '10px' }}>
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
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', alignItems: 'center' }}>
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

          <input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            style={{ width: 'auto', minWidth: '150px' }}
            title="Filter by Month"
          />

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

          <button
            type="button"
            onClick={() => {
              if (isOffline) {
                alert("Offline mode: cannot download files from backend.");
                return;
              }
              window.open(`${API_BASE}/api/analytics/export/excel?token=${token}&month=${filterMonth}`, '_blank');
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}
          >
            <FileSpreadsheet size={16} /> Export Excel
          </button>
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
                  <th style={{ padding: '12px 8px' }}>Type</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Shared?</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Receipt</th>
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
                    <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>
                      <span style={{ fontSize: '11px', color: exp.delivery_type === 'online delivery' ? 'var(--color-info)' : 'var(--text-muted)' }}>
                        {exp.delivery_type === 'online delivery' ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {exp.is_shared ? '✅' : '👤'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {exp.receipt_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const fullUrl = exp.receipt_url.startsWith('http') 
                              ? exp.receipt_url 
                              : `${API_BASE}${exp.receipt_url}`;
                            setActiveReceiptUrl(fullUrl);
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto' }}
                        >
                          <Eye size={12} /> View
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      {isOffline || String(exp.user_id) === String(user?.id) ? (
                        <button 
                          onClick={() => handleDelete(exp.id)}
                          style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                          className="btn-trash-hover"
                          title="Delete Expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'default' }} title="Read-only: Logged by another member">
                          <Lock size={12} style={{ opacity: 0.6 }} />
                          <span>Read-only</span>
                        </div>
                      )}
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

      {/* Lightbox Modal for Receipt Viewing */}
      {activeReceiptUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }} onClick={() => setActiveReceiptUrl(null)}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '100%',
            maxWidth: '640px',
            position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Expense Receipt</h3>
              <button 
                onClick={() => setActiveReceiptUrl(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ 
              background: '#090d16', 
              borderRadius: 'var(--radius-sm)', 
              minHeight: '300px', 
              maxHeight: '70vh', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              {activeReceiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={activeReceiptUrl} 
                  style={{ width: '100%', height: '500px', border: 'none' }}
                  title="Receipt PDF"
                />
              ) : (
                <img 
                  src={activeReceiptUrl} 
                  alt="Receipt Scan" 
                  style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
                />
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <a 
                href={activeReceiptUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none', textAlign: 'center' }}
              >
                Open in new tab
              </a>
              <button 
                onClick={() => setActiveReceiptUrl(null)} 
                className="btn-primary" 
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ExpenseLog;

