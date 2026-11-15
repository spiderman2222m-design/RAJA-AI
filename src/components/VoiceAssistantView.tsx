import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Mic, Send, Square, Volume2 } from 'lucide-react';
import { streamAiChat, synthesizeVoiceSpeech, transcribeVoiceAudio } from '../lib/api';
import {
  addConversationMessage,
  createConversation,
  incrementFeatureUsage,
} from '../lib/firestoreService';
import { TRANSLATIONS } from '../i18n/translations';
import type { AppLanguage, AppSettings, Conversation, UserProfile } from '../types';

interface VoiceAssistantViewProps {
  language: AppLanguage;
  userProfile: UserProfile;
  appSettings: AppSettings;
  onSelectConversation: (conv: Conversation) => void;
  onRequireUpgrade: (reason: string) => void;
}

interface VoiceTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function VoiceAssistantView({
  language,
  userProfile,
  appSettings,
  onSelectConversation,
  onRequireUpgrade,
}: VoiceAssistantViewProps) {
  const t = TRANSLATIONS[language];
  const [voiceName, setVoiceName] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [textInput, setTextInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const checkVoiceQuota = (): boolean => {
    if (userProfile.isBlocked) {
      setErrorMsg(t.accountBlocked);
      return false;
    }
    if (userProfile.plan === 'premium_monthly' || userProfile.plan === 'premium_yearly') {
      return true;
    }
    const used = userProfile.usage?.voiceCount ?? 0;
    const limit = appSettings.freeLimits?.voiceCount ?? 10;
    if (used >= limit) {
      onRequireUpgrade(t.quotaReached);
      return false;
    }
    return true;
  };

  const processVoiceQuery = async (spokenText: string) => {
    if (!spokenText.trim()) {
      setStatus('idle');
      return;
    }
    setStatus('processing');
    setErrorMsg(null);

    const userTurn: VoiceTurn = { id: `u_${Date.now()}`, role: 'user', text: spokenText };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);

    try {
      let conv = conversation;
      if (!conv) {
        conv = await createConversation({
          userId: userProfile.uid,
          title: `Voice: ${spokenText.slice(0, 48)}`,
          mode: 'voice',
          language,
        });
        setConversation(conv);
        onSelectConversation(conv);
      }

      const nextCount = nextTurns.length;
      await addConversationMessage({
        conversationId: conv.id,
        userId: userProfile.uid,
        role: 'user',
        content: spokenText,
        mode: 'voice',
        language,
        nextCount,
      });

      const reply = await streamAiChat({
        message: spokenText,
        history: turns.map((item) => ({ role: item.role, content: item.text })),
        mode: 'voice',
        language,
        onChunk: () => {},
      });

      const cleanReply = reply.trim() || 'I am ready to help.';
      setTurns((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: cleanReply }]);

      await addConversationMessage({
        conversationId: conv.id,
        userId: userProfile.uid,
        role: 'assistant',
        content: cleanReply,
        mode: 'voice',
        language,
        nextCount: nextCount + 1,
      });

      await incrementFeatureUsage(userProfile.uid, 'voiceCount');

      setStatus('speaking');
      const { audioBase64, mimeType } = await synthesizeVoiceSpeech({
        text: cleanReply,
        voiceName,
      });
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setStatus('idle');
      audio.onerror = () => setStatus('idle');
      await audio.play();
    } catch (err) {
      setStatus('idle');
      setErrorMsg(err instanceof Error ? err.message : 'Voice assistant request failed.');
    }
  };

  const startRecording = async () => {
    if (!checkVoiceQuota()) return;
    setErrorMsg(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 400) {
          setStatus('idle');
          return;
        }
        setStatus('processing');
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = String(reader.result || '');
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const transcript = await transcribeVoiceAudio({
            audioBase64: base64,
            mimeType,
            language,
          });
          if (!transcript) {
            setErrorMsg('Could not detect speech clearly. Please try again.');
            setStatus('idle');
            return;
          }
          await processVoiceQuery(transcript);
        } catch (err) {
          setStatus('idle');
          setErrorMsg(err instanceof Error ? err.message : 'Audio transcription failed.');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('listening');
    } catch {
      setErrorMsg('Microphone permission denied or unavailable. You can still type below for voice replies.');
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 sm:px-6 py-3 border-b border-white/8 bg-[#0E0C15]/80 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#F4F1EA]">{t.navVoice}</h2>
          <p className="text-xs text-[#9E97AD] hidden sm:block">
            Talk naturally and receive spoken AI replies in Hindi, English, or Gujarati.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="voice-select" className="text-xs text-[#9E97AD] hidden sm:inline">
            Voice:
          </label>
          <select
            id="voice-select"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value as typeof voiceName)}
            className="px-2.5 py-1.5 rounded-lg bg-[#161321] border border-white/10 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="Kore">Kore (Warm)</option>
            <option value="Puck">Puck (Bright)</option>
            <option value="Charon">Charon (Deep)</option>
            <option value="Fenrir">Fenrir (Bold)</option>
            <option value="Zephyr">Zephyr (Calm)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col items-center">
        {/* Animated Royal AI Assistant Avatar */}
        <div className="relative my-4 flex flex-col items-center">
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
            {(status === 'listening' || status === 'speaking') && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.24, 1], opacity: [0.45, 0.08, 0.45] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  className={`absolute inset-0 rounded-full border-2 ${
                    status === 'listening' ? 'border-[#7C3AED]' : 'border-[#D4AF37]'
                  }`}
                />
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  className={`absolute inset-2 rounded-full border ${
                    status === 'listening' ? 'border-[#A78BFA]' : 'border-[#F3D578]'
                  }`}
                />
              </>
            )}

            <motion.div
              animate={
                status === 'speaking'
                  ? { scale: [1, 1.03, 1] }
                  : status === 'listening'
                  ? { scale: 1.02 }
                  : { scale: 1 }
              }
              transition={{ duration: 0.9, repeat: status === 'speaking' ? Infinity : 0 }}
              className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-[#D4AF37]/60 bg-[#12101A] shadow-2xl"
            >
              <img
                src="/src/assets/images/animated_assistant_avatar_1794730098224.jpg"
                alt="APNA RAJA AI animated voice assistant"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>

          <p className="mt-3 text-sm font-medium text-[#D4AF37]">
            {status === 'listening'
              ? t.listening
              : status === 'processing'
              ? t.generating
              : status === 'speaking'
              ? 'Speaking reply...'
              : t.speakNow}
          </p>

          <div className="mt-4 flex items-center gap-3">
            {status === 'listening' ? (
              <button
                type="button"
                onClick={stopRecording}
                className="min-h-[48px] px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop & Send
              </button>
            ) : (
              <button
                type="button"
                disabled={status === 'processing'}
                onClick={startRecording}
                className="min-h-[48px] px-6 py-3 rounded-full bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#8B5CF6] text-white font-semibold text-sm flex items-center gap-2 border border-[#D4AF37]/40 transition-all disabled:opacity-50"
              >
                {status === 'processing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4 text-[#F3D578]" />
                )}
                {t.tapToSpeak}
              </button>
            )}

            {status === 'speaking' && (
              <button
                type="button"
                onClick={() => {
                  audioRef.current?.pause();
                  setStatus('idle');
                }}
                className="min-h-[48px] px-4 py-3 rounded-full bg-[#161321] border border-white/15 text-xs text-[#F4F1EA] hover:border-[#D4AF37]"
              >
                Mute Audio
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="w-full max-w-2xl mt-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Voice Transcript History */}
        {turns.length > 0 && (
          <div className="w-full max-w-2xl mt-6 space-y-3">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`p-3.5 rounded-xl border text-sm ${
                  turn.role === 'user'
                    ? 'bg-[#231B38]/60 border-[#7C3AED]/30 text-[#F4F1EA]'
                    : 'bg-[#12101A] border-white/10 text-[#EAE6F3]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#9E97AD] mb-1">
                  <span>{turn.role === 'user' ? 'You' : 'APNA RAJA AI'}</span>
                  {turn.role === 'assistant' && <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />}
                </div>
                <p className="leading-relaxed">{turn.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Text Fallback Input */}
      <div className="px-4 sm:px-6 pb-4 pt-2 border-t border-white/8 bg-[#09080D]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!textInput.trim() || status !== 'idle') return;
            if (!checkVoiceQuota()) return;
            const queryText = textInput.trim();
            setTextInput('');
            processVoiceQuery(queryText);
          }}
          className="max-w-2xl mx-auto flex items-center gap-2 bg-[#12101A] border border-white/12 rounded-xl p-2"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type a message to hear a spoken voice reply..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-[#F4F1EA] placeholder:text-[#6D677D] focus:outline-none"
          />
          <button
            type="submit"
            disabled={status !== 'idle' || !textInput.trim()}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#D4AF37] text-[#09080D] font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            Speak Reply
          </button>
        </form>
      </div>
    </div>
  );
}
