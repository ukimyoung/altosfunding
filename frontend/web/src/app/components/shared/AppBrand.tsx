import { ImageWithFallback } from './figma/ImageWithFallback';
import brandLogo from '@/app/assets/Altos Funding_Logo_40X40.png';

type AppBrandProps = {
  className?: string;
  logoWrapClassName?: string;
  imageClassName?: string;
  textClassName?: string;
  showText?: boolean;
};

const BRAND_LOGO_SRC = brandLogo;

export function AppBrand({
  className = 'flex items-center gap-2',
  logoWrapClassName = 'w-10 h-10',
  imageClassName = 'w-10 h-10 object-contain brightness-0 invert',
  textClassName = 'text-xl text-white',
  showText = true,
}: AppBrandProps) {
  return (
    <div className={className}>
      <div className={`flex items-center justify-center ${logoWrapClassName}`}>
        <ImageWithFallback
          src={BRAND_LOGO_SRC}
          alt="Altos Funding Logo"
          className={imageClassName}
        />
      </div>
      {showText ? <span className={textClassName}>Altos Funding</span> : null}
    </div>
  );
}
