import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Lock, 
  ShieldAlert, 
  Phone, 
  UserCheck, 
  RefreshCw, 
  Search, 
  X, 
  ShieldCheck, 
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react';
import { User, UserRole } from '../types.ts';
import { secureStorage } from '../lib/secureStorage.ts';

interface UserManagementProps {
  currentUser: User | null;
}

export default function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modals / Editor State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form Fields
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('technician');
  const [phone, setPhone] = useState<string>('');

  // Auth headers generator helper
  const getAuthHeaders = (additionalHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...additionalHeaders };
    if (currentUser?.token) {
      headers['Authorization'] = `Bearer ${currentUser.token}`;
    }
    return headers;
  };

  // Delete confirmation state
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);

  const fetchUsers = () => {
    if (!currentUser?.token) {
      // Fallback silently if user is not authenticated yet
      const cachedUsers = secureStorage.getItem<User[]>('smartfix_users');
      if (cachedUsers && Array.isArray(cachedUsers)) {
        setUsers(cachedUsers);
      } else {
        setUsers([]);
        secureStorage.setItem('smartfix_users', []);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch('/api/users', {
      headers: getAuthHeaders()
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to retrieve system accounts');
        return res.json();
      })
      .then((data) => {
        const usersArray = Array.isArray(data) ? data : [];
        setUsers(usersArray);
        secureStorage.setItem('smartfix_users', usersArray);
        setErrorMsg('');
      })
      .catch((err) => {
        console.warn('Database offline: fetching users fallback to local storage.', err.message || err);
        const cachedUsers = secureStorage.getItem<User[]>('smartfix_users');
        if (cachedUsers && Array.isArray(cachedUsers)) {
          setUsers(cachedUsers);
          setErrorMsg('');
        } else {
          // Initialize clean fallback users list (omit passwords)
          setUsers([]);
          secureStorage.setItem('smartfix_users', []);
          setErrorMsg('');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setName('');
    setRole('technician');
    setPhone('');
    setEditingUser(null);
    setShowPassword(false);
    setErrorMsg('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    resetForm();
    setEditingUser(user);
    setUsername(user.username);
    setName(user.name);
    setRole(user.role);
    setPhone(user.phone || '');
    setPassword(''); // blank to not update password unless filled
    setIsFormOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim() || !name.trim() || !role) {
      setErrorMsg('Username, Full Name, and System Role are required.');
      return;
    }

    if (!editingUser && !password.trim()) {
      setErrorMsg('A password is required for new accounts.');
      return;
    }

    const payload: any = {
      username: username.trim(),
      name: name.trim(),
      role,
      phone: phone.trim(),
    };

    if (password.trim()) {
      payload.password = password.trim();
    }

    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Server rejected user update operation.');
        }
        return data;
      })
      .then(() => {
        setSuccessMsg(editingUser ? 'User profile updated successfully!' : 'New user account created successfully!');
        fetchUsers();
        setIsFormOpen(false);
        resetForm();
        setTimeout(() => setSuccessMsg(''), 4000);
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        const cachedUsers = secureStorage.getItem<User[]>('smartfix_users');
        let localUsersList: User[] = (cachedUsers && Array.isArray(cachedUsers)) ? cachedUsers : [];

        if (editingUser) {
          localUsersList = localUsersList.map((u) => 
            u.id === editingUser.id ? { ...u, name: name.trim(), role, phone: phone.trim() } : u
          );
          setSuccessMsg('User profile updated successfully (Local storage backup updated)!');
        } else {
          const nextUser: User = {
            id: `usr-${localUsersList.length + 101 + Math.floor(Math.random()*900)}`,
            username: username.trim(),
            name: name.trim(),
            role,
            phone: phone.trim()
          };
          localUsersList.push(nextUser);
          setSuccessMsg('New user account created successfully (Local storage backup updated)!');
        }

        secureStorage.setItem('smartfix_users', localUsersList);
        setUsers(localUsersList);
        setIsFormOpen(false);
        resetForm();
        setTimeout(() => setSuccessMsg(''), 4000);
      });
  };

  const handleDeleteUser = (userId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to delete user.');
        }
        return data;
      })
      .then(() => {
        setSuccessMsg('User account successfully removed.');
        fetchUsers();
        setConfirmDeleteUser(null);
        setTimeout(() => setSuccessMsg(''), 4000);
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        const cachedUsers = secureStorage.getItem<User[]>('smartfix_users');
        if (cachedUsers && Array.isArray(cachedUsers)) {
          const updated = cachedUsers.filter(u => u.id !== userId);
          secureStorage.setItem('smartfix_users', updated);
          setUsers(updated);
        }
        setSuccessMsg('User account successfully removed (Local storage backup updated).');
        setConfirmDeleteUser(null);
        setTimeout(() => setSuccessMsg(''), 4000);
      });
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q))
    );
  });

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-md border border-violet-500/25">
            <ShieldCheck className="h-3 w-3" /> Admin
          </span>
        );
      case 'coordinator':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/25">
            Coordinator
          </span>
        );
      case 'senior_technician':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/25">
            Senior Tech
          </span>
        );
      case 'technician':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-teal-500/10 text-teal-300 px-2 py-0.5 rounded-md border border-teal-500/25">
            Technician
          </span>
        );
    }
  };

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <div className="ios-glass-card rounded-3xl p-6 text-left animate-fade-in space-y-6" id="user-management-tab-module">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-extrabold text-white tracking-tight font-display">Team Directory</h3>
          <p className="text-xs text-slate-400">Manage operator permissions, technician allocations, and credentials.</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            disabled={currentUser?.role !== 'admin'}
            onClick={handleOpenCreate}
            className={`px-3 py-2 ios-btn-primary text-white rounded-xl text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all ${
              currentUser?.role !== 'admin' ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Account
          </button>

          <button
            type="button"
            onClick={fetchUsers}
            className="p-2 text-slate-300 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 text-xs flex items-center gap-1.5 font-semibold cursor-pointer transition-all"
            title="Refresh Account Registry"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-350 p-4 rounded-xl flex items-start gap-2.5 text-xs">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Operation Error</span>
            <p className="text-rose-300">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-350 p-4 rounded-xl flex items-start gap-2.5 text-xs animate-fade-in">
          <UserCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Success</span>
            <p className="text-emerald-300">{successMsg}</p>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter users by full name, username, or contact phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-400 rounded-xl pl-9 pr-8 py-2.5 text-xs focus:outline-none focus:bg-white/10 focus:border-teal-500/50 transition-all font-sans"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* BENCHMARK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
         {[
          { label: 'Total Users', count: users.length, style: 'bg-white/5 border-white/10 text-slate-100 hover:bg-white/10' },
          { label: 'System Admins', count: users.filter(u => u.role === 'admin').length, style: 'bg-violet-500/10 border-violet-500/20 text-violet-300 hover:bg-violet-500/15' },
          { label: 'Senior Engineers', count: users.filter(u => u.role === 'senior_technician').length, style: 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/15' },
          { label: 'Field Technicians', count: users.filter(u => u.role === 'technician').length, style: 'bg-teal-500/10 border-teal-500/20 text-teal-300 hover:bg-teal-500/15' }
        ].map((stat, i) => (
          <div key={i} className={`p-4 border rounded-2xl transition-all duration-150 ${stat.style}`}>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">{stat.label}</span>
            <p className="text-2xl font-extrabold tracking-tight mt-1 font-display">{stat.count}</p>
          </div>
        ))}
      </div>

      {/* USER LIST CARDS */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start justify-between">
              <div className="flex items-start gap-3 w-full">
                <div className="h-9 w-9 rounded-xl bg-white/10 shrink-0" />
                <div className="space-y-2 flex-1 pt-0.5">
                  <div className="h-4 bg-white/10 rounded-full w-24" />
                  <div className="h-3 bg-white/5 rounded-full w-16" />
                  <div className="pt-2 flex gap-2">
                    <div className="h-5 bg-white/10 rounded-full w-20" />
                    <div className="h-5 bg-white/5 rounded-full w-24" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="user-accounts-grid">
          {filteredUsers.map((user) => (
            <div 
              key={user.id} 
              className={`p-4 bg-white/5 hover:bg-white/10 border rounded-2xl flex items-start justify-between transition-all duration-150 ${
                isSelf(user.id) ? 'border-teal-500/35 bg-teal-500/5' : 'border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  user.role === 'admin' ? 'bg-violet-500/10 text-violet-300 border border-violet-500/25' :
                  user.role === 'coordinator' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/25' :
                  user.role === 'senior_technician' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/25' :
                  'bg-teal-500/10 text-teal-300 border border-teal-500/25'
                }`}>
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm tracking-tight">{user.name}</span>
                    {isSelf(user.id) && (
                      <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 font-extrabold px-1.5 py-0.5 rounded font-mono select-none">
                        YOU
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                  
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {getRoleBadge(user.role)}
                    
                    {user.phone ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-350 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        <Smartphone className="h-3 w-3 text-teal-400" /> {user.phone}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-450 italic">No phone registered</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTION MENU */}
              {currentUser?.role === 'admin' ? (
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(user)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-all"
                    title="Edit User Profile"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isSelf(user.id)}
                    onClick={() => setConfirmDeleteUser(user)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isSelf(user.id) 
                        ? 'text-slate-600 cursor-not-allowed opacity-30'
                        : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer'
                    }`}
                    title={isSelf(user.id) ? "Cannot delete yourself" : "Delete User"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Read Only</span>
              )}
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 italic text-xs border border-dashed border-white/10 rounded-2xl bg-white/5">
              No matching records found in team registry.
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX FOR CREATE / EDIT ACCOUNT FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto" id="account-form-overlay">
          <div className="bg-[#050e12]/95 backdrop-blur-xl w-full max-w-sm rounded-3xl shadow-2xl border border-white/10 max-h-[90vh] flex flex-col overflow-hidden animate-scale-up text-slate-100" id="account-form-container">
            
            {/* Modal Header */}
            <div className="bg-white/5 px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-white text-xs flex items-center gap-1.5 font-sans uppercase tracking-wider">
                  {editingUser ? 'Modify Account' : 'New System Operator'}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {editingUser ? `Editing ${editingUser.name}` : 'Create role-specific access permissions'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 px-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-semibold">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    disabled={!!editingUser}
                    className="w-full bg-slate-900 disabled:opacity-50 border border-white/10 rounded-xl py-2.5 pl-7 pr-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {editingUser ? 'New Password (Optional)' : 'Password (Required)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingUser ? '•••••• (leave blank to keep)' : '••••••'}
                    required={!editingUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 pl-3 pr-10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-450 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Access Permissions</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                >
                  <option value="admin">Administrator (System-wide Control)</option>
                  <option value="coordinator">Coordinator (Registration & Dispatch Only)</option>
                  <option value="senior_technician">Senior Technician (Repairs & Settle/Billing)</option>
                  <option value="technician">Technician (Update Jobs Only)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                />
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 border border-white/10 text-slate-400 rounded-xl py-2 text-xs font-bold hover:bg-white/5 hover:text-white transition-all text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white border border-teal-500/30 rounded-xl py-2 text-xs font-bold shadow-md transition-all text-center cursor-pointer active:scale-95"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto" id="delete-user-overlay">
          <div className="bg-[#050e12]/95 backdrop-blur-xl max-w-sm w-full rounded-3xl p-6 border border-white/10 text-left animate-scale-up space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <h4 className="font-extrabold text-sm tracking-tight font-sans text-white">Revoke Access Permissions?</h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              This will permanently revoke system access for <strong className="text-white">{confirmDeleteUser.name}</strong> (@{confirmDeleteUser.username}). Unassigned dispatches remains unaffected.
            </p>

            <div className="flex gap-2 pt-2 border-t border-white/10 mt-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="flex-1 border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl py-2 mt-2 text-xs font-bold cursor-pointer transition-all text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(confirmDeleteUser.id)}
                className="flex-1 bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500/30 rounded-xl py-2 mt-2 text-xs font-bold cursor-pointer transition-all shadow-md text-center active:scale-95"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
