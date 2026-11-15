import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_APP_SETTINGS,
  OWNER_ADMIN_EMAIL,
  type AppLanguage,
  type AppSettings,
  type ChatMessage,
  type ChatMode,
  type Conversation,
  type CreationRecord,
  type PaymentRecord,
  type PlanTier,
  type UsageMap,
  type UserProfile,
} from '../types';

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
}

export async function ensureUserProfile(firebaseUser: User, preferredLanguage: AppLanguage = 'en'): Promise<UserProfile> {
  const path = `users/${firebaseUser.uid}`;
  const ref = doc(db, 'users', firebaseUser.uid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const isOwnerAdmin =
      firebaseUser.email?.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase() &&
      firebaseUser.emailVerified;

    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: (firebaseUser.email || 'user@example.com').slice(0, 256),
      displayName: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Royal Member').slice(0, 120),
      photoURL: (firebaseUser.photoURL || '').slice(0, 500),
      role: isOwnerAdmin ? 'admin' : 'user',
      plan: 'free',
      subscriptionStatus: 'active',
      subscriptionBillingCycle: 'none',
      subscriptionExpiresAt: 'none',
      lastPaymentId: '',
      preferredLanguage,
      usage: {
        chatCount: 0,
        voiceCount: 0,
        imageCount: 0,
        videoCount: 0,
        writerCount: 0,
        codeCount: 0,
        translateCount: 0,
      },
      isBlocked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, newProfile);
    return newProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateUserLanguage(uid: string, preferredLanguage: AppLanguage): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      preferredLanguage,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function incrementFeatureUsage(uid: string, field: keyof UsageMap): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      [`usage.${field}`]: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function commitVerifiedSubscriptionUpgrade(params: {
  uid: string;
  paymentId: string;
  plan: 'premium_monthly' | 'premium_yearly';
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: 'INR' | 'USD';
  provider: 'razorpay_verified' | 'stripe_verified' | 'upi_verified';
  transactionRef: string;
  signature: string;
  expiresAt: string;
}): Promise<void> {
  const batch = writeBatch(db);
  const paymentRef = doc(db, 'payments', params.paymentId);
  const userRef = doc(db, 'users', params.uid);

  batch.set(paymentRef, {
    id: params.paymentId,
    userId: params.uid,
    plan: params.plan,
    amount: params.amount,
    currency: params.currency,
    provider: params.provider,
    transactionRef: params.transactionRef.slice(0, 128),
    signature: params.signature.slice(0, 256),
    status: 'verified',
    createdAt: serverTimestamp(),
  });

  batch.update(userRef, {
    plan: params.plan,
    subscriptionStatus: 'active',
    subscriptionBillingCycle: params.billingCycle,
    subscriptionExpiresAt: params.expiresAt.slice(0, 64),
    lastPaymentId: params.paymentId,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function createConversation(params: {
  userId: string;
  title: string;
  mode: ChatMode;
  language: AppLanguage;
}): Promise<Conversation> {
  const id = makeSafeId('conv');
  const path = `conversations/${id}`;
  const payload: Conversation = {
    id,
    userId: params.userId,
    title: params.title.trim().slice(0, 160) || 'New Conversation',
    mode: params.mode,
    language: params.language,
    messageCount: 0,
    lastMessagePreview: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'conversations', id), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function addConversationMessage(params: {
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  mode: ChatMode;
  language: AppLanguage;
  nextCount: number;
  titleUpdate?: string;
}): Promise<ChatMessage> {
  const messageId = makeSafeId('msg');
  const msgPath = `conversations/${params.conversationId}/messages/${messageId}`;
  const msgPayload: ChatMessage = {
    id: messageId,
    conversationId: params.conversationId,
    userId: params.userId,
    role: params.role,
    content: params.content.slice(0, 50000) || ' ',
    mode: params.mode,
    language: params.language,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'conversations', params.conversationId, 'messages', messageId), msgPayload);
    const convUpdate: Record<string, unknown> = {
      messageCount: params.nextCount,
      lastMessagePreview: params.content.replace(/\s+/g, ' ').trim().slice(0, 220),
      language: params.language,
      updatedAt: serverTimestamp(),
    };
    if (params.titleUpdate) {
      convUpdate.title = params.titleUpdate.trim().slice(0, 160);
    }
    await updateDoc(doc(db, 'conversations', params.conversationId), convUpdate);
    return msgPayload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, msgPath);
  }
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  const path = `conversations/${conversationId}`;
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      title: title.trim().slice(0, 160) || 'Untitled',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const path = `conversations/${conversationId}`;
  try {
    const msgsSnap = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((m) => batch.delete(m.ref));
    batch.delete(doc(db, 'conversations', conversationId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveCreationRecord(params: {
  userId: string;
  type: 'image' | 'video';
  prompt: string;
  mediaUrl: string;
  aspectRatio: string;
}): Promise<CreationRecord> {
  const id = makeSafeId(params.type === 'image' ? 'img' : 'vid');
  const path = `creations/${id}`;
  const record: CreationRecord = {
    id,
    userId: params.userId,
    type: params.type,
    prompt: params.prompt.trim().slice(0, 2000),
    mediaUrl: params.mediaUrl.slice(0, 500),
    aspectRatio: params.aspectRatio.slice(0, 16),
    status: 'completed',
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'creations', id), record);
    return record;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCreationRecord(creationId: string): Promise<void> {
  const path = `creations/${creationId}`;
  try {
    await deleteDoc(doc(db, 'creations', creationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const path = 'app_settings/global';
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'global'));
    if (snap.exists()) {
      const data = snap.data() as Partial<AppSettings>;
      return {
        ...DEFAULT_APP_SETTINGS,
        ...data,
        merchantUpiId: data.merchantUpiId || DEFAULT_APP_SETTINGS.merchantUpiId,
      };
    }
    return DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export async function saveAppSettings(params: {
  updatedBy: string;
  freeLimits: UsageMap;
  monthlyPriceInr: number;
  yearlyPriceInr: number;
  merchantUpiId: string;
}): Promise<void> {
  const path = 'app_settings/global';
  try {
    await setDoc(doc(db, 'app_settings', 'global'), {
      id: 'global',
      freeLimits: params.freeLimits,
      monthlyPriceInr: params.monthlyPriceInr,
      yearlyPriceInr: params.yearlyPriceInr,
      merchantUpiId: params.merchantUpiId.trim().slice(0, 120) || DEFAULT_APP_SETTINGS.merchantUpiId,
      updatedBy: params.updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminFetchAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function adminFetchAllPayments(): Promise<PaymentRecord[]> {
  const path = 'payments';
  try {
    const snap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => d.data() as PaymentRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function adminUpdateUserAccount(params: {
  targetUid: string;
  plan?: PlanTier;
  isBlocked?: boolean;
  role?: 'user' | 'admin';
  email?: string;
  adminUid?: string;
  resetUsage?: boolean;
}): Promise<void> {
  const path = `users/${params.targetUid}`;
  try {
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (params.plan) {
      updates.plan = params.plan;
      updates.subscriptionBillingCycle =
        params.plan === 'premium_monthly' ? 'monthly' : params.plan === 'premium_yearly' ? 'yearly' : 'none';
      updates.subscriptionStatus = 'active';
      updates.subscriptionExpiresAt =
        params.plan === 'free'
          ? 'none'
          : new Date(Date.now() + (params.plan === 'premium_yearly' ? 365 : 30) * 86400000).toISOString();
    }
    if (typeof params.isBlocked === 'boolean') {
      updates.isBlocked = params.isBlocked;
    }
    if (params.role) {
      updates.role = params.role;
      if (params.role === 'admin' && params.email && params.adminUid) {
        await setDoc(doc(db, 'admins', params.targetUid), {
          uid: params.targetUid,
          email: params.email,
          grantedBy: params.adminUid,
          createdAt: serverTimestamp(),
        });
      }
    }
    if (params.resetUsage) {
      updates.usage = {
        chatCount: 0,
        voiceCount: 0,
        imageCount: 0,
        videoCount: 0,
        writerCount: 0,
        codeCount: 0,
        translateCount: 0,
      };
    }

    await updateDoc(doc(db, 'users', params.targetUid), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchUserCreations(userId: string): Promise<CreationRecord[]> {
  const path = 'creations';
  try {
    const q = query(collection(db, 'creations'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CreationRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
