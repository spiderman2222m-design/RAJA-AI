import { useState } from 'react';
import { AlertTriangle, Download, Film, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { ApiClientError, generateAiImage, generateAiVideo } from '../lib/api';
import {
  deleteCreationRecord,
  incrementFeatureUsage,
  saveCreationRecord,
} from '../lib/firestoreService';
import { TRANSLATIONS } from '../i18n/translations';
import type { AppLanguage, AppSettings, CreationRecord, UserProfile } from '../types';

interface MediaStudioViewProps {
  mode: 'image' | 'video';
  language: AppLanguage;
  userProfile: UserProfile;
  appSettings: AppSettings;
  creations: CreationRecord[];
  onRequireUpgrade: (reason: string) => void;
}

export function MediaStudioView({
  mode,
  language,
  userProfile,
  appSettings,
  creations,
  onRequireUpgrade,
}: MediaStudioViewProps) {
  const t = TRANSLATIONS[language];
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>(
    mode === 'video' ? '16:9' : '1:1'
  );
  const [highQuality, setHighQuality] = useState(false);
  const [videoDuration, setVideoDuration] = useState<'5s' | '8s' | '10s'>('5s');
  const [videoResolution, setVideoResolution] = useState<'360p' | '720p' | '1080p'>('720p');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requiresPaidKey, setRequiresPaidKey] = useState(false);

  const filteredCreations = creations.filter((c) => c.type === mode);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    if (userProfile.isBlocked) {
      setErrorMsg(t.accountBlocked);
      return;
    }

    if (userProfile.plan === 'free') {
      const field = mode === 'image' ? 'imageCount' : 'videoCount';
      const used = userProfile.usage?.[field] ?? 0;
      const limit = appSettings.freeLimits?.[field] ?? (mode === 'image' ? 5 : 2);
      if (used >= limit) {
        onRequireUpgrade(t.quotaReached);
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);
    setRequiresPaidKey(false);

    try {
      if (mode === 'image') {
        const res = await generateAiImage({
          prompt: prompt.trim(),
          aspectRatio,
          highQuality,
        });
        await saveCreationRecord({
          userId: userProfile.uid,
          type: 'image',
          prompt: prompt.trim(),
          mediaUrl: res.mediaUrl,
          aspectRatio,
        });
        await incrementFeatureUsage(userProfile.uid, 'imageCount');
      } else {
        const videoRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
        const res = await generateAiVideo({
          prompt: prompt.trim(),
          aspectRatio: videoRatio,
          duration: videoDuration,
          resolution: videoResolution,
        });
        await saveCreationRecord({
          userId: userProfile.uid,
          type: 'video',
          prompt: prompt.trim(),
          mediaUrl: res.mediaUrl,
          aspectRatio: videoRatio,
        });
        await incrementFeatureUsage(userProfile.uid, 'videoCount');
      }
      setPrompt('');
    } catch (err) {
      if (err instanceof ApiClientError && err.requiresPaidKey) {
        setRequiresPaidKey(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Media generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto px-4 sm:px-6 py-6">
      <div className="max-w-5xl w-full mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#F4F1EA] flex items-center gap-2.5">
              {mode === 'image' ? (
                <ImageIcon className="w-6 h-6 text-[#D4AF37]" />
              ) : (
                <Film className="w-6 h-6 text-[#D4AF37]" />
              )}
              {mode === 'image' ? t.navImage : t.navVideo}
            </h2>
            <p className="mt-1 text-sm text-[#9E97AD]">
              {mode === 'image'
                ? 'Generate artwork, brand visuals, and photorealistic scenes from text.'
                : 'Produce cinematic short videos using Gemini Omni Flash.'}
            </p>
          </div>
        </div>

        {/* Generation Studio Form */}
        <form
          onSubmit={handleGenerate}
          className="bg-[#12101A] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div>
            <label htmlFor="media-prompt" className="block text-xs font-medium text-[#B6B0C4] mb-2">
              {mode === 'image' ? 'Image Prompt' : 'Video Scene Prompt'}
            </label>
            <textarea
              id="media-prompt"
              rows={3}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'image'
                  ? 'A majestic Indian palace courtyard at twilight with golden lanterns, editorial photography...'
                  : 'Slow cinematic drone pan over Jaipur Amber Fort at golden sunrise, atmospheric mist...'
              }
              className="w-full rounded-xl bg-[#09080D] border border-white/12 focus:border-[#D4AF37] focus:outline-none p-3.5 text-sm text-[#F4F1EA] placeholder:text-[#6D677D]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label htmlFor="ratio-select" className="block text-[11px] text-[#9E97AD] mb-1">
                  Aspect Ratio
                </label>
                <select
                  id="ratio-select"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                  className="px-3 py-2 rounded-lg bg-[#09080D] border border-white/12 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
                >
                  {mode === 'image' ? (
                    <>
                      <option value="1:1">1:1 Square</option>
                      <option value="16:9">16:9 Landscape</option>
                      <option value="9:16">9:16 Portrait</option>
                      <option value="4:3">4:3 Standard</option>
                      <option value="3:4">3:4 Vertical</option>
                    </>
                  ) : (
                    <>
                      <option value="16:9">16:9 Widescreen</option>
                      <option value="9:16">9:16 Vertical</option>
                    </>
                  )}
                </select>
              </div>

              {mode === 'image' ? (
                <div>
                  <label htmlFor="quality-select" className="block text-[11px] text-[#9E97AD] mb-1">
                    Model Quality
                  </label>
                  <select
                    id="quality-select"
                    value={highQuality ? 'hd' : 'fast'}
                    onChange={(e) => setHighQuality(e.target.value === 'hd')}
                    className="px-3 py-2 rounded-lg bg-[#09080D] border border-white/12 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="fast">Standard Flash Image</option>
                    <option value="hd">Ultra Nano Banana 2.1</option>
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="duration-select" className="block text-[11px] text-[#9E97AD] mb-1">
                      Duration
                    </label>
                    <select
                      id="duration-select"
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value as typeof videoDuration)}
                      className="px-3 py-2 rounded-lg bg-[#09080D] border border-white/12 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="5s">5 seconds</option>
                      <option value="8s">8 seconds</option>
                      <option value="10s">10 seconds</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="res-select" className="block text-[11px] text-[#9E97AD] mb-1">
                      Resolution
                    </label>
                    <select
                      id="res-select"
                      value={videoResolution}
                      onChange={(e) => setVideoResolution(e.target.value as typeof videoResolution)}
                      className="px-3 py-2 rounded-lg bg-[#09080D] border border-white/12 text-xs text-[#F4F1EA] focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="360p">360p Fast</option>
                      <option value="720p">720p HD</option>
                      <option value="1080p">1080p Full HD</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6D28D9] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#8B5CF6] border border-[#D4AF37]/40 text-white font-semibold text-sm flex items-center gap-2 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? t.generating : mode === 'image' ? 'Generate Image' : 'Generate Video'}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-1">
                <p>{errorMsg}</p>
                {requiresPaidKey && (
                  <p className="text-[#9E97AD]">
                    Open Settings → Secrets in AI Studio and attach a billing-enabled GEMINI_API_KEY to unlock
                    image & video generation models.
                  </p>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Creations Gallery */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#D4AF37]">
            {mode === 'image' ? 'Generated Images' : 'Generated Videos'} ({filteredCreations.length})
          </h3>

          {filteredCreations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#12101A]/50 p-10 text-center text-sm text-[#9E97AD]">
              {mode === 'image'
                ? 'Your generated images will appear here once created.'
                : 'Your generated videos will appear here once created.'}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCreations.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#12101A] border border-white/10 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-[#09080D] relative overflow-hidden">
                    {item.type === 'image' ? (
                      <img
                        src={item.mediaUrl}
                        alt={item.prompt}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={item.mediaUrl}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <p className="text-xs text-[#EAE6F3] line-clamp-2 leading-relaxed">{item.prompt}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/8 text-xs text-[#9E97AD]">
                      <span className="font-mono-tabular">{item.aspectRatio}</span>
                      <div className="flex items-center gap-3">
                        <a
                          href={item.mediaUrl}
                          download
                          className="text-[#D4AF37] hover:text-[#F3D578] flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t.download}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteCreationRecord(item.id)}
                          aria-label="Delete creation"
                          className="text-[#9E97AD] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
