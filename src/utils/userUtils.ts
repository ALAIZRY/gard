export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: 'أصناف المخزون' | 'الاستعلام' | 'الجرد الميداني' | 'التقارير' | 'الإعدادات والنظام' | 'إدارة المستخدمين';
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: string;
  password: string;
  isSystem?: boolean;
  permissions: string[];
  createdAt: string;
  lastLogin?: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // أصناف المخزون
  { key: 'view_catalog', label: 'عرض الأصناف والمخزون', description: 'السماح بتصفح قائمة جميع الأصناف والبحث فيها', category: 'أصناف المخزون' },
  { key: 'edit_items', label: 'إضافة وتعديل الأصناف والأسعار', description: 'إضافة صنف جديد، وتعديل أسعار البيع والتكلفة والعبوات', category: 'أصناف المخزون' },
  { key: 'delete_items', label: 'حذف الأصناف وقاعدة البيانات', description: 'حذف صنف أو أصناف محددة أو تفريغ القاعدة', category: 'أصناف المخزون' },

  // الاستعلام
  { key: 'view_inquiry', label: 'الاستعلام عن الأصناف والباركود', description: 'تصفح شاشة البحث السريع والباركود والوحدات', category: 'الاستعلام' },

  // الجرد الميداني
  { key: 'run_audit', label: 'بدء وإجراء الجرد الميداني', description: 'فتح جلسة جرد جديدة، قراءة الباركود وإدخال الكميات', category: 'الجرد الميداني' },
  { key: 'edit_audit_records', label: 'تعديل وحذف سجلات الجرد', description: 'تغيير الكميات المجرودة وتعديل الموقع/الأعمدة في الجرد', category: 'الجرد الميداني' },
  { key: 'complete_audit', label: 'اعتماد وإغلاق الجلسات', description: 'إنهاء الجرد واعتماد النتائج بشكل نهائي', category: 'الجرد الميداني' },

  // التقارير
  { key: 'view_reports', label: 'عرض تقارير الفروقات والتكاليف', description: 'استعراض مطابقة الجرد، تقارير العجز والزيادة والمالية', category: 'التقارير' },
  { key: 'export_reports', label: 'تصدير وطباعة التقارير', description: 'تنزيل كشوفات الإكسل وطباعة تقارير الجرد المعتمدة', category: 'التقارير' },

  // الإعدادات والنظام
  { key: 'manage_settings', label: 'الضبط واستيراد الإكسل والنسخ', description: 'تهيئة بيانات الترويسة والمخزن واستيراد وتصدير الإكسل', category: 'الإعدادات والنظام' },

  // إدارة المستخدمين
  { key: 'manage_users', label: 'إدارة المستخدمين والصلاحيات', description: 'إضافة مستخدمين جدد وتغيير كلمات السر والصلاحيات', category: 'إدارة المستخدمين' },
];

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    name: 'مدير النظام / الصيدلي المسؤول',
    role: 'مدير النظام',
    password: '123',
    isSystem: true,
    permissions: ALL_PERMISSIONS.map((p) => p.key),
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr_auditor',
    username: 'auditor',
    name: 'مسؤول الجرد والمخزن',
    role: 'مراقب مخزني',
    password: '123',
    isSystem: true,
    permissions: ['view_catalog', 'view_inquiry', 'run_audit', 'edit_audit_records', 'complete_audit', 'view_reports', 'export_reports'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'usr_pharmacist',
    username: 'pharmacist',
    name: 'صيدلي مناوب',
    role: 'صيدلي',
    password: '123',
    isSystem: false,
    permissions: ['view_catalog', 'view_inquiry'],
    createdAt: new Date().toISOString()
  }
];

const USER_STORAGE_KEY = 'rama_user_accounts';

export const loadUserAccounts = (): UserAccount[] => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading user accounts:', e);
  }
  // Fallback to initial users and save them
  saveUserAccounts(INITIAL_USERS);
  return INITIAL_USERS;
};

export const saveUserAccounts = (users: UserAccount[]): void => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving user accounts:', e);
  }
};

export const getUserByUsername = (username: string): UserAccount | null => {
  const users = loadUserAccounts();
  const clean = username.trim().toLowerCase();
  return users.find((u) => u.username.toLowerCase() === clean) || null;
};

export const hasUserPermission = (
  currentUser: { username: string; role?: string; permissions?: string[] } | null,
  permissionKey: string
): boolean => {
  if (!currentUser || !currentUser.username) return false;

  const cleanUsername = currentUser.username.trim().toLowerCase();

  // Master superadmin 'admin' always has 100% full access
  if (cleanUsername === 'admin') {
    return true;
  }

  // Always look up latest saved account permissions from localStorage
  const account = getUserByUsername(currentUser.username);
  if (account) {
    if (account.username.trim().toLowerCase() === 'admin') return true;
    if (account.permissions && Array.isArray(account.permissions)) {
      return account.permissions.includes(permissionKey);
    }
  }

  // Fallback to session permissions if account not found in local users
  if (currentUser.permissions && Array.isArray(currentUser.permissions)) {
    return currentUser.permissions.includes(permissionKey);
  }

  return false;
};
