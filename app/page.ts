'use client';

import React, { useState, useEffect } from 'react';

// --- INTERFACES ---
interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  active: boolean;
}

interface GroupItem {
  productId: string;
  qty: number;
  price: number;
  discountType?: 'amount' | 'percent';
  discount?: number;
  name?: string;
}

interface Group {
  id: string;
  code: string;
  name: string;
  company?: string;
  contact?: string;
  phone?: string;
  email?: string;
  date?: string;
  pax: number;
  discount: number;
  tax: number;
  dp: number;
  due?: string;
  notes?: string;
  status: 'Draft' | 'Offering' | 'Confirmed' | 'Invoiced' | 'Cancelled';
  items: GroupItem[];
  created?: string;
}

interface Company {
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface DB {
  company: Company;
  products: Product[];
  groups: Group[];
}

interface User {
  username: string;
  role: 'superadmin' | 'user';
  name: string;
}

// --- INITIAL SEED DATA ---
const KEY = 'rombongan_manager_v2';
const seed: DB = {
  company: { name: 'Lembang Park & Zoo', address: 'Alamat perusahaan / destinasi', phone: '', email: '' },
  products: [
    { id: 'p1', name: 'Tiket Dewasa', category: 'Tiket', unit: 'pax', price: 50000, active: true },
    { id: 'p2', name: 'Tiket Anak', category: 'Tiket', unit: 'pax', price: 35000, active: true },
    { id: 'p3', name: 'Tiket Pelajar', category: 'Tiket', unit: 'pax', price: 30000, active: true },
    { id: 'p4', name: 'Paket Makan A', category: 'Makan', unit: 'pax', price: 25000, active: true },
    { id: 'p5', name: 'Paket Makan B', category: 'Makan', unit: 'pax', price: 30000, active: true },
    { id: 'p6', name: 'Feeding Animal', category: 'Add-on', unit: 'pax', price: 25000, active: true },
    { id: 'p7', name: 'Animal Encounter', category: 'Add-on', unit: 'pax', price: 50000, active: true },
    { id: 'p8', name: 'Guide', category: 'Add-on', unit: 'unit', price: 300000, active: true }
  ],
  groups: []
};

const USERS: Record<string, User & { password: string }> = {
  superadmin: { username: 'superadmin', password: 'admin123', role: 'superadmin', name: 'Superadmin' },
  user: { username: 'user', password: 'user123', role: 'user', name: 'User Biasa' }
};

// --- HELPER FUNCTIONS ---
const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const fmtDate = (s?: string) =>
  !s ? '-' : new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

export default function RombonganManager() {
  const [db, setDb] = useState<DB>(seed);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [page, setPage] = useState<'dashboard' | 'groups' | 'form' | 'products' | 'product_form' | 'documents' | 'settings'>('dashboard');
  
  // State Login & Filter
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form State Rombongan
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<Partial<Group>>({});
  const [formItems, setFormItems] = useState<GroupItem[]>([]);
  const [selectedProductAdd, setSelectedProductAdd] = useState('');
  const [qtyProductAdd, setQtyProductAdd] = useState(1);

  // Form State Produk
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState<Partial<Product>>({});

  // Document State
  const [selectedDocGroup, setSelectedDocGroup] = useState<string>('');
  const [docKind, setDocKind] = useState<'offering' | 'confirmation' | 'proforma' | 'invoice'>('offering');
  const [showDocPreview, setShowDocPreview] = useState(false);

  // Load Initial Data
  useEffect(() => {
    const localDb = localStorage.getItem(KEY);
    if (localDb) {
      try {
        const parsed = JSON.parse(localDb);
        setDb({
          company: parsed.company || seed.company,
          products: parsed.products || seed.products,
          groups: parsed.groups || []
        });
      } catch (e) {
        console.error("Gagal load database local", e);
      }
    }
    const sessionUser = sessionStorage.getItem('rombongan_current_user');
    if (sessionUser) {
      setCurrentUser(JSON.parse(sessionUser));
    }
  }, []);

  // Save Data
  const saveData = (newDb: DB) => {
    setDb(newDb);
    localStorage.setItem(KEY, JSON.stringify(newDb));
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';

  const requireSuperAdmin = () => {
    if (!isSuperAdmin) {
      alert('Akses hanya untuk Superadmin.');
      setPage('dashboard');
      return false;
    }
    return true;
  };

  // --- CALCULATION LOGIC ---
  const productById = (id: string) => db.products.find(p => p.id === id);

  const itemCalc = (i: GroupItem) => {
    const qty = +i.qty || 0;
    const price = +i.price || 0;
    const gross = qty * price;
    const discountType = i.discountType || 'amount';
    const discountValue = Math.max(0, +i.discount! || 0);
    const discount = discountType === 'percent' ? Math.min(gross, (gross * discountValue) / 100) : Math.min(gross, discountValue);
    return { gross, discount, total: Math.max(0, gross - discount) };
  };

  const calcGroup = (g: Partial<Group> & { items?: GroupItem[] }) => {
    const items = g.items || [];
    const subtotal = items.reduce((a, i) => a + itemCalc(i).gross, 0);
    const itemDiscount = items.reduce((a, i) => a + itemCalc(i).discount, 0);
    const discount = +g.discount! || 0;
    const tax = +g.tax! || 0;
    const total = Math.max(0, subtotal - itemDiscount - discount + tax);
    const dp = +g.dp! || 0;
    return { subtotal, itemDiscount, discount, tax, total, dp, balance: Math.max(0, total - dp) };
  };

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = Object.values(USERS).find(u => u.username === loginUsername.trim() && u.password === loginPassword);
    if (!found) {
      setLoginError(true);
      setLoginPassword('');
      return;
    }
    setLoginError(false);
    const userObj: User = { username: found.username, role: found.role, name: found.name };
    setCurrentUser(userObj);
    sessionStorage.setItem('rombongan_current_user', JSON.stringify(userObj));
    setPage('dashboard');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('rombongan_current_user');
    setCurrentUser(null);
    setPage('dashboard');
  };

  const handleNewGroup = () => {
    const newG: Group = {
      id: crypto.randomUUID(),
      code: 'GRP-' + new Date().getFullYear() + '-' + String(db.groups.length + 1).padStart(4, '0'),
      name: '',
      status: 'Draft',
      pax: 0,
      discount: 0,
      tax: 0,
      dp: 0,
      items: [],
      created: new Date().toISOString()
    };
    setEditingGroup(null);
    setFormData(newG);
    setFormItems([]);
    if (db.products.filter(p => p.active).length > 0) {
      setSelectedProductAdd(db.products.filter(p => p.active)[0].id);
    }
    setPage('form');
  };

  const handleEditGroup = (g: Group) => {
    setEditingGroup(g);
    setFormData(g);
    setFormItems(JSON.parse(JSON.stringify(g.items || [])));
    if (db.products.filter(p => p.active).length > 0) {
      setSelectedProductAdd(db.products.filter(p => p.active)[0].id);
    }
    setPage('form');
  };

  const handleAddItem = () => {
    const p = productById(selectedProductAdd);
    if (!p) return;
    setFormItems([...formItems, { productId: selectedProductAdd, qty: qtyProductAdd, price: p.price, discountType: 'amount', discount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    const updated = [...formItems];
    if (field === 'discountType') updated[index].discountType = val;
    else (updated[index] as any)[field] = Math.max(0, +val || 0);
    setFormItems(updated);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const finalGroup = { ...formData, items: formItems } as Group;
    let newGroups = [...db.groups];
    if (editingGroup) {
      const idx = newGroups.findIndex(x => x.id === editingGroup.id);
      newGroups[idx] = finalGroup;
    } else {
      newGroups.push(finalGroup);
    }
    saveData({ ...db, groups: newGroups });
    setPage('groups');
  };

  // Status Badge Component
  const renderBadge = (status: string) => {
    let c = status === 'Confirmed' || status === 'Invoiced' ? 'green' : status === 'Cancelled' ? 'red' : status === 'Offering' ? 'yellow' : 'gray';
    return <span className={`badge ${c}`}>{status}</span>;
  };

  // Table Group Component
  const renderGroupTable = (groupsList: Group[]) => {
    if (!groupsList.length) return <div className="empty">Belum ada data rombongan.</div>;
    return (
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              <th>No. Booking</th>
              <th>Rombongan</th>
              <th>Tanggal</th>
              <th>Pax</th>
              <th>Item</th>
              <th>Total</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {groupsList.map(g => {
              const c = calcGroup(g);
              return (
                <tr key={g.id}>
                  <td>{g.code}</td>
                  <td>
                    <b>{g.name}</b>
                    <div className="muted">{g.company || ''}</div>
                  </td>
                  <td>{fmtDate(g.date)}</td>
                  <td>{g.pax || 0}</td>
                  <td>{(g.items || []).length}</td>
                  <td>{rupiah(c.total)}</td>
                  <td>{renderBadge(g.status)}</td>
                  <td>
                    <button className="btn small" onClick={() => handleEditGroup(g)}>
                      Edit
                    </button>{' '}
                    <button
                      className="btn small"
                      onClick={() => {
                        setSelectedDocGroup(g.id);
                        setShowDocPreview(false);
                        setPage('documents');
                      }}
                    >
                      Dokumen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // --- LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <h1>Rombongan Manager</h1>
            <p>Group Booking & Billing</p>
          </div>
          {loginError && <div className="login-error">Username atau password salah.</div>}
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Username</label>
              <input
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn primary" type="submit">
              Login
            </button>
          </form>
          <div className="muted" style={{ marginTop: 16, fontSize: 11, lineHeight: 1.6 }}>
            Default: <b>superadmin / admin123</b> · <b>user / user123</b>
          </div>
        </div>
      </div>
    );
  }

  // Calculated variables for Form
  const currentCalculatedForm = calcGroup({ ...formData, items: formItems });

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="side">
        <div className="brand">
          Rombongan Manager<small>Group Booking & Billing</small>
        </div>
        <div className="nav">
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
            Dashboard
          </button>
          <button className={page === 'groups' ? 'active' : ''} onClick={() => setPage('groups')}>
            Data Rombongan
          </button>
          {isSuperAdmin && (
            <button
              className={page === 'products' ? 'active' : ''}
              onClick={() => requireSuperAdmin() && setPage('products')}
            >
              Produk & Harga
            </button>
          )}
          <button className={page === 'documents' ? 'active' : ''} onClick={() => setPage('documents')}>
            Dokumen
          </button>
          {isSuperAdmin && (
            <button
              className={page === 'settings' ? 'active' : ''}
              onClick={() => requireSuperAdmin() && setPage('settings')}
            >
              Pengaturan
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <span className="user-chip">
            👤 {currentUser.name} · {currentUser.role === 'superadmin' ? 'Superadmin' : 'User Biasa'}
          </span>
          <button className="btn small logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* PAGE 1: DASHBOARD */}
        {page === 'dashboard' && (
          <div>
            <div className="top">
              <div>
                <h1>Dashboard</h1>
                <div className="muted">Kelola rombongan, produk, harga, dokumen dan pembayaran.</div>
              </div>
              <button className="btn primary" onClick={handleNewGroup}>
                + Rombongan Baru
              </button>
            </div>
            <div className="grid">
              <div className="card stat">
                Total Rombongan<b>{db.groups.length}</b>
              </div>
              <div className="card stat">
                Confirmed<b>{db.groups.filter(g => ['Confirmed', 'Invoiced'].includes(g.status)).length}</b>
              </div>
              <div className="card stat">
                Nilai Booking<b>{rupiah(db.groups.reduce((a, g) => a + calcGroup(g).total, 0))}</b>
              </div>
              <div className="card stat">
                Tiket Terjual
                <b>
                  {db.groups.reduce(
                    (a, g) =>
                      a +
                      (g.items || [])
                        .filter(i => productById(i.productId)?.category === 'Tiket')
                        .reduce((x, i) => x + (+i.qty || 0), 0),
                    0
                  )}
                </b>
              </div>
            </div>
            <div className="grid" style={{ marginTop: 16 }}>
              <div className="card stat">
                Pax Makan
                <b>
                  {db.groups.reduce(
                    (a, g) =>
                      a +
                      (g.items || [])
                        .filter(i => productById(i.productId)?.category === 'Makan')
                        .reduce((x, i) => x + (+i.qty || 0), 0),
                    0
                  )}
                </b>
              </div>
              <div className="card stat">
                Produk Aktif<b>{db.products.filter(p => p.active).length}</b>
              </div>
              <div className="card stat">
                Proforma/Invoice<b>{db.groups.filter(g => ['Confirmed', 'Invoiced'].includes(g.status)).length}</b>
              </div>
              <div className="card stat">
                Outstanding<b>{rupiah(db.groups.reduce((a, g) => a + calcGroup(g).balance, 0))}</b>
              </div>
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Alur Kerja</h3>
              <div className="toolbar">
                <span className="badge gray">1. Input Booking</span>
                <span>→</span>
                <span className="badge yellow">2. Offering</span>
                <span>→</span>
                <span className="badge green">3. Confirmation</span>
                <span>→</span>
                <span className="badge green">4. Proforma</span>
                <span>→</span>
                <span className="badge green">5. Invoice</span>
              </div>
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Rombongan Terbaru</h3>
              {renderGroupTable(
                [...db.groups].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 8)
              )}
            </div>
          </div>
        )}

        {/* PAGE 2: DATA ROMBONGAN */}
        {page === 'groups' && (
          <div>
            <div className="top">
              <div>
                <h1>Data Rombongan</h1>
                <div className="muted">Satu booking dapat berisi banyak tiket, makanan dan add-on.</div>
              </div>
              <button className="btn primary" onClick={handleNewGroup}>
                + Rombongan Baru
              </button>
            </div>
            <div className="card">
              <div className="toolbar">
                <input
                  placeholder="Cari booking, nama, perusahaan..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, minWidth: 240, padding: 9, border: '1px solid #d0d5dd', borderRadius: 8 }}
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="btn"
                >
                  <option value="">Semua status</option>
                  <option>Draft</option>
                  <option>Offering</option>
                  <option>Confirmed</option>
                  <option>Invoiced</option>
                  <option>Cancelled</option>
                </select>
              </div>
              {renderGroupTable(
                db.groups.filter(
                  g =>
                    (!statusFilter || g.status === statusFilter) &&
                    JSON.stringify(g).toLowerCase().includes(searchQuery.toLowerCase())
                )
              )}
            </div>
          </div>
        )}

        {/* PAGE 3: FORM INPUT / EDIT ROMBONGAN */}
        {page === 'form' && (
          <div>
            <div className="top">
              <div>
                <h1>{editingGroup ? 'Edit' : 'Input'} Rombongan</h1>
                <div className="muted">Masukkan data customer lalu pilih produk dan jumlah pesanan.</div>
              </div>
            </div>
            <div className="card">
              <form onSubmit={handleSaveGroup}>
                <div className="formgrid">
                  <div className="field">
                    <label>No. Booking</label>
                    <input
                      value={formData.code || ''}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={formData.status || 'Draft'}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      {['Draft', 'Offering', 'Confirmed', 'Invoiced', 'Cancelled'].map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Nama Rombongan</label>
                    <input
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Instansi / Perusahaan</label>
                    <input
                      value={formData.company || ''}
                      onChange={e => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Contact Person</label>
                    <input
                      value={formData.contact || ''}
                      onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>No. WhatsApp / Telepon</label>
                    <input
                      value={formData.phone || ''}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Tanggal Kunjungan</label>
                    <input
                      type="date"
                      value={formData.date || ''}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Jumlah Peserta</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.pax || 0}
                      onChange={e => setFormData({ ...formData, pax: +e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Diskon</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.discount || 0}
                      onChange={e => setFormData({ ...formData, discount: +e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Pajak / Biaya Tambahan</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.tax || 0}
                      onChange={e => setFormData({ ...formData, tax: +e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>DP / Uang Muka</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.dp || 0}
                      onChange={e => setFormData({ ...formData, dp: +e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Jatuh Tempo</label>
                    <input
                      type="date"
                      value={formData.due || ''}
                      onChange={e => setFormData({ ...formData, due: e.target.value })}
                    />
                  </div>
                  <div className="field full">
                    <label>Catatan / Permintaan Khusus</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="section">
                  <h3>Detail Pesanan</h3>
                  <div className="toolbar">
                    <select
                      value={selectedProductAdd}
                      onChange={e => setSelectedProductAdd(e.target.value)}
                      style={{ minWidth: 260, padding: 9, border: '1px solid #d0d5dd', borderRadius: 8 }}
                    >
                      {db.products
                        .filter(p => p.active)
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.category} — {p.name} ({rupiah(p.price)}/{p.unit})
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={qtyProductAdd}
                      onChange={e => setQtyProductAdd(+e.target.value)}
                      style={{ width: 100, padding: 9, border: '1px solid #d0d5dd', borderRadius: 8 }}
                    />
                    <button type="button" className="btn primary" onClick={handleAddItem}>
                      + Tambah Item
                    </button>
                  </div>

                  <div id="itemsArea">
                    {!formItems.length ? (
                      <div className="empty" style={{ padding: 25 }}>
                        Belum ada item. Tambahkan tiket, makan atau add-on.
                      </div>
                    ) : (
                      <div className="tablewrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Produk</th>
                              <th>Kategori</th>
                              <th>Qty</th>
                              <th>Harga</th>
                              <th>Subtotal</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {formItems.map((i, idx) => {
                              const p = productById(i.productId);
                              return (
                                <tr key={idx}>
                                  <td>{p?.name || i.name || 'Produk'}</td>
                                  <td>{p?.category || ''}</td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      value={i.qty || 0}
                                      onChange={e => handleUpdateItem(idx, 'qty', e.target.value)}
                                      style={{ width: 85, padding: 6, border: '1px solid #d0d5dd', borderRadius: 7 }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      value={i.price || 0}
                                      onChange={e => handleUpdateItem(idx, 'price', e.target.value)}
                                      style={{ width: 130, padding: 6, border: '1px solid #d0d5dd', borderRadius: 7 }}
                                    />
                                  </td>
                                  <td>{rupiah((+i.qty || 0) * (+i.price || 0))}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn small danger"
                                      onClick={() => handleRemoveItem(idx)}
                                    >
                                      Hapus
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card" style={{ marginTop: 16, background: '#f8fafc', boxShadow: 'none' }}>
                  <div className="formgrid">
                    <div>
                      <div className="muted">Subtotal</div>
                      <b>{rupiah(currentCalculatedForm.subtotal)}</b>
                    </div>
                    <div>
                      <div className="muted">Diskon Item</div>
                      <b>{rupiah(currentCalculatedForm.itemDiscount)}</b>
                    </div>
                    <div>
                      <div className="muted">Diskon Booking</div>
                      <b>{rupiah(currentCalculatedForm.discount)}</b>
                    </div>
                    <div>
                      <div className="muted">Pajak/Biaya</div>
                      <b>{rupiah(currentCalculatedForm.tax)}</b>
                    </div>
                    <div>
                      <div className="muted">Grand Total</div>
                      <b style={{ fontSize: 22 }}>{rupiah(currentCalculatedForm.total)}</b>
                    </div>
                    <div>
                      <div className="muted">DP</div>
                      <b>{rupiah(currentCalculatedForm.dp)}</b>
                    </div>
                    <div>
                      <div className="muted">Outstanding</div>
                      <b style={{ fontSize: 22 }}>{rupiah(currentCalculatedForm.balance)}</b>
                    </div>
                  </div>
                </div>

                <div className="actions">
                  <button type="button" className="btn" onClick={() => setPage('groups')}>
                    Batal
                  </button>
                  <button type="submit" className="btn primary">
                    Simpan Rombongan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PAGE 4: PRODUK & HARGA */}
        {page === 'products' && (
          <div>
            <div className="top">
              <div>
                <h1>Master Produk & Harga</h1>
                <div className="muted">
                  Atur harga tiket, makan dan add-on yang otomatis tersedia saat membuat booking.
                </div>
              </div>
              <button
                className="btn primary"
                onClick={() => {
                  setEditingProduct(null);
                  setProductFormData({ id: crypto.randomUUID(), name: '', category: 'Tiket', unit: 'pax', price: 0, active: true });
                  setPage('product_form');
                }}
              >
                + Produk
              </button>
            </div>
            <div className="card">
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Kategori</th>
                      <th>Satuan</th>
                      <th>Harga</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db.products.map(p => (
                      <tr key={p.id}>
                        <td>
                          <b>{p.name}</b>
                        </td>
                        <td>{p.category}</td>
                        <td>{p.unit}</td>
                        <td>{rupiah(p.price)}</td>
                        <td>
                          {p.active ? (
                            <span className="badge green">Aktif</span>
                          ) : (
                            <span className="badge gray">Nonaktif</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn small"
                            onClick={() => {
                              setEditingProduct(p);
                              setProductFormData(p);
                              setPage('product_form');
                            }}
                          >
                            Edit
                          </button>{' '}
                          <button
                            className="btn small"
                            onClick={() => {
                              const updated = db.products.map(x => (x.id === p.id ? { ...x, active: !x.active } : x));
                              saveData({ ...db, products: updated });
                            }}
                          >
                            {p.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 4.5: FORM PRODUK */}
        {page === 'product_form' && (
          <div>
            <div className="top">
              <div>
                <h1>{editingProduct ? 'Edit' : 'Tambah'} Produk</h1>
                <div className="muted">Harga ini akan menjadi harga default saat produk ditambahkan ke booking.</div>
              </div>
            </div>
            <div className="card">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  let updated = [...db.products];
                  if (editingProduct) {
                    const idx = updated.findIndex(x => x.id === editingProduct.id);
                    updated[idx] = productFormData as Product;
                  } else {
                    updated.push(productFormData as Product);
                  }
                  saveData({ ...db, products: updated });
                  setPage('products');
                }}
              >
                <div className="formgrid">
                  <div className="field">
                    <label>Nama Produk</label>
                    <input
                      value={productFormData.name || ''}
                      onChange={e => setProductFormData({ ...productFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Kategori</label>
                    <select
                      value={productFormData.category || 'Tiket'}
                      onChange={e => setProductFormData({ ...productFormData, category: e.target.value })}
                    >
                      {['Tiket', 'Makan', 'Add-on', 'Lainnya'].map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Satuan</label>
                    <select
                      value={productFormData.unit || 'pax'}
                      onChange={e => setProductFormData({ ...productFormData, unit: e.target.value })}
                    >
                      {['pax', 'orang', 'unit', 'bus', 'paket'].map(x => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Harga</label>
                    <input
                      type="number"
                      min="0"
                      value={productFormData.price || 0}
                      onChange={e => setProductFormData({ ...productFormData, price: +e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={productFormData.active ? 'true' : 'false'}
                      onChange={e => setProductFormData({ ...productFormData, active: e.target.value === 'true' })}
                    >
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                </div>
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setPage('products')}>
                    Batal
                  </button>
                  <button className="btn primary">Simpan Produk</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PAGE 5: DOKUMEN */}
        {page === 'documents' && (
          <div>
            <div className="top">
              <div>
                <h1>Dokumen</h1>
                <div className="muted">Dokumen otomatis berdasarkan detail item booking.</div>
              </div>
            </div>
            <div className="card no-print">
              <div className="formgrid">
                <div className="field">
                  <label>Pilih Rombongan</label>
                  <select
                    value={selectedDocGroup}
                    onChange={e => {
                      setSelectedDocGroup(e.target.value);
                      setShowDocPreview(false);
                    }}
                  >
                    <option value="">-- pilih --</option>
                    {db.groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.code} — {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Dokumen</label>
                  <select value={docKind} onChange={e => setDocKind(e.target.value as any)}>
                    <option value="offering">Offering Letter</option>
                    <option value="confirmation">Confirmation Letter</option>
                    <option value="proforma">Proforma Invoice</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>
              </div>
              <div className="actions">
                <button
                  className="btn primary"
                  onClick={() => {
                    if (!selectedDocGroup) {
                      alert('Pilih rombongan.');
                      return;
                    }
                    setShowDocPreview(true);
                  }}
                >
                  Tampilkan Dokumen
                </button>
              </div>
            </div>

            {/* PREVIEW DOKUMEN */}
            <div id="docPreview" style={{ marginTop: 18 }}>
              {selectedDocGroup && !showDocPreview && (() => {
                const g = db.groups.find(x => x.id === selectedDocGroup);
                if (!g) return null;
                const c = calcGroup(g);
                return (
                  <div className="card no-print">
                    <b>{g.name}</b> · {g.code} · {g.pax || 0} peserta · {rupiah(c.total)} · {g.items?.length || 0} item
                  </div>
                );
              })()}

              {showDocPreview && selectedDocGroup && (() => {
                const g = db.groups.find(x => x.id === selectedDocGroup);
                if (!g) return null;
                const c = calcGroup(g);
                const titleMap = {
                  offering: 'OFFERING LETTER',
                  confirmation: 'CONFIRMATION LETTER',
                  proforma: 'PROFORMA INVOICE',
                  invoice: 'INVOICE'
                };
                const prefixMap = {
                  offering: 'OL-',
                  confirmation: 'CL-',
                  proforma: 'PI-',
                  invoice: 'INV-'
                };
                const docTitle = titleMap[docKind];
                const docNo = prefixMap[docKind] + g.code;

                return (
                  <>
                    <div className="doc">
                      <div className="dochead">
                        <div>
                          <b>{db.company.name}</b>
                          <div className="muted">{db.company.address}</div>
                          <div className="muted">
                            {db.company.phone} {db.company.email ? '· ' + db.company.email : ''}
                          </div>
                        </div>
                        <div className="right">
                          <b>{docNo}</b>
                          <div>{fmtDate(new Date().toISOString().slice(0, 10))}</div>
                        </div>
                      </div>

                      <h2>{docTitle}</h2>
                      <p>
                        Kepada Yth.
                        <br />
                        <b>{g.contact || g.company || g.name}</b>
                        <br />
                        {g.company || ''}
                      </p>

                      {docKind === 'offering' && (
                        <p>
                          Berikut penawaran untuk rombongan <b>{g.name}</b> pada <b>{fmtDate(g.date)}</b> dengan jumlah
                          peserta <b>{g.pax}</b> orang.
                        </p>
                      )}
                      {docKind === 'confirmation' && (
                        <p>
                          Dengan ini kami mengonfirmasi pemesanan rombongan <b>{g.name}</b> pada <b>{fmtDate(g.date)}</b>{' '}
                          sebanyak <b>{g.pax}</b> peserta.
                        </p>
                      )}

                      <table>
                        <thead>
                          <tr>
                            <th>Produk</th>
                            <th>Kategori</th>
                            <th>Qty</th>
                            <th>Harga</th>
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(g.items || []).map((i, idx) => {
                            const p = productById(i.productId);
                            const ic = itemCalc(i);
                            return (
                              <tr key={idx}>
                                <td>{p?.name || i.name || 'Produk'}</td>
                                <td>{p?.category || ''}</td>
                                <td>{i.qty}</td>
                                <td>{rupiah(i.price)}</td>
                                <td className="right">{rupiah(ic.gross)}</td>
                              </tr>
                            );
                          })}
                          <tr>
                            <td colSpan={4} className="right">
                              <b>Subtotal</b>
                            </td>
                            <td className="right">{rupiah(c.subtotal)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="right">
                              Diskon
                            </td>
                            <td className="right">{rupiah(c.discount)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="right">
                              Pajak/Biaya
                            </td>
                            <td className="right">{rupiah(c.tax)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="right">
                              <b>Grand Total</b>
                            </td>
                            <td className="right">
                              <b>{rupiah(c.total)}</b>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="right">
                              DP
                            </td>
                            <td className="right">{rupiah(c.dp)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="right">
                              <b>Outstanding</b>
                            </td>
                            <td className="right">
                              <b>{rupiah(c.balance)}</b>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <p>
                        <b>Tanggal kunjungan:</b> {fmtDate(g.date)} &nbsp; <b>Jatuh tempo:</b> {fmtDate(g.due)}
                      </p>
                      {g.notes && (
                        <p>
                          <b>Catatan:</b> {g.notes}
                        </p>
                      )}
                      <p>
                        Dokumen ini diterbitkan dari sistem pengelolaan rombongan dan memuat item serta harga yang tersimpan
                        pada booking.
                      </p>

                      <div style={{ marginTop: 70, display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          Pelanggan
                          <br />
                          <br />
                          <br />
                          (________________)
                        </div>
                        <div>
                          Hormat kami,
                          <br />
                          <br />
                          <br />
                          (________________)
                        </div>
                      </div>
                    </div>

                    <div className="actions no-print">
                      <button className="btn" onClick={() => window.print()}>
                        🖨 Cetak / Simpan PDF
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* PAGE 6: PENGATURAN */}
        {page === 'settings' && (
          <div>
            <div className="top">
              <div>
                <h1>Pengaturan</h1>
                <div className="muted">Identitas perusahaan pada dokumen.</div>
              </div>
            </div>
            <div className="card">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  saveData(db);
                  alert('Pengaturan tersimpan.');
                }}
              >
                <div className="formgrid">
                  <div className="field">
                    <label>Nama Perusahaan / Destinasi</label>
                    <input
                      value={db.company.name}
                      onChange={e => setDb({ ...db, company: { ...db.company, name: e.target.value } })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Telepon</label>
                    <input
                      value={db.company.phone}
                      onChange={e => setDb({ ...db, company: { ...db.company, phone: e.target.value } })}
                    />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input
                      value={db.company.email}
                      onChange={e => setDb({ ...db, company: { ...db.company, email: e.target.value } })}
                    />
                  </div>
                  <div className="field full">
                    <label>Alamat</label>
                    <textarea
                      value={db.company.address}
                      onChange={e => setDb({ ...db, company: { ...db.company, address: e.target.value } })}
                    />
                  </div>
                </div>
                <div className="actions">
                  <button className="btn primary">Simpan Pengaturan</button>
                </div>
              </form>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
              <h3>Data</h3>
              <p className="muted">
                Versi ini menyimpan data di browser menggunakan localStorage. Login sudah mendukung 2 role: Superadmin dan User Biasa. Data aplikasi masih tersimpan di localStorage browser.
              </p>
              <button
                className="btn danger"
                onClick={() => {
                  if (requireSuperAdmin() && confirm('Hapus semua booking?')) {
                    saveData({ ...db, groups: [] });
                  }
                }}
              >
                Hapus Semua Rombongan
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}