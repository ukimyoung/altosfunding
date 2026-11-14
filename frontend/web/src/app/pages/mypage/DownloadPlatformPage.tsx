import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Download,
  Monitor,
  Smartphone,
  Tablet,
  Apple,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/shared/figma/ImageWithFallback';
import { downloadPlatformLinks } from '@/app/config/downloadLinks';
import { useLocale } from '@/app/i18n/LocaleContext';

export function DownloadPlatformPage() {
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const { T } = useLocale();
  const text = T.downloadPlatform;
  const platforms = downloadPlatformLinks.map((platform) => ({
    ...platform,
    name:
      platform.id === 'windows'
        ? text.windowsName
        : platform.id === 'macos'
          ? text.macosName
          : platform.id === 'android'
            ? text.androidName
            : text.iosName,
    description:
      platform.id === 'windows'
        ? text.windowsDesc
        : platform.id === 'macos'
          ? text.macosDesc
          : platform.id === 'android'
            ? text.androidDesc
            : text.iosDesc,
    actionLabel:
      platform.id === 'android'
        ? text.googlePlayBtn
        : platform.id === 'ios'
          ? text.appStoreBtn
          : text.downloadBtn,
    icon:
      platform.id === 'windows' ? (
        <Monitor size={32} />
      ) : platform.id === 'macos' ? (
        <Apple size={32} />
      ) : platform.id === 'android' ? (
        <Smartphone size={32} />
      ) : (
        <Tablet size={32} />
      ),
  }));

  const filteredPlatforms = platforms.filter((p) => p.category === activeTab);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
            <Download size={24} className="text-[#0052FF]" />
          </div>
          <div>
            <h1 className="text-2xl text-white font-medium">{text.pageTitle}</h1>
            <p className="text-gray-400 text-sm mt-1">{text.pageSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-[#0052FF]/20 via-[#0f0f17] to-[#00FF94]/10 border border-[#0052FF]/30 rounded-2xl p-8 mb-10 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#0052FF]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00FF94]/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0052FF]/10 border border-[#0052FF]/30 rounded-full mb-4">
              <span className="w-2 h-2 rounded-full bg-[#00FF94] animate-pulse"></span>
              <span className="text-[#00FF94] text-xs font-medium whitespace-nowrap">
                {text.bannerBadge}
              </span>
            </div>
            <h2 className="text-3xl text-white font-medium mb-4">
              {text.bannerTitlePre}
              <span className="text-[#0052FF]">{text.bannerTitleHighlight}</span>
              {text.bannerTitlePost}
            </h2>
            <p className="text-gray-300 text-lg mb-6">{text.bannerDescription}</p>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-[#00FF94]" />
                <span className="text-gray-300">{text.featureFreeDownload}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={18} className="text-[#00FF94]" />
                <span className="text-gray-300">{text.featureAllDevices}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={18} className="text-[#00FF94]" />
                <span className="text-gray-300">{text.featureSupport}</span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaW5nJTIwcGxhdGZvcm0lMjBzY3JlZW58ZW58MXx8fHwxNzM2NzA3MjAwfDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="MetaTrader 4 Platform"
              className="w-96 h-64 object-cover rounded-xl border border-[#1a1a24]"
            />
          </div>
        </div>
      </motion.div>

      {/* Platform Toggle */}
      <div className="mb-10">
        <div className="inline-flex p-1 bg-[#0f0f17] border border-[#1a1a24] rounded-lg">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'desktop'
                ? 'bg-[#0052FF] text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Monitor size={18} />
            {text.tabDesktop}
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'mobile'
                ? 'bg-[#0052FF] text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone size={18} />
            {text.tabMobile}
          </button>
        </div>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPlatforms.map((platform, index) => (
          <motion.div
            key={platform.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 hover:border-[#0052FF]/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-[#0052FF]/10 flex items-center justify-center text-[#0052FF] group-hover:bg-[#0052FF]/20 transition-colors flex-shrink-0">
                {platform.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-xl font-medium mb-1">{platform.name}</h3>
                <p className="text-gray-400 text-sm">{platform.description}</p>
              </div>
              <a
                href={platform.href}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-gradient-to-r from-[#0052FF] to-[#0052FF]/80 text-white rounded-lg hover:shadow-lg hover:shadow-[#0052FF]/30 transition-all font-medium inline-flex items-center gap-2 whitespace-nowrap flex-shrink-0"
              >
                {platform.category === 'desktop' ? (
                  <Download size={18} />
                ) : (
                  <ExternalLink size={18} />
                )}
                {platform.actionLabel}
                <ChevronRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

