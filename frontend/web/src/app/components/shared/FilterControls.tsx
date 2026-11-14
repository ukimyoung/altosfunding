import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';

// 페이지 단위 필터 블록을 감싸는 공통 컨테이너입니다.
type FilterCardProps = {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FilterCard({
  title,
  icon,
  children,
  className = 'bg-[#0f0f17] border border-[#2a2a3a] rounded-xl p-6',
}: FilterCardProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-white font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// 모든 필터 필드가 같은 여백과 타이포그래피를 유지하도록 하는 라벨 래퍼입니다.
type FilterFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FilterField({ label, children, className = '' }: FilterFieldProps) {
  return (
    <div className={className}>
      <label className="text-gray-400 text-xs font-medium mb-2 block">{label}</label>
      {children}
    </div>
  );
}

// 계정 페이지 전반에서 검색 입력에 사용하는 텍스트 필드입니다.
type FilterTextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  inputClassName?: string;
  wrapperClassName?: string;
};

export function FilterTextInput({
  icon,
  inputClassName = '',
  wrapperClassName = 'relative',
  className,
  ...props
}: FilterTextInputProps) {
  return (
    <div className={wrapperClassName}>
      {icon}
      <input
        {...props}
        className={`w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0052FF] transition-colors ${className || ''} ${inputClassName}`}
      />
    </div>
  );
}

// 필터 패널에서 공통으로 쓰는 아이콘 포함 날짜 입력 필드입니다.
type FilterDateInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  inputClassName?: string;
  onPickerOpen?: () => void;
};

export function FilterDateInput({
  icon,
  inputClassName = '',
  className,
  onPickerOpen,
  ...props
}: FilterDateInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleWrapperClick = () => {
    const input = inputRef.current;
    if (!input) return;

    onPickerOpen?.();

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.click();
  };

  return (
    <div className="relative cursor-pointer" onClick={handleWrapperClick}>
      {icon}
      <input
        ref={inputRef}
        {...props}
        type="date"
        className={`filter-date-input w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg pl-10 pr-4 py-2.5 text-white text-sm cursor-pointer focus:outline-none focus:border-[#0052FF] transition-colors ${className || ''} ${inputClassName}`}
      />
    </div>
  );
}

// 별도 드롭다운 상태가 필요 없는 페이지에서 쓰는 네이티브 select입니다.
type FilterSelectOption = {
  label: string;
  value: string;
};

type FilterSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: FilterSelectOption[];
  selectClassName?: string;
};

export function FilterSelect({
  options,
  selectClassName = '',
  className,
  ...props
}: FilterSelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0052FF] transition-colors appearance-none cursor-pointer ${className || ''} ${selectClassName}`}
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23888\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '12px',
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// 페이지 내부에서 열림/닫힘 상태를 직접 관리하는 커스텀 드롭다운입니다.
type FilterDropdownProps = {
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  onSelect: (value: string) => void;
  options: readonly string[];
  className?: string;
  menuClassName?: string;
};

export function FilterDropdown({
  label,
  value,
  isOpen,
  onToggle,
  onClose,
  onSelect,
  options,
  className = 'w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm text-left flex items-center justify-between hover:border-[#0052FF]/50 transition-colors',
  menuClassName = 'absolute top-full left-0 right-0 mt-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg overflow-hidden z-10 shadow-xl',
}: FilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !onClose) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={dropdownRef} className="relative">
      <button type="button" onClick={onToggle} className={className}>
        <span>{value}</span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className={menuClassName}>
          {options.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onSelect(option)}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#24243a] transition-colors ${
                value === option ? 'bg-[#0052FF]/10 text-white' : 'text-gray-400'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

// Search / Reset 버튼을 우측 정렬로 배치하기 위한 액션 영역입니다.
type FilterActionsProps = {
  children: ReactNode;
  className?: string;
};

export function FilterActions({ children, className = 'flex justify-end gap-3' }: FilterActionsProps) {
  return <div className={className}>{children}</div>;
}
