import type * as React from 'react';

type MemberAddressFieldValues = {
  country: string;
  city: string;
  stateProvince: string;
  addressLine1: string;
  addressLine2: string;
  zipCode: string;
};

type MemberAddressFieldKey = keyof MemberAddressFieldValues;

export type MemberBasicInfoValues = MemberAddressFieldValues & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type MemberBasicInfoFieldKey = keyof MemberBasicInfoValues;

type BasicField = {
  key: MemberBasicInfoFieldKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
};

type MemberBasicInfoFieldsProps = {
  values: MemberBasicInfoValues;
  onChange: (field: MemberBasicInfoFieldKey, value: string) => void;
  renderField: (field: BasicField) => React.ReactNode;
  renderPassword: () => React.ReactNode;
  gap?: number;
  bottomMargin?: number;
};

const labels = {
  firstName: '이름',
  lastName: '성',
  email: '이메일',
  phone: '전화번호',
} satisfies Record<'firstName' | 'lastName' | 'email' | 'phone', string>;

const addressLabels = {
  country: '국가',
  city: '도시',
  stateProvince: '주',
  addressLine1: '주소',
  addressLine2: '상세주소',
  zipCode: '우편번호',
} satisfies Record<MemberAddressFieldKey, string>;

export function MemberBasicInfoFields({
  values,
  onChange,
  renderField,
  renderPassword,
  gap = 16,
  bottomMargin = 24,
}: MemberBasicInfoFieldsProps) {
  const field = (
    key: MemberBasicInfoFieldKey,
    label: string,
    placeholder: string,
    options: Pick<BasicField, 'required' | 'type'> = {},
  ) =>
    renderField({
      key,
      label,
      value: values[key],
      onChange: (value) => onChange(key, value),
      placeholder,
      ...options,
    });

  const addressField = (key: MemberAddressFieldKey, placeholder: string, required?: boolean) =>
    renderField({
      key,
      label: addressLabels[key],
      value: values[key],
      onChange: (value) => onChange(key, value),
      placeholder,
      required,
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, marginBottom: bottomMargin }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {field('firstName', labels.firstName, 'First name', { required: true })}
        {field('lastName', labels.lastName, 'Last name', { required: true })}
      </div>
      {field('email', labels.email, 'email@example.com', { required: true, type: 'email' })}
      {renderPassword()}
      {field('phone', labels.phone, '010-0000-0000', { type: 'tel' })}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
          {addressField('country', 'United States')}
          {addressField('stateProvince', 'California')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
          {addressField('city', 'Los Angeles')}
          {addressField('zipCode', '123123123')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
          {addressField('addressLine1', '123 Main St')}
          {addressField('addressLine2', 'Apt 4')}
        </div>
      </div>
    </div>
  );
}
