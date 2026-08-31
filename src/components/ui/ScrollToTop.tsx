import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const mainEl = document.querySelector('main');
      const scrollTop =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        (mainEl?.scrollTop ?? 0);
      setIsVisible(scrollTop > 250);
    };

    window.addEventListener('scroll', checkScroll, { passive: true });
    document.addEventListener('scroll', checkScroll, { passive: true, capture: true });
    const mainEl = document.querySelector('main');
    mainEl?.addEventListener('scroll', checkScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', checkScroll);
      document.removeEventListener('scroll', checkScroll, { capture: true });
      mainEl?.removeEventListener('scroll', checkScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('main');
    mainEl?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-700 hover:text-[#E34A26] hover:border-[#E34A26]/40 hover:bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E34A26]/30 animate-fade-in"
      aria-label="Volver arriba"
      title="Volver al inicio de la página"
    >
      <ChevronUp className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
    </button>
  );
};
