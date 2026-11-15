import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Code2,
  Copy,
  FileText,
  Languages,
  MessageSquare,
  Send,
  Volume2,
  Loader2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { streamAiChat, synthesizeVoiceSpeech } from '../lib/api';
import {
  addConversationMessage,
  createConversation,
  incrementFeatureUsage,
} from '../lib/firestoreService';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  AppLanguage,
  AppSettings,
  ChatMessage,
  ChatMode,
  Conversation,
  UsageMap,
  UserProfile,
} from '../types';

interface ChatWorkspaceProps {
  mode: 'chat' | 'writer' | 'code' | 'translate';
  language: AppLanguage;
  userProfile: UserProfile;
  appSettings: AppSettings;
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  onSelectConversation: (conv: Conversation) => void;
  onRequireUpgrade: (reason: string) => void;
}

const STARTER_PROMPTS: Record<
  'chat' | 'writer' | 'code' | 'translate',
  Record<AppLanguage, string[]>
> = {
  chat: {
    en: [
      'Plan a productive 7-day routine for learning AI development',
      'Explain quantum computing in simple everyday terms',
      'Summarize top strategies to grow an online business in India',
    ],
    hi: [
      'AI डेवलपमेंट सीखने के लिए 7 दिन का प्रभावी रूटीन बनाएं',
      'क्वांटम कंप्यूटिंग को सरल हिंदी में समझाएं',
      'भारत में ऑनलाइन बिजनेस बढ़ाने के 5 बेहतरीन तरीके बताएं',
    ],
    gu: [
      'AI ડેવલપમેન્ટ શીખવા માટે 7 દિવસનો અસરકારક પ્લાન બનાવો',
      'ક્વોન્ટમ કમ્પ્યુટિંગ સરળ ગુજરાતીમાં સમજાવો',
      'ભારતમાં ઓનલાઈન બિઝનેસ વધારવાના 5 શ્રેષ્ઠ ઉપાયો જણાવો',
    ],
  },
  writer: {
    en: [
      'Write 5 engaging Instagram captions for a luxury watch brand',
      'Draft a 60-second YouTube Shorts script about future technology',
      'Write an inspiring short story about patience and mastery',
    ],
    hi: [
      'लक्ज़री ब्रांड के लिए 5 आकर्षक इंस्टाग्राम कैप्शन लिखें',
      'भविष्य की तकनीक पर 60 सेकंड की यूट्यूब शॉर्ट्स स्क्रिप्ट लिखें',
      'धैर्य और सफलता पर एक प्रेरक लघु कथा लिखें',
    ],
    gu: [
      'લક્ઝરી બ્રાન્ડ માટે 5 આકર્ષક ઈન્સ્ટાગ્રામ કેપ્શન લખો',
      'ભવિષ્યની ટેકનોલોજી પર 60 સેકન્ડની YouTube Shorts સ્ક્રિપ્ટ લખો',
      'ધૈર્ય અને સફળતા પર એક પ્રેરણાદાયી ટૂંકી વાર્તા લખો',
    ],
  },
  code: {
    en: [
      'Write a clean TypeScript rate limiter middleware for Express',
      'Build a Jetpack Compose Android login card with Material 3',
      'Explain async/await vs Promises with practical examples',
    ],
    hi: [
      'Express के लिए TypeScript रेट लिमिटर मिडलवेयर लिखें',
      'Android Jetpack Compose में लॉगिन कार्ड का कोड लिखें',
      'उदाहरण के साथ async/await और Promises का अंतर समझाएं',
    ],
    gu: [
      'Express માટે TypeScript રેટ લિમિટર મિડલવેર લખો',
      'Android Jetpack Compose માં લોગિન કાર્ડનો કોડ લખો',
      'ઉદાહરણ સાથે async/await અને Promises નો તફાવત સમજાવો',
    ],
  },
  translate: {
    en: [
      'Welcome to APNA RAJA AI. How can I assist you today?',
      'Success comes to those who stay consistent every single day.',
      'Please schedule our team meeting for tomorrow at 10 AM.',
    ],
    hi: [
      'अपना राजा एआई में आपका स्वागत है। आज मैं आपकी क्या मदद कर सकता हूँ?',
      'सफलता उन्हीं को मिलती है जो हर दिन निरंतर प्रयास करते हैं।',
    ],
    gu: [
      'APNA RAJA AI માં તમારું સ્વાગત છે. આજે હું તમને કેવી રીતે મદદ કરી શકું?',
      'સફળતા તેમને જ મળે છે જેઓ દરરોજ સતત મહેનત કરે છે.',
    ],
  },
};

export function ChatWorkspace({
  mode,
  language,
  userProfile,
  appSettings,
  activeConversation,
  messages,
  onSelectConversation,
  onRequireUpgrade,
}: ChatWorkspaceProps) {
  const t = TRANSLATIONS[language];
  const [input, setInput] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

  // Studio-specific controls
  const [writerFormat, setWriterFormat] = useState('Caption');
  const [writerTone, setWriterTone] = useState('Royal & Polished');
  const [codeTask, setCodeTask] = useState('Generate Code');
  const [codeLang, setCodeLang] = useState('TypeScript');
  const [sourceLang, setSourceLang] = useState('Auto-detect');
  const [targetLang, setTargetLang] = useState(
    language === 'hi' ? 'Hindi' : language === 'gu' ? 'Gujarati' : 'Hindi'
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingReply, pendingUserText]);

  const usageFieldForMode = (m: ChatMode): keyof UsageMap => {
    if (m === 'writer') return 'writerCount';
    if (m === 'code') return 'codeCount';
    if (m === 'translate') return 'translateCount';
    return 'chatCount';
  };

  const checkQuotaAllowed = (): boolean => {
    if (userProfile.isBlocked) {
      setErrorMsg(t.accountBlocked);
      return false;
    }
    if (userProfile.plan === 'premium_monthly' || userProfile.plan === 'premium_yearly') {
      return true;
    }
    const field = usageFieldForMode(mode);
    const used = userProfile.usage?.[field] ?? 0;
    const limit = appSettings.freeLimits?.[field] ?? 25;
    if (used >= limit) {
      onRequireUpgrade(t.quotaReached);
      return false;
    }
    return true;
  };

  const buildPromptWithStudioContext = (rawText: string): { prompt: string; extraContext: string } => {
    if (mode === 'writer') {
      return {
        prompt: rawText,
        extraContext: `Requested Format: ${writerFormat}. Desired Tone: ${writerTone}.`,
      };
    }
    if (mode === 'code') {
      return {
        prompt: rawText,
        extraContext: `Task: ${codeTask}. Primary Language/Framework: ${codeLang}.`,
      };
    }
    if (mode === 'translate') {
      return {
        prompt: `Translate the following text from ${sourceLang} to ${targetLang}. Provide the clean translation first, followed by a brief pronunciation guide if helpful:\n\n${rawText}`,
        extraContext: `Source: ${sourceLang}, Target: ${targetLang}.`,
      };
    }
    return { prompt: rawText, extraContext: '' };
  };

  const handleSend = async (customText?: string) => {
    const raw = (customText ?? input).trim();
    if (!raw || isGenerating) return;
    if (!checkQuotaAllowed()) return;

    setErrorMsg(null);
    if (!customText) setInput('');
    setIsGenerating(true);
    setPendingUserText(raw);
    setStreamingReply('');

    try {
      let conv = activeConversation;
      if (!conv || conv.mode !== mode) {
        conv = await createConversation({
          userId: userProfile.uid,
          title: raw.slice(0, 60),
          mode,
          language,
        });
        onSelectConversation(conv);
      }

      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const nextCountAfterUser = (conv.messageCount || messages.length) + 1;
      await addConversationMessage({
        conversationId: conv.id,
        userId: userProfile.uid,
        role: 'user',
        content: raw,
        mode,
        language,
        nextCount: nextCountAfterUser,
        titleUpdate: messages.length === 0 ? raw.slice(0, 60) : undefined,
      });

      const { prompt, extraContext } = buildPromptWithStudioContext(raw);
      const reply = await streamAiChat({
        message: prompt,
        history: historyPayload,
        mode,
        language,
        extraContext,
        onChunk: (partial) => setStreamingReply(partial),
      });

      const finalReply = reply.trim() || 'No response generated.';
      await addConversationMessage({
        conversationId: conv.id,
        userId: userProfile.uid,
        role: 'assistant',
        content: finalReply,
        mode,
        language,
        nextCount: nextCountAfterUser + 1,
      });

      await incrementFeatureUsage(userProfile.uid, usageFieldForMode(mode));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate AI response.');
    } finally {
      setPendingUserText(null);
      setStreamingReply('');
      setIsGenerating(false);
    }
  };

  const handleSpeakMessage = async (msg: ChatMessage) => {
    if (playingMsgId === msg.id) {
      audioRef.current?.pause();
      setPlayingMsgId(null);
      return;
    }

    setPlayingMsgId(msg.id);
    try {
      const { audioBase64, mimeType } = await synthesizeVoiceSpeech({
        text: msg.content,
        voiceName: 'Kore',
      });
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingMsgId(null);
      audio.onerror = () => setPlayingMsgId(null);
      await audio.play();
    } catch (err) {
      setPlayingMsgId(null);
      setErrorMsg(err instanceof Error ? err.message : 'Unable to play voice reply.');
    }
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const modeMeta = {
    chat: {
      icon: MessageSquare,
      title: t.navChat,
      subtitle: 'Conversational intelligence across Hindi, English, and Gujarati.',
    },
    writer: {
      icon: FileText,
      title: t.navWriter,
      subtitle: 'Craft captions, stories, video scripts, and high-converting copy.',
    },
    code: {
      icon: Code2,
      title: t.navCode,
      subtitle: 'Generate, debug, explain, and refactor clean production code.',
    },
    translate: {
      icon: Languages,
      title: t.navTranslate,
      subtitle: 'Natural multilingual translation preserving tone and idiom.',
    },
  }[mode];

  const ModeIcon = modeMeta.icon;
  const starters = STARTER_PROMPTS[mode][language];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode Context Toolbar */}
      <div className="px-4 sm:px-6 py-3 border-b border-white/8 bg-[#0E0C15]/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ModeIcon className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#F4F1EA] truncate">{modeMeta.title}</h2>
            <p className="text-xs text-[#9E97AD] truncate hidden sm:block">{modeMeta.subtitle}</p>
          </div>
        </div>

        {mode === 'writer' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Content format"
              value={writerFormat}
              onChange={(e) => setWriterFormat(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
            >
              <option>Caption</option>
              <option>Short Story</option>
              <option>YouTube Script</option>
              <option>Speech</option>
              <option>Blog Article</option>
            </select>
            <select
              aria-label="Content tone"
              value={writerTone}
              onChange={(e) => setWriterTone(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
            >
              <option>Royal & Polished</option>
              <option>Professional</option>
              <option>Witty & Viral</option>
              <option>Emotional</option>
            </select>
          </div>
        )}

        {mode === 'code' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Coding task"
              value={codeTask}
              onChange={(e) => setCodeTask(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
            >
              <option>Generate Code</option>
              <option>Explain Code</option>
              <option>Debug & Fix</option>
              <option>Refactor & Optimize</option>
            </select>
            <select
              aria-label="Programming language"
              value={codeLang}
              onChange={(e) => setCodeLang(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
            >
              <option>TypeScript</option>
              <option>Python</option>
              <option>Kotlin (Android)</option>
              <option>JavaScript</option>
              <option>SQL</option>
              <option>Java</option>
            </select>
          </div>
        )}

        {mode === 'translate' && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Source language"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
            >
              <option>Auto-detect</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Gujarati</option>
              <option>Marathi</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (sourceLang !== 'Auto-detect') {
                  const prevSource = sourceLang;
                  setSourceLang(targetLang);
                  setTargetLang(prevSource);
                }
              }}
              aria-label="Swap languages"
              className="p-1.5 rounded-lg bg-[#161321] border border-white/10 text-[#D4AF37] hover:bg-[#1E1A2D] transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <select
              aria-label="Target language"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
            >
              <option>Hindi</option>
              <option>Gujarati</option>
              <option>English</option>
              <option>Marathi</option>
              <option>Punjabi</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        {messages.length === 0 && !pendingUserText ? (
          <div className="max-w-2xl mx-auto py-8 sm:py-12 text-center space-y-6">
            <img
              src="/src/assets/images/animated_assistant_avatar_1794730098224.jpg"
              alt="APNA RAJA AI companion"
              referrerPolicy="no-referrer"
              className="w-20 h-20 mx-auto rounded-2xl object-cover border border-[#D4AF37]/35 shadow-xl"
            />
            <div>
              <h3 className="font-display text-2xl font-bold text-[#F4F1EA]">
                {modeMeta.title}
              </h3>
              <p className="mt-2 text-sm text-[#9E97AD] max-w-md mx-auto">
                {modeMeta.subtitle}
              </p>
            </div>
            <div className="grid sm:grid-cols-1 gap-2.5 text-left max-w-xl mx-auto">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-[#12101A] hover:bg-[#191625] border border-white/10 hover:border-[#D4AF37]/35 text-sm text-[#EAE6F3] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <img
                    src="/src/assets/images/royal_ai_emblem_1794730096169.jpg"
                    alt="APNA RAJA AI"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-lg object-cover border border-[#D4AF37]/30 shrink-0 mt-1"
                  />
                )}
                <div
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#231B38] border border-[#7C3AED]/40 text-[#F4F1EA]'
                      : 'bg-[#12101A] border border-white/10 text-[#EAE6F3]'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <>
                      <MarkdownRenderer content={msg.content} />
                      <div className="mt-3 pt-2.5 border-t border-white/8 flex items-center gap-3 text-xs text-[#9E97AD]">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors py-1"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === msg.id ? t.copied : t.copy}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSpeakMessage(msg)}
                          className="flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors py-1"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${playingMsgId === msg.id ? 'text-[#D4AF37]' : ''}`} />
                          <span>{playingMsgId === msg.id ? 'Stop' : t.listen}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {pendingUserText && !messages.some((m) => m.role === 'user' && m.content === pendingUserText) && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#231B38] border border-[#7C3AED]/40 text-[#F4F1EA]">
                  <p className="text-sm sm:text-base whitespace-pre-wrap">{pendingUserText}</p>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex gap-3.5 justify-start">
                <img
                  src="/src/assets/images/royal_ai_emblem_1794730096169.jpg"
                  alt="APNA RAJA AI"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-lg object-cover border border-[#D4AF37]/30 shrink-0 mt-1"
                />
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#12101A] border border-white/10">
                  {streamingReply ? (
                    <MarkdownRenderer content={streamingReply} />
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-[#9E97AD]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                      <span>{t.generating}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 sm:px-6 pb-4 pt-2 border-t border-white/8 bg-[#09080D]">
        {errorMsg && (
          <div className="max-w-3xl mx-auto mb-2.5 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-300 hover:text-white shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-3xl mx-auto flex items-end gap-2.5 bg-[#12101A] border border-white/12 focus-within:border-[#D4AF37]/60 rounded-2xl p-2"
        >
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t.chatPlaceholder}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm sm:text-base text-[#F4F1EA] placeholder:text-[#6D677D] focus:outline-none resize-none max-h-36"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#09080D] font-semibold text-sm transition-colors flex items-center gap-2 shrink-0 disabled:opacity-40 whitespace-nowrap"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">{t.send}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
