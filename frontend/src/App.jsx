import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ReceiptText, BarChart3, Users, Bell, LogOut, Copy, Check, Menu, Landmark, ChevronRight } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ExpenseLog from './pages/ExpenseLog';
import Analytics from './pages/Analytics';
import BudgetPool from './pages/BudgetPool';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const MEMBERS = [
  { name: 'Akhil', email: 'akhil@spendlens.com', color: '#10b981', emoji: '🟢' },
  { name: 'Vikas', email: 'vikas@spendlens.com', color: '#6366f1', emoji: '🔵' },
  { name: 'Jithu', email: 'jithu@spendlens.com', color: '#f59e0b', emoji: '🟡' },
  { name: 'Bhanu', email: 'bhanu@spendlens.com', color: '#ef4444', emoji: '🔴' },
  { name: 'Jagan', email: 'jagan@spendlens.com', color: '#0ea5e9', emoji: '🔷' },
];

const MOCK_ANALYTICS = null;

const MOCK_NOTIFICATIONS = [];

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isOffline, setIsOffline] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'waking'

  const enableOfflineMode = () => {
    setIsOffline(true);
    localStorage.setItem('token', 'mock-token');
    setToken('mock-token');
    setUser({
      id: 1,
      name: "Jithendra Kumar (Offline)",
      email: "jith@spendlens.com",
      upi_id: "jith@okaxis",
      avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Jithendra",
      room_id: 1
    });
    setRoom({
      id: 1,
      name: "B6 (Offline)",
      invite_code: "LENS99",
      members: [
        { id: 1, name: "Jithendra Kumar", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Jithendra" },
        { id: 2, name: "Alice Smith", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Alice" },
        { id: 3, name: "Bob Johnson", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Bob" },
        { id: 4, name: "Charlie Brown", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie" }
      ]
    });
    setAnalytics(MOCK_ANALYTICS);
    setNotifications(MOCK_NOTIFICATIONS);
  };
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expenses, setExpenses] = useState([]);

  const fetchExpenses = async (activeToken) => {
    if (activeToken === 'mock-token') {
      // Offline mode: no test expenses, start fresh
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/expenses/`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [upi, setUpi] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch current user and room info
  const fetchUserData = async (activeToken) => {
    if (activeToken === 'mock-token') return;
    try {
      const userRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        
        // Fetch room if user has one
        if (userData.room_id) {
          const roomRes = await fetch(`${API_BASE}/api/auth/room`, {
            headers: { Authorization: `Bearer ${activeToken}` }
          });
          if (roomRes.ok) {
            const roomData = await roomRes.json();
            setRoom(roomData);
            fetchAnalytics(activeToken);
          }
        } else {
          setRoom(null);
        }
        fetchNotifications(activeToken);
      } else {
        // Token expired
        handleLogout();
      }
    } catch (err) {
      console.error("Error fetching user data", err);
      handleLogout();
    }
  };

  const fetchNotifications = async (activeToken) => {
    if (activeToken === 'mock-token') return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async (activeToken) => {
    if (activeToken === 'mock-token') return;
    try {
      const res = await fetch(`${API_BASE}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // On mount, restore session and ping server
  useEffect(() => {
    if (token === 'mock-token') {
      setServerStatus('online');
      enableOfflineMode();
      fetchExpenses('mock-token');
      return;
    }

    const pingServer = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${API_BASE}/`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'online') {
            setServerStatus('online');
            return true;
          }
        }
      } catch (err) {
        console.log("Waiting for backend server to wake up...", err);
      }
      return false;
    };

    let intervalId;
    const initConnection = async () => {
      const ok = await pingServer();
      if (!ok) {
        setServerStatus('waking');
        intervalId = setInterval(async () => {
          const okRetry = await pingServer();
          if (okRetry) {
            clearInterval(intervalId);
          }
        }, 3000);
      }
    };
    
    initConnection();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (token && token !== 'mock-token') {
      fetchUserData(token);
      fetchExpenses(token);
      
      // Setup polling for updates (every 10s)
      const interval = setInterval(() => {
        fetchNotifications(token);
        fetchExpenses(token);
        if (room) {
          fetchAnalytics(token);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [token, room?.id]);

  const handleMemberLogin = async (member) => {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', member.email);
      params.append('password', 'password123');

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setIsOffline(false);
        fetchExpenses(data.access_token);
      } else {
        setError(data.detail || 'Login failed. Is the backend running?');
      }
    } catch (err) {
      setError('Connection failed. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Connection failed. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, upi_id: upi })
      });

      const data = await res.json();
      if (res.ok) {
        // Auto login
        const loginParams = new URLSearchParams();
        loginParams.append('username', email);
        loginParams.append('password', password);
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: loginParams
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem('token', loginData.access_token);
          setToken(loginData.access_token);
        }
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setRoom(null);
    setAnalytics(null);
    setNotifications([]);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications(token);
    } catch (err) {
      console.error(err);
    }
  };

  const copyInvite = () => {
    if (room?.invite_code) {
      navigator.clipboard.writeText(room.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Waking up server loading screen
  if (serverStatus === 'checking' || serverStatus === 'waking') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
        <div className="blur-circle circle-1" style={{ width: '600px', height: '600px', top: '-200px', right: '-100px', opacity: 0.18 }}></div>
        <div className="blur-circle circle-2" style={{ width: '700px', height: '700px', bottom: '-250px', left: '-200px', opacity: 0.15 }}></div>
        <div className="blur-circle" style={{ width: '300px', height: '300px', background: 'var(--color-secondary)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.06, filter: 'blur(120px)' }}></div>

        <div className="animate-fade" style={{ zIndex: 1, textAlign: 'center', width: '100%', maxWidth: '480px', padding: '0 24px' }}>
          <div style={{ marginBottom: '28px' }}>
            <span style={{ fontSize: '56px', display: 'inline-block', animation: 'float 3s ease-in-out infinite' }}>🔎</span>
            <h1 className="text-gradient" style={{ fontSize: '36px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', marginTop: '12px' }}>SpendLens</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>Household expense intelligence</p>
          </div>

          <div className="card animate-pulse-glow" style={{ padding: '24px', border: '1px solid var(--border-glow)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.1)', borderTopColor: 'var(--color-secondary)', animation: 'spin 1s linear infinite' }}></div>
            </div>
            
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              {serverStatus === 'checking' ? 'Connecting to services...' : 'Waking up SpendLens...'}
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.5', margin: 0 }}>
              {serverStatus === 'checking' 
                ? 'Initializing a secure connection with SpendLens API...'
                : "SpendLens is hosted on Render's free tier and goes to sleep after inactivity. Waking it up usually takes 30-50 seconds. We'll load automatically when ready!"}
            </p>

            {serverStatus === 'waking' && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                  <div className="loading-progress" style={{ height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))', borderRadius: '2px', width: '70%', animation: 'loading-bar 30s linear infinite' }}></div>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>Retrying connection in background...</span>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes float { 
            0% { transform: translateY(0px); } 
            50% { transform: translateY(-10px); } 
            100% { transform: translateY(0px); } 
          }
          @keyframes loading-bar {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 95%; }
          }
        `}</style>
      </div>
    );
  }

  // Render Login screen with member selection
  if (!token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
        <div className="blur-circle circle-1" style={{ width: '600px', height: '600px', top: '-200px', right: '-100px', opacity: 0.18 }}></div>
        <div className="blur-circle circle-2" style={{ width: '700px', height: '700px', bottom: '-250px', left: '-200px', opacity: 0.15 }}></div>
        <div className="blur-circle" style={{ width: '300px', height: '300px', background: '#f59e0b', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.06, filter: 'blur(120px)' }}></div>

        <div className="animate-fade" style={{ zIndex: 1, textAlign: 'center', width: '100%', maxWidth: '680px', padding: '0 24px' }}>
          {/* Logo & Title */}
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>🔎</span>
            <h1 className="text-gradient" style={{ fontSize: '42px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>SpendLens</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '6px', fontFamily: 'var(--font-body)' }}>Collaborative expense intelligence for your household</p>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '28px 0 24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)' }}></div>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sign in as</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--border-color), transparent)' }}></div>
          </div>

          {/* Member Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {MEMBERS.map((member, idx) => (
              <button
                key={member.email}
                onClick={() => handleMemberLogin(member)}
                disabled={loading}
                id={`login-member-${member.name.toLowerCase()}`}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px 12px 18px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: loading ? 0.6 : 1,
                  animation: `fade-in 0.4s ease-out ${idx * 0.08}s both`,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                    e.currentTarget.style.borderColor = member.color;
                    e.currentTarget.style.boxShadow = `0 12px 32px ${member.color}25, 0 0 20px ${member.color}15`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Glow background */}
                <div style={{ position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)', width: '80px', height: '80px', background: member.color, opacity: 0.08, borderRadius: '50%', filter: 'blur(24px)', pointerEvents: 'none' }}></div>

                {/* Avatar */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${member.color}30, ${member.color}10)`,
                  border: `2px solid ${member.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 16px ${member.color}20`,
                }}>
                  <img
                    src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${member.name}`}
                    alt={member.name}
                    style={{ width: '44px', height: '44px', borderRadius: '50%' }}
                  />
                </div>

                {/* Name */}
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{member.name}</span>

                {/* Arrow indicator */}
                <ChevronRight size={14} style={{ color: member.color, opacity: 0.6 }} />
              </button>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '16px',
              color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '8px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--color-secondary)', animation: 'spin 0.8s linear infinite' }}></div>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Signing in...</span>
            </div>
          )}

          {/* Footer */}
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '32px', opacity: 0.6 }}>SpendLens Room Intel v1.1 &middot; Production Build</p>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  // Show transition loading screen when token is present but user details are loading
  if (token && !user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', position: 'relative' }}>
        <div className="blur-circle circle-1"></div>
        <div className="blur-circle circle-2"></div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--color-secondary)', animation: 'spin 1s linear infinite', margin: '0 auto 20px auto' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '16px' }}>Loading SpendLens...</p>
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }



  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Background Orbs */}
      <div className="blur-circle circle-1" style={{ opacity: 0.08 }}></div>
      <div className="blur-circle circle-2" style={{ opacity: 0.08 }}></div>

      {/* Mobile Sidebar Overlay Backdrop */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      {/* Sidebar Navigation */}
      <aside 
        className={`glass-panel sidebar-navigation ${isSidebarOpen ? 'open' : ''}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px', padding: '0 8px' }}>
          <span style={{ fontSize: '24px' }}>🔎</span>
          <div>
            <h2 className="text-gradient" style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-display)' }}>SpendLens</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Room Intel v1.1</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button 
            onClick={() => { setActivePage('dashboard'); setIsSidebarOpen(false); }} 
            className={`btn-secondary`}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: activePage === 'dashboard' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: activePage === 'dashboard' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              color: activePage === 'dashboard' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          
          <button 
            onClick={() => { setActivePage('expenses'); setIsSidebarOpen(false); }} 
            className={`btn-secondary`}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: activePage === 'expenses' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: activePage === 'expenses' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              color: activePage === 'expenses' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <ReceiptText size={18} /> Expense Log
          </button>

          <button 
            onClick={() => { setActivePage('analytics'); setIsSidebarOpen(false); }} 
            className={`btn-secondary`}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: activePage === 'analytics' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: activePage === 'analytics' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              color: activePage === 'analytics' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <BarChart3 size={18} /> Intelligence
          </button>

          <button 
            onClick={() => { setActivePage('budgetPool'); setIsSidebarOpen(false); }} 
            className={`btn-secondary`}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
              background: activePage === 'budgetPool' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: activePage === 'budgetPool' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              color: activePage === 'budgetPool' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Landmark size={18} /> Monthly Pool
          </button>
        </nav>

        {/* User profile footer in sidebar */}
        {user && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={user.avatar} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }} />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <h4 style={{ fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.name}</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</span>
              </div>
            </div>
            <button
              id="logout-button"
              onClick={() => { handleLogout(); setIsSidebarOpen(false); }}
              className="btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                color: 'var(--color-danger)', fontSize: '13px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.06)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="main-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header className="glass-panel app-header" style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              className="hamburger-btn" 
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 style={{ fontSize: '20px', fontFamily: 'var(--font-display)' }}>{room?.name || 'Household'}</h1>
            {room && (
              <div 
                onClick={copyInvite}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', 
                  padding: '4px 10px', borderRadius: '16px', fontSize: '12px', color: 'var(--color-secondary)', cursor: 'pointer', transition: 'all var(--transition-fast)'
                }}
              >
                Code: <strong style={{ letterSpacing: '0.05em' }}>{room.invite_code}</strong>
                {copied ? <Check size={12} style={{ color: 'var(--color-primary)' }} /> : <Copy size={12} />}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn-secondary" 
                style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '50%', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span 
                    className="animate-pulse-glow"
                    style={{ position: 'absolute', top: '-2px', right: '-2px', background: 'var(--color-danger)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div className="card" style={{ position: 'absolute', top: '50px', right: 0, width: '320px', maxH: '400px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 100, padding: '16px', border: '1px solid var(--border-glow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h4 style={{ fontSize: '14px' }}>House Alerts ({unreadCount} new)</h4>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllNotificationsRead} style={{ fontSize: '11px', color: 'var(--color-secondary)', background: 'transparent' }}>Mark all read</button>
                    )}
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: '250px', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                    {notifications.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>No recent notifications.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{ padding: '10px', background: n.read ? 'rgba(255,255,255,0.01)' : 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${n.type === 'budget' ? 'var(--color-accent)' : n.type === 'anomaly' ? 'var(--color-danger)' : n.type === 'optimization' ? 'var(--color-primary)' : 'var(--color-secondary)'}` }}>
                          <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '4px' }}>{n.message}</p>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              {(room?.members || []).slice(0, 3).map((m, idx) => (
                <img 
                   key={m.id} 
                  src={m.avatar} 
                  alt={m.name} 
                  title={m.name}
                  style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', marginLeft: idx > 0 ? '-10px' : 0, 
                    border: '2px solid var(--bg-secondary)', zIndex: 3 - idx, background: 'rgba(255,255,255,0.05)'
                  }} 
                />
              ))}
              {(room?.members?.length || 0) > 3 && (
                <div 
                  style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', marginLeft: '-10px', 
                    background: 'var(--bg-secondary)', border: '2px solid var(--border-color)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', zIndex: 0
                  }}
                >
                  +{(room?.members?.length || 0) - 3}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Views */}
        <main className="app-main-content" style={{ flex: 1, overflowY: 'auto' }}>
          {activePage === 'dashboard' && <Dashboard analytics={analytics} token={token} user={user} onRefresh={() => fetchAnalytics(token)} isOffline={isOffline} />}
          {activePage === 'expenses' && <ExpenseLog token={token} room={room} onRefresh={() => fetchAnalytics(token)} isOffline={isOffline} user={user} expenses={expenses} setExpenses={setExpenses} fetchExpenses={fetchExpenses} />}
          {activePage === 'analytics' && <Analytics analytics={analytics} token={token} isOffline={isOffline} />}
          {activePage === 'budgetPool' && (
            <BudgetPool 
              expenses={expenses} 
              isOffline={isOffline} 
              room={room} 
              token={token} 
              user={user} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
