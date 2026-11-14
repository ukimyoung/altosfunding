import { useRef, useState } from "react";
import type * as React from "react";
import { Check, Eye, EyeOff, RefreshCw } from "lucide-react";
import { FormInput, FormLabel, RadioItem, SectionLabel, TextareaField } from "../shared/FormControls";
import { ModalCloseBtn } from "../shared/ModalCloseButton";
import { tok } from "../../theme/tokens";
import {
  MemberBasicInfoFields,
  type MemberBasicInfoFieldKey,
  type MemberBasicInfoValues,
} from "./MemberBasicInfoFields";
import type { CreateUserRequest, UserKycStatus, UserStatus } from "@/api/user";

type AccountStatusValue = UserStatus;
type KycStatusOptionValue = "APPROVED" | "Unverified" | "Rejected";
type FieldErrors = Partial<Record<"firstName" | "lastName" | "email", string>>;

const accountOptionLabels = ["ACTIVE (활성)", "INACTIVE (비활성)", "BANNED (영구정지)"];
const kycOptionLabels = ["APPROVED (인증 완료)", "Unverified (미인증)", "Rejected (인증 실패)"];

const errorTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "#DC2626",
  fontFamily: "'Noto Sans KR','DM Sans',sans-serif",
};

const getErrorInputStyle = (hasError: boolean): React.CSSProperties | undefined =>
  hasError ? { borderColor: "#DC2626" } : undefined;

export function AddUserModal({
  dark,
  onClose,
  onConfirm,
}: {
  dark: boolean;
  onClose: () => void;
  onConfirm: (payload: CreateUserRequest) => void;
}) {
  const t = tok(dark);
  const [userType, setUserType] = useState<"normal" | "vip">("normal");
  const [accountStatus, setAccountStatus] = useState<AccountStatusValue>("ACTIVE");
  const [kycStatus, setKycStatus] = useState<KycStatusOptionValue>("Unverified");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPw, setShowPw] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  const genTemp = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    setPwValue(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const clearError = (field: keyof FieldErrors) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateRequiredFields = () => {
    const nextErrors: FieldErrors = {};

    if (!firstName.trim()) nextErrors.firstName = "필수값입니다.";
    if (!lastName.trim()) nextErrors.lastName = "필수값입니다.";
    if (!email.trim()) nextErrors.email = "필수값입니다.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const normalizeAccountStatus = (value: AccountStatusValue): UserStatus => {
    if (value === "INACTIVE") return "INACTIVE";
    if (value === "BANNED") return "BANNED";
    return "ACTIVE";
  };

  const normalizeKycStatus = (value: KycStatusOptionValue): UserKycStatus => {
    if (value === "APPROVED") return "APPROVED";
    if (value === "Rejected") return "REJECTED";
    return "NONE";
  };

  const handleConfirm = () => {
    if (!validateRequiredFields()) return;

    const payload: CreateUserRequest = {
      email: email.trim(),
      password: pwValue,
      role: "USER",
      grade: userType === "vip" ? "VIP" : "NORMAL",
      status: normalizeAccountStatus(accountStatus),
      kyc_status: normalizeKycStatus(kycStatus),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      country: country.trim() || undefined,
      city: city.trim() || undefined,
      state_province: stateProvince.trim() || undefined,
      address_line1: address.trim() || undefined,
      address_line2: addressDetail.trim() || undefined,
      zip_code: zipCode.trim() || undefined,
      phone: phone.trim() || undefined,
      admin_note: adminNote.trim() || undefined,
    };

    onConfirm(payload);
  };

  const basicInfoValues: MemberBasicInfoValues = {
    firstName,
    lastName,
    email,
    phone,
    country,
    city,
    stateProvince,
    addressLine1: address,
    addressLine2: addressDetail,
    zipCode,
  };

  const handleBasicInfoChange = (field: MemberBasicInfoFieldKey, value: string) => {
    if (field === "firstName") {
      setFirstName(value);
      clearError("firstName");
    }
    if (field === "lastName") {
      setLastName(value);
      clearError("lastName");
    }
    if (field === "email") {
      setEmail(value);
      clearError("email");
    }
    if (field === "phone") setPhone(value);
    if (field === "country") setCountry(value);
    if (field === "city") setCity(value);
    if (field === "stateProvince") setStateProvince(value);
    if (field === "addressLine1") setAddress(value);
    if (field === "addressLine2") setAddressDetail(value);
    if (field === "zipCode") setZipCode(value);
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 0",
      }}
    >
      <div style={{
        width: 560, maxHeight: "90vh", borderRadius: 16,
        background: t.surface, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        fontFamily: "'DM Sans','Noto Sans KR',sans-serif",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: "'Noto Sans KR',sans-serif" }}>사용자 추가</span>
          <ModalCloseBtn onClick={onClose} t={t} />
        </div>

        <div ref={bodyRef} style={{ padding: 24, overflowY: "auto", flex: 1, scrollbarWidth: "none" }}>
          <SectionLabel label="기본 인적사항" t={t} />
          <MemberBasicInfoFields
            values={basicInfoValues}
            onChange={handleBasicInfoChange}
            renderField={({ key, label, value, onChange, placeholder, required, type }) => (
              <div key={key}>
                <FormLabel label={label} required={required} t={t} />
                <FormInput
                  placeholder={placeholder}
                  type={type}
                  value={value}
                  onChange={onChange}
                  style={getErrorInputStyle(
                    (key === "firstName" && Boolean(errors.firstName)) ||
                      (key === "lastName" && Boolean(errors.lastName)) ||
                      (key === "email" && Boolean(errors.email)),
                  )}
                  t={t}
                />
                {key === "firstName" && errors.firstName && <div style={errorTextStyle}>{errors.firstName}</div>}
                {key === "lastName" && errors.lastName && <div style={errorTextStyle}>{errors.lastName}</div>}
                {key === "email" && errors.email && <div style={errorTextStyle}>{errors.email}</div>}
              </div>
            )}
            renderPassword={() => (
              <div>
                <FormLabel label="비밀번호" t={t} />
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      value={pwValue}
                      onChange={(e) => setPwValue(e.target.value)}
                      type={showPw ? "text" : "password"}
                      placeholder="비밀번호를 입력하거나 임시 발급하세요"
                      style={{ height: 38, background: t.surface2, border: `1px solid ${t.border2}`, borderRadius: 8, fontSize: 13, padding: "0 38px 0 12px", color: t.text, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "'DM Mono',monospace" }}
                    />
                    <button onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: t.textHint, display: "flex", alignItems: "center", padding: 0 }}>
                      {showPw ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                    </button>
                  </div>
                  <button onClick={genTemp} style={{ height: 38, padding: "0 14px", border: `1px solid ${t.border2}`, background: t.surface2, color: t.textSec, borderRadius: 8, fontSize: 12, fontWeight: 500, fontFamily: "'Noto Sans KR',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap" }}>
                    <RefreshCw size={13} strokeWidth={1.75} />
                    임시 발급
                  </button>
                </div>
              </div>
            )}
          />

          <SectionLabel label="계정 설정" t={t} />
          <div style={{ marginBottom: 24 }}>
            <FormLabel label="User Type" t={t} />
            <div style={{ display: "flex", gap: 8 }}>
              {(["normal", "vip"] as const).map((v) => {
                const active = userType === v;
                const label = v === "normal" ? "일반" : "VIP";
                return (
                  <button key={v} onClick={() => setUserType(v)} style={{
                    height: 34, padding: "0 20px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    fontFamily: "'Noto Sans KR',sans-serif", transition: "all 0.15s",
                    background: active ? "rgba(124,106,247,0.08)" : t.surface2,
                    border: `1px solid ${active ? "#7C6AF7" : t.border2}`,
                    color: active ? "#7C6AF7" : t.textSec,
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <SectionLabel label="계정상태 / KYC 설정" t={t} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <FormLabel label="계정상태" t={t} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {accountOptionLabels.map((opt) => (
                  <RadioItem key={opt} label={opt} selected={accountStatus === opt.split(" ")[0]} onClick={() => setAccountStatus(opt.split(" ")[0] as AccountStatusValue)} t={t} />
                ))}
              </div>
            </div>
            <div>
              <FormLabel label="초기 KYC 상태" t={t} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {kycOptionLabels.map((opt) => (
                  <RadioItem key={opt} label={opt} selected={kycStatus === opt.split(" ")[0]} onClick={() => setKycStatus(opt.split(" ")[0] as KycStatusOptionValue)} t={t} />
                ))}
              </div>
            </div>
          </div>

          <SectionLabel label="관리자 메모" t={t} />
          <TextareaField placeholder="내부 메모 (선택사항)" value={adminNote} onChange={setAdminNote} t={t} />
        </div>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 500, fontFamily: "'Noto Sans KR',sans-serif", cursor: "pointer" }}>
            취소
          </button>
          <button onClick={handleConfirm} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#7C6AF7", color: "#fff", fontSize: 12, fontWeight: 500, fontFamily: "'Noto Sans KR',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} strokeWidth={2.5} />
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
