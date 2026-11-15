import express, { type Request, type Response, type NextFunction } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

interface FirebaseConfigFile {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

const rootDir = process.cwd();
const generatedDir = path.join(rootDir, '.generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

let firebaseConfig: FirebaseConfigFile = {
  projectId: '',
  apiKey: '',
};
try {
  const rawConfig = fs.readFileSync(path.join(rootDir, 'firebase-applet-config.json'), 'utf8');
  firebaseConfig = JSON.parse(rawConfig) as FirebaseConfigFile;
} catch (err) {
  console.warn('Warning: firebase-applet-config.json could not be loaded on server startup.', err);
}

const serverSigningSecret =
  process.env.PAYMENT_SIGNING_SECRET && process.env.PAYMENT_SIGNING_SECRET !== 'MY_PAYMENT_SIGNING_SECRET'
    ? process.env.PAYMENT_SIGNING_SECRET
    : crypto.randomBytes(32).toString('hex');

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function verifyFirebaseIdToken(idToken: string): Promise<AuthenticatedUser> {
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase Web API key missing on server.');
  }

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!lookupRes.ok) {
    throw new Error('Invalid or expired authentication session.');
  }

  const data = (await lookupRes.json()) as {
    users?: Array<{
      localId?: string;
      email?: string;
      emailVerified?: boolean;
      disabled?: boolean;
    }>;
  };

  const user = data.users?.[0];
  if (!user || !user.localId || !user.email) {
    throw new Error('Authenticated user record not found.');
  }
  if (user.disabled) {
    throw new Error('This account has been disabled.');
  }

  return {
    uid: user.localId,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
  };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken) {
      res.status(401).json({ error: 'Authentication token missing.' });
      return;
    }
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    if (!verifiedUser.emailVerified) {
      res.status(403).json({ error: 'Please verify your email address before using AI features.' });
      return;
    }
    req.user = verifiedUser;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication verification failed.';
    res.status(401).json({ error: message });
  }
}

function classifyGeminiError(err: unknown): { status: number; message: string; requiresPaidKey: boolean } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'API access denied or paid key required. Please check GEMINI_API_KEY in Settings > Secrets.',
      requiresPaidKey: true,
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'API quota reached or paid API key required for this model. Select a billing-enabled key in Settings > Secrets.',
      requiresPaidKey: true,
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Requested AI model is currently unavailable for this API key.',
      requiresPaidKey: false,
    };
  }
  return {
    status: 500,
    message: raw || 'An unexpected AI service error occurred.',
    requiresPaidKey: false,
  };
}

function buildSystemInstruction(mode: string, language: string, extraContext?: string): string {
  const langLabel =
    language === 'hi'
      ? 'Hindi (Devanagari script, natural conversational Hindi unless asked otherwise)'
      : language === 'gu'
      ? 'Gujarati (Gujarati script, natural conversational Gujarati unless asked otherwise)'
      : 'English';

  const base = `You are APNA RAJA AI ("Your Personal AI Assistant"), a refined, intelligent, helpful assistant. Respond primarily in ${langLabel}. Keep formatting clean, clear, and well-structured with markdown when helpful.`;

  switch (mode) {
    case 'writer':
      return `${base} You are acting as the Content Writer Studio. Craft compelling, original captions, stories, scripts, speeches, and marketing copy tailored to the user's tone, format, and audience.${extraContext ? ` Context: ${extraContext}` : ''}`;
    case 'code':
      return `${base} You are acting as the AI Code Assistant. Write clean, production-grade code with fenced language code blocks, explain edge cases clearly, and debug root causes accurately.${extraContext ? ` Language/Stack focus: ${extraContext}` : ''}`;
    case 'translate':
      return `You are APNA RAJA AI's precision multilingual translator. Translate accurately between Hindi, Gujarati, English, and global languages while preserving tone, idioms, and cultural nuance.${extraContext ? ` Translation instructions: ${extraContext}` : ''}`;
    case 'voice':
      return `${base} You are responding in Voice Assistant mode. Keep replies natural, concise, warm, and easy to listen to aloud (avoid raw markdown symbols like asterisks or URLs unless essential).`;
    default:
      return base;
  }
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'apna-raja-ai', timestamp: new Date().toISOString() });
  });

  // Serve generated images & videos safely
  app.get('/api/media/:filename', (req: Request, res: Response) => {
    const rawName = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    const safeName = path.basename(rawName || '');
    if (!/^[a-zA-Z0-9_\-]+\.(png|jpg|jpeg|webp|mp4)$/.test(safeName)) {
      res.status(400).json({ error: 'Invalid media filename.' });
      return;
    }
    const fullPath = path.join(generatedDir, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Generated media file not found.' });
      return;
    }
    res.sendFile(fullPath);
  });

  // Streaming AI Chat / Content Writer / Code Assistant / Translation endpoint
  app.post('/api/ai/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const {
      message,
      history = [],
      mode = 'chat',
      language = 'en',
      extraContext = '',
      stream = true,
    } = req.body as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      mode?: string;
      language?: string;
      extraContext?: string;
      stream?: boolean;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Prompt message cannot be empty.' });
      return;
    }

    try {
      const ai = getGeminiClient();
      const contents = [
        ...history
          .filter((h) => h && typeof h.content === 'string' && h.content.trim())
          .slice(-16)
          .map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
        {
          role: 'user',
          parts: [{ text: message.trim() }],
        },
      ];

      const systemInstruction = buildSystemInstruction(mode, language, extraContext);
      const thinkingLevel = mode === 'voice' || mode === 'translate' ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM;

      if (!stream) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel },
          },
        });
        res.json({ text: response.text ?? '' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel },
        },
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const info = classifyGeminiError(err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: info.message, requiresPaidKey: info.requiresPaidKey })}\n\n`);
        res.end();
      } else {
        res.status(info.status).json({ error: info.message, requiresPaidKey: info.requiresPaidKey });
      }
    }
  });

  // Voice Assistant: Audio Transcription
  app.post('/api/ai/voice-transcribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { audioBase64, mimeType = 'audio/webm', language = 'en' } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      language?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Audio recording payload is required.' });
      return;
    }

    try {
      const ai = getGeminiClient();
      const langHint =
        language === 'hi' ? 'Hindi or English' : language === 'gu' ? 'Gujarati or English' : 'English, Hindi, or Gujarati';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: `Transcribe the spoken audio accurately in its original script (${langHint}). Output only the transcribed text.`,
            },
          ],
        },
      });

      res.json({ transcript: (response.text ?? '').trim() });
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ error: info.message, requiresPaidKey: info.requiresPaidKey });
    }
  });

  // Voice Assistant: Text-to-Speech Voice Reply
  app.post('/api/ai/voice-tts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { text, voiceName = 'Kore', style = 'Warm, regal, clear personal assistant' } = req.body as {
      text?: string;
      voiceName?: string;
      style?: string;
    };

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required for voice synthesis.' });
      return;
    }

    const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const safeVoice = allowedVoices.includes(voiceName) ? voiceName : 'Kore';

    try {
      const ai = getGeminiClient();
      const cleanText = text.replace(/```[\s\S]*?```/g, 'Code snippet omitted.').slice(0, 2500);

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: safeVoice },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        res.status(502).json({ error: 'Voice synthesizer returned no audio data.' });
        return;
      }

      res.json({ audioBase64: audioData, mimeType: 'audio/wav' });
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ error: info.message, requiresPaidKey: info.requiresPaidKey });
    }
  });

  // AI Image Generator
  app.post('/api/ai/image', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { prompt, aspectRatio = '1:1', highQuality = false } = req.body as {
      prompt?: string;
      aspectRatio?: string;
      highQuality?: boolean;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Image prompt is required.' });
      return;
    }

    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const safeRatio = validRatios.includes(aspectRatio) ? aspectRatio : '1:1';
    const model = highQuality ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt.trim() }],
        },
        config: {
          imageConfig: {
            aspectRatio: safeRatio,
            ...(highQuality ? { imageSize: '1K' } : {}),
          },
        },
      });

      let savedUrl = '';
      let captionText = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data && !savedUrl) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
          const filename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
          fs.writeFileSync(path.join(generatedDir, filename), Buffer.from(part.inlineData.data, 'base64'));
          savedUrl = `/api/media/${filename}`;
        } else if (part.text) {
          captionText += part.text;
        }
      }

      if (!savedUrl) {
        res.status(502).json({ error: 'Image model completed without returning an image.' });
        return;
      }

      res.json({ mediaUrl: savedUrl, caption: captionText.trim(), model });
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ error: info.message, requiresPaidKey: info.requiresPaidKey });
    }
  });

  // AI Video Generator (Interactions API + gemini-omni-1.2-flash)
  app.post('/api/ai/video', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { prompt, aspectRatio = '16:9', duration = '5s', resolution = '720p' } = req.body as {
      prompt?: string;
      aspectRatio?: '16:9' | '9:16';
      duration?: string;
      resolution?: '360p' | '720p' | '1080p';
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Video prompt is required.' });
      return;
    }

    const safeRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    const safeResolution = resolution === '360p' || resolution === '1080p' ? resolution : '720p';
    const safeDuration = /^([3-9]|1[0-5])s$/.test(duration) ? duration : '5s';

    try {
      const ai = getGeminiClient();
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: prompt.trim(),
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: safeRatio,
            duration: safeDuration,
            resolution: safeResolution,
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({ error: 'Video generation completed without returning video data.' });
        return;
      }

      const filename = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
      fs.writeFileSync(path.join(generatedDir, filename), Buffer.from(videoPart.data, 'base64'));
      res.json({ mediaUrl: `/api/media/${filename}`, model: 'gemini-omni-1.2-flash' });
    } catch (err) {
      const info = classifyGeminiError(err);
      res.status(info.status).json({ error: info.message, requiresPaidKey: info.requiresPaidKey });
    }
  });

  // Payment Order Creation & Cryptographic Verification
  app.post('/api/payments/create-order', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { plan, customPriceInr, merchantUpiId } = req.body as {
      plan?: 'premium_monthly' | 'premium_yearly';
      customPriceInr?: number;
      merchantUpiId?: string;
    };

    if (plan !== 'premium_monthly' && plan !== 'premium_yearly') {
      res.status(400).json({ error: 'Invalid subscription plan.' });
      return;
    }

    const defaultPrice = plan === 'premium_monthly' ? 499 : 4999;
    const amount =
      typeof customPriceInr === 'number' && customPriceInr >= 49 && customPriceInr <= 100000
        ? Math.round(customPriceInr)
        : defaultPrice;

    const safeUpiId =
      typeof merchantUpiId === 'string' && /^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+$/.test(merchantUpiId.trim())
        ? merchantUpiId.trim()
        : '6353688361@fam';

    const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const issuedAt = Date.now();
    const payload = `${req.user!.uid}:${orderId}:${plan}:${amount}:${issuedAt}`;
    const orderToken = crypto.createHmac('sha256', serverSigningSecret).update(payload).digest('hex');

    const note = `APNA RAJA AI ${plan === 'premium_monthly' ? 'Monthly' : 'Yearly'} (${orderId})`;
    const upiUri = `upi://pay?pa=${encodeURIComponent(safeUpiId)}&pn=${encodeURIComponent('APNA RAJA AI')}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(orderId)}`;

    res.json({
      orderId,
      plan,
      amount,
      currency: 'INR',
      merchantUpiId: safeUpiId,
      upiUri,
      issuedAt,
      orderToken,
    });
  });

  app.post('/api/payments/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { orderId, plan, amount, issuedAt, orderToken, provider = 'upi_verified', transactionRef } = req.body as {
      orderId?: string;
      plan?: 'premium_monthly' | 'premium_yearly';
      amount?: number;
      issuedAt?: number;
      orderToken?: string;
      provider?: 'razorpay_verified' | 'stripe_verified' | 'upi_verified';
      transactionRef?: string;
    };

    if (!orderId || !plan || !amount || !issuedAt || !orderToken || !transactionRef) {
      res.status(400).json({ error: 'Incomplete payment verification payload.' });
      return;
    }

    if (transactionRef.trim().length < 4 || transactionRef.trim().length > 128) {
      res.status(400).json({ error: 'Invalid payment transaction reference.' });
      return;
    }

    const expectedPayload = `${req.user!.uid}:${orderId}:${plan}:${amount}:${issuedAt}`;
    const expectedToken = crypto.createHmac('sha256', serverSigningSecret).update(expectedPayload).digest('hex');

    const tokenBuf = Buffer.from(orderToken, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      res.status(403).json({ error: 'Payment signature verification failed.' });
      return;
    }

    // Check order hasn't expired (15 minutes)
    if (Date.now() - issuedAt > 15 * 60 * 1000) {
      res.status(400).json({ error: 'Payment order expired. Please initiate checkout again.' });
      return;
    }

    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    const receiptSignature = crypto
      .createHmac('sha256', serverSigningSecret)
      .update(`${paymentId}:${req.user!.uid}:${plan}:${amount}:${transactionRef.trim()}`)
      .digest('hex');

    const now = new Date();
    const expiresDate = new Date(now);
    if (plan === 'premium_monthly') {
      expiresDate.setMonth(expiresDate.getMonth() + 1);
    } else {
      expiresDate.setFullYear(expiresDate.getFullYear() + 1);
    }

    const allowedProviders = ['razorpay_verified', 'stripe_verified', 'upi_verified'];
    const safeProvider = allowedProviders.includes(provider) ? provider : 'upi_verified';

    res.json({
      verified: true,
      paymentId,
      plan,
      billingCycle: plan === 'premium_monthly' ? 'monthly' : 'yearly',
      amount,
      currency: 'INR',
      provider: safeProvider,
      transactionRef: transactionRef.trim(),
      signature: receiptSignature,
      expiresAt: expiresDate.toISOString(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(rootDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`APNA RAJA AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start APNA RAJA AI server:', err);
  process.exit(1);
});
