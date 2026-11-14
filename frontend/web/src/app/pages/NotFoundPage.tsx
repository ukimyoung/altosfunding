import { SearchX } from 'lucide-react';
import { AlphaNavigation } from '../components/landing/AlphaNavigation';
import { AlphaFooter } from '../components/landing/AlphaFooter';
import { useLocale } from '../i18n/LocaleContext';

export function NotFoundPage() {
  const { T } = useLocale();
  const text = T.notFound;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <AlphaNavigation />

      <main className="flex flex-1 items-center justify-center px-5 pt-24 pb-14 sm:px-6 sm:pb-16">
        <section className="w-full max-w-xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-[#2a2a3a] bg-[#0f0f17] sm:mb-8 sm:h-16 sm:w-16">
            <SearchX size={30} className="text-[#00FF94] sm:h-8 sm:w-8" />
          </div>

          <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-[#00FF94]">
            {text.code}
          </p>
          <h1 className="mx-auto mb-4 max-w-[18rem] text-3xl font-bold leading-tight [word-break:keep-all] sm:max-w-none sm:text-5xl">
            {text.title}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-gray-400 [word-break:keep-all] sm:max-w-md sm:text-base">
            {text.description}
          </p>
        </section>
      </main>

      <AlphaFooter />
    </div>
  );
}
