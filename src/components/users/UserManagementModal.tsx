import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { api } from '../../services/api';
import { X, UserPlus, Trash2, Shield, User as UserIcon } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !name.trim()) {
      setError('Please fill in all user fields.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      await api.createUser({
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        role,
      });
      setUsername('');
      setPassword('');
      setName('');
      setRole('user');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await api.deleteUser(id);
        loadUsers();
      } catch (err: any) {
        setError(err.message || 'Failed to delete user');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 z-10 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">User Management</h3>
              <p className="text-xs text-slate-500">Manage site team & admin credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {/* Create User Form */}
          <form
            onSubmit={handleCreateUser}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
          >
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Add New User
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Full Name (e.g. Asad Ali)"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              />
              <input
                type="text"
                placeholder="Username (e.g. asad)"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
              >
                <option value="user">User (Supervisor)</option>
                <option value="admin">Admin (Full Access)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User</span>
            </button>
          </form>

          {/* User List */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Existing Accounts ({users.length})
            </span>
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{u.name}</p>
                      <p className="text-[11px] text-slate-500">
                        @{u.username} •{' '}
                        <span
                          className={`font-semibold ${
                            u.role === 'admin' ? 'text-amber-700' : 'text-slate-700'
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  </div>
                  {u.id !== 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
