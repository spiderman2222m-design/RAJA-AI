import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09080D] px-6 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/src/assets/images/royal_hero_backdrop_1794730096891.jpg')" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#09080D] via-[#09080D]/80 to-[#140E24]/70"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center max-w-md"
      >
        <div className="relative mb-7">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-[#D4AF37]/40 bg-[#12101A] shadow-2xl">
            <img
              src="/src/assets/images/royal_ai_emblem_1794730096169.jpg"
              alt="APNA RAJA AI royal crown emblem"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => {
              setTimeout(onComplete, 250);
            }}
            className="mt-6 h-[2px] w-48 mx-auto origin-left bg-gradient-to-r from-[#7C3AED] via-[#D4AF37] to-[#F3D578]"
          />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-[#F4F1EA]">
          APNA RAJA AI
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#D4AF37] font-medium tracking-wide">
          Your Personal AI Assistant
        </p>

        <button
          type="button"
          onClick={onComplete}
          className="mt-8 text-xs text-[#9E97AD] hover:text-[#F4F1EA] transition-colors py-2 px-4 whitespace-nowrap"
        >
          Enter Workspace
        </button>
      </motion.div>
    </motion.div>
  );
}
