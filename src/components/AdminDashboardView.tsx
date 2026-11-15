import { useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import {
  adminFetchAllPayments,
  adminFetchAllUsers,
  adminUpdateUserAccount,
  saveAppSettings,
} from '../lib/firestoreService';
import type { AppSettings, PaymentRecord, PlanTier, UsageMap, UserProfile } from '../types';

interface AdminDashboardViewProps {
  currentUser: UserProfile;
  appSettings: AppSettings;
}

export function AdminDashboardView({ currentUser, appSettings }: AdminDashboardViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'settings'>('users');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [limitsDraft, setLimitsDraft] = useState<UsageMap>(appSettings.freeLimits);
  const [monthlyPrice, setMonthlyPrice] = useState(appSettings.monthlyPriceInr);
  const [yearlyPrice, setYearlyPrice] = useState(appSettings.yearlyPriceInr);
  const [merchantUpiId, setMerchantUpiId] = useState(appSettings.merchantUpiId || '6353688361@fam');

  const loadAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [uList, pList] = await Promise.all([adminFetchAllUsers(), adminFetchAllPayments()]);
      setUsers(uList);
      setPayments(pList);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load admin records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    setLimitsDraft(appSettings.freeLimits);
    setMonthlyPrice(appSettings.monthlyPriceInr);
    setYearlyPrice(appSettings.yearlyPriceInr);
    setMerchantUpiId(appSettings.merchantUpiId || '6353688361@fam');
  }, [appSettings]);

  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const premiumUsers = users.filter((u) => u.plan !== 'free').length;
  const totalAiRequests = users.reduce((sum, u) => {
    const usage = u.usage;
    if (!usage) return sum;
    return (
      sum +
      (usage.chatCount || 0) +
      (usage.voiceCount || 0) +
      (usage.imageCount || 0) +
      (usage.videoCount || 0) +
      (usage.writerCount || 0) +
      (usage.codeCount || 0) +
      (usage.translateCount || 0)
    );
  }, 0);

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.plan?.toLowerCase().includes(q)
    );
  });

  const handlePlanChange = async (target: UserProfile, plan: PlanTier) => {
    setStatusMsg(null);
    try {
      await adminUpdateUserAccount({ targetUid: target.uid, plan });
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, plan } : u)));
      setStatusMsg(`Updated ${target.email} to ${plan}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update user plan.');
    }
  };

  const handleToggleBlock = async (target: UserProfile) => {
    if (target.uid === currentUser.uid) return;
    try {
      const nextBlocked = !target.isBlocked;
      await adminUpdateUserAccount({ targetUid: target.uid, isBlocked: nextBlocked });
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, isBlocked: nextBlocked } : u)));
      setStatusMsg(`${target.email} is now ${nextBlocked ? 'suspended' : 'active'}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update block status.');
    }
  };

  const handleResetUsage = async (target: UserProfile) => {
    try {
      await adminUpdateUserAccount({ targetUid: target.uid, resetUsage: true });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === target.uid
            ? {
                ...u,
                usage: {
                  chatCount: 0,
                  voiceCount: 0,
                  imageCount: 0,
                  videoCount: 0,
                  writerCount: 0,
                  codeCount: 0,
                  translateCount: 0,
                },
              }
            : u
        )
      );
      setStatusMsg(`Reset usage counters for ${target.email}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reset usage.');
    }
  };

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await saveAppSettings({
        updatedBy: currentUser.uid,
        freeLimits: limitsDraft,
        monthlyPriceInr: Number(monthlyPrice) || 499,
        yearlyPriceInr: Number(yearlyPrice) || 4999,
        merchantUpiId: merchantUpiId.trim() || '6353688361@fam',
      });
      setStatusMsg('Global limits, UPI handle, and subscription pricing saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save global settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#F4F1EA] flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-[#D4AF37]" />
              Owner Admin Console
            </h2>
            <p className="mt-1 text-sm text-[#9E97AD]">
              Manage user accounts, AI feature quotas, verified subscriptions, and pricing.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAdminData}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#161321] border border-white/10 hover:border-[#D4AF37]/40 text-xs font-medium text-[#F4F1EA] flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-[#12101A] border border-white/10 p-4">
            <p className="text-xs text-[#9E97AD]">Registered Users</p>
            <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#F4F1EA]">{users.length}</p>
          </div>
          <div className="rounded-2xl bg-[#12101A] border border-white/10 p-4">
            <p className="text-xs text-[#9E97AD]">Premium Subscribers</p>
            <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#D4AF37]">{premiumUsers}</p>
          </div>
          <div className="rounded-2xl bg-[#12101A] border border-white/10 p-4">
            <p className="text-xs text-[#9E97AD]">Verified Revenue</p>
            <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-emerald-400">₹{totalRevenue}</p>
          </div>
          <div className="rounded-2xl bg-[#12101A] border border-white/10 p-4">
            <p className="text-xs text-[#9E97AD]">Total AI Operations</p>
            <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#A78BFA]">{totalAiRequests}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#12101A] border border-white/10 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users' ? 'bg-[#7C3AED] text-white' : 'text-[#9E97AD] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users & Usage
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'payments' ? 'bg-[#7C3AED] text-white' : 'text-[#9E97AD] hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Payments ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-[#7C3AED] text-white' : 'text-[#9E97AD] hover:text-white'
            }`}
          >
            Quotas & Pricing
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-[#9E97AD] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or plan..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#12101A] border border-white/10 focus:border-[#D4AF37] focus:outline-none text-xs text-[#F4F1EA]"
              />
            </div>

            <div className="rounded-2xl bg-[#12101A] border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-[#9E97AD]">
                  <tr>
                    <th className="py-3 px-4 font-medium">User</th>
                    <th className="py-3 px-4 font-medium">Plan</th>
                    <th className="py-3 px-4 font-medium text-right">Chat / Voice / Code</th>
                    <th className="py-3 px-4 font-medium text-right">Img / Vid</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#9E97AD]">
                        Loading accounts...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#9E97AD]">
                        No matching users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#F4F1EA]">{u.displayName}</div>
                          <div className="text-[#9E97AD]">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            aria-label={`Plan for ${u.email}`}
                            value={u.plan}
                            onChange={(e) => handlePlanChange(u, e.target.value as PlanTier)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#09080D] border border-white/12 text-xs text-[#F4F1EA]"
                          >
                            <option value="free">Free</option>
                            <option value="premium_monthly">Monthly</option>
                            <option value="premium_yearly">Yearly</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-[#EAE6F3]">
                          {u.usage?.chatCount || 0} / {u.usage?.voiceCount || 0} / {u.usage?.codeCount || 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-[#EAE6F3]">
                          {u.usage?.imageCount || 0} / {u.usage?.videoCount || 0}
                        </td>
                        <td className="py-3 px-4">
                          <span className={u.isBlocked ? 'text-red-400' : 'text-emerald-400'}>
                            {u.isBlocked ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleResetUsage(u)}
                            className="px-2.5 py-1 rounded-lg bg-[#1A1626] hover:bg-[#241E35] border border-white/10 text-[#D4AF37]"
                          >
                            Reset Quota
                          </button>
                          {u.uid !== currentUser.uid && (
                            <button
                              type="button"
                              onClick={() => handleToggleBlock(u)}
                              className="px-2.5 py-1 rounded-lg bg-[#1A1626] hover:bg-red-500/20 border border-white/10 text-red-300 inline-flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3" />
                              {u.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="rounded-2xl bg-[#12101A] border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[#9E97AD]">
                <tr>
                  <th className="py-3 px-4 font-medium">Payment ID</th>
                  <th className="py-3 px-4 font-medium">User UID</th>
                  <th className="py-3 px-4 font-medium">Plan</th>
                  <th className="py-3 px-4 font-medium">Method / Ref</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#9E97AD]">
                      No verified subscription payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-mono-tabular text-[#D4AF37]">{p.id}</td>
                      <td className="py-3 px-4 font-mono-tabular text-[#9E97AD]">{p.userId}</td>
                      <td className="py-3 px-4 text-[#F4F1EA]">{p.plan}</td>
                      <td className="py-3 px-4 text-[#EAE6F3]">
                        {p.provider} · <span className="font-mono-tabular">{p.transactionRef}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-emerald-400">
                        ₹{p.amount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'settings' && (
          <form
            onSubmit={handleSaveGlobalSettings}
            className="rounded-2xl bg-[#12101A] border border-white/10 p-6 space-y-6 max-w-2xl"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#9E97AD] mb-1.5">Monthly Plan Price (INR)</label>
                <input
                  type="number"
                  min={49}
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#09080D] border border-white/12 text-sm font-mono-tabular text-[#F4F1EA]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9E97AD] mb-1.5">Yearly Plan Price (INR)</label>
                <input
                  type="number"
                  min={99}
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#09080D] border border-white/12 text-sm font-mono-tabular text-[#F4F1EA]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#9E97AD] mb-1.5">Merchant UPI ID (for QR & UPI Checkout)</label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={120}
                value={merchantUpiId}
                onChange={(e) => setMerchantUpiId(e.target.value)}
                placeholder="6353688361@fam"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#09080D] border border-white/12 text-sm font-mono-tabular text-[#F3D578]"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#D4AF37] mb-3">Free Tier Feature Quotas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {(Object.keys(limitsDraft) as Array<keyof UsageMap>).map((key) => (
                  <div key={key}>
                    <label className="block text-[11px] text-[#9E97AD] mb-1">{key}</label>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={limitsDraft[key]}
                      onChange={(e) =>
                        setLimitsDraft((prev) => ({
                          ...prev,
                          [key]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#09080D] border border-white/12 text-xs font-mono-tabular text-[#F4F1EA]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#09080D] font-semibold text-sm flex items-center gap-2"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Global Rules
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
