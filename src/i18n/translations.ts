import type { AppLanguage } from '../types';

export interface Translations {
  brandName: string;
  tagline: string;
  signInTitle: string;
  signInSubtitle: string;
  continueWithGoogle: string;
  orUseEmail: string;
  emailLabel: string;
  passwordLabel: string;
  nameLabel: string;
  signInBtn: string;
  signUpBtn: string;
  createAccountLink: string;
  alreadyHaveAccountLink: string;
  forgotPassword: string;
  verifyEmailTitle: string;
  verifyEmailDesc: string;
  resendVerification: string;
  iHaveVerified: string;
  signOut: string;
  newChat: string;
  history: string;
  noHistory: string;
  searchHistory: string;
  upgradePlan: string;
  currentPlan: string;
  freePlan: string;
  monthlyPlan: string;
  yearlyPlan: string;
  navChat: string;
  navVoice: string;
  navImage: string;
  navVideo: string;
  navWriter: string;
  navCode: string;
  navTranslate: string;
  navAdmin: string;
  chatPlaceholder: string;
  send: string;
  listening: string;
  speakNow: string;
  tapToSpeak: string;
  generating: string;
  download: string;
  copy: string;
  copied: string;
  listen: string;
  quotaReached: string;
  accountBlocked: string;
}

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  en: {
    brandName: 'APNA RAJA AI',
    tagline: 'Your Personal AI Assistant',
    signInTitle: 'Enter Your Royal Workspace',
    signInSubtitle: 'Sign in with Google or Email to unlock AI Chat, Voice, Media Studios, Code, and Translation.',
    continueWithGoogle: 'Continue with Google',
    orUseEmail: 'or continue with email',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    nameLabel: 'Full name',
    signInBtn: 'Sign In',
    signUpBtn: 'Create Account',
    createAccountLink: 'New here? Create an account',
    alreadyHaveAccountLink: 'Already have an account? Sign in',
    forgotPassword: 'Forgot password?',
    verifyEmailTitle: 'Verify Your Email Address',
    verifyEmailDesc: 'We sent a verification link to your inbox. Please confirm your email to secure your account and continue.',
    resendVerification: 'Resend Verification Email',
    iHaveVerified: 'I Have Verified — Continue',
    signOut: 'Sign Out',
    newChat: 'New Session',
    history: 'Conversation History',
    noHistory: 'No saved conversations yet. Start asking APNA RAJA AI below.',
    searchHistory: 'Search conversations...',
    upgradePlan: 'Upgrade Plan',
    currentPlan: 'Plan',
    freePlan: 'Free Plan',
    monthlyPlan: 'Royal Monthly',
    yearlyPlan: 'Royal Yearly',
    navChat: 'AI Chat',
    navVoice: 'Voice Assistant',
    navImage: 'Image Studio',
    navVideo: 'Video Studio',
    navWriter: 'Content Writer',
    navCode: 'Code Assistant',
    navTranslate: 'Translator',
    navAdmin: 'Admin Console',
    chatPlaceholder: 'Ask APNA RAJA AI anything in English, Hindi, or Gujarati...',
    send: 'Send',
    listening: 'Listening to your voice...',
    speakNow: 'Tap microphone and speak clearly',
    tapToSpeak: 'Tap to Speak',
    generating: 'Creating...',
    download: 'Download',
    copy: 'Copy',
    copied: 'Copied',
    listen: 'Listen',
    quotaReached: 'Free tier limit reached for this feature. Upgrade to Royal Premium to continue.',
    accountBlocked: 'Your account has been suspended by the administrator.',
  },
  hi: {
    brandName: 'APNA RAJA AI',
    tagline: 'आपका व्यक्तिगत AI सहायक',
    signInTitle: 'अपने रॉयल वर्कस्पेस में प्रवेश करें',
    signInSubtitle: 'AI चैट, वॉइस, इमेज, वीडियो, कंटेंट, कोड और अनुवाद के लिए Google या ईमेल से लॉगिन करें।',
    continueWithGoogle: 'Google से जारी रखें',
    orUseEmail: 'या ईमेल से जारी रखें',
    emailLabel: 'ईमेल पता',
    passwordLabel: 'पासवर्ड',
    nameLabel: 'पूरा नाम',
    signInBtn: 'साइन इन करें',
    signUpBtn: 'खाता बनाएं',
    createAccountLink: 'नए उपयोगकर्ता हैं? नया खाता बनाएं',
    alreadyHaveAccountLink: 'पहले से खाता है? साइन इन करें',
    forgotPassword: 'पासवर्ड भूल गए?',
    verifyEmailTitle: 'अपना ईमेल सत्यापित करें',
    verifyEmailDesc: 'हमने आपके ईमेल पर एक सत्यापन लिंक भेजा है। आगे बढ़ने के लिए कृपया ईमेल की पुष्टि करें।',
    resendVerification: 'लिंक फिर से भेजें',
    iHaveVerified: 'मैंने सत्यापित कर लिया — आगे बढ़ें',
    signOut: 'साइन आउट',
    newChat: 'नई बातचीत',
    history: 'चैट इतिहास',
    noHistory: 'अभी कोई सहेजी गई बातचीत नहीं है। नीचे लिखकर शुरुआत करें।',
    searchHistory: 'इतिहास खोजें...',
    upgradePlan: 'प्लान अपग्रेड करें',
    currentPlan: 'प्लान',
    freePlan: 'फ्री प्लान',
    monthlyPlan: 'रॉयल मासिक',
    yearlyPlan: 'रॉयल वार्षिक',
    navChat: 'AI चैट',
    navVoice: 'वॉइस असिस्टेंट',
    navImage: 'इमेज स्टूडियो',
    navVideo: 'वीडियो स्टूडियो',
    navWriter: 'कंटेंट राइटर',
    navCode: 'कोड असिस्टेंट',
    navTranslate: 'अनुवादक',
    navAdmin: 'एडमिन डैशबोर्ड',
    chatPlaceholder: 'हिंदी, अंग्रेजी या गुजराती में कुछ भी पूछें...',
    send: 'भेजें',
    listening: 'आपकी आवाज़ सुन रहे हैं...',
    speakNow: 'माइक दबाएं और स्पष्ट बोलें',
    tapToSpeak: 'बोलने के लिए दबाएं',
    generating: 'तैयार हो रहा है...',
    download: 'डाउनलोड',
    copy: 'कॉपी करें',
    copied: 'कॉपी हो गया',
    listen: 'सुनें',
    quotaReached: 'इस सुविधा की मुफ्त सीमा समाप्त हो गई है। जारी रखने के लिए प्रीमियम प्लान लें।',
    accountBlocked: 'एडमिनिस्ट्रेटर द्वारा आपका खाता निलंबित कर दिया गया है।',
  },
  gu: {
    brandName: 'APNA RAJA AI',
    tagline: 'તમારો વ્યક્તિગત AI સહાયક',
    signInTitle: 'તમારા રોયલ વર્કસ્પેસમાં પ્રવેશ કરો',
    signInSubtitle: 'AI ચેટ, વોઈસ, ઈમેજ, વિડિયો, કન્ટેન્ટ, કોડ અને ભાષાંતર માટે Google અથવા ઈમેલથી સાઈન ઈન કરો.',
    continueWithGoogle: 'Google સાથે ચાલુ રાખો',
    orUseEmail: 'અથવા ઈમેલ વડે ચાલુ રાખો',
    emailLabel: 'ઈમેલ સરનામું',
    passwordLabel: 'પાસવર્ડ',
    nameLabel: 'પૂરું નામ',
    signInBtn: 'સાઈન ઈન કરો',
    signUpBtn: 'ખાતું બનાવો',
    createAccountLink: 'નવા છો? નવું ખાતું બનાવો',
    alreadyHaveAccountLink: 'પહેલેથી ખાતું છે? સાઈન ઈન કરો',
    forgotPassword: 'પાસવર્ડ ભૂલી ગયા?',
    verifyEmailTitle: 'તમારું ઈમેલ ચકાસો',
    verifyEmailDesc: 'અમે તમારા ઈમેલ પર ચકાસણી લિંક મોકલી છે. આગળ વધવા માટે કૃપા કરીને ઈમેલની પુષ્ટિ કરો.',
    resendVerification: 'લિંક ફરી મોકલો',
    iHaveVerified: 'મેં ચકાસણી કરી — આગળ વધો',
    signOut: 'સાઈન આઉટ',
    newChat: 'નવી વાતચીત',
    history: 'ચેટ ઇતિહાસ',
    noHistory: 'હજુ સુધી કોઈ સાચવેલી વાતચીત નથી. નીચે પૂછીને શરૂઆત કરો.',
    searchHistory: 'ઇતિહાસ શોધો...',
    upgradePlan: 'પ્લાન અપગ્રેડ કરો',
    currentPlan: 'પ્લાન',
    freePlan: 'ફ્રી પ્લાન',
    monthlyPlan: 'રોયલ માસિક',
    yearlyPlan: 'રોયલ વાર્ષિક',
    navChat: 'AI ચેટ',
    navVoice: 'વોઈસ આસિસ્ટન્ટ',
    navImage: 'ઈમેજ સ્ટુડિયો',
    navVideo: 'વિડિયો સ્ટુડિયો',
    navWriter: 'કન્ટેન્ટ રાઈટર',
    navCode: 'કોડ આસિસ્ટન્ટ',
    navTranslate: 'અનુવાદક',
    navAdmin: 'એડમિન ડેશબોર્ડ',
    chatPlaceholder: 'ગુજરાતી, હિન્દી અથવા અંગ્રેજીમાં કંઈપણ પૂછો...',
    send: 'મોકલો',
    listening: 'તમારો અવાજ સાંભળી રહ્યા છીએ...',
    speakNow: 'માઈક દબાવો અને સ્પષ્ટ બોલો',
    tapToSpeak: 'બોલવા માટે દબાવો',
    generating: 'બનાવી રહ્યા છીએ...',
    download: 'ડાઉનલોડ',
    copy: 'કોપી કરો',
    copied: 'કોપી થયું',
    listen: 'સાંભળો',
    quotaReached: 'આ સુવિધાની મફત મર્યાદા પૂર્ણ થઈ ગઈ છે. ચાલુ રાખવા પ્રીમિયમ અપગ્રેડ કરો.',
    accountBlocked: 'એડમિનિસ્ટ્રેટર દ્વારા તમારું ખાતું સ્થગિત કરવામાં આવ્યું છે.',
  },
};
