import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { AlertCircle, CheckCircle2, Globe, Mail, RefreshCw } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { TRANSLATIONS } from '../i18n/translations';
import type { AppLanguage } from '../types';

interface AuthScreenProps {
  language: AppLanguage;
  onLanguageChange: (lang: AppLanguage) => void;
  unverifiedUser: User | null;
  onVerifiedRefresh: () => void;
}

export function AuthScreen({
  language,
  onLanguageChange,
  unverifiedUser,
  onVerifiedRefresh,
}: AuthScreenProps) {
  const t = TRANSLATIONS[language];
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed before completing.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowConsoleGuide(false);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim().slice(0, 120) });
        }
        await sendEmailVerification(cred.user);
        setInfoMsg('Verification email sent. Please confirm your email address.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setShowConsoleGuide(true);
        setErrorMsg(
          'Email/Password authentication is not yet enabled in your Firebase project. Use Google Sign-In now, or enable Email/Password in Firebase Console.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Switch to Sign In.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password must be at least 6 characters.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setErrorMsg('Enter your email address above first to reset your password.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg(`Password reset email sent to ${email.trim()}.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await sendEmailVerification(unverifiedUser);
      setInfoMsg('A fresh verification link was sent to your inbox.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!unverifiedUser) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await reload(unverifiedUser);
      if (auth.currentUser?.emailVerified) {
        onVerifiedRefresh();
      } else {
        setErrorMsg('Your email is still unverified. Click the link in your email inbox first.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification check failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09080D] text-[#F4F1EA] grid lg:grid-cols-2">
      {/* Left Royal Showcase Panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-[#D4AF37]/15">
        <img
          src="/src/assets/images/royal_hero_backdrop_1794730096891.jpg"
          alt="Royal studio interior"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#09080D]/90 via-[#120D1F]/80 to-[#09080D]/95" />

        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src="/src/assets/images/royal_ai_emblem_1794730096169.jpg"
            alt="APNA RAJA AI logo"
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-lg object-cover border border-[#D4AF37]/40"
          />
          <span className="font-display text-xl font-bold tracking-wider text-[#F4F1EA]">
            {t.brandName}
          </span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight text-balance text-[#F4F1EA]">
            Intelligence Crafted for Clarity, Speed, and Sovereign Control.
          </h2>
          <p className="text-base text-[#B6B0C4] leading-relaxed">
            Conversational reasoning, voice dialogue, multilingual translation in Hindi, English, and Gujarati,
            plus dedicated studios for writing, code, images, and video.
          </p>

          <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-[#D4AF37] font-semibold">3 Languages</p>
              <p className="text-[#9E97AD] mt-1">Hindi · English · Gujarati</p>
            </div>
            <div>
              <p className="text-[#D4AF37] font-semibold">7 AI Studios</p>
              <p className="text-[#9E97AD] mt-1">Chat · Voice · Media · Code</p>
            </div>
            <div>
              <p className="text-[#D4AF37] font-semibold">Synced History</p>
              <p className="text-[#9E97AD] mt-1">Web & Android Responsive</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-[#9E97AD]">
          {t.brandName} · {t.tagline}
        </p>
      </div>

      {/* Right Authentication Panel */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-center justify-between">
          <div className="flex lg:hidden items-center gap-2.5">
            <img
              src="/src/assets/images/royal_ai_emblem_1794730096169.jpg"
              alt="APNA RAJA AI logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-[#D4AF37]/40"
            />
            <span className="font-display text-lg font-bold tracking-wide">{t.brandName}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 bg-[#12101A] border border-white/10 rounded-lg p-1">
            <Globe className="w-4 h-4 text-[#D4AF37] ml-2" aria-hidden="true" />
            {(['en', 'hi', 'gu'] as AppLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  language === lang
                    ? 'bg-[#7C3AED] text-white'
                    : 'text-[#9E97AD] hover:text-[#F4F1EA]'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'ગુજરાતી'}
              </button>
            ))}
          </div>
        </div>

        <div className="my-auto w-full max-w-md mx-auto py-8">
          {unverifiedUser ? (
            <div className="bg-[#12101A] border border-[#D4AF37]/25 rounded-2xl p-6 sm:p-8 space-y-5">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/40 flex items-center justify-center text-[#D4AF37]">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-[#F4F1EA]">{t.verifyEmailTitle}</h1>
                <p className="mt-2 text-sm text-[#9E97AD] leading-relaxed">
                  {t.verifyEmailDesc} ({unverifiedUser.email})
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCheckVerification}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#09080D] font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  {t.iHaveVerified}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendVerification}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#1A1626] hover:bg-[#231D33] border border-white/10 text-sm font-medium text-[#F4F1EA] transition-colors"
                >
                  {t.resendVerification}
                </button>

                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="w-full py-2 text-xs text-[#9E97AD] hover:text-[#F4F1EA] transition-colors"
                >
                  {t.signOut}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F1EA] text-balance">
                  {t.signInTitle}
                </h1>
                <p className="mt-2 text-sm text-[#9E97AD] leading-relaxed">{t.signInSubtitle}</p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <p>{errorMsg}</p>
                    {showConsoleGuide && (
                      <ol className="mt-2 list-decimal list-inside space-y-1 text-red-100/90">
                        <li>Open Firebase Console for project <span className="font-mono-tabular">skilled-lexicon-37cvm</span>.</li>
                        <li>Navigate to Build → Authentication → Sign-in method.</li>
                        <li>Click Add new provider → Email/Password → Enable and Save.</li>
                      </ol>
                    )}
                  </div>
                </div>
              )}

              {infoMsg && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#F4F1EA] hover:bg-white text-[#09080D] font-semibold text-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                {t.continueWithGoogle}
              </button>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-white/10" />
                <span className="mx-3 text-xs text-[#9E97AD]">{t.orUseEmail}</span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-medium text-[#B6B0C4] mb-1.5">
                      {t.nameLabel}
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Rajesh Patel"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#12101A] border border-white/12 focus:border-[#D4AF37] focus:outline-none text-sm text-[#F4F1EA] placeholder:text-[#6D677D]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-[#B6B0C4] mb-1.5">
                    {t.emailLabel}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#12101A] border border-white/12 focus:border-[#D4AF37] focus:outline-none text-sm text-[#F4F1EA] placeholder:text-[#6D677D]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="auth-password" className="block text-xs font-medium text-[#B6B0C4]">
                      {t.passwordLabel}
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        className="text-xs text-[#D4AF37] hover:underline"
                      >
                        {t.forgotPassword}
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#12101A] border border-white/12 focus:border-[#D4AF37] focus:outline-none text-sm text-[#F4F1EA] placeholder:text-[#6D677D]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#8B5CF6] text-white font-semibold text-sm transition-all border border-[#D4AF37]/30 disabled:opacity-50"
                >
                  {loading ? '...' : isSignUp ? t.signUpBtn : t.signInBtn}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setIsSignUp((v) => !v);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="w-full text-center text-xs text-[#B6B0C4] hover:text-[#D4AF37] transition-colors py-1"
              >
                {isSignUp ? t.alreadyHaveAccountLink : t.createAccountLink}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#6D677D]">
          Secure Firebase Auth · Encrypted Server AI Proxy
        </p>
      </div>
    </div>
  );
}
