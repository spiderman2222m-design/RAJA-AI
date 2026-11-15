import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, CreditCard, Crown, ExternalLink, Loader2, ShieldCheck, X } from 'lucide-react';
import { createPaymentOrder, verifyPaymentOrder } from '../lib/api';
import { commitVerifiedSubscriptionUpgrade } from '../lib/firestoreService';
import type { AppSettings, UserProfile } from '../types';

interface SubscriptionModalProps {
  isOpen: boolean;
  reason?: string | null;
  userProfile: UserProfile;
  appSettings: AppSettings;
  onClose: () => void;
}

export function SubscriptionModal({
  isOpen,
  reason,
  userProfile,
  appSettings,
  onClose,
}: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'premium_monthly' | 'premium_yearly'>('premium_monthly');
  const [checkoutStep, setCheckoutStep] = useState<'plans' | 'checkout' | 'success'>('plans');
  const [provider, setProvider] = useState<'upi_verified' | 'razorpay_verified' | 'stripe_verified'>('upi_verified');
  const [transactionRef, setTransactionRef] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    plan: 'premium_monthly' | 'premium_yearly';
    amount: number;
    merchantUpiId: string;
    upiUri: string;
    issuedAt: number;
    orderToken: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!orderData?.upiUri) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(orderData.upiUri, {
      width: 220,
      margin: 2,
      color: {
        dark: '#09080D',
        light: '#F4F1EA',
      },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [orderData?.upiUri]);

  if (!isOpen) return null;

  const monthlyPrice = appSettings.monthlyPriceInr || 499;
  const yearlyPrice = appSettings.yearlyPriceInr || 4999;
  const merchantUpiId = appSettings.merchantUpiId || '6353688361@fam';

  const startCheckout = async (plan: 'premium_monthly' | 'premium_yearly') => {
    setSelectedPlan(plan);
    setErrorMsg(null);
    setLoading(true);
    try {
      const price = plan === 'premium_monthly' ? monthlyPrice : yearlyPrice;
      const order = await createPaymentOrder(plan, price, merchantUpiId);
      setOrderData(order);
      setTransactionRef('');
      setCheckoutStep('checkout');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start checkout.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUpi = async () => {
    const upi = orderData?.merchantUpiId || merchantUpiId;
    await navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 1800);
  };

  const handleVerifyAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderData || !transactionRef.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const verified = await verifyPaymentOrder({
        orderId: orderData.orderId,
        plan: orderData.plan,
        amount: orderData.amount,
        issuedAt: orderData.issuedAt,
        orderToken: orderData.orderToken,
        provider,
        transactionRef: transactionRef.trim(),
      });

      await commitVerifiedSubscriptionUpgrade({
        uid: userProfile.uid,
        paymentId: verified.paymentId,
        plan: verified.plan,
        billingCycle: verified.billingCycle,
        amount: verified.amount,
        currency: verified.currency,
        provider: verified.provider,
        transactionRef: verified.transactionRef,
        signature: verified.signature,
        expiresAt: verified.expiresAt,
      });

      setCheckoutStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#12101A] border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-2xl my-auto">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#F4F1EA]">
              APNA RAJA AI Membership
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setCheckoutStep('plans');
              onClose();
            }}
            aria-label="Close modal"
            className="p-2 rounded-lg text-[#9E97AD] hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {reason && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-200">
              {reason}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs sm:text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          {checkoutStep === 'plans' && (
            <div className="grid md:grid-cols-3 gap-4">
              {/* Free Plan */}
              <div className="rounded-2xl bg-[#09080D] border border-white/10 p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-[#9E97AD]">For Exploring</p>
                  <h3 className="mt-1 text-lg font-bold text-[#F4F1EA]">Free Plan</h3>
                  <p className="mt-3 text-2xl font-bold font-mono-tabular text-[#F4F1EA]">₹0</p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#B6B0C4]">
                    <li>{appSettings.freeLimits.chatCount} AI Chat turns</li>
                    <li>{appSettings.freeLimits.voiceCount} Voice replies</li>
                    <li>{appSettings.freeLimits.imageCount} AI Images</li>
                    <li>{appSettings.freeLimits.videoCount} AI Videos</li>
                    <li>
                      {appSettings.freeLimits.writerCount} Content drafts · {appSettings.freeLimits.codeCount} Code tasks
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-white/8 text-xs text-[#9E97AD]">
                  {userProfile.plan === 'free' ? 'Active Plan' : 'Included Base Tier'}
                </div>
              </div>

              {/* Monthly Plan */}
              <div className="rounded-2xl bg-[#181326] border border-[#7C3AED]/50 p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-[#A78BFA]">For Daily Creators</p>
                  <h3 className="mt-1 text-lg font-bold text-[#F4F1EA]">Royal Monthly</h3>
                  <p className="mt-3 text-2xl font-bold font-mono-tabular text-[#F4F1EA]">
                    ₹{monthlyPrice} <span className="text-xs font-normal text-[#9E97AD]">/ month</span>
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#EAE6F3]">
                    <li>Unlimited AI Chat & Translation</li>
                    <li>Unlimited Content Writer & Code Assistant</li>
                    <li>Priority Voice Assistant (TTS + STT)</li>
                    <li>Expanded Image & Video Studio Access</li>
                    <li>Full Cross-Device Synced History</li>
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={loading || userProfile.plan === 'premium_monthly'}
                  onClick={() => startCheckout('premium_monthly')}
                  className="mt-6 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {userProfile.plan === 'premium_monthly' ? 'Active Plan' : 'Choose Monthly'}
                </button>
              </div>

              {/* Yearly Plan */}
              <div className="rounded-2xl bg-[#191524] border border-[#D4AF37]/60 p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-[#D4AF37]">For Power Users · Best Value</p>
                  <h3 className="mt-1 text-lg font-bold text-[#F4F1EA]">Royal Yearly</h3>
                  <p className="mt-3 text-2xl font-bold font-mono-tabular text-[#F3D578]">
                    ₹{yearlyPrice} <span className="text-xs font-normal text-[#9E97AD]">/ year</span>
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#EAE6F3]">
                    <li>Everything in Royal Monthly</li>
                    <li>Save 2 months annually</li>
                    <li>Highest priority Gemini processing</li>
                    <li>Full HD Video & 2.1 Image Studio priority</li>
                    <li>Dedicated sovereign workspace</li>
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={loading || userProfile.plan === 'premium_yearly'}
                  onClick={() => startCheckout('premium_yearly')}
                  className="mt-6 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#09080D] font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {userProfile.plan === 'premium_yearly' ? 'Active Plan' : 'Choose Yearly'}
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 'checkout' && orderData && (
            <form onSubmit={handleVerifyAndActivate} className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 rounded-xl bg-[#09080D] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#9E97AD]">Order ID: {orderData.orderId}</p>
                  <p className="text-sm font-semibold text-[#F4F1EA] mt-0.5">
                    {selectedPlan === 'premium_monthly' ? 'Royal Monthly Plan' : 'Royal Yearly Plan'}
                  </p>
                </div>
                <p className="text-xl font-bold font-mono-tabular text-[#D4AF37]">₹{orderData.amount}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B6B0C4] mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'upi_verified', label: 'UPI / QR' },
                    { id: 'razorpay_verified', label: 'Razorpay' },
                    { id: 'stripe_verified', label: 'Card / Stripe' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setProvider(item.id as typeof provider)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors ${
                        provider === item.id
                          ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white'
                          : 'bg-[#09080D] border-white/10 text-[#9E97AD]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {provider === 'upi_verified' && (
                <div className="rounded-2xl bg-[#09080D] border border-[#D4AF37]/30 p-5 grid sm:grid-cols-[auto_1fr] gap-5 items-center">
                  <div className="w-40 h-40 mx-auto rounded-xl bg-[#F4F1EA] p-2 flex items-center justify-center shrink-0">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Scan UPI QR to pay ${orderData.merchantUpiId}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin text-[#09080D]" />
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[#9E97AD]">Pay directly to Merchant UPI ID</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="px-3 py-2 rounded-lg bg-[#161321] border border-white/10 font-mono-tabular text-sm text-[#F3D578] select-all">
                          {orderData.merchantUpiId}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#1A1626] hover:bg-[#251F36] border border-white/10 text-[#F4F1EA] flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedUpi ? 'Copied' : 'Copy UPI'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[#9E97AD] leading-relaxed">
                      Scan the QR code with FamPay, Google Pay, PhonePe, or Paytm, or tap below on Android to pay ₹
                      {orderData.amount}. Then enter your 12-digit UPI Reference / UTR ID below.
                    </p>

                    <a
                      href={orderData.upiUri}
                      className="inline-flex min-h-[40px] items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold text-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open UPI App to Pay ₹{orderData.amount}
                    </a>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="txn-ref" className="block text-xs font-medium text-[#B6B0C4] mb-1.5">
                  {provider === 'upi_verified'
                    ? 'Enter UPI Transaction / 12-Digit UTR Number'
                    : 'Verified Transaction Reference ID'}
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-3" />
                  <input
                    id="txn-ref"
                    type="text"
                    required
                    minLength={6}
                    placeholder={provider === 'upi_verified' ? 'e.g. 432198765432' : 'e.g. pay_N8x92kL1'}
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#09080D] border border-white/12 focus:border-[#D4AF37] focus:outline-none text-sm font-mono-tabular text-[#F4F1EA] placeholder:text-[#6D677D]"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#9E97AD] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Verified server-side via HMAC-SHA256 signature & atomic Firestore ledger.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutStep('plans')}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A1626] border border-white/10 text-xs font-medium text-[#F4F1EA]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !transactionRef.trim()}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#09080D] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify & Activate Subscription
                </button>
              </div>
            </form>
          )}

          {checkoutStep === 'success' && (
            <div className="max-w-md mx-auto py-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl font-bold text-[#F4F1EA]">Royal Access Activated</h3>
              <p className="text-sm text-[#9E97AD]">
                Your payment has been cryptographically verified and your subscription is now active.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCheckoutStep('plans');
                  onClose();
                }}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D4AF37] text-[#09080D] font-semibold text-sm"
              >
                Return to Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
