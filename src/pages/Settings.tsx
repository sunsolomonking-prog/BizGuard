import React from 'react';
import { Settings as SettingsIcon, Building2, Bell, Shield, Save, RefreshCw, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { toAppBusiness } from '../lib/business';
import { roleLabel } from '../lib/rbac';

interface BusinessForm {
  name: string;
  industry: string;
  location: string;
  currency: string;
  timezone: string;
  taxRate: string;
  lowStockThreshold: string;
}

interface ProfileForm {
  name: string;
  email: string;
  role: string;
}

export const Settings: React.FC = () => {
  const { currentBusiness, user, theme, toggleTheme, setCurrentBusiness, setBusinesses, setUser } = useAppStore();
  const [businessForm, setBusinessForm] = React.useState<BusinessForm>({ name: '', industry: '', location: '', currency: 'NGN', timezone: 'Africa/Lagos', taxRate: '7.5', lowStockThreshold: '10' });
  const [profileForm, setProfileForm] = React.useState<ProfileForm>({ name: '', email: '', role: '' });
  const [isSavingBusiness, setIsSavingBusiness] = React.useState(false);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  React.useEffect(() => {
    if (currentBusiness) {
      setBusinessForm({
        name: currentBusiness.name,
        industry: currentBusiness.industry,
        location: currentBusiness.location,
        currency: currentBusiness.currency,
        timezone: currentBusiness.timezone,
        taxRate: String(currentBusiness.settings.taxRate ?? 7.5),
        lowStockThreshold: String(currentBusiness.settings.lowStockThreshold ?? 10),
      });
    }
  }, [currentBusiness]);

  React.useEffect(() => {
    if (user) setProfileForm({ name: user.name, email: user.email, role: user.role });
  }, [user]);

  const saveBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentBusiness?.id) return;
    setIsSavingBusiness(true);
    const settings = {
      ...currentBusiness.settings,
      taxRate: Number(businessForm.taxRate) || 0,
      lowStockThreshold: Number(businessForm.lowStockThreshold) || 0,
    };
    const { data, error } = await supabase
      .from('businesses')
      .update({
        name: businessForm.name.trim(),
        industry: businessForm.industry.trim() || 'General',
        location: businessForm.location.trim(),
        currency: businessForm.currency.trim() || 'NGN',
        timezone: businessForm.timezone.trim() || 'Africa/Lagos',
        settings,
      })
      .eq('id', currentBusiness.id)
      .select('*')
      .single();

    if (error) {
      toast.error(`Could not save business settings: ${error.message}`);
    } else if (data) {
      const business = toAppBusiness(data);
      setCurrentBusiness(business);
      setBusinesses([business]);
      toast.success('Business settings saved');
    }
    setIsSavingBusiness(false);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    setIsSavingProfile(true);
    const { data, error } = await supabase
      .from('users')
      .update({ name: profileForm.name.trim() || user.name })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) {
      toast.error(`Could not save profile: ${error.message}`);
    } else if (data) {
      setUser({ ...user, name: data.name, email: data.email, businessId: data.business_id, role: data.role as typeof user.role });
      await supabase.auth.updateUser({ data: { name: data.name, full_name: data.name } });
      toast.success('Profile saved');
    }
    setIsSavingProfile(false);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-1 text-slate-500">Manage business profile, account preferences, notifications, and security settings</p>
      </div>

      <form onSubmit={saveBusiness} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4"><Building2 className="h-5 w-5 text-slate-500" /><h2 className="font-semibold text-slate-800">Business Settings</h2></div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Business Name</span><input value={businessForm.name} onChange={(event) => setBusinessForm({ ...businessForm, name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" required /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Industry</span><input value={businessForm.industry} onChange={(event) => setBusinessForm({ ...businessForm, industry: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Location</span><input value={businessForm.location} onChange={(event) => setBusinessForm({ ...businessForm, location: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Currency</span><input value={businessForm.currency} onChange={(event) => setBusinessForm({ ...businessForm, currency: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Timezone</span><input value={businessForm.timezone} onChange={(event) => setBusinessForm({ ...businessForm, timezone: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Tax Rate (%)</span><input type="number" value={businessForm.taxRate} onChange={(event) => setBusinessForm({ ...businessForm, taxRate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Low Stock Threshold</span><input type="number" value={businessForm.lowStockThreshold} onChange={(event) => setBusinessForm({ ...businessForm, lowStockThreshold: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><button disabled={isSavingBusiness} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 font-semibold text-white disabled:opacity-50">{isSavingBusiness ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Business</button></div>
      </form>

      <form onSubmit={saveProfile} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4"><User className="h-5 w-5 text-slate-500" /><h2 className="font-semibold text-slate-800">Profile</h2></div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Full Name</span><input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Email</span><input value={profileForm.email} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" /></label>
          <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Role</span><input value={roleLabel(profileForm.role)} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" /></label>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><button disabled={isSavingProfile} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{isSavingProfile ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Profile</button></div>
      </form>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><SettingsIcon className="h-6 w-6 text-emerald-600" /><h3 className="mt-3 font-bold text-slate-800">Preferences</h3><p className="mt-1 text-sm text-slate-500">Theme: {theme === 'light' ? 'Light' : 'Dark'}</p><button onClick={toggleTheme} className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Toggle Theme</button></div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><Bell className="h-6 w-6 text-blue-600" /><h3 className="mt-3 font-bold text-slate-800">Notifications</h3><p className="mt-1 text-sm text-slate-500">Low stock, debtor, sales, and security alerts are managed in the Notification Center.</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><Shield className="h-6 w-6 text-purple-600" /><h3 className="mt-3 font-bold text-slate-800">Security</h3><p className="mt-1 text-sm text-slate-500">Protected by Supabase Auth, tenant-aware RLS, and role-based route protection.</p></div>
      </div>
    </div>
  );
};

export default Settings;
