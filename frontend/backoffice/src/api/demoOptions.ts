import api from './axios';

// 데모 계좌 생성 팝업(사용자 웹 My Account)의 선택지는 platform_config의 DEMO scope에 저장된다.
export type DemoConfigKey =
  | 'allowed_capitals'
  | 'allowed_leverages'
  | 'default_capital'
  | 'default_leverage';

export type ConfigValueType = 'STRING' | 'INTEGER' | 'FLOAT' | 'JSON' | 'BOOLEAN';

export interface PlatformConfigItem {
  scope: string;
  key: string;
  // Core는 JSON 값을 그대로, 기존 서버는 문자열로 내려준다.
  value: unknown;
  value_type: ConfigValueType;
  description: string | null;
}

export interface DemoOptionsConfig {
  allowedCapitals: number[];
  allowedLeverages: number[];
  defaultCapital: number;
  defaultLeverage: number;
}

export const DEMO_OPTION_DEFAULTS: DemoOptionsConfig = {
  allowedCapitals: [10000, 50000, 100000],
  allowedLeverages: [100, 200, 500],
  defaultCapital: 10000,
  defaultLeverage: 100,
};

function parseValue(item: PlatformConfigItem | undefined): unknown {
  if (!item) return undefined;
  if (typeof item.value !== 'string' || item.value_type === 'STRING') return item.value;
  try {
    return JSON.parse(item.value);
  } catch {
    return undefined;
  }
}

function toNumberList(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const numbers = value.map(Number).filter((v) => Number.isFinite(v) && v > 0);
  return numbers.length > 0 ? numbers : fallback;
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const getDemoOptionsConfig = async (): Promise<DemoOptionsConfig> => {
  const response = await api.get<PlatformConfigItem[]>('/v1/admin/platform-config/DEMO');
  const byKey = new Map(response.data.map((item) => [item.key, item]));
  return {
    allowedCapitals: toNumberList(parseValue(byKey.get('allowed_capitals')), DEMO_OPTION_DEFAULTS.allowedCapitals),
    allowedLeverages: toNumberList(parseValue(byKey.get('allowed_leverages')), DEMO_OPTION_DEFAULTS.allowedLeverages),
    defaultCapital: toNumber(parseValue(byKey.get('default_capital')), DEMO_OPTION_DEFAULTS.defaultCapital),
    defaultLeverage: toNumber(parseValue(byKey.get('default_leverage')), DEMO_OPTION_DEFAULTS.defaultLeverage),
  };
};

const DESCRIPTIONS: Record<DemoConfigKey, string> = {
  allowed_capitals: '데모 계좌 자본금 선택지 (USDT)',
  allowed_leverages: '데모 계좌 레버리지 선택지',
  default_capital: '데모 계좌 기본 자본금 (USDT)',
  default_leverage: '데모 계좌 기본 레버리지',
};

export const updateDemoConfig = async (key: DemoConfigKey, value: number | number[]) => {
  const response = await api.put<PlatformConfigItem>(`/v1/admin/platform-config/DEMO/${key}`, {
    value,
    value_type: Array.isArray(value) ? 'JSON' : Number.isInteger(value) ? 'INTEGER' : 'FLOAT',
    description: DESCRIPTIONS[key],
  });
  return response.data;
};
