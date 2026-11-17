import { getCountries, getCountryCallingCode } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import labelsEn from 'react-phone-number-input/locale/en';
import labelsKo from 'react-phone-number-input/locale/ko';

// 웹 회원가입 2단계·My Account > Edit Profile과 백오피스 회원 추가·수정이 같은 국가 목록을 쓴다.
// Core에는 영어 국가 이름(예: 'United States')이 저장된다.
export const COUNTRY_LABELS = labelsEn as Record<string, string>;
const COUNTRY_LABELS_KO = labelsKo as Record<string, string>;

export const PRIORITY_COUNTRY_CODES: Country[] = ['US', 'CA', 'GB'];

export type CountryOption = {
  code: Country;
  label: string;
  callingCode: string;
};

// 자주 쓰는 국가를 위에 두고 나머지는 이름순
export const COUNTRY_OPTIONS: CountryOption[] = [
  ...PRIORITY_COUNTRY_CODES.map((code) => ({
    code,
    label: COUNTRY_LABELS[code] ?? code,
    callingCode: `+${getCountryCallingCode(code)}`,
  })),
  ...getCountries()
    .filter((code) => !PRIORITY_COUNTRY_CODES.includes(code))
    .map((code) => ({
      code,
      label: COUNTRY_LABELS[code] ?? code,
      callingCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

// 예전에 직접 입력한 국가 이름을 목록의 이름으로 맞추기 위한 별칭
const COUNTRY_ALIASES: Record<string, Country> = {
  usa: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  america: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  korea: 'KR',
  'republic of korea': 'KR',
  'korea, republic of': 'KR',
  한국: 'KR',
  남한: 'KR',
  vietnam: 'VN',
  'viet nam': 'VN',
  russia: 'RU',
  uae: 'AE',
};

const normalizeCountryText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const COUNTRY_LOOKUP = (() => {
  const lookup = new Map<string, Country>();
  for (const option of COUNTRY_OPTIONS) {
    lookup.set(normalizeCountryText(option.code), option.code);
    lookup.set(normalizeCountryText(option.label), option.code);
    const koLabel = COUNTRY_LABELS_KO[option.code];
    if (koLabel) {
      lookup.set(normalizeCountryText(koLabel), option.code);
    }
  }
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    lookup.set(normalizeCountryText(alias), code);
  }
  return lookup;
})();

/**
 * 저장된 국가 값(영어 이름·국가 코드·한국어 이름·흔한 별칭)을 목록의 영어 이름으로 바꾼다.
 * 목록에서 찾을 수 없으면 빈 문자열을 돌려준다.
 */
export const toCountryLabel = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const code = COUNTRY_LOOKUP.get(normalizeCountryText(value));
  return code ? (COUNTRY_LABELS[code] ?? code) : '';
};
