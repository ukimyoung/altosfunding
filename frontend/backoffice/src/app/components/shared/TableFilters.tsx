"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

export const SEARCH_DEBOUNCE_MS = 300;

interface TableFilterBarProps {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  background?: string;
  borderColor?: string;
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minWidth?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  iconLeft?: number;
  paddingLeft?: number;
  paddingRight?: number;
  iconSize?: number;
  background?: string;
  borderColor?: string;
  textColor?: string;
  iconColor?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

interface SelectFilterOption {
  value: string;
  label: React.ReactNode;
}

interface SelectFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectFilterOption[];
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  paddingLeft?: number;
  paddingRight?: number;
  background?: string;
  borderColor?: string;
  textColor?: string;
  iconColor?: string;
}

interface DateRangeFilterProps {
  startValue: string;
  onStartChange: (value: string) => void;
  endValue: string;
  onEndChange: (value: string) => void;
  startMin?: string;
  startMax?: string;
  endMin?: string;
  endMax?: string;
  startWidth?: number;
  endWidth?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  paddingX?: number;
  background?: string;
  borderColor?: string;
  textColor?: string;
  separator?: React.ReactNode;
  showEnd?: boolean;
}

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  background?: string;
  color?: string;
  border?: string;
  height?: number;
  padding?: string;
  fontSize?: number;
  fontWeight?: number;
  radius?: number;
  gap?: number;
  style?: React.CSSProperties;
}

export function TableFilterBar({
  children,
  actions,
  containerStyle,
  background,
  borderColor,
}: TableFilterBarProps) {
  return (
    <div
      style={{
        background,
        border: borderColor ? `1px solid ${borderColor}` : "1px solid transparent",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 24,
        ...containerStyle,
      }}
    >
      {children}

      {actions ? <div style={{ marginLeft: "auto" }}>{actions}</div> : null}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  minWidth = 280,
  height = 40,
  fontSize = 13,
  fontFamily = "'Noto Sans KR',sans-serif",
  iconLeft = 12,
  paddingLeft = 36,
  paddingRight = 12,
  iconSize = 16,
  background,
  borderColor,
  textColor,
  iconColor,
  onKeyDown,
}: SearchFieldProps) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: iconLeft,
          top: "50%",
          transform: "translateY(-50%)",
          color: iconColor ?? "#94a3b8",
          pointerEvents: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Search size={iconSize} strokeWidth={1.75} />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          width: "100%",
          height,
          paddingLeft,
          paddingRight,
          borderRadius: 8,
          border: `1px solid ${borderColor ?? "#cbd5e1"}`,
          background: background ?? "#f8fafc",
          color: textColor ?? "#0f172a",
          fontSize,
          fontFamily,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  width = 140,
  height = 36,
  fontSize = 13,
  fontFamily = "'Noto Sans KR',sans-serif",
  paddingLeft = 12,
  paddingRight = 28,
  background,
  borderColor,
  textColor,
  iconColor,
}: SelectFilterProps) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width,
          height,
          padding: `0 ${paddingRight}px 0 ${paddingLeft}px`,
          borderRadius: 8,
          border: `1px solid ${borderColor ?? "#cbd5e1"}`,
          background: background ?? "#f8fafc",
          color: textColor ?? "#0f172a",
          fontSize,
          fontFamily,
          cursor: "pointer",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          color: iconColor ?? "#94a3b8",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function DateRangeFilter({
  startValue,
  onStartChange,
  endValue,
  onEndChange,
  startMin,
  startMax,
  endMin,
  endMax,
  startWidth = 140,
  endWidth = 140,
  height = 36,
  fontSize = 13,
  fontFamily = "'Noto Sans KR',sans-serif",
  paddingX = 12,
  background = "rgb(244, 245, 247)",
  borderColor = "rgba(0, 0, 0, 0.09)",
  textColor = "rgb(26, 26, 26)",
  separator = "~",
  showEnd = true,
}: DateRangeFilterProps) {
  const startInputRef = React.useRef<HTMLInputElement | null>(null);
  const endInputRef = React.useRef<HTMLInputElement | null>(null);

  const openPicker = (input: HTMLInputElement | null) => {
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  const dateInputStyle: React.CSSProperties = {
    height,
    padding: `0 ${paddingX}px`,
    background,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    fontSize,
    color: textColor,
    outline: "none",
    boxSizing: "border-box",
    fontFamily,
    cursor: "pointer",
  };

  return (
    <>
      <div
        className="relative cursor-pointer"
        onClick={() => openPicker(startInputRef.current)}
        style={{ position: "relative", minWidth: startWidth, flexShrink: 0 }}
      >
        <input
          ref={startInputRef}
          type="date"
          value={startValue}
          onChange={(e) => onStartChange(e.target.value)}
          min={startMin}
          max={startMax}
          style={{ ...dateInputStyle, width: "100%" }}
        />
      </div>
      {showEnd ? (
        <>
          <span style={{ fontSize, color: textColor, margin: "0 2px", flexShrink: 0 }}>
            {separator}
          </span>
          <div
            className="relative cursor-pointer"
            onClick={() => openPicker(endInputRef.current)}
            style={{ position: "relative", minWidth: endWidth, flexShrink: 0 }}
          >
            <input
              ref={endInputRef}
              type="date"
              value={endValue}
              onChange={(e) => onEndChange(e.target.value)}
              min={endMin}
              max={endMax}
              style={{ ...dateInputStyle, width: "100%" }}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

export function ActionButton({
  children,
  onClick,
  type = "button",
  background = "#4f46e5",
  color = "#fff",
  border = "none",
  height = 36,
  padding = "0 20px",
  fontSize = 13,
  fontWeight = 500,
  radius = 8,
  gap = 6,
  style,
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        height,
        padding,
        borderRadius: radius,
        border,
        background,
        color,
        fontSize,
        fontWeight,
        fontFamily: "'Noto Sans KR',sans-serif",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
