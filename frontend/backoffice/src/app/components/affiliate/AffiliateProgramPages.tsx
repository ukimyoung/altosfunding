import { useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileSpreadsheet,
  Filter,
  Folder,
  FolderOpen,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./AffiliateAlertDialog";

type ToastHandler = (message: string, type?: "success" | "warning") => void;
type PartnerStatus = "Active" | "Suspended" | "Withdrawn" | "Blacklist";
type PartnerStatusFilter = "All" | "Active" | "Inactive" | "PermanentlySuspended";
type NetworkStatus = "Active" | "Inactive" | "PermanentlySuspended";

interface Partner {
  id: string;
  name: string;
  phone: string;
  email: string;
  uplineId: string | null;
  downlineIbId: string | null;
  level: number;
  status: PartnerStatus;
  downline: number;
  registeredAt: string;
}

interface TreeNode {
  id: string;
  name: string;
  level: number;
  status: PartnerStatus;
  volume: string;
  children?: TreeNode[];
}

interface NetworkTreeNode {
  id: string;
  name: string;
  email: string;
  userType: string;
  status: NetworkStatus;
  generatedVolume: string;
  commission: string;
  children?: NetworkTreeNode[];
}

function formatUid(identifier: string) {
  return identifier.replace(/^(?:IB|UID)-/, "UID-");
}

const PARTNERS: Partner[] = [
  { id: "IB-10482", name: "Daniel Kim", phone: "+82 10-2847-1930", email: "daniel.kim@vertex.io", uplineId: null, downlineIbId: "IB-10811", level: 12, status: "Active", downline: 126, registeredAt: "2026-06-04 14:30 (GMT+9)" },
  { id: "IB-10396", name: "Sophia Chen", phone: "+65 9123 4088", email: "sophia@orbitcapital.sg", uplineId: null, downlineIbId: "IB-11018", level: 9, status: "Active", downline: 84, registeredAt: "2026-05-22 09:18 (GMT+9)" },
  { id: "IB-10271", name: "Marcus Lee", phone: "+44 7700 912801", email: "marcus@northstar.uk", uplineId: "IB-10482", downlineIbId: "IB-11102", level: 18, status: "Suspended", downline: 213, registeredAt: "2026-04-17 16:42 (GMT+9)" },
  { id: "IB-10144", name: "Aiko Tanaka", phone: "+81 90-3841-7260", email: "aiko@horizon.jp", uplineId: "IB-10396", downlineIbId: "IB-11304", level: 7, status: "Active", downline: 57, registeredAt: "2026-03-08 11:05 (GMT+9)" },
  { id: "IB-10093", name: "Oliver Smith", phone: "+1 415 555 0192", email: "oliver@apextrading.com", uplineId: "IB-10271", downlineIbId: "IB-11621", level: 21, status: "Withdrawn", downline: 302, registeredAt: "2026-02-14 18:20 (GMT+9)" },
  { id: "IB-10038", name: "Nadia Rahman", phone: "+971 50 927 4431", email: "nadia@meridian.ae", uplineId: "IB-10093", downlineIbId: null, level: 14, status: "Blacklist", downline: 0, registeredAt: "2026-01-29 10:12 (GMT+9)" },
];

const MEMBER_SEARCH_RESULTS = [
  { id: "UID-20841", ibNumber: "IB-20841", name: "Grace Yoon", email: "grace.yoon@altos.io" },
  { id: "UID-20796", ibNumber: "IB-20796", name: "Alex Morgan", email: "alex.morgan@altos.io" },
  { id: "UID-20682", ibNumber: "IB-20682", name: "김서준", email: "seojun.kim@altos.io" },
];

const TREE: TreeNode = {
  id: "IB-10482", name: "Daniel Kim", level: 12, status: "Active", volume: "$148,320",
  children: [
    {
      id: "IB-10811", name: "Minseo Park", level: 8, status: "Active", volume: "$62,410",
      children: [
        { id: "IB-11102", name: "Ethan Wong", level: 4, status: "Active", volume: "$21,800" },
        { id: "IB-11218", name: "Liam Cho", level: 3, status: "Suspended", volume: "$12,650" },
      ],
    },
    {
      id: "IB-10829", name: "Emma Wilson", level: 7, status: "Active", volume: "$54,890",
      children: [
        { id: "IB-11304", name: "Mia Santos", level: 4, status: "Active", volume: "$18,720" },
        {
          id: "IB-11342", name: "Noah Lim", level: 5, status: "Active", volume: "$24,100",
          children: [{ id: "IB-11621", name: "Leo Martin", level: 2, status: "Active", volume: "$8,440" }],
        },
      ],
    },
    { id: "IB-10907", name: "Lucas Meyer", level: 6, status: "Withdrawn", volume: "$31,020" },
  ],
};

const NETWORK_TREES: NetworkTreeNode[] = [
  {
    id: "IB-10482",
    name: "Daniel K.",
    email: "daniel@vertex.io",
    userType: "My IB Account - Level 1",
    status: "Active",
    generatedVolume: "$428,600",
    commission: "+$18,420.50",
    children: [
      {
        id: "IB-10811",
        name: "Minji K.",
        email: "minjik@naver.com",
        userType: "Downline IB - Level 2",
        status: "Active",
        generatedVolume: "$142,800",
        commission: "+$4,284.00",
        children: [
          { id: "UID-21408", name: "Ethan W.", email: "ethan@gmail.com", userType: "Direct User", status: "Active", generatedVolume: "$38,500", commission: "+$770.00" },
          { id: "UID-21562", name: "Liam C.", email: "liam@outlook.com", userType: "Direct User", status: "Inactive", generatedVolume: "$18,200", commission: "+$364.00" },
        ],
      },
      {
        id: "IB-10829",
        name: "Emma W.",
        email: "emma@altos.io",
        userType: "Downline IB - Level 2",
        status: "Active",
        generatedVolume: "$118,400",
        commission: "+$3,552.00",
        children: [
          {
            id: "IB-11342",
            name: "Noah L.",
            email: "noah@gmail.com",
            userType: "Downline IB - Level 3",
            status: "Active",
            generatedVolume: "$74,900",
            commission: "+$1,498.00",
            children: [
              { id: "UID-22116", name: "Leo M.", email: "leom@mail.com", userType: "Direct User", status: "PermanentlySuspended", generatedVolume: "$24,100", commission: "+$482.00" },
            ],
          },
        ],
      },
      { id: "UID-20841", name: "Grace Y.", email: "grace@altos.io", userType: "Direct User", status: "Active", generatedVolume: "$54,300", commission: "+$1,086.00" },
    ],
  },
  {
    id: "IB-10396",
    name: "Sophia C.",
    email: "sophia@orbitcapital.sg",
    userType: "My IB Account - Level 1",
    status: "Active",
    generatedVolume: "$316,200",
    commission: "+$12,648.00",
    children: [
      { id: "IB-11018", name: "Oliver T.", email: "oliver@proton.me", userType: "Downline IB - Level 2", status: "Active", generatedVolume: "$96,500", commission: "+$2,895.00" },
      { id: "UID-21804", name: "Mia S.", email: "mias@gmail.com", userType: "Direct User", status: "Active", generatedVolume: "$42,700", commission: "+$854.00" },
    ],
  },
];

const COMMISSION_UIDS = [
  "UID-10487", "UID-20591", "UID-31842", "UID-20714", "UID-41208", "UID-38511",
  "UID-10487", "UID-42924", "UID-20591", "UID-46777", "UID-33108", "UID-44041",
  "UID-27829", "UID-45118", "UID-31342", "UID-47006", "UID-41621", "UID-48990",
];

const COMMISSION_DETAIL_ROWS = [
  { date: "2026-11-18 16:42 GMT+9", member: "Alex M.", email: "alex@gmail.com", userType: "Downline IB - Level 3", accountType: "Prime", amount: "$192.00", rate: "5%", earned: "+$9.60", status: "Completed" },
  { date: "2026-11-17 14:32 GMT+9", member: "Minji K.", email: "minjik@naver.com", userType: "Downline IB - Level 2", accountType: "Elite", amount: "$113.00", rate: "7%", earned: "+$7.91", status: "Completed" },
  { date: "2026-11-16 11:08 GMT+9", member: "TRADER92", email: "trader92@outlook.com", userType: "Direct Client", accountType: "Professional", amount: "$79.00", rate: "10%", earned: "+$7.90", status: "Pending" },
  { date: "2026-11-15 09:55 GMT+9", member: "Soojin P.", email: "soojinp@gmail.com", userType: "Downline IB - Level 2", accountType: "Prime", amount: "$192.00", rate: "7%", earned: "+$13.44", status: "Completed" },
  { date: "2026-11-14 18:20 GMT+9", member: "ZENITH08", email: "zenith08@proton.me", userType: "Direct Client", accountType: "Starter", amount: "$48.00", rate: "10%", earned: "+$4.80", status: "Completed" },
  { date: "2026-11-13 13:47 GMT+9", member: "FXPRO11", email: "fxpro11@gmail.com", userType: "Direct Client", accountType: "Elite", amount: "$113.00", rate: "10%", earned: "+$11.30", status: "Refunded" },
  { date: "2026-11-12 10:16 GMT+9", member: "Alex M.", email: "alex@gmail.com", userType: "Downline IB - Level 3", accountType: "Professional", amount: "$79.00", rate: "5%", earned: "+$3.95", status: "Completed" },
  { date: "2026-11-11 21:04 GMT+9", member: "PROTRADER24", email: "protrader24@gmail.com", userType: "Direct Client", accountType: "Prime", amount: "$192.00", rate: "10%", earned: "+$19.20", status: "Completed" },
  { date: "2026-11-10 17:39 GMT+9", member: "Minji K.", email: "minjik@naver.com", userType: "Downline IB - Level 2", accountType: "Professional", amount: "$79.00", rate: "7%", earned: "+$5.53", status: "Pending" },
  { date: "2026-11-09 08:25 GMT+9", member: "ALPHA77", email: "alpha77@outlook.com", userType: "Direct Client", accountType: "Starter", amount: "$48.00", rate: "10%", earned: "+$4.80", status: "Completed" },
  { date: "2026-11-08 19:14 GMT+9", member: "Jinho L.", email: "jinhol@gmail.com", userType: "Downline IB - Level 4", accountType: "Elite", amount: "$113.00", rate: "4%", earned: "+$4.52", status: "Completed" },
  { date: "2026-11-07 15:03 GMT+9", member: "CAPITAL41", email: "capital41@icloud.com", userType: "Direct Client", accountType: "Prime", amount: "$192.00", rate: "10%", earned: "+$19.20", status: "Completed" },
  { date: "2026-11-06 12:28 GMT+9", member: "Emma W.", email: "emma@altos.io", userType: "Downline IB - Level 2", accountType: "Professional", amount: "$79.00", rate: "7%", earned: "+$5.53", status: "Refunded" },
  { date: "2026-11-05 09:41 GMT+9", member: "NEXUS18", email: "nexus18@gmail.com", userType: "Direct Client", accountType: "Starter", amount: "$48.00", rate: "10%", earned: "+$4.80", status: "Completed" },
  { date: "2026-11-04 17:52 GMT+9", member: "Noah L.", email: "noah@gmail.com", userType: "Downline IB - Level 3", accountType: "Elite", amount: "$113.00", rate: "5%", earned: "+$5.65", status: "Pending" },
  { date: "2026-11-03 14:18 GMT+9", member: "VIPTRADER06", email: "viptrader06@proton.me", userType: "Direct Client", accountType: "Prime", amount: "$192.00", rate: "10%", earned: "+$19.20", status: "Completed" },
  { date: "2026-11-02 11:33 GMT+9", member: "Leo M.", email: "leom@mail.com", userType: "Downline IB - Level 4", accountType: "Professional", amount: "$79.00", rate: "4%", earned: "+$3.16", status: "Completed" },
  { date: "2026-11-01 08:06 GMT+9", member: "STRATEGY90", email: "strategy90@gmail.com", userType: "Direct Client", accountType: "Starter", amount: "$48.00", rate: "10%", earned: "+$4.80", status: "Completed" },
].map((row, index) => ({ ...row, ibNumber: COMMISSION_UIDS[index] }));

function tokens(dark: boolean) {
  return {
    surface: dark ? "#0F1829" : "#ffffff",
    surface2: dark ? "#1A2035" : "#F4F5F7",
    surface3: dark ? "#232C44" : "#E8EAF0",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    border2: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)",
    text: dark ? "#E8EAF0" : "#1A1A1A",
    textSec: dark ? "#8B8FA8" : "#4A4A58",
    textHint: dark ? "#5A6080" : "#A0A0AA",
    pageBg: dark ? "#0A0F1E" : "#F4F5F7",
    accent: "#7C6AF7",
    accentBg: "rgba(124,106,247,0.12)",
    accentBd: "rgba(124,106,247,0.22)",
  };
}
type T = ReturnType<typeof tokens>;

const statusMap: Record<PartnerStatus, { bg: string; color: string; border: string }> = {
  Active: { bg: "rgba(22,163,74,0.1)", color: "#16A34A", border: "rgba(22,163,74,0.2)" },
  Suspended: { bg: "rgba(217,119,6,0.1)", color: "#D97706", border: "rgba(217,119,6,0.2)" },
  Withdrawn: { bg: "rgba(220,38,38,0.1)", color: "#DC2626", border: "rgba(220,38,38,0.2)" },
  Blacklist: { bg: "rgba(220,38,38,0.1)", color: "#DC2626", border: "rgba(220,38,38,0.2)" },
};

const statusLabelMap: Record<PartnerStatus, string> = {
  Active: "활성",
  Suspended: "비활성",
  Withdrawn: "영구정지",
  Blacklist: "영구정지",
};

const networkStatusMap: Record<NetworkStatus, { label: string; bg: string; color: string; border: string }> = {
  Active: { label: "활성", bg: "rgba(22,163,74,.08)", color: "#16A34A", border: "rgba(22,163,74,.2)" },
  Inactive: { label: "비활성", bg: "rgba(217,119,6,.08)", color: "#D97706", border: "rgba(217,119,6,.2)" },
  PermanentlySuspended: { label: "영구정지", bg: "rgba(220,38,38,.08)", color: "#DC2626", border: "rgba(220,38,38,.2)" },
};

function StatusBadge({ status }: { status: PartnerStatus }) {
  const s = statusMap[status];
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 600 }}>{statusLabelMap[status]}</span>;
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 13, margin: "5px 0 0", opacity: 0.62 }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", background: "#7C6AF7", color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

function TreeView({ node, t, depth = 0, compact = false }: { node: TreeNode; t: T; depth?: number; compact?: boolean }) {
  const [open, setOpen] = useState(true);
  const hasChildren = Boolean(node.children?.length);
  return (
    <div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: compact ? "8px 10px" : "10px 12px", marginLeft: depth * 25, borderRadius: 9, border: `1px solid ${depth === 0 ? t.accentBd : t.border}`, background: depth === 0 ? t.accentBg : t.surface, marginBottom: 6 }}>
        {depth > 0 && <span style={{ position: "absolute", left: -14, top: -8, width: 14, height: 26, borderLeft: `1px solid ${t.border2}`, borderBottom: `1px solid ${t.border2}`, borderBottomLeftRadius: 6 }} />}
        <button onClick={() => setOpen(v => !v)} disabled={!hasChildren} style={{ width: 22, height: 22, border: "none", background: "transparent", padding: 0, color: hasChildren ? t.accent : t.textHint, display: "flex", alignItems: "center", justifyContent: "center", cursor: hasChildren ? "pointer" : "default" }}>
          {hasChildren ? (open ? <FolderOpen size={17} /> : <Folder size={17} />) : <UserRound size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: t.text, fontSize: 12, fontWeight: 650 }}>{node.name}</span>
            <span style={{ color: t.accent, fontSize: 10, fontWeight: 700 }}>LV.{node.level}</span>
          </div>
          <div style={{ color: t.textHint, fontSize: 10, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>{node.id} · 볼륨 {node.volume}</div>
        </div>
        <StatusBadge status={node.status} />
        {hasChildren && <ChevronDown size={14} color={t.textHint} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />}
      </div>
      {open && node.children?.map(child => <TreeView key={child.id} node={child} t={t} depth={depth + 1} compact={compact} />)}
    </div>
  );
}

function findNetworkNode(node: NetworkTreeNode, query: string): NetworkTreeNode | null {
  const normalizedQuery = query.toLowerCase().replace(/\s/g, "");
  const searchable = `${node.name}${node.id}${node.id.replace("IB-", "")}${node.email}`.toLowerCase().replace(/\s/g, "");
  if (searchable.includes(normalizedQuery)) return node;
  for (const child of node.children ?? []) {
    const match = findNetworkNode(child, query);
    if (match) return match;
  }
  return null;
}

function countNetworkNodes(node: NetworkTreeNode): number {
  return 1 + (node.children ?? []).reduce((total, child) => total + countNetworkNodes(child), 0);
}

function countActiveNetworkNodes(node: NetworkTreeNode): number {
  return (node.status === "Active" ? 1 : 0) + (node.children ?? []).reduce((total, child) => total + countActiveNetworkNodes(child), 0);
}

function NetworkTreeRows({ node, depth = 0 }: { node: NetworkTreeNode; depth?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = Boolean(node.children?.length);
  const statusStyle = networkStatusMap[node.status];
  const rowColumns = "minmax(360px, 2fr) minmax(220px, 1.2fr) 170px 120px";
  return (
    <>
      <div
        onMouseEnter={event => { event.currentTarget.style.background = "#F8FAFC"; }}
        onMouseLeave={event => { event.currentTarget.style.background = "#FFFFFF"; }}
        style={{ display: "grid", gridTemplateColumns: rowColumns, minHeight: 72, borderBottom: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1A1A1A", position: "relative", transition: "background .12s" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, paddingLeft: 18 + depth * 28, paddingRight: 14, minWidth: 0, position: "relative" }}>
          {depth > 0 && <span style={{ position: "absolute", left: 34 + (depth - 1) * 28, top: 0, bottom: 0, width: 1, background: "rgba(37,99,235,.22)" }} />}
          <button onClick={() => setOpen(value => !value)} disabled={!hasChildren} style={{ width: 18, height: 28, padding: 0, border: "none", background: "transparent", color: hasChildren ? "#8B8FA8" : "transparent", cursor: hasChildren ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronDown size={14} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
          </button>
          <div style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid rgba(37,99,235,.2)", background: "rgba(37,99,235,.07)", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {hasChildren && open ? <FolderOpen size={20} strokeWidth={1.8} /> : <Folder size={20} strokeWidth={1.8} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis" }}>{node.name}</span>
              <span style={{ fontSize: 10, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis" }}>({node.email})</span>
            </div>
            <div style={{ fontSize: 10, color: "#64748B", fontFamily: "'DM Mono',monospace", fontWeight: 550, marginTop: 4 }}>{formatUid(node.id)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px" }}>
          <span style={{ display: "inline-flex", padding: "4px 9px", borderRadius: 7, border: "1px solid rgba(37,99,235,.18)", background: "rgba(37,99,235,.07)", color: "#2563EB", fontSize: 10, fontWeight: 550, whiteSpace: "nowrap" }}>{node.userType}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 16px", color: "#16A34A", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{node.commission}</div>
        <div style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 7, border: `1px solid ${statusStyle.border}`, background: statusStyle.bg, color: statusStyle.color, fontSize: 10, whiteSpace: "nowrap" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />{statusStyle.label}
          </span>
        </div>
      </div>
      {open && node.children?.map(child => <NetworkTreeRows key={child.id} node={child} depth={depth + 1} />)}
    </>
  );
}

function NetworkTreeTable({ root }: { root: NetworkTreeNode }) {
  const rowColumns = "minmax(360px, 2fr) minmax(220px, 1.2fr) 170px 120px";
  return (
    <div style={{ overflowX: "auto", background: "#FFFFFF" }}>
      <div style={{ minWidth: 900 }}>
        <div style={{ display: "grid", gridTemplateColumns: rowColumns, height: 40, alignItems: "center", borderBottom: "1px solid rgba(0,0,0,.09)", background: "#F8FAFC", color: "#8B8FA8", fontSize: 10, fontWeight: 700, letterSpacing: ".07em" }}>
          <div style={{ padding: "0 18px" }}>MEMBER</div>
          <div style={{ padding: "0 14px" }}>USER TYPE</div>
          <div style={{ padding: "0 16px", textAlign: "right" }}>COMMISSION</div>
          <div style={{ padding: "0 12px" }}>STATUS</div>
        </div>
        <NetworkTreeRows key={root.id} node={root} />
      </div>
    </div>
  );
}

function PartnerDrawer({ partner, t, onClose }: { partner: Partner; t: T; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", zIndex: 900 }} />
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, maxWidth: "92vw", zIndex: 901, background: t.surface, borderLeft: `1px solid ${t.border2}`, boxShadow: "-18px 0 52px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 22px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>IB 파트너 상세</div>
            <div style={{ fontSize: 11, color: t.textHint, marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{partner.id}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: t.textSec, cursor: "pointer" }}><X size={19} /></button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, paddingBottom: 20, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><UserRound size={21} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{partner.name}</div>
              <div style={{ color: t.textHint, fontSize: 11, marginTop: 3 }}>등록일 {partner.registeredAt} · 직속/하위 {partner.downline}명</div>
            </div>
            <StatusBadge status={partner.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "18px 0 22px" }}>
            {[
              ["연락처", partner.phone],
              ["이메일", partner.email],
              ["커미션레벨", `Level ${partner.level}`],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "12px 13px", borderRadius: 9, background: t.surface2, border: `1px solid ${t.border}` }}>
                <div style={{ color: t.textHint, fontSize: 10, marginBottom: 5 }}>{label}</div>
                <div style={{ color: t.text, fontSize: 12, fontWeight: 550, wordBreak: "break-all" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Downline 조직도</div>
              <div style={{ color: t.textHint, fontSize: 10, marginTop: 3 }}>폴더를 선택해 하위 조직을 펼치거나 접을 수 있습니다.</div>
            </div>
            <span style={{ padding: "4px 8px", borderRadius: 6, background: t.surface2, color: t.textSec, fontSize: 10 }}>전체 {partner.downline}명</span>
          </div>
          <TreeView node={{ ...TREE, id: partner.id, name: partner.name, level: partner.level, status: partner.status }} t={t} compact />
        </div>
      </aside>
    </>
  );
}

function AddPartnerModal({ t, onClose, onSave }: { t: T; onClose: () => void; onSave: () => void }) {
  const [memberQuery, setMemberQuery] = useState("");
  const [results, setResults] = useState(MEMBER_SEARCH_RESULTS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [uplineQuery, setUplineQuery] = useState("");
  const [selectedUplineId, setSelectedUplineId] = useState<string | null>(null);
  const [uplineComboboxOpen, setUplineComboboxOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const filteredUplines = PARTNERS.filter(partner => {
    const query = uplineQuery.trim().toLowerCase().replace(/\s/g, "");
    const searchable = `${partner.name}${partner.email}${partner.id}${partner.id.replace("IB-", "")}`.toLowerCase().replace(/\s/g, "");
    return selectedUplineId === "root" || !query || searchable.includes(query);
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 38,
    padding: "0 11px",
    borderRadius: 8,
    border: `1px solid ${t.border2}`,
    background: t.surface2,
    color: t.text,
    fontSize: 12,
    outline: "none",
  };

  function handleSearch() {
    const query = memberQuery.trim().toLowerCase();
    setResults(
      query
        ? MEMBER_SEARCH_RESULTS.filter(member => `${member.name} ${member.email} ${member.ibNumber}`.toLowerCase().includes(query))
        : MEMBER_SEARCH_RESULTS,
    );
  }

  function handleSelectMember(member: typeof MEMBER_SEARCH_RESULTS[number]) {
    setSelectedMemberId(member.id);
    setPartnerName(member.name);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(0,0,0,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 600, maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, boxShadow: "0 24px 70px rgba(0,0,0,.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>신규 IB 추가</div><div style={{ fontSize: 11, color: t.textHint, marginTop: 3 }}>파트너 기본 정보와 초기 레벨을 설정합니다.</div></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: t.textSec, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 22, overflowY: "auto" }}>
          <section style={{ paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>회원 검색</div>
            <div style={{ fontSize: 10, color: t.textHint, marginBottom: 10 }}>기존 회원을 검색한 후 IB 파트너로 지정하세요.</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} color={t.textHint} style={{ position: "absolute", left: 11, top: 12 }} />
                <input
                  value={memberQuery}
                  onChange={event => setMemberQuery(event.target.value)}
                  onKeyDown={event => event.key === "Enter" && handleSearch()}
                  placeholder="회원 이름, 이메일 또는 IB 번호 입력"
                  style={{ ...inputStyle, width: "100%", paddingLeft: 34 }}
                />
              </div>
              <button onClick={handleSearch} style={{ height: 38, padding: "0 17px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>검색</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {results.map(member => {
                const selected = selectedMemberId === member.id;
                return (
                  <div key={member.id} style={{ padding: "10px 11px", borderRadius: 9, border: `1px solid ${selected ? t.accentBd : t.border}`, background: selected ? t.accentBg : t.surface2, display: "grid", gridTemplateColumns: "minmax(100px,.8fr) minmax(180px,1.5fr) minmax(88px,.7fr) auto", alignItems: "center", gap: 10 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 650, color: t.text }}>{member.name}</span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: t.textHint }}>{member.email}</span>
                    <span style={{ whiteSpace: "nowrap", fontSize: 10, color: t.textSec, fontFamily: "'DM Mono',monospace" }}>{member.ibNumber}</span>
                    <button onClick={() => handleSelectMember(member)} style={{ height: 28, padding: "0 11px", borderRadius: 7, border: `1px solid ${selected ? t.accent : t.border2}`, background: selected ? t.accent : t.surface, color: selected ? "#fff" : t.textSec, fontSize: 10, fontWeight: 650, cursor: "pointer" }}>{selected ? "선택됨" : "선택"}</button>
                  </div>
                );
              })}
              {results.length === 0 && <div style={{ padding: "22px 12px", borderRadius: 9, background: t.surface2, color: t.textHint, textAlign: "center", fontSize: 11 }}>검색 결과가 없습니다.</div>}
            </div>
          </section>

          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>IB 파트너 설정</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              파트너명
              <input value={partnerName} onChange={event => setPartnerName(event.target.value)} placeholder="회원을 선택해주세요" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              초기 IB 레벨
              <select defaultValue="1" style={{ ...inputStyle, padding: "0 10px" }}>
                {Array.from({ length: 40 }, (_, i) => <option key={i + 1} value={i + 1}>Level {i + 1}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              상태
              <select defaultValue="Active" style={{ ...inputStyle, padding: "0 10px" }}>
                <option value="Active">활성</option>
                <option value="Inactive">비활성</option>
                <option value="PermanentlySuspended">영구정지</option>
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              Upline
              <div style={{ position: "relative" }}>
                <Search size={14} color={t.textHint} style={{ position: "absolute", left: 11, top: 12, zIndex: 1, pointerEvents: "none" }} />
                <input
                  value={uplineQuery}
                  onFocus={() => setUplineComboboxOpen(true)}
                  onBlur={() => setUplineComboboxOpen(false)}
                  onChange={event => {
                    setUplineQuery(event.target.value);
                    setSelectedUplineId(null);
                    setUplineComboboxOpen(true);
                  }}
                  placeholder="Upline 이름, 이메일 또는 IB 번호 검색"
                  role="combobox"
                  aria-expanded={uplineComboboxOpen}
                  aria-controls="add-partner-upline-options"
                  style={{ ...inputStyle, paddingLeft: 34, paddingRight: 30 }}
                />
                <ChevronDown size={13} color={t.textHint} style={{ position: "absolute", right: 10, top: 13, pointerEvents: "none", transform: uplineComboboxOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                {uplineComboboxOpen && (
                  <div id="add-partner-upline-options" role="listbox" style={{ position: "absolute", top: 43, left: 0, right: 0, zIndex: 30, maxHeight: 220, overflowY: "auto", borderRadius: 9, border: `1px solid ${t.border2}`, background: t.surface, boxShadow: "0 12px 32px rgba(0,0,0,.14)", padding: 5 }}>
                    {(!uplineQuery.trim() || selectedUplineId === "root") && (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedUplineId === "root"}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => {
                          setSelectedUplineId("root");
                          setUplineQuery("Upline 없음 (Root)");
                          setUplineComboboxOpen(false);
                        }}
                        style={{ width: "100%", minHeight: 38, padding: "7px 9px", borderRadius: 7, border: "none", background: "transparent", color: t.textSec, textAlign: "left", cursor: "pointer", fontSize: 11 }}
                      >
                        Upline 없음 (Root)
                      </button>
                    )}
                    {filteredUplines.map(partner => {
                      const selected = selectedUplineId === partner.id;
                      return (
                        <button
                          key={partner.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            setSelectedUplineId(partner.id);
                            setUplineQuery(`${partner.name} · ${partner.id}`);
                            setUplineComboboxOpen(false);
                          }}
                          onMouseEnter={event => { event.currentTarget.style.background = t.surface2; }}
                          onMouseLeave={event => { event.currentTarget.style.background = selected ? t.accentBg : "transparent"; }}
                          style={{ width: "100%", minHeight: 42, padding: "8px 9px", borderRadius: 7, border: "none", background: selected ? t.accentBg : "transparent", color: t.text, display: "grid", gridTemplateColumns: "minmax(100px,.8fr) minmax(180px,1.5fr) minmax(88px,.7fr) 16px", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer" }}
                        >
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, fontWeight: 650 }}>{partner.name}</span>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: t.textHint }}>{partner.email}</span>
                          <span style={{ whiteSpace: "nowrap", fontSize: 10, color: t.textSec, fontFamily: "'DM Mono',monospace" }}>{partner.id}</span>
                          {selected && <Check size={13} color={t.accent} />}
                        </button>
                      );
                    })}
                    {filteredUplines.length === 0 && <div style={{ padding: "18px 10px", textAlign: "center", color: t.textHint, fontSize: 10 }}>일치하는 Upline 파트너가 없습니다.</div>}
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 18px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, cursor: "pointer" }}>취소</button>
          <PrimaryButton onClick={() => setConfirmOpen(true)}><Check size={15} /> 파트너 등록</PrimaryButton>
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[440px] gap-0 overflow-hidden border-border bg-background p-0 text-foreground">
          <AlertDialogHeader className="gap-1.5 p-6 text-left">
            <span className="text-xs font-semibold tracking-wide text-primary">Register New IB</span>
            <AlertDialogTitle>신규 IB 등록 확인</AlertDialogTitle>
            <AlertDialogDescription>신규 IB를 추가하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={onSave}><Check /> 확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditPartnerModal({ partner, t, onClose, onSave }: { partner: Partner; t: T; onClose: () => void; onSave: (partner: Partner) => void }) {
  const [level, setLevel] = useState(partner.level);
  const [status, setStatus] = useState<PartnerStatus>(
    partner.status === "Withdrawn" ? "Suspended" : partner.status,
  );
  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 38,
    padding: "0 11px",
    borderRadius: 8,
    border: `1px solid ${t.border2}`,
    background: t.surface2,
    color: t.text,
    fontSize: 12,
    outline: "none",
  };
  const readOnlyInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: t.surface3,
    color: t.textHint,
    borderColor: t.border,
    cursor: "not-allowed",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(0,0,0,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 520, maxWidth: "100%", background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 14, boxShadow: "0 24px 70px rgba(0,0,0,.3)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>IB 파트너 수정</div>
            <div style={{ fontSize: 11, color: t.textHint, marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{partner.id} · 등록일 {partner.registeredAt}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: t.textSec, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ padding: "11px 13px", borderRadius: 9, background: t.accentBg, border: `1px solid ${t.accentBd}`, color: t.textSec, fontSize: 11, lineHeight: 1.55, marginBottom: 18 }}>
            레벨 또는 상태 변경 시 이후 발생하는 커미션부터 새로운 설정이 적용됩니다.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              파트너명
              <input value={partner.name} readOnly aria-readonly="true" style={readOnlyInputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              IB 레벨
              <select value={level} onChange={event => setLevel(Number(event.target.value))} style={{ ...inputStyle, padding: "0 10px", cursor: "pointer" }}>
                {Array.from({ length: 40 }, (_, index) => <option key={index + 1} value={index + 1}>Level {index + 1}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: t.textSec, fontSize: 11 }}>
              상태
              <select value={status} onChange={event => setStatus(event.target.value as PartnerStatus)} style={{ ...inputStyle, padding: "0 10px", cursor: "pointer" }}>
                <option value="Active">활성</option>
                <option value="Suspended">비활성</option>
                <option value="Blacklist">영구정지</option>
              </select>
            </label>
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 18px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>취소</button>
          <PrimaryButton onClick={() => onSave({ ...partner, level, status })}><Save size={15} /> 저장</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function RelocationConfirmModal({
  source,
  target,
  t,
  onClose,
  onConfirm,
}: {
  source: NetworkTreeNode;
  target: NetworkTreeNode;
  t: T;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={event => event.target === event.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 960, background: "rgba(15,23,42,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="relocation-confirm-title" aria-describedby="relocation-confirm-description" style={{ width: 430, maxWidth: "100%", borderRadius: 14, border: `1px solid ${t.border2}`, background: t.surface, boxShadow: "0 24px 70px rgba(0,0,0,.24)", overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowRightLeft size={17} /></div>
          <div style={{ flex: 1 }}>
            <div id="relocation-confirm-title" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>재배치 확인</div>
            <div id="relocation-confirm-description" style={{ fontSize: 12, color: t.textSec, lineHeight: 1.6, marginTop: 5 }}>정말로 재배치를 실행하겠습니까?</div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ border: "none", background: "transparent", color: t.textHint, padding: 2, cursor: "pointer" }}><X size={17} /></button>
        </div>
        <div style={{ margin: "0 22px 20px", padding: 14, borderRadius: 10, background: t.surface2, border: `1px solid ${t.border}`, display: "grid", gridTemplateColumns: "1fr 28px 1fr", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: t.textHint, marginBottom: 5 }}>이동 대상</div>
            <div style={{ fontSize: 12, fontWeight: 650, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{source.name}</div>
            <div style={{ fontSize: 9, color: t.textHint, marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{source.id}</div>
          </div>
          <div style={{ color: t.accent, display: "flex", justifyContent: "center" }}><ChevronRight size={15} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: t.textHint, marginBottom: 5 }}>새 Upline</div>
            <div style={{ fontSize: 12, fontWeight: 650, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target.name}</div>
            <div style={{ fontSize: 9, color: t.textHint, marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{target.id}</div>
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 18px", borderRadius: 8, border: `1px solid ${t.border2}`, background: "transparent", color: t.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>취소</button>
          <PrimaryButton onClick={onConfirm}><Check size={15} /> 확인</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function IbPartnerManagementPage({ dark, onToast }: { dark: boolean; onToast: ToastHandler }) {
  const PAGE_SIZE = 5;
  const t = tokens(dark);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PartnerStatusFilter>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [partners, setPartners] = useState(PARTNERS);
  const [drawer, setDrawer] = useState<Partner | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const filtered = partners.filter(p => {
    const q = query.toLowerCase();
    const matchesStatus =
      status === "All" ||
      (status === "Active" && p.status === "Active") ||
      (status === "Inactive" && (p.status === "Suspended" || p.status === "Withdrawn")) ||
      (status === "PermanentlySuspended" && p.status === "Blacklist");
    return (!q || `${p.name} ${p.id} ${p.email} ${p.uplineId ?? ""} ${p.downlineIbId ?? ""}`.toLowerCase().includes(q)) && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedPartners = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const th: React.CSSProperties = { padding: "11px 13px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textSec, whiteSpace: "nowrap", background: dark ? t.surface2 : "#F8FAFC", borderBottom: `1px solid ${dark ? t.border2 : "#E2E8F0"}` };
  const td: React.CSSProperties = { padding: "13px", color: t.text, fontSize: 12, borderBottom: `1px solid ${dark ? t.border : "#E2E8F0"}`, verticalAlign: "middle" };
  return (
    <div style={{ padding: "24px 28px 48px", minHeight: "100vh", color: t.text, background: t.pageBg }}>
      <PageHeader title="IB 파트너 관리" description="IB 파트너 정보, 레벨, 상태 및 전체 Downline 조직을 관리합니다." action={<PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> 신규 IB 추가</PrimaryButton>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          ["전체 파트너", partners.length, Users, t.text],
          ["활성 파트너", partners.filter(p => p.status === "Active").length, ShieldCheck, "#16A34A"],
        ].map(([label, value, Icon, color]) => {
          const IconComponent = Icon as typeof Users;
          return <div key={String(label)} style={{ padding: "15px 17px", borderRadius: 11, border: `1px solid ${t.border}`, background: t.surface, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: t.surface2, color: color as string, display: "flex", alignItems: "center", justifyContent: "center" }}><IconComponent size={17} /></div>
            <div><div style={{ fontSize: 10, color: t.textHint, marginBottom: 3 }}>{label as string}</div><div style={{ fontSize: 20, fontWeight: 750, color: color as string }}>{Number(value).toLocaleString()}</div></div>
          </div>;
        })}
      </div>
      <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 13, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} color={t.textHint} style={{ position: "absolute", left: 12, top: 11 }} />
            <input value={query} onChange={e => { setQuery(e.target.value); setCurrentPage(1); }} placeholder="파트너명, UID, 이메일, 상위·하위 IB 검색" style={{ width: "100%", height: 36, padding: "0 12px 0 35px", borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 12, outline: "none" }} />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value as PartnerStatusFilter); setCurrentPage(1); }} style={{ height: 36, minWidth: 170, padding: "0 12px", borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, fontSize: 12, fontWeight: 500, cursor: "pointer", outline: "none" }}>
            <option value="All">전체 상태</option>
            <option value="Active">활성</option>
            <option value="Inactive">비활성</option>
            <option value="PermanentlySuspended">영구정지</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "5%" }} />
            </colgroup>
            <thead><tr>{["파트너명/UID", "상위 IB", "하위 IB", "커미션레벨", "Downline", "등록일", "상태", "관리"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {pagedPartners.map(p => (
                <tr key={p.id} onMouseEnter={e => e.currentTarget.style.background = t.surface2} onMouseLeave={e => e.currentTarget.style.background = t.surface} style={{ background: t.surface }}>
                  <td style={{ ...td, paddingTop: 15, paddingBottom: 15 }}>
                    <button onClick={() => setDrawer(p)} style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", maxWidth: "100%" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap", overflow: "hidden" }}>
                        <span style={{ color: t.text, fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                        <span style={{ color: t.textHint, fontSize: 10, fontWeight: 450, overflow: "hidden", textOverflow: "ellipsis" }}>({p.email})</span>
                      </div>
                      <div style={{ color: t.textSec, fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 550, marginTop: 4 }}>{formatUid(p.id)}</div>
                    </button>
                  </td>
                  <td style={{ ...td, color: p.uplineId ? t.textSec : t.textHint, fontFamily: "'DM Mono',monospace", fontSize: 11, whiteSpace: "nowrap" }}>{p.uplineId ? formatUid(p.uplineId) : "-"}</td>
                  <td style={{ ...td, color: p.downlineIbId ? t.textSec : t.textHint, fontFamily: "'DM Mono',monospace", fontSize: 11, whiteSpace: "nowrap" }}>{p.downlineIbId ? formatUid(p.downlineIbId) : "-"}</td>
                  <td style={td}><span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 9px", borderRadius: 7, border: `1px solid ${t.accentBd}`, background: t.accentBg, color: t.accent, fontSize: 11, fontWeight: 700 }}>Level {p.level}</span></td>
                  <td style={td}><span style={{ fontWeight: 650 }}>{p.downline}</span><span style={{ color: t.textHint, marginLeft: 3 }}>명</span></td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{p.registeredAt}</td>
                  <td style={td}><StatusBadge status={p.status} /></td>
                  <td style={td}><button onClick={() => setEditingPartner(p)} style={{ border: "none", background: "transparent", color: t.accent, fontSize: 12, fontWeight: 650, cursor: "pointer", padding: 0 }}>수정</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: t.textHint, padding: 44 }}>검색 조건에 맞는 IB 파트너가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 11, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif" }}>총 {filtered.length}명 · {safePage} / {totalPages} 페이지</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={safePage === 1}
              onMouseEnter={event => { if (safePage !== 1) event.currentTarget.style.background = t.surface3; }}
              onMouseLeave={event => { event.currentTarget.style.background = t.surface2; }}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: t.textSec, cursor: safePage === 1 ? "not-allowed" : "pointer", opacity: safePage === 1 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              aria-label="이전 페이지"
            >
              <ChevronLeft size={13} />
            </button>
            {visiblePages.map(page => {
              const active = page === safePage;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  onMouseEnter={event => { if (!active) event.currentTarget.style.background = t.surface3; }}
                  onMouseLeave={event => { if (!active) event.currentTarget.style.background = t.surface2; }}
                  style={{ width: 28, height: 28, borderRadius: 6, border: active ? "none" : `1px solid ${t.border2}`, background: active ? t.accent : t.surface2, color: active ? "#fff" : t.textSec, fontSize: 12, fontFamily: "'DM Sans',sans-serif", fontWeight: active ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  aria-current={active ? "page" : undefined}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
              onMouseEnter={event => { if (safePage !== totalPages) event.currentTarget.style.background = t.surface3; }}
              onMouseLeave={event => { event.currentTarget.style.background = t.surface2; }}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border2}`, background: t.surface2, color: t.textSec, cursor: safePage === totalPages ? "not-allowed" : "pointer", opacity: safePage === totalPages ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              aria-label="다음 페이지"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
      {drawer && <PartnerDrawer partner={drawer} t={t} onClose={() => setDrawer(null)} />}
      {adding && <AddPartnerModal t={t} onClose={() => setAdding(false)} onSave={() => { setAdding(false); onToast("신규 IB 파트너가 등록되었습니다.", "success"); }} />}
      {editingPartner && (
        <EditPartnerModal
          partner={editingPartner}
          t={t}
          onClose={() => setEditingPartner(null)}
          onSave={updatedPartner => {
            setPartners(current => current.map(partner => partner.id === updatedPartner.id ? updatedPartner : partner));
            setEditingPartner(null);
            onToast("IB 파트너 정보가 저장되었습니다.", "success");
          }}
        />
      )}
    </div>
  );
}

export function AffiliateNetworkPage({ dark, onToast }: { dark: boolean; onToast: ToastHandler }) {
  const t = tokens(dark);
  const relocationMembers = useMemo(() => {
    const collect = (node: NetworkTreeNode): NetworkTreeNode[] => [node, ...(node.children ?? []).flatMap(collect)];
    return NETWORK_TREES.flatMap(collect).filter(node => node.id.startsWith("IB-"));
  }, []);
  const [networkQuery, setNetworkQuery] = useState("");
  const [treeRoot, setTreeRoot] = useState<NetworkTreeNode>(NETWORK_TREES[0]);
  const [source, setSource] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceComboboxOpen, setSourceComboboxOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetComboboxOpen, setTargetComboboxOpen] = useState(false);
  const [showRelocationConfirm, setShowRelocationConfirm] = useState(false);
  const control: React.CSSProperties = { width: "100%", height: 38, borderRadius: 8, border: `1px solid ${t.border2}`, background: t.surface2, color: t.text, padding: "0 10px", fontSize: 12 };
  const filteredRelocationMembers = relocationMembers.filter(member => {
    const query = sourceQuery.toLowerCase().replace(/\s/g, "");
    return !query || `${member.name}${member.id}${member.id.replace("IB-", "")}`.toLowerCase().replace(/\s/g, "").includes(query);
  });
  const filteredUplineMembers = relocationMembers.filter(member => {
    const query = targetQuery.toLowerCase().replace(/\s/g, "");
    const matchesQuery = !query || `${member.name}${member.id}${member.id.replace("IB-", "")}`.toLowerCase().replace(/\s/g, "").includes(query);
    return member.id !== source && matchesQuery;
  });
  const selectedSource = relocationMembers.find(member => member.id === source);
  const selectedTarget = relocationMembers.find(member => member.id === target);

  function handleNetworkSearch() {
    const query = networkQuery.trim();
    if (!query) {
      setTreeRoot(NETWORK_TREES[0]);
      return;
    }
    const match = NETWORK_TREES.map(root => findNetworkNode(root, query)).find((node): node is NetworkTreeNode => Boolean(node));
    if (match) {
      setTreeRoot(match);
      onToast(`${match.name}의 Downline 조직도를 불러왔습니다.`, "success");
    } else {
      onToast("일치하는 이름 또는 IB 번호를 찾을 수 없습니다.", "warning");
    }
  }

  return (
    <div style={{ padding: "24px 28px 48px", minHeight: "100vh", color: t.text, background: t.pageBg }}>
      <PageHeader title="네트워크 및 조직도 관리" description="IB별 전체 Downline 계층을 탐색하고 조직 연결을 관리합니다." />
      <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 13, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ color: t.accent, width: 34, height: 34, borderRadius: 9, background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center" }}><Search size={16} /></div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 11, color: t.textHint, marginBottom: 5 }}>이름 또는 IB 번호 입력</div>
          <div style={{ display: "flex", gap: 8, maxWidth: 560 }}>
            <input
              value={networkQuery}
              onChange={event => setNetworkQuery(event.target.value)}
              onKeyDown={event => event.key === "Enter" && handleNetworkSearch()}
              placeholder="이름 또는 IB 번호 입력"
              style={{ ...control, flex: 1, minWidth: 0, outline: "none" }}
            />
            <button onClick={handleNetworkSearch} style={{ height: 38, padding: "0 18px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>검색</button>
          </div>
          <div style={{ fontSize: 9, color: t.textHint, marginTop: 5 }}>예: Daniel, 10482, IB-11342</div>
        </div>
        <div style={{ display: "flex", gap: 22, padding: "0 10px" }}>
          {[
            ["표시 조직", `${countNetworkNodes(treeRoot)}명`],
            ["활성", `${countActiveNetworkNodes(treeRoot)}명`],
          ].map(([label, value], index) => <div key={label} style={{ paddingLeft: index > 0 ? 22 : 0, borderLeft: index > 0 ? `1px solid ${t.border}` : "none" }}><div style={{ fontSize: 10, color: t.textHint }}>{label}</div><div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 3, whiteSpace: "nowrap" }}>{value}</div></div>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)", gap: 16, alignItems: "start", marginBottom: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,.09)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "15px 18px", borderBottom: "1px solid rgba(0,0,0,.09)", background: "#FFFFFF" }}>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Downline IB &amp; Client Network</div><div style={{ fontSize: 10, color: "#A0A0AA", marginTop: 3 }}>폴더 노드를 선택해 Sub-IB와 Direct User 계층을 확장하거나 축소하세요.</div></div>
          </div>
          <NetworkTreeTable root={treeRoot} />
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 13 }}>
          <div style={{ padding: "15px 17px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 9, alignItems: "center" }}><ArrowRightLeft size={16} color={t.accent} /><div><div style={{ fontSize: 13, fontWeight: 700 }}>Downline 재배치</div><div style={{ fontSize: 10, color: t.textHint, marginTop: 2 }}>선택한 조직과 전체 하위 노드를 이동합니다.</div></div></div>
          <div style={{ padding: 17, display: "flex", flexDirection: "column", gap: 13 }}>
            <label style={{ fontSize: 11, color: t.textSec }}>
              이동 대상 멤버
              <div style={{ position: "relative", marginTop: 6 }}>
                <Search size={14} color={t.textHint} style={{ position: "absolute", left: 11, top: 12, zIndex: 1, pointerEvents: "none" }} />
                <input
                  value={sourceQuery}
                  onFocus={() => setSourceComboboxOpen(true)}
                  onBlur={() => setSourceComboboxOpen(false)}
                  onChange={event => {
                    setSourceQuery(event.target.value);
                    setSource("");
                    setSourceComboboxOpen(true);
                  }}
                  placeholder="이름 또는 IB 번호 입력"
                  role="combobox"
                  aria-expanded={sourceComboboxOpen}
                  aria-controls="relocation-member-options"
                  style={{ ...control, paddingLeft: 32, paddingRight: 30, outline: "none" }}
                />
                <ChevronDown size={13} color={t.textHint} style={{ position: "absolute", right: 10, top: 13, pointerEvents: "none", transform: sourceComboboxOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                {sourceComboboxOpen && (
                  <div id="relocation-member-options" role="listbox" style={{ position: "absolute", top: 43, left: 0, right: 0, zIndex: 30, maxHeight: 220, overflowY: "auto", borderRadius: 9, border: `1px solid ${t.border2}`, background: t.surface, boxShadow: "0 12px 32px rgba(0,0,0,.14)", padding: 5 }}>
                    {filteredRelocationMembers.map(member => {
                      const selected = source === member.id;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            setSource(member.id);
                            setSourceQuery(`${member.name} · ${member.id}`);
                            if (target === member.id) {
                              setTarget("");
                              setTargetQuery("");
                            }
                            setSourceComboboxOpen(false);
                          }}
                          onMouseEnter={event => { event.currentTarget.style.background = t.surface2; }}
                          onMouseLeave={event => { event.currentTarget.style.background = "transparent"; }}
                          style={{ width: "100%", minHeight: 42, padding: "7px 9px", borderRadius: 7, border: "none", background: selected ? t.accentBg : "transparent", color: t.text, display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer" }}
                        >
                          <div style={{ width: 27, height: 27, borderRadius: 7, background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UserRound size={13} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 650 }}>{member.name}</div><div style={{ fontSize: 9, color: t.textHint, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>{member.id} · {member.userType}</div></div>
                          {selected && <Check size={13} color={t.accent} />}
                        </button>
                      );
                    })}
                    {filteredRelocationMembers.length === 0 && <div style={{ padding: "18px 10px", textAlign: "center", color: t.textHint, fontSize: 10 }}>일치하는 IB 파트너가 없습니다.</div>}
                  </div>
                )}
              </div>
            </label>
            <div style={{ display: "flex", justifyContent: "center", color: t.textHint }}><ChevronDown size={17} /></div>
            <label style={{ fontSize: 11, color: t.textSec }}>
              새 Upline 선택
              <div style={{ position: "relative", marginTop: 6 }}>
                <Search size={14} color={t.textHint} style={{ position: "absolute", left: 11, top: 12, zIndex: 1, pointerEvents: "none" }} />
                <input
                  value={targetQuery}
                  onFocus={() => setTargetComboboxOpen(true)}
                  onBlur={() => setTargetComboboxOpen(false)}
                  onChange={event => {
                    setTargetQuery(event.target.value);
                    setTarget("");
                    setTargetComboboxOpen(true);
                  }}
                  placeholder="이름 또는 IB 번호 입력"
                  role="combobox"
                  aria-expanded={targetComboboxOpen}
                  aria-controls="relocation-upline-options"
                  style={{ ...control, paddingLeft: 32, paddingRight: 30, outline: "none" }}
                />
                <ChevronDown size={13} color={t.textHint} style={{ position: "absolute", right: 10, top: 13, pointerEvents: "none", transform: targetComboboxOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                {targetComboboxOpen && (
                  <div id="relocation-upline-options" role="listbox" style={{ position: "absolute", top: 43, left: 0, right: 0, zIndex: 30, maxHeight: 220, overflowY: "auto", borderRadius: 9, border: `1px solid ${t.border2}`, background: t.surface, boxShadow: "0 12px 32px rgba(0,0,0,.14)", padding: 5 }}>
                    {filteredUplineMembers.map(member => {
                      const selected = target === member.id;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            setTarget(member.id);
                            setTargetQuery(`${member.name} · ${member.id}`);
                            setTargetComboboxOpen(false);
                          }}
                          onMouseEnter={event => { event.currentTarget.style.background = t.surface2; }}
                          onMouseLeave={event => { event.currentTarget.style.background = "transparent"; }}
                          style={{ width: "100%", minHeight: 42, padding: "7px 9px", borderRadius: 7, border: "none", background: selected ? t.accentBg : "transparent", color: t.text, display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer" }}
                        >
                          <div style={{ width: 27, height: 27, borderRadius: 7, background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UserRound size={13} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 650 }}>{member.name}</div><div style={{ fontSize: 9, color: t.textHint, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>{member.id} · {member.userType}</div></div>
                          {selected && <Check size={13} color={t.accent} />}
                        </button>
                      );
                    })}
                    {filteredUplineMembers.length === 0 && <div style={{ padding: "18px 10px", textAlign: "center", color: t.textHint, fontSize: 10 }}>일치하는 Upline 파트너가 없습니다.</div>}
                  </div>
                )}
              </div>
            </label>
            <div style={{ padding: "9px 10px", borderRadius: 8, background: "rgba(217,119,6,.08)", color: "#D97706", fontSize: 10, lineHeight: 1.5 }}>재배치 시 이미 확정된 커미션에는 영향을 주지 않습니다.</div>
            <PrimaryButton onClick={() => selectedSource && selectedTarget ? setShowRelocationConfirm(true) : onToast("이동 대상과 새 Upline을 모두 선택해주세요.", "warning")}><ArrowRightLeft size={14} /> 재배치 실행</PrimaryButton>
          </div>
        </div>
      </div>
      {showRelocationConfirm && selectedSource && selectedTarget && (
        <RelocationConfirmModal
          source={selectedSource}
          target={selectedTarget}
          t={t}
          onClose={() => setShowRelocationConfirm(false)}
          onConfirm={() => {
            setShowRelocationConfirm(false);
            onToast(`${selectedSource.id} 조직이 ${selectedTarget.id} 하위로 재배치되었습니다.`, "success");
          }}
        />
      )}
    </div>
  );
}

export function AffiliateCommissionRatePage({ dark, onToast }: { dark: boolean; onToast: ToastHandler }) {
  const t = tokens(dark);
  const [rates, setRates] = useState(() => Array.from({ length: 40 }, (_, index) => ({
    level: index + 1,
    type: index < 10 ? "%" : "$",
    value: index < 5 ? 6 - index * .5 : index < 10 ? 2 : Math.max(1, 12 - Math.floor(index / 3)),
  })));
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  return (
    <div style={{ padding: "24px 28px 48px", minHeight: "100vh", color: t.text, background: t.pageBg }}>
      <PageHeader
        title="커미션 비율 관리"
        description="Level 1–40의 기본 커미션 지급 방식과 금액을 설정합니다."
        action={<PrimaryButton onClick={() => setSaveConfirmOpen(true)}><Save size={15} /> 변경사항 저장</PrimaryButton>}
      />
      <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,.09)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid rgba(0,0,0,.09)", background: "#F8FAFC" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Commission Matrix</div>
            <div style={{ fontSize: 10, color: "#A0A0AA", marginTop: 3 }}>Level 1–40의 기본 지급 방식을 비율(%) 또는 고정 금액($)으로 설정합니다.</div>
          </div>
        </div>
        <div style={{ padding: 16, background: "#F8FAFC", display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 10, overflowX: "auto" }}>
          {rates.map(rate => (
            <div key={rate.level} style={{ minHeight: 84, border: "1px solid rgba(0,0,0,.09)", borderRadius: 9, background: "#FFFFFF", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "9px 10px", borderBottom: "1px solid rgba(0,0,0,.08)", display: "flex", alignItems: "center", background: "#FFFFFF" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1A1A1A" }}>Level {rate.level}</span>
              </div>
              <div style={{ padding: 10, display: "grid", gridTemplateColumns: "58px 1fr", gap: 6 }}>
                <select value={rate.type} onChange={event => setRates(current => current.map(item => item.level === rate.level ? { ...item, type: event.target.value } : item))} style={{ height: 34, borderRadius: 7, border: "1px solid rgba(0,0,0,.12)", background: "#FFFFFF", color: "#1A1A1A", fontSize: 11, padding: "0 7px", cursor: "pointer" }}><option>%</option><option>$</option></select>
                <input type="number" min="0" step=".5" value={rate.value} onChange={event => setRates(current => current.map(item => item.level === rate.level ? { ...item, value: Number(event.target.value) } : item))} style={{ width: "100%", minWidth: 0, height: 34, borderRadius: 7, border: "1px solid rgba(0,0,0,.12)", background: "#FFFFFF", color: "#1A1A1A", fontSize: 11, padding: "0 9px", outline: "none", fontFamily: "'DM Mono',monospace" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent className="max-w-[440px] gap-0 overflow-hidden border-border bg-background p-0 text-foreground">
          <AlertDialogHeader className="gap-1.5 p-6 text-left">
            <span className="text-xs font-semibold tracking-wide text-primary">Save Changes</span>
            <AlertDialogTitle>변경사항 저장 확인</AlertDialogTitle>
            <AlertDialogDescription>변경 사항을 저장하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setSaveConfirmOpen(false);
              onToast("커미션 비율 설정이 저장되었습니다.", "success");
            }}><Check /> 확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const COMMISSION_FLOW_UPLINES = [
  { step: "3차 상위 IB", name: "Sophia Chen", uid: "UID-10396", level: "Level 9", rate: "2%", amount: "$60.00", accent: "#0F766E", accentBg: "rgba(15,118,110,.08)", accentBorder: "rgba(15,118,110,.2)", width: 470 },
  { step: "2차 상위 IB", name: "Emma Wilson", uid: "UID-10829", level: "Level 7", rate: "4%", amount: "$120.00", accent: "#2563EB", accentBg: "rgba(37,99,235,.07)", accentBorder: "rgba(37,99,235,.18)", width: 500 },
  { step: "1차 상위 IB · Direct", name: "Daniel Kim", uid: "UID-10482", level: "Level 12", rate: "5%", amount: "$150.00", accent: "#7C6AF7", accentBg: "rgba(124,106,247,.08)", accentBorder: "rgba(124,106,247,.2)", width: 560 },
] as const;

export function AffiliateCommissionFlowPage({ dark }: { dark: boolean }) {
  const t = tokens(dark);
  const sampleOrder = "ORD-2026-88412";
  const [orderQuery, setOrderQuery] = useState(sampleOrder);
  const [searchedOrder, setSearchedOrder] = useState(sampleOrder);

  function handleSearch() {
    const orderNumber = orderQuery.trim().toUpperCase();
    setOrderQuery(orderNumber);
    setSearchedOrder(orderNumber);
  }

  return (
    <div style={{ padding: "24px 28px 56px", minHeight: "100vh", color: t.text, background: t.pageBg }}>
      <PageHeader title="커미션 플로우" description="결제 완료된 챌린지 티켓 주문의 스폰서십 커미션 분배 경로를 조회합니다." />

      <div style={{ padding: "18px 20px", borderRadius: 12, border: `1px solid ${dark ? t.border2 : "#E2E8F0"}`, background: dark ? t.surface : "#FFFFFF", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: t.accentBg, color: t.accent }}>
            <ReceiptText size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>챌린지 티켓 주문 조회</div>
            <div style={{ fontSize: 10, color: t.textHint, marginTop: 2 }}>주문 번호를 입력해 결제 이후 생성된 커미션 경로를 확인하세요.</div>
          </div>
        </div>
        <form
          onSubmit={event => {
            event.preventDefault();
            handleSearch();
          }}
          style={{ display: "flex", gap: 9, alignItems: "center" }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 620 }}>
            <Search size={15} color={t.textHint} style={{ position: "absolute", left: 12, top: 12, pointerEvents: "none" }} />
            <input
              value={orderQuery}
              onChange={event => setOrderQuery(event.target.value)}
              placeholder="주문 번호 입력 (예: ORD-2026-88412)"
              aria-label="챌린지 티켓 주문 번호"
              style={{ width: "100%", height: 40, padding: "0 13px 0 36px", borderRadius: 8, border: `1px solid ${dark ? t.border2 : "#E2E8F0"}`, background: dark ? t.surface2 : "#F8FAFC", color: t.text, fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none" }}
            />
          </div>
          <button type="submit" disabled={!orderQuery.trim()} style={{ height: 40, padding: "0 20px", borderRadius: 8, border: "none", background: t.accent, color: "#FFFFFF", fontSize: 12, fontWeight: 650, cursor: orderQuery.trim() ? "pointer" : "not-allowed", opacity: orderQuery.trim() ? 1 : .45 }}>검색</button>
          <button
            type="button"
            onClick={() => {
              setOrderQuery("");
              setSearchedOrder("");
            }}
            style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${dark ? t.border2 : "#E2E8F0"}`, background: dark ? t.surface : "#FFFFFF", color: t.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            aria-label="검색 초기화"
          >
            <RotateCcw size={14} />
          </button>
        </form>
      </div>

      {searchedOrder ? (
        <div style={{ borderRadius: 13, border: `1px solid ${dark ? t.border2 : "#E2E8F0"}`, background: dark ? t.surface : "#FFFFFF", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${dark ? t.border : "#E2E8F0"}`, background: dark ? t.surface : "#FFFFFF" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>스폰서십 커미션 분배 경로</div>
              <div style={{ fontSize: 10, color: t.textHint, marginTop: 4 }}>아래 주문에서 시작해 화살표 방향을 따라 상위 IB로 커미션이 분배됩니다.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: t.textHint }}>분배 인원</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 2 }}>3명</div>
              </div>
              <div style={{ width: 1, height: 28, background: dark ? t.border : "#E2E8F0" }} />
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: t.textHint }}>총 지급 커미션</div>
                <div style={{ fontSize: 14, fontWeight: 750, color: "#16A34A", marginTop: 2, fontFamily: "'DM Mono',monospace" }}>$330.00</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "30px 24px 34px", background: dark ? t.pageBg : "#F8FAFC", overflowX: "auto" }}>
            <div style={{ minWidth: 720, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {COMMISSION_FLOW_UPLINES.map((node, index) => (
                <div key={node.uid} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {index > 0 && (
                    <div style={{ width: 32, height: 52, display: "flex", flexDirection: "column", alignItems: "center", color: "#94A3B8" }}>
                      <ArrowUp size={17} strokeWidth={2.2} />
                      <div style={{ width: 1, flex: 1, background: "#CBD5E1" }} />
                    </div>
                  )}
                  <div style={{ width: node.width, borderRadius: 12, border: `1px solid ${node.accentBorder}`, background: dark ? t.surface : "#FFFFFF", boxShadow: "0 4px 14px rgba(15,23,42,.04)", overflow: "hidden" }}>
                    <div style={{ height: 3, background: node.accent }} />
                    <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "minmax(170px,1.5fr) minmax(120px,1fr) minmax(110px,.8fr)", gap: 16, alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "inline-flex", padding: "3px 7px", borderRadius: 6, background: node.accentBg, color: node.accent, fontSize: 9, fontWeight: 700, marginBottom: 7 }}>{node.step}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{node.name}</span>
                          <span style={{ fontSize: 10, color: t.textHint, fontFamily: "'DM Mono',monospace" }}>{node.uid}</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: t.textHint }}>커미션레벨 · 지급률</div>
                        <div style={{ fontSize: 11, color: t.textSec, fontWeight: 650, marginTop: 4 }}>{node.level} <span style={{ color: "#CBD5E1", margin: "0 4px" }}>·</span> {node.rate}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: t.textHint }}>지급 커미션</div>
                        <div style={{ fontSize: 15, color: "#16A34A", fontWeight: 750, marginTop: 3, fontFamily: "'DM Mono',monospace" }}>{node.amount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ width: 32, height: 56, display: "flex", flexDirection: "column", alignItems: "center", color: t.accent }}>
                <ArrowUp size={18} strokeWidth={2.3} />
                <div style={{ width: 1, flex: 1, background: "rgba(124,106,247,.35)" }} />
              </div>

              <div style={{ width: 660, borderRadius: 13, border: `1px solid ${dark ? t.border2 : "#E2E8F0"}`, background: dark ? t.surface : "#FFFFFF", boxShadow: "0 8px 24px rgba(15,23,42,.06)", overflow: "hidden" }}>
                <div style={{ padding: "15px 17px", display: "grid", gridTemplateColumns: "minmax(190px,1.35fr) minmax(180px,1.2fr) minmax(130px,.8fr)", gap: 18, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: t.accentBg, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CircleDollarSign size={19} /></div>
                    <div>
                      <div style={{ fontSize: 9, color: t.accent, fontWeight: 700, marginBottom: 4 }}>BASE · 구매자 / 주문</div>
                      <div style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>Grace Yoon <span style={{ color: t.textHint, fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>UID-20841</span></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: t.textHint }}>챌린지 티켓 주문 번호</div>
                    <div style={{ fontSize: 12, color: t.text, fontWeight: 650, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{searchedOrder}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: t.textHint }}>결제 금액</div>
                    <div style={{ fontSize: 16, color: t.text, fontWeight: 750, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>$3,000.00</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, padding: "3px 7px", borderRadius: 6, border: "1px solid rgba(22,163,74,.2)", background: "rgba(22,163,74,.08)", color: "#16A34A", fontSize: 9, fontWeight: 650 }}><CheckCircle2 size={10} /> 결제완료</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 13, color: t.textHint, fontSize: 9 }}>커미션 생성 기준 · 결제 완료 2026-11-18 16:42 (GMT+9)</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ minHeight: 360, borderRadius: 12, border: `1px dashed ${dark ? t.border2 : "#CBD5E1"}`, background: dark ? t.surface : "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textHint }}>
          <ReceiptText size={28} strokeWidth={1.5} />
          <div style={{ fontSize: 13, fontWeight: 650, color: t.textSec, marginTop: 12 }}>조회할 주문 번호를 입력해주세요.</div>
          <div style={{ fontSize: 10, marginTop: 5 }}>결제 완료 주문의 상향 커미션 경로가 여기에 표시됩니다.</div>
        </div>
      )}
    </div>
  );
}

export function AffiliateCommissionDetailPage({ dark }: { dark: boolean }) {
  const t = tokens(dark);
  const PAGE_SIZE = 10;
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = COMMISSION_DETAIL_ROWS.filter(row => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesMember = !normalizedQuery || `${row.member} ${row.email} ${row.ibNumber}`.toLowerCase().includes(normalizedQuery);
    const rowDate = row.date.slice(0, 10);
    const matchesStart = !startDate || rowDate >= startDate.slice(0, 10);
    const matchesEnd = !endDate || rowDate <= endDate.slice(0, 10);
    return matchesMember && matchesStart && matchesEnd;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const firstRecord = filteredRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const lastRecord = Math.min(safePage * PAGE_SIZE, filteredRows.length);

  function resetFilters() {
    setQuery("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  }

  function exportExcelRecords() {
    const headers = ["DATE", "MEMBER", "UID", "USER TYPE", "ACCOUNT TYPE", "AMOUNT PAID", "COMMISSION RATE", "EARNED COMMISSION", "STATUS"];
    const values = filteredRows.map(row => [row.date, `${row.member} (${row.email})`, row.ibNumber, row.userType, row.accountType, row.amount, row.rate, row.earned, row.status]);
    const body = [headers, ...values].map(row => row.join("\t")).join("\n");
    const blob = new Blob([body], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "affiliate-commission-detail.xls";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, borderRadius: 8, border: "1px solid #E2E8F0",
    background: "#FFFFFF", color: "#1A1A1A", fontSize: 11, padding: "0 12px", outline: "none",
  };
  const thStyle: React.CSSProperties = {
    padding: "11px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
    color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textAlign: "left", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "13px 14px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0",
    color: "#334155", fontSize: 11, verticalAlign: "middle",
  };

  return (
    <div style={{ padding: "24px 28px 48px", minHeight: "100vh", color: t.text, background: t.pageBg }}>
      <PageHeader title="커미션 상세" description="거래 단위 제휴 커미션 기록을 검색하고 내보냅니다." />

      <div style={{ borderRadius: 12, border: "1px solid #E2E8F0", background: "#FFFFFF", padding: "18px 20px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Filter size={16} color="#7C6AF7" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Search &amp; Filter</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(220px, .8fr) minmax(220px, .8fr) auto", gap: 14, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#4A4A58", fontSize: 10 }}>
            Member / Email / UID
            <div style={{ position: "relative" }}>
              <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 12, top: 13, pointerEvents: "none" }} />
              <input value={query} onChange={event => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search by Member, Email, or UID..." style={{ ...inputStyle, paddingLeft: 34 }} />
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#4A4A58", fontSize: 10 }}>
            Start Date <span style={{ color: "#A0A0AA" }}>yyyy-MM-dd hh:mm (GMT+9)</span>
            <input type="datetime-local" step="60" value={startDate} onChange={event => { setStartDate(event.target.value); setCurrentPage(1); }} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#4A4A58", fontSize: 10 }}>
            End Date <span style={{ color: "#A0A0AA" }}>yyyy-MM-dd hh:mm (GMT+9)</span>
            <input type="datetime-local" step="60" value={endDate} onChange={event => { setEndDate(event.target.value); setCurrentPage(1); }} style={inputStyle} />
          </label>
          <button onClick={resetFilters} style={{ height: 40, padding: "0 15px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Reset Filters</button>
        </div>
      </div>

      <div style={{ borderRadius: 12, border: "1px solid #E2E8F0", background: "#FFFFFF", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #E2E8F0" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>Detailed Performance Workspace</div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 5 }}>Search, filter, and export transaction-level affiliate commission records.</div>
          </div>
          <button onClick={exportExcelRecords} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#334155", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}><FileSpreadsheet size={13} /> Excel</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1350, borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 175 }} />
              <col style={{ width: 250 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 125 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead><tr>{["DATE", "MEMBER", "UID", "USER TYPE", "ACCOUNT TYPE", "AMOUNT PAID", "COMMISSION RATE", "EARNED COMMISSION", "STATUS"].map(header => <th key={header} style={{ ...thStyle, textAlign: ["AMOUNT PAID", "COMMISSION RATE", "EARNED COMMISSION"].includes(header) ? "right" : "left" }}>{header}</th>)}</tr></thead>
            <tbody>
              {pagedRows.map((row, index) => {
                const statusStyle = row.status === "Completed"
                  ? { color: "#16A34A", background: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.2)" }
                  : row.status === "Pending"
                    ? { color: "#D97706", background: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.2)" }
                    : { color: "#DC2626", background: "rgba(220,38,38,.08)", border: "rgba(220,38,38,.2)" };
                const isIb = row.userType.startsWith("Downline");
                return (
                  <tr key={`${row.date}-${index}`} onMouseEnter={event => { event.currentTarget.style.background = "#F8FAFC"; }} onMouseLeave={event => { event.currentTarget.style.background = "#FFFFFF"; }}>
                    <td style={{ ...tdStyle, fontFamily: "'DM Mono',monospace", color: "#475569", whiteSpace: "nowrap" }}>{row.date}</td>
                    <td style={tdStyle}><div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}><span style={{ color: "#1A1A1A", fontWeight: 650 }}>{row.member}</span><span style={{ color: "#94A3B8", fontSize: 10 }}>({row.email})</span></div></td>
                    <td style={{ ...tdStyle, color: "#475569", fontFamily: "'DM Mono',monospace", fontWeight: 650, whiteSpace: "nowrap" }}>{row.ibNumber}</td>
                    <td style={tdStyle}><span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 7, border: `1px solid ${isIb ? "rgba(37,99,235,.18)" : "#E2E8F0"}`, background: isIb ? "rgba(37,99,235,.07)" : "#F8FAFC", color: isIb ? "#2563EB" : "#475569", fontSize: 10, whiteSpace: "nowrap" }}>{row.userType}</span></td>
                    <td style={{ ...tdStyle, color: "#1A1A1A", fontWeight: 550 }}>{row.accountType}</td>
                    <td style={{ ...tdStyle, color: "#1A1A1A", fontWeight: 650, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{row.amount}</td>
                    <td style={{ ...tdStyle, color: "#334155", fontWeight: 650, textAlign: "right" }}>{row.rate}</td>
                    <td style={{ ...tdStyle, color: "#16A34A", fontWeight: 750, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{row.earned}</td>
                    <td style={tdStyle}><span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 7, border: `1px solid ${statusStyle.border}`, background: statusStyle.background, color: statusStyle.color, fontSize: 10, fontWeight: 650 }}>{row.status}</span></td>
                  </tr>
                );
              })}
              {pagedRows.length === 0 && <tr><td colSpan={9} style={{ ...tdStyle, padding: 46, textAlign: "center", color: "#94A3B8" }}>No commission records match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #E2E8F0", background: "#FFFFFF" }}>
          <span style={{ fontSize: 11, color: "#64748B" }}>Showing {firstRecord} - {lastRecord} of {filteredRows.length} records</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <button onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safePage === 1} style={{ height: 32, padding: "0 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#475569", fontSize: 11, cursor: safePage === 1 ? "not-allowed" : "pointer", opacity: safePage === 1 ? .4 : 1 }}>Previous</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => {
              const active = safePage === page;
              return <button key={page} onClick={() => setCurrentPage(page)} aria-current={active ? "page" : undefined} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${active ? "#7C6AF7" : "#E2E8F0"}`, background: active ? "#7C6AF7" : "#FFFFFF", color: active ? "#FFFFFF" : "#475569", fontSize: 11, fontWeight: active ? 700 : 500, cursor: "pointer" }}>{page}</button>;
            })}
            <button onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safePage === totalPages} style={{ height: 32, padding: "0 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#475569", fontSize: 11, cursor: safePage === totalPages ? "not-allowed" : "pointer", opacity: safePage === totalPages ? .4 : 1 }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
