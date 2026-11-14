import type { Coupon, Member } from "../types/coupon";

export const MEMBER_POOL: Member[] = [
  { id: "m01", name: "John Trader",   email: "john.trader@gmail.com" },
  { id: "m02", name: "Sarah Invest",  email: "sarah.invest@gmail.com" },
  { id: "m03", name: "Mike FX",       email: "mikefx@tradehub.io" },
  { id: "m04", name: "Emily Markets", email: "emily.markets@proton.me" },
  { id: "m05", name: "Chris Chart",   email: "chrischart@outlook.com" },
  { id: "m06", name: "Anna Pips",     email: "anna.pips@gmail.com" },
  { id: "m07", name: "Lucas Bull",    email: "lucas.bull@yahoo.com" },
  { id: "m08", name: "Dana Bear",     email: "dana.bear@icloud.com" },
];
export const INITIAL_COUPONS: Coupon[] = [
  {
    id: "c01", code: "JOHNTRADER10", name: "존트레이더 유튜브 7월",
    partnerId: "m01", discountValue: 10, commissionRate: 5,
    scopeAll: true, scopeProducts: ["Starter", "Professional", "Elite"],
    maxUses: 200, perUserLimit: "once", startDate: "2026-07-01", endDate: "2026-07-31", status: "active",
    usageHistory: [
      { userName: "Alice Kim",  userEmail: "alice.kim@gmail.com",    discountApplied: 10, datetime: "2026-07-22T15:44:00Z", orderNo: "ORD-20260722-011", originalAmountUsd: 150 },
      { userName: "Bob Park",   userEmail: "bob.park@naver.com",     discountApplied: 10, datetime: "2026-07-20T08:22:00Z", orderNo: "ORD-20260720-006", originalAmountUsd: 300 },
      { userName: "Cindy Oh",   userEmail: "cindy.oh@daum.net",      discountApplied: 10, datetime: "2026-07-18T11:30:00Z", orderNo: "ORD-20260718-003", originalAmountUsd: 600 },
      { userName: "Derek Cho",  userEmail: "derek.cho@gmail.com",    discountApplied: 10, datetime: "2026-07-16T14:50:00Z", orderNo: "ORD-20260716-014", originalAmountUsd: 300 },
      { userName: "Ellen Baek", userEmail: "ellen.baek@proton.me",   discountApplied: 10, datetime: "2026-07-14T09:00:00Z", orderNo: "ORD-20260714-007", originalAmountUsd: 150 },
      { userName: "Felix Yoon", userEmail: "felix.yoon@naver.com",   discountApplied: 10, datetime: "2026-07-13T13:15:00Z", orderNo: "ORD-20260713-002", originalAmountUsd: 300 },
      { userName: "Grace Han",  userEmail: "grace.han@gmail.com",    discountApplied: 10, datetime: "2026-07-11T10:33:00Z", orderNo: "ORD-20260711-009", originalAmountUsd: 600 },
      { userName: "Henry Shin", userEmail: "henry.shin@outlook.com", discountApplied: 10, datetime: "2026-07-10T16:20:00Z", orderNo: "ORD-20260710-005", originalAmountUsd: 300 },
      { userName: "Irene Jung", userEmail: "irene.j@naver.com",      discountApplied: 10, datetime: "2026-07-09T08:45:00Z", orderNo: "ORD-20260709-012", originalAmountUsd: 150 },
      { userName: "Jake Lim",   userEmail: "jake.lim@daum.net",      discountApplied: 10, datetime: "2026-07-08T11:02:00Z", orderNo: "ORD-20260708-003", originalAmountUsd: 300 },
      { userName: "Karen Moon", userEmail: "karen.m@gmail.com",      discountApplied: 10, datetime: "2026-07-05T14:33:00Z", orderNo: "ORD-20260705-008", originalAmountUsd: 150 },
      { userName: "Leo Kim",    userEmail: "leo.kim@kakao.com",      discountApplied: 10, datetime: "2026-07-03T09:14:00Z", orderNo: "ORD-20260703-001", originalAmountUsd: 300 },
    ],
  },
  {
    id: "c02", code: "SARAHVIP20", name: "사라인베스트 인스타 6월",
    partnerId: "m02", discountValue: 20, commissionRate: 8,
    scopeAll: false, scopeProducts: ["Professional", "Elite"],
    maxUses: 100, perUserLimit: "once", startDate: "2026-06-01", endDate: "2026-06-30", status: "inactive",
    usageHistory: [
      { userName: "David Lee",  userEmail: "david.lee@gmail.com",  discountApplied: 20, datetime: "2026-06-04T08:55:00Z", orderNo: "ORD-20260604-011", originalAmountUsd: 300 },
      { userName: "Emma Yoon",  userEmail: "emma.yoon@gmail.com",  discountApplied: 20, datetime: "2026-06-11T16:20:00Z", orderNo: "ORD-20260611-002", originalAmountUsd: 600 },
    ],
  },
  {
    id: "c03", code: "MIKEFX10", name: "마이크FX 트위터 할인",
    partnerId: "m03", discountValue: 10, commissionRate: 3,
    scopeAll: true, scopeProducts: ["Starter", "Professional", "Elite"],
    maxUses: 50, perUserLimit: "once", startDate: "2026-05-01", endDate: "2026-05-31", status: "active",
    usageHistory: [],
  },
  {
    id: "c04", code: "EMILY15OFF", name: "에밀리마켓 블로그 5월",
    partnerId: "m04", discountValue: 15, commissionRate: 7,
    scopeAll: false, scopeProducts: ["Starter"],
    maxUses: 80, perUserLimit: "unlimited", startDate: "2026-04-01", endDate: "2026-04-30", status: "active",
    usageHistory: [
      { userName: "Frank Choi", userEmail: "frank.c@naver.com", discountApplied: 15, datetime: "2026-04-10T10:10:00Z", orderNo: "ORD-20260410-007", originalAmountUsd: 150 },
    ],
  },
  {
    id: "c05", code: "CHRISCHART5", name: "크리스차트 팟캐스트",
    partnerId: "m05", discountValue: 5, commissionRate: 5,
    scopeAll: true, scopeProducts: ["Starter", "Professional", "Elite"],
    maxUses: 300, perUserLimit: "once", startDate: "2026-08-01", endDate: "2026-08-31", status: "active",
    usageHistory: [],
  },
  {
    id: "c06", code: "ANNAPIPS30", name: "안나핍스 텔레그램",
    partnerId: "m06", discountValue: 30, commissionRate: 10,
    scopeAll: false, scopeProducts: ["Elite"],
    maxUses: 30, perUserLimit: "once", startDate: "2026-03-01", endDate: "2026-03-31", status: "inactive",
    usageHistory: [
      { userName: "Grace Han",  userEmail: "grace.han@gmail.com",       discountApplied: 30, datetime: "2026-03-06T13:00:00Z", orderNo: "ORD-20260306-015", originalAmountUsd: 600 },
      { userName: "Henry Shin", userEmail: "henry.shin@outlook.com",    discountApplied: 30, datetime: "2026-03-12T09:45:00Z", orderNo: "ORD-20260312-004", originalAmountUsd: 600 },
      { userName: "Irene Jung", userEmail: "irene.j@naver.com",         discountApplied: 30, datetime: "2026-03-18T17:22:00Z", orderNo: "ORD-20260318-009", originalAmountUsd: 600 },
      { userName: "Jake Lim",   userEmail: "jake.lim@daum.net",         discountApplied: 30, datetime: "2026-03-24T11:30:00Z", orderNo: "ORD-20260324-002", originalAmountUsd: 600 },
    ],
  },
];
