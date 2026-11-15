import { auth } from './firebase';
import type { AppLanguage, ChatMode } from '../types';

export class ApiClientError extends Error {
  requiresPaidKey: boolean;
  status: number;

  constructor(message: string, status: number, requiresPaidKey = false) {
    super(message);
    this.status = status;
    this.requiresPaidKey = requiresPaidKey;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiClientError('You must be signed in to use AI features.', 401);
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function streamAiChat(params: {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  mode: ChatMode;
  language: AppLanguage;
  extraContext?: string;
  onChunk: (partial: string) => void;
}): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: params.message,
      history: params.history,
      mode: params.mode,
      language: params.language,
      extraContext: params.extraContext ?? '',
      stream: true,
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string; requiresPaidKey?: boolean };
    throw new ApiClientError(
      errBody.error || 'AI request failed.',
      res.status,
      Boolean(errBody.requiresPaidKey)
    );
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiClientError('Streaming response unavailable.', 500);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      const parsed = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string; requiresPaidKey?: boolean };
      if (parsed.error) {
        throw new ApiClientError(parsed.error, 500, Boolean(parsed.requiresPaidKey));
      }
      if (parsed.text) {
        fullText += parsed.text;
        params.onChunk(fullText);
      }
    }
  }

  return fullText;
}

export async function transcribeVoiceAudio(params: {
  audioBase64: string;
  mimeType: string;
  language: AppLanguage;
}): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/voice-transcribe', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { transcript?: string; error?: string; requiresPaidKey?: boolean };
  if (!res.ok) {
    throw new ApiClientError(data.error || 'Transcription failed.', res.status, Boolean(data.requiresPaidKey));
  }
  return data.transcript ?? '';
}

export async function synthesizeVoiceSpeech(params: {
  text: string;
  voiceName?: string;
  style?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/voice-tts', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    audioBase64?: string;
    mimeType?: string;
    error?: string;
    requiresPaidKey?: boolean;
  };
  if (!res.ok || !data.audioBase64) {
    throw new ApiClientError(data.error || 'Speech synthesis failed.', res.status, Boolean(data.requiresPaidKey));
  }
  return { audioBase64: data.audioBase64, mimeType: data.mimeType || 'audio/wav' };
}

export async function generateAiImage(params: {
  prompt: string;
  aspectRatio: string;
  highQuality?: boolean;
}): Promise<{ mediaUrl: string; caption: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/image', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    mediaUrl?: string;
    caption?: string;
    error?: string;
    requiresPaidKey?: boolean;
  };
  if (!res.ok || !data.mediaUrl) {
    throw new ApiClientError(data.error || 'Image generation failed.', res.status, Boolean(data.requiresPaidKey));
  }
  return { mediaUrl: data.mediaUrl, caption: data.caption || '' };
}

export async function generateAiVideo(params: {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  duration: string;
  resolution: '360p' | '720p' | '1080p';
}): Promise<{ mediaUrl: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/video', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    mediaUrl?: string;
    error?: string;
    requiresPaidKey?: boolean;
  };
  if (!res.ok || !data.mediaUrl) {
    throw new ApiClientError(data.error || 'Video generation failed.', res.status, Boolean(data.requiresPaidKey));
  }
  return { mediaUrl: data.mediaUrl };
}

export async function createPaymentOrder(
  plan: 'premium_monthly' | 'premium_yearly',
  customPriceInr?: number,
  merchantUpiId?: string
) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plan, customPriceInr, merchantUpiId }),
  });
  const data = (await res.json()) as {
    orderId: string;
    plan: 'premium_monthly' | 'premium_yearly';
    amount: number;
    currency: 'INR';
    merchantUpiId: string;
    upiUri: string;
    issuedAt: number;
    orderToken: string;
    error?: string;
  };
  if (!res.ok) {
    throw new ApiClientError(data.error || 'Failed to create payment order.', res.status);
  }
  return data;
}

export async function verifyPaymentOrder(params: {
  orderId: string;
  plan: 'premium_monthly' | 'premium_yearly';
  amount: number;
  issuedAt: number;
  orderToken: string;
  provider: 'razorpay_verified' | 'stripe_verified' | 'upi_verified';
  transactionRef: string;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    verified: boolean;
    paymentId: string;
    plan: 'premium_monthly' | 'premium_yearly';
    billingCycle: 'monthly' | 'yearly';
    amount: number;
    currency: 'INR';
    provider: 'razorpay_verified' | 'stripe_verified' | 'upi_verified';
    transactionRef: string;
    signature: string;
    expiresAt: string;
    error?: string;
  };
  if (!res.ok || !data.verified) {
    throw new ApiClientError(data.error || 'Payment verification failed.', res.status);
  }
  return data;
}
