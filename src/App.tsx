import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { AnimatePresence } from 'motion/react';
import {
  Code2,
  Crown,
  Edit3,
  FileText,
  Film,
  Image as ImageIcon,
  Languages,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType, testFirestoreConnection } from './lib/firebase';
import {
  deleteConversation,
  ensureUserProfile,
  fetchAppSettings,
  renameConversation,
  updateUserLanguage,
} from './lib/firestoreService';
import { TRANSLATIONS } from './i18n/translations';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { ChatWorkspace } from './components/ChatWorkspace';
import { VoiceAssistantView } from './components/VoiceAssistantView';
import { MediaStudioView } from './components/MediaStudioView';
import { SubscriptionModal } from './components/SubscriptionModal';
import { AdminDashboardView } from './components/AdminDashboardView';
import {
  DEFAULT_APP_SETTINGS,
  OWNER_ADMIN_EMAIL,
  type AppLanguage,
  type AppSettings,
  type ChatMessage,
  type Conversation,
  type CreationRecord,
  type UserProfile,
  type WorkspaceMode,
} from './types';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [mode, setMode] = useState<WorkspaceMode>('chat');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [creations, setCreations] = useState<CreationRecord[]>([]);

  const [historySearch, setHistorySearch] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u && u.emailVerified) {
        try {
          const profile = await ensureUserProfile(u, language);
          setUserProfile(profile);
          if (profile.preferredLanguage) {
            setLanguage(profile.preferredLanguage);
          }
          const settings = await fetchAppSettings();
          setAppSettings(settings);
        } catch (err) {
          console.error(err);
        }
      } else {
        setUserProfile(null);
        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setCreations([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time user profile & global settings listeners
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;

    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`)
    );

    const unsubSettings = onSnapshot(
      doc(db, 'app_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<AppSettings>;
          setAppSettings({
            ...DEFAULT_APP_SETTINGS,
            ...data,
            merchantUpiId: data.merchantUpiId || DEFAULT_APP_SETTINGS.merchantUpiId,
          });
        }
      },
      () => {}
    );

    const convQuery = query(
      collection(db, 'conversations'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubConvs = onSnapshot(
      convQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Conversation);
        list.sort((a, b) => {
          const tA = (a.updatedAt as { seconds?: number })?.seconds ?? 0;
          const tB = (b.updatedAt as { seconds?: number })?.seconds ?? 0;
          return tB - tA;
        });
        setConversations(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    const creationsQuery = query(
      collection(db, 'creations'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubCreations = onSnapshot(
      creationsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as CreationRecord);
        list.sort((a, b) => {
          const tA = (a.createdAt as { seconds?: number })?.seconds ?? 0;
          const tB = (b.createdAt as { seconds?: number })?.seconds ?? 0;
          return tB - tA;
        });
        setCreations(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'creations')
    );

    return () => {
      unsubUser();
      unsubSettings();
      unsubConvs();
      unsubCreations();
    };
  }, [firebaseUser?.uid, firebaseUser?.emailVerified]);

  // Real-time messages listener for active conversation
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !activeConversation) {
      setMessages([]);
      return;
    }

    const msgQuery = query(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      msgQuery,
      (snap) => {
        setMessages(snap.docs.map((d) => d.data() as ChatMessage));
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `conversations/${activeConversation.id}/messages`
        )
    );
    return () => unsub();
  }, [firebaseUser?.uid, firebaseUser?.emailVerified, activeConversation?.id]);

  const handleLanguageChange = async (lang: AppLanguage) => {
    setLanguage(lang);
    if (firebaseUser && firebaseUser.emailVerified) {
      await updateUserLanguage(firebaseUser.uid, lang);
    }
  };

  const t = TRANSLATIONS[language];
  const isAdminUser =
    Boolean(userProfile?.role === 'admin') ||
    (firebaseUser?.email?.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase() &&
      Boolean(firebaseUser?.emailVerified));

  const navItems: Array<{ id: WorkspaceMode; label: string; icon: typeof MessageSquare }> = [
    { id: 'chat', label: t.navChat, icon: MessageSquare },
    { id: 'voice', label: t.navVoice, icon: Mic },
    { id: 'image', label: t.navImage, icon: ImageIcon },
    { id: 'video', label: t.navVideo, icon: Film },
    { id: 'writer', label: t.navWriter, icon: FileText },
    { id: 'code', label: t.navCode, icon: Code2 },
    { id: 'translate', label: t.navTranslate, icon: Languages },
  ];

  if (isAdminUser) {
    navItems.push({ id: 'admin', label: t.navAdmin, icon: Shield });
  }

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  const handleNewSession = () => {
    setActiveConversation(null);
    setMessages([]);
    if (mode === 'image' || mode === 'video' || mode === 'admin') {
      setMode('chat');
    }
    setMobileMenuOpen(false);
  };

  const handleSelectHistory = (conv: Conversation) => {
    setActiveConversation(conv);
    if (conv.mode === 'voice') {
      setMode('voice');
    } else if (conv.mode === 'writer' || conv.mode === 'code' || conv.mode === 'translate') {
      setMode(conv.mode);
    } else {
      setMode('chat');
    }
    setMobileMenuOpen(false);
  };

  const planLabel =
    userProfile?.plan === 'premium_yearly'
      ? t.yearlyPlan
      : userProfile?.plan === 'premium_monthly'
      ? t.monthlyPlan
      : t.freePlan;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0E0C15] border-r border-white/10">
      {/* Brand Row */}
      <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/src/assets/images/royal_ai_emblem_1794730096169.jpg"
            alt="APNA RAJA AI logo"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-lg object-cover border border-[#D4AF37]/40 shrink-0"
          />
          <span className="font-display text-sm font-bold tracking-wider text-[#F4F1EA] truncate">
            {t.brandName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-2 text-[#9E97AD] hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* New Chat CTA */}
      <div className="p-3">
        <button
          type="button"
          onClick={handleNewSession}
          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#8B5CF6] border border-[#D4AF37]/30 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          {t.newChat}
        </button>
      </div>

      {/* AI Studios Navigation */}
      <nav className="px-3 space-y-1" aria-label="AI Studios">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#1D182B] text-[#F3D578] border border-[#D4AF37]/30'
                  : 'text-[#B6B0C4] hover:text-[#F4F1EA] hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#D4AF37]' : 'text-[#9E97AD]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Conversation History */}
      <div className="mt-4 flex-1 min-h-0 flex flex-col border-t border-white/8 pt-3 px-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-medium text-[#9E97AD]">{t.history}</span>
          <span className="text-[11px] font-mono-tabular text-[#6D677D]">{conversations.length}</span>
        </div>

        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-[#6D677D] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder={t.searchHistory}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#09080D] border border-white/8 focus:border-[#D4AF37]/50 focus:outline-none text-xs text-[#F4F1EA] placeholder:text-[#6D677D]"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 pb-2">
          {filteredConversations.length === 0 ? (
            <p className="text-[11px] text-[#6D677D] px-2 py-4 text-center">{t.noHistory}</p>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                    isSelected ? 'bg-[#1A1527] text-[#F4F1EA]' : 'text-[#9E97AD] hover:bg-white/[0.04] hover:text-[#EAE6F3]'
                  }`}
                >
                  {editingConvId === conv.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (editingTitle.trim()) {
                          await renameConversation(conv.id, editingTitle);
                        }
                        setEditingConvId(null);
                      }}
                      className="flex-1"
                    >
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => setEditingConvId(null)}
                        className="w-full bg-[#09080D] px-2 py-1 rounded border border-[#D4AF37]/40 text-xs text-white focus:outline-none"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectHistory(conv)}
                      className="flex-1 text-left truncate py-0.5"
                    >
                      {conv.title}
                    </button>
                  )}

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      aria-label="Rename conversation"
                      onClick={() => {
                        setEditingConvId(conv.id);
                        setEditingTitle(conv.title);
                      }}
                      className="p-1 hover:text-[#D4AF37]"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete conversation"
                      onClick={() => {
                        if (activeConversation?.id === conv.id) {
                          setActiveConversation(null);
                        }
                        deleteConversation(conv.id);
                      }}
                      className="p-1 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Account & Plan Footer */}
      {userProfile && (
        <div className="p-3 border-t border-white/8 bg-[#0B0911] space-y-2.5">
          <button
            type="button"
            onClick={() => {
              setUpgradeReason(null);
              setUpgradeModalOpen(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#161322] hover:bg-[#1D182E] border border-[#D4AF37]/30 flex items-center justify-between text-xs transition-colors"
          >
            <span className="flex items-center gap-2 text-[#F3D578] font-medium">
              <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
              {planLabel}
            </span>
            <span className="text-[11px] text-[#A78BFA]">{t.upgradePlan}</span>
          </button>

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#F4F1EA] truncate">{userProfile.displayName}</p>
              <p className="text-[11px] text-[#9E97AD] truncate">{userProfile.email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut(auth)}
              aria-label={t.signOut}
              title={t.signOut}
              className="p-2 rounded-lg text-[#9E97AD] hover:text-red-300 hover:bg-white/5 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {!authReady ? (
        <div className="min-h-screen bg-[#09080D]" />
      ) : !firebaseUser || !firebaseUser.emailVerified || !userProfile ? (
        <AuthScreen
          language={language}
          onLanguageChange={handleLanguageChange}
          unverifiedUser={firebaseUser && !firebaseUser.emailVerified ? firebaseUser : null}
          onVerifiedRefresh={async () => {
            if (auth.currentUser?.emailVerified) {
              setFirebaseUser(auth.currentUser);
              const profile = await ensureUserProfile(auth.currentUser, language);
              setUserProfile(profile);
            }
          }}
        />
      ) : (
        <div className="h-screen w-screen overflow-hidden bg-[#09080D] text-[#F4F1EA] flex">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-[272px] shrink-0 h-full">{sidebarContent}</aside>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden flex">
              <div
                className="fixed inset-0 bg-black/70"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="relative z-10 w-[280px] max-w-[85vw] h-full">{sidebarContent}</div>
            </div>
          )}

          {/* Main Workspace Column */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* Compact 3-Zone Top Header */}
            <header className="h-14 px-4 sm:px-6 border-b border-white/10 bg-[#09080D] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  className="lg:hidden p-2 -ml-2 rounded-lg text-[#F4F1EA] hover:bg-white/5"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="font-display text-sm sm:text-base font-bold tracking-wider text-[#F4F1EA] whitespace-nowrap truncate">
                  {t.brandName}
                </h1>
              </div>

              <div className="flex items-center gap-1 bg-[#12101A] border border-white/10 rounded-lg p-0.5 shrink-0">
                {(['en', 'hi', 'gu'] as AppLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleLanguageChange(lang)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      language === lang
                        ? 'bg-[#7C3AED] text-white'
                        : 'text-[#9E97AD] hover:text-[#F4F1EA]'
                    }`}
                  >
                    {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'ગુજ'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setUpgradeReason(null);
                    setUpgradeModalOpen(true);
                  }}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#09080D] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {userProfile.plan === 'free' ? t.upgradePlan : planLabel}
                </button>
              </div>
            </header>

            {/* Active Studio Viewport */}
            <main className="flex-1 min-h-0 overflow-hidden">
              {(mode === 'chat' || mode === 'writer' || mode === 'code' || mode === 'translate') && (
                <ChatWorkspace
                  mode={mode}
                  language={language}
                  userProfile={userProfile}
                  appSettings={appSettings}
                  activeConversation={activeConversation}
                  messages={messages}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                  onRequireUpgrade={(reason) => {
                    setUpgradeReason(reason);
                    setUpgradeModalOpen(true);
                  }}
                />
              )}

              {mode === 'voice' && (
                <VoiceAssistantView
                  language={language}
                  userProfile={userProfile}
                  appSettings={appSettings}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                  onRequireUpgrade={(reason) => {
                    setUpgradeReason(reason);
                    setUpgradeModalOpen(true);
                  }}
                />
              )}

              {(mode === 'image' || mode === 'video') && (
                <MediaStudioView
                  mode={mode}
                  language={language}
                  userProfile={userProfile}
                  appSettings={appSettings}
                  creations={creations}
                  onRequireUpgrade={(reason) => {
                    setUpgradeReason(reason);
                    setUpgradeModalOpen(true);
                  }}
                />
              )}

              {mode === 'admin' && isAdminUser && (
                <AdminDashboardView currentUser={userProfile} appSettings={appSettings} />
              )}
            </main>
          </div>

          <SubscriptionModal
            isOpen={upgradeModalOpen}
            reason={upgradeReason}
            userProfile={userProfile}
            appSettings={appSettings}
            onClose={() => setUpgradeModalOpen(false)}
          />
        </div>
      )}
    </>
  );
}
