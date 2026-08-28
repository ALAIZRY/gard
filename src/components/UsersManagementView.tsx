import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Search,
  Check,
  X,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import {
  UserAccount,
  ALL_PERMISSIONS,
  PermissionDefinition,
  loadUserAccounts,
  saveUserAccounts
} from '../utils/userUtils';

interface UsersManagementViewProps {
  currentUsername?: string;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({ currentUsername }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('مراقب مخزني');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Toggle Password Preview in table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setUsers(loadUserAccounts());
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormName('');
    setFormRole('مراقب مخزني');
    setFormPassword('123');
    // Default auditor permissions
    setSelectedPermissions(['view_catalog', 'view_inquiry', 'run_audit', 'edit_audit_records', 'complete_audit', 'view_reports', 'export_reports']);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormName(user.name);
    setFormRole(user.role);
    setFormPassword(user.password || '123');
    setSelectedPermissions(user.permissions || []);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleApplyPresetRole = (roleType: 'admin' | 'auditor' | 'pharmacist' | 'receiver') => {
    if (roleType === 'admin') {
      setFormRole('مدير النظام');
      setSelectedPermissions(ALL_PERMISSIONS.map((p) => p.key));
    } else if (roleType === 'auditor') {
      setFormRole('مراقب مخزني');
      setSelectedPermissions(['view_catalog', 'view_inquiry', 'run_audit', 'edit_audit_records', 'complete_audit', 'view_reports', 'export_reports']);
    } else if (roleType === 'pharmacist') {
      setFormRole('صيدلي');
      setSelectedPermissions(['view_catalog', 'view_inquiry']);
    } else if (roleType === 'receiver') {
      setFormRole('مستلم بضاعة');
      setSelectedPermissions(['view_catalog', 'edit_items', 'view_inquiry', 'manage_settings']);
    }
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAllPermissions = () => {
    if (selectedPermissions.length === ALL_PERMISSIONS.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(ALL_PERMISSIONS.map((p) => p.key));
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = formUsername.trim().toLowerCase();
    const cleanName = formName.trim();
    const cleanPass = formPassword.trim();

    if (!cleanUsername) {
      setErrorMsg('يرجى كتابة اسم المستخدم بالإنجليزية.');
      return;
    }

    if (!cleanName) {
      setErrorMsg('يرجى كتابة الاسم الكامل للمستخدم.');
      return;
    }

    if (!cleanPass) {
      setErrorMsg('يرجى كتابة كلمة السر.');
      return;
    }

    // Check duplicate username if adding new
    if (!editingUser) {
      const exists = users.some((u) => u.username.toLowerCase() === cleanUsername);
      if (exists) {
        setErrorMsg('اسم المستخدم هذا موجود بالفعل! يرجى اختيار اسم مستخدم آخر.');
        return;
      }
    }

    let updatedUsers: UserAccount[];

    if (editingUser) {
      updatedUsers = users.map((u) => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            username: cleanUsername,
            name: cleanName,
            role: formRole,
            password: cleanPass,
            permissions: selectedPermissions
          };
        }
        return u;
      });
    } else {
      const newUser: UserAccount = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        username: cleanUsername,
        name: cleanName,
        role: formRole,
        password: cleanPass,
        isSystem: false,
        permissions: selectedPermissions,
        createdAt: new Date().toISOString()
      };
      updatedUsers = [...users, newUser];
    }

    saveUserAccounts(updatedUsers);
    setUsers(updatedUsers);

    // Also update custom pass storage if modified
    try {
      localStorage.setItem(`rama_user_pass_${cleanUsername}`, cleanPass);
    } catch (e) {}

    // Update active user session if the edited user is currently logged in
    try {
      const activeSessionStr = sessionStorage.getItem('rama_auth_session');
      if (activeSessionStr) {
        const activeUser = JSON.parse(activeSessionStr);
        if (activeUser && activeUser.username.trim().toLowerCase() === cleanUsername) {
          const updatedActive = {
            ...activeUser,
            role: formRole,
            permissions: selectedPermissions
          };
          sessionStorage.setItem('rama_auth_session', JSON.stringify(updatedActive));
        }
      }
    } catch (err) {}

    setIsModalOpen(false);
    setSuccessMsg(editingUser ? 'تم تحديث بيانات المستخدم وصلاحياته بنجاح!' : 'تم إضافة المستخدم الجديد بنجاح!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (user.username.toLowerCase() === 'admin') {
      alert('لا يمكن حذف حساب مدير النظام الرئيسي الافتراضي.');
      return;
    }

    if (confirm(`هل أنت تأكد من حذف حساب المستخدم (${user.name} - ${user.username})؟`)) {
      const updated = users.filter((u) => u.id !== user.id);
      saveUserAccounts(updated);
      setUsers(updated);
      setSuccessMsg(`تم حذف المستخدم (${user.name}) بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const togglePasswordVisibilityInTable = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Group permissions by category
  const categories: PermissionDefinition['category'][] = [
    'أصناف المخزون',
    'الاستعلام',
    'الجرد الميداني',
    'التقارير',
    'الإعدادات والنظام',
    'إدارة المستخدمين'
  ];

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              إدارة المستخدمين وصلاحيات الوصول
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                أمان محلي 100%
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              إضافة المستخدمين والصيادلة، تحديد كلمات السر، والتحكم المباشر في صلاحيات الشاشات والجرد
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar & Table Header Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم المستخدم، الاسم الكامل، أو الوظيفة..."
              className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>إجمالي حسابات النظام:</span>
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-900 rounded-lg font-mono">
              {users.length} مستخدمين
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">اسم المستخدم</th>
                <th className="py-2.5 px-3">الاسم الكامل</th>
                <th className="py-2.5 px-3">المسمى الوظيفي / الدور</th>
                <th className="py-2.5 px-3 text-center">الصلاحيات الممنوحة</th>
                <th className="py-2.5 px-3 text-center">كلمة السر</th>
                <th className="py-2.5 px-3 text-center">نوع الحساب</th>
                <th className="py-2.5 px-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredUsers.map((user) => {
                const isCurrent = currentUsername?.toLowerCase() === user.username.toLowerCase();
                const isShowPass = visiblePasswords[user.id];
                const permCount = user.permissions?.length || 0;

                return (
                  <tr key={user.id} className={`hover:bg-slate-50/80 transition ${isCurrent ? 'bg-emerald-50/50' : ''}`}>
                    
                    {/* Username */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{user.username}</span>
                          {isCurrent && (
                            <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">أنت</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-3 font-bold text-slate-900">{user.name}</td>

                    {/* Role */}
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        user.role === 'مدير النظام' || user.role === 'مدير'
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : user.role === 'مراقب مخزني'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : user.role === 'صيدلي'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        <Shield className="w-3 h-3" />
                        <span>{user.role}</span>
                      </span>
                    </td>

                    {/* Permissions Count Badge */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{permCount} من {ALL_PERMISSIONS.length} صلاحيات</span>
                      </span>
                    </td>

                    {/* Password View */}
                    <td className="py-2.5 px-3 text-center font-mono">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-700 font-bold">
                          {isShowPass ? (user.password || '123') : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibilityInTable(user.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                          title={isShowPass ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                        >
                          {isShowPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    {/* System Account Badge */}
                    <td className="py-2.5 px-3 text-center">
                      {user.isSystem ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-200 rounded-md">افتراضي</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">مخصص</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(user)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition"
                          title="تعديل المستخدم والصلاحيات"
                        >
                          <Edit className="w-3.5 h-3.5 text-blue-600" />
                        </button>

                        {!user.isSystem && user.username.toLowerCase() !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition"
                            title="حذف المستخدم"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm font-['Cairo',sans-serif] overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    {editingUser ? `تعديل مستخدم وصلاحيات: ${editingUser.name}` : 'إضافة حساب مستخدم جديد'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    حدد اسم المستخدم وكلمة السر والصلاحيات المسموح بها بدقة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المستخدم (بالإنجليزية) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="مثال: pharma1"
                    disabled={!!editingUser && editingUser.username.toLowerCase() === 'admin'}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم الكامل / الموظف <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: د. محمد علي"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    كلمة السر <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="كلمة السر"
                      required
                      className="w-full pr-3 pl-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="مثال: صيدلي مناوب"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

              </div>

              {/* Quick Role Preset Buttons */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>نماذج الصلاحيات الجاهزة (اضغط لتطبيق النموذج سريعاً):</span>
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPresetRole('admin')}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold transition text-center"
                  >
                    👑 مدير النظام (شامل)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPresetRole('auditor')}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold transition text-center"
                  >
                    📋 مراقب مخزني (جرد)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPresetRole('pharmacist')}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition text-center"
                  >
                    💊 صيدلي (عرض فقط)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPresetRole('receiver')}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition text-center"
                  >
                    📦 مستلم بضاعة
                  </button>
                </div>
              </div>

              {/* Detailed Permissions Matrix Checklist */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>جدول الصلاحيات التفصيلية الممنوحة ({selectedPermissions.length} من {ALL_PERMISSIONS.length})</span>
                  </label>

                  <button
                    type="button"
                    onClick={toggleAllPermissions}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    {selectedPermissions.length === ALL_PERMISSIONS.length ? 'إلغاء تحديد الكل' : 'تحديد جميع الصلاحيات'}
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const catPerms = ALL_PERMISSIONS.filter((p) => p.category === cat);
                    return (
                      <div key={cat} className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-2">
                        <p className="text-[11px] font-black text-slate-700 border-b border-slate-200 pb-1">
                          📁 {cat}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catPerms.map((perm) => {
                            const isChecked = selectedPermissions.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                                  isChecked
                                    ? 'bg-emerald-50/80 border-emerald-300 text-slate-900 font-bold shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(perm.key)}
                                  className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                                />
                                <div>
                                  <span className="block text-slate-900 font-bold">{perm.label}</span>
                                  <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{perm.description}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{editingUser ? 'حفظ تعديلات الحساب' : 'إنشاء المستخدم والتفعيل'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
