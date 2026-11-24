import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Folder,
  FolderOpen,
  Layers3,
  TrendingUp,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useLocale } from '@/app/i18n/LocaleContext';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import type { AffiliateNetworkNode } from '@/api/affiliate';
import { useAffiliateMeQuery, useAffiliateNetworkQuery } from '@/app/queries/affiliate';

type AffiliateStatus = 'active' | 'pending' | 'inactive';
type AffiliateType = 'self' | 'ib' | 'client';

interface AffiliateNode {
  id: string;
  name: string;
  email: string;
  ibNumber: string;
  type: AffiliateType;
  level: number;
  status: AffiliateStatus;
  commission: number;
  children?: AffiliateNode[];
}

const uidLabel = (uid: string) => `UID-${uid}`;

const toAffiliateNode = (node: AffiliateNetworkNode, isRoot = false): AffiliateNode => ({
  id: node.uid,
  name: node.name,
  email: node.email,
  ibNumber: uidLabel(node.uid),
  type: isRoot ? 'self' : node.is_ib ? 'ib' : 'client',
  level: node.level ?? 0,
  status:
    node.member_status === 'ACTIVE' && (node.ib_status === null || node.ib_status === 'ACTIVE')
      ? 'active'
      : 'inactive',
  commission: node.commission,
  children: node.children.map((child) => toAffiliateNode(child)),
});

const collectExpandableIds = (node: AffiliateNode): string[] =>
  node.children?.length
    ? [node.id, ...node.children.flatMap((child) => collectExpandableIds(child))]
    : [];

const depthPadding = ['pl-4', 'pl-10', 'pl-16', 'pl-24', 'pl-28'];

export function AffiliatePerformancePage() {
  const { locale, T } = useLocale();
  const A = T.affiliate;
  const meQuery = useAffiliateMeQuery();
  const me = meQuery.data?.is_ib ? meQuery.data : null;
  const networkQuery = useAffiliateNetworkQuery(Boolean(me));
  const affiliateNetwork = useMemo(
    () => (networkQuery.data ? toAffiliateNode(networkQuery.data.root, true) : null),
    [networkQuery.data],
  );
  const expandableNodeIds = useMemo(
    () => (affiliateNetwork ? collectExpandableIds(affiliateNetwork) : []),
    [affiliateNetwork],
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 처음 불러오면 내 계정과 바로 아래 단계까지 펼친다.
  useEffect(() => {
    if (!affiliateNetwork) return;
    setExpandedNodes(
      new Set([
        affiliateNetwork.id,
        ...(affiliateNetwork.children ?? [])
          .filter((child) => child.children?.length)
          .map((child) => child.id),
      ]),
    );
  }, [affiliateNetwork]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const setNodeOpen = (id: string, open: boolean) => {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const getStatusLabel = (status: AffiliateStatus) => A[status];

  const getTypeLabel = (node: AffiliateNode) => {
    if (node.type === 'self') return `${A.myAccount} - ${A.level} ${me?.level ?? node.level}`;
    if (node.type === 'client') return A.directClient;
    return A.downlineIb;
  };

  const statusClass = (status: AffiliateStatus) => {
    if (status === 'active') {
      return 'border-[#00FF94]/20 bg-[#00FF94]/10 text-[#00FF94]';
    }
    if (status === 'pending') {
      return 'border-[#FFB800]/20 bg-[#FFB800]/10 text-[#FFB800]';
    }
    return 'border-white/10 bg-white/5 text-gray-400';
  };

  const renderNode = (node: AffiliateNode, depth = 0) => {
    const hasChildren = Boolean(node.children?.length);
    const isOpen = expandedNodes.has(node.id);
    const NodeIcon = node.type === 'client' ? UserRound : isOpen ? FolderOpen : Folder;

    return (
      <Collapsible
        key={node.id}
        open={isOpen}
        onOpenChange={(open) => setNodeOpen(node.id, open)}
      >
        <div
          className={`group grid min-w-[820px] grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_150px_120px] items-center border-b border-white/[0.06] py-3 pr-4 transition-colors hover:bg-white/[0.025] ${
            depthPadding[Math.min(depth, depthPadding.length - 1)]
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {hasChildren ? (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-gray-500 hover:bg-[#0052FF]/10 hover:text-[#68A0FF]"
                  aria-label={`${isOpen ? A.collapseAll : A.expandAll}: ${node.name}`}
                >
                  {isOpen ? <ChevronDown /> : <ChevronRight />}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <div className="size-8 shrink-0" />
            )}

            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                node.type === 'client'
                  ? 'border-white/10 bg-white/5 text-gray-400'
                  : 'border-[#0052FF]/20 bg-[#0052FF]/10 text-[#68A0FF]'
              }`}
            >
              <NodeIcon className="size-5" />
            </div>
            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
              <div className="shrink-0 text-sm font-semibold text-white">{node.name}</div>
              <div className="truncate text-xs text-gray-500">({node.email})</div>
            </div>
          </div>

          {/* UID 열 숨김 (2026-11-24 요청)
          <div className="font-mono text-xs font-medium text-gray-400">
            {node.ibNumber}
          </div>
          */}

          <div>
            <Badge
              variant="outline"
              className={
                node.type === 'client'
                  ? 'border-white/10 bg-white/5 text-gray-300'
                  : 'border-[#0052FF]/20 bg-[#0052FF]/10 text-[#8CB6FF]'
              }
            >
              {getTypeLabel(node)}
            </Badge>
          </div>

          <div className="text-right text-sm font-semibold text-[#00FF94]">
            +${currencyFormatter.format(node.commission)}
          </div>
          <div className="flex justify-end">
            <Badge variant="outline" className={statusClass(node.status)}>
              <span
                className={`size-1.5 rounded-full ${
                  node.status === 'active'
                    ? 'bg-[#00FF94]'
                    : node.status === 'pending'
                      ? 'bg-[#FFB800]'
                      : 'bg-gray-500'
                }`}
              />
              {getStatusLabel(node.status)}
            </Badge>
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            <div className="relative">
              <div className="absolute bottom-0 left-8 top-0 w-px bg-gradient-to-b from-[#0052FF]/40 to-transparent" />
              {node.children?.map((child) => renderNode(child, depth + 1))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  const renderMobileNode = (node: AffiliateNode, depth = 0) => {
    const hasChildren = Boolean(node.children?.length);
    const isOpen = expandedNodes.has(node.id);
    const NodeIcon = node.type === 'client' ? UserRound : isOpen ? FolderOpen : Folder;
    const mobileDepth = ['ml-0', 'ml-3', 'ml-6', 'ml-9'];

    return (
      <div
        key={node.id}
        className={`min-w-0 ${mobileDepth[Math.min(depth, mobileDepth.length - 1)]}`}
      >
        <Collapsible
          open={isOpen}
          onOpenChange={(open) => setNodeOpen(node.id, open)}
          className="min-w-0"
        >
          <div className="min-w-0 rounded-xl border border-white/[0.07] bg-[#14141e] p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              {hasChildren ? (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-gray-500 hover:bg-[#0052FF]/10 hover:text-[#68A0FF]"
                    aria-label={`${isOpen ? A.collapseAll : A.expandAll}: ${node.name}`}
                  >
                    {isOpen ? <ChevronDown /> : <ChevronRight />}
                  </Button>
                </CollapsibleTrigger>
              ) : (
                <div className="size-8 shrink-0" />
              )}
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                  node.type === 'client'
                    ? 'border-white/10 bg-white/5 text-gray-400'
                    : 'border-[#0052FF]/20 bg-[#0052FF]/10 text-[#68A0FF]'
                }`}
              >
                <NodeIcon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{node.name}</div>
                <div className="mt-0.5 break-all text-xs leading-5 text-gray-500">
                  ({node.email})
                </div>
              </div>
            </div>

            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {/* UID 숨김 (2026-11-24 요청)
              <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {A.ibNumber}
                </span>
                <span className="font-mono text-xs font-medium text-gray-300">
                  {node.ibNumber}
                </span>
              </div>
              */}
              <Badge
                variant="outline"
                className={
                  node.type === 'client'
                    ? 'max-w-full border-white/10 bg-white/5 text-gray-300'
                    : 'max-w-full border-[#0052FF]/20 bg-[#0052FF]/10 text-[#8CB6FF]'
                }
              >
                <span className="truncate">{getTypeLabel(node)}</span>
              </Badge>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
              <div className="min-w-0">
                <div className="text-[11px] text-gray-500">{A.commissionContribution}</div>
                <div className="mt-1 truncate text-sm font-semibold text-[#00FF94]">
                  +${currencyFormatter.format(node.commission)}
                </div>
              </div>
              <Badge variant="outline" className={`shrink-0 ${statusClass(node.status)}`}>
                <span
                  className={`size-1.5 rounded-full ${
                    node.status === 'active'
                      ? 'bg-[#00FF94]'
                      : node.status === 'pending'
                        ? 'bg-[#FFB800]'
                        : 'bg-gray-500'
                  }`}
                />
                {getStatusLabel(node.status)}
              </Badge>
            </div>
          </div>

          {hasChildren && (
            <CollapsibleContent>
              <div className="mt-2 space-y-2 border-l border-[#0052FF]/20">
                {node.children?.map((child) => renderMobileNode(child, depth + 1))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  };

  const emptyMessage =
    meQuery.isLoading || networkQuery.isLoading
      ? A.loading
      : meQuery.data && !meQuery.data.is_ib
        ? A.notIbPartner
        : A.loadFailed;

  const summaryCards = [
    // '현재 IB 레벨' 카드 숨김 (2026-11-24 요청)
    // {
    //   label: A.currentLevel,
    //   value: me ? `${A.level} ${me.level}` : '-',
    //   meta: A.levelRange,
    //   icon: Layers3,
    //   accent: 'text-[#68A0FF]',
    //   iconSurface: 'border-[#0052FF]/20 bg-[#0052FF]/10',
    // },
    {
      label: A.commissionRate,
      value: me ? `${Number(me.commission_rate.toFixed(4))}%` : '-',
      meta: me ? `${A.level} ${me.level}` : '',
      icon: TrendingUp,
      accent: 'text-[#00FF94]',
      iconSurface: 'border-[#00FF94]/20 bg-[#00FF94]/10',
    },
    {
      label: A.totalCommission,
      value: me ? `$${currencyFormatter.format(me.total_commission)}` : '-',
      meta: A.paidInUsdt,
      icon: CircleDollarSign,
      accent: 'text-[#00FF94]',
      iconSurface: 'border-[#00FF94]/20 bg-[#00FF94]/10',
    },
    {
      label: A.activeNetwork,
      value: me ? String(me.network_active) : '-',
      meta: `${A.activeMembers} · ${me?.network_total ?? 0} ${A.partnersAndClients}`,
      icon: UsersRound,
      accent: 'text-[#C59BFF]',
      iconSurface: 'border-purple-400/20 bg-purple-400/10',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] min-w-0 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#68A0FF]">
          {A.eyebrow}
        </div>
        <div className="text-2xl font-semibold text-white sm:text-3xl">{A.overviewTitle}</div>
        <div className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
          {A.overviewSubtitle}
        </div>
      </motion.div>

      <div className="mb-6 grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="h-full min-w-0 gap-0 border-[#242432] bg-gradient-to-br from-[#11111a] to-[#0d0d15] shadow-xl shadow-black/10 transition-colors hover:border-[#0052FF]/30">
                <CardContent className="min-w-0 p-4 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div
                      className={`flex size-11 items-center justify-center rounded-xl border ${card.iconSurface} ${card.accent}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-gray-500">
                      LIVE
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">{card.label}</div>
                  <div className={`mt-2 text-3xl font-semibold tracking-tight ${card.accent}`}>
                    {card.value}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">{card.meta}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#242432] bg-[#0f0f17]"
      >
        <div className="flex min-w-0 flex-col gap-4 border-b border-white/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white">{A.networkTitle}</div>
            <div className="mt-1 text-sm text-gray-400">{A.networkSubtitle}</div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedNodes(new Set(expandableNodeIds))}
              className="w-full min-w-0 border-[#2a2a3a] bg-[#16161f] px-2 text-xs text-gray-300 hover:bg-[#1d1d2a] hover:text-white sm:w-auto sm:px-3 sm:text-sm"
            >
              <FolderOpen />
              {A.expandAll}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedNodes(new Set())}
              className="w-full min-w-0 border-[#2a2a3a] bg-[#16161f] px-2 text-xs text-gray-300 hover:bg-[#1d1d2a] hover:text-white sm:w-auto sm:px-3 sm:text-sm"
            >
              <Folder />
              {A.collapseAll}
            </Button>
          </div>
        </div>

        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain md:block">
          <div className="grid min-w-[820px] grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_150px_120px] border-b border-white/[0.07] bg-[#14141e] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <div>{A.member}</div>
            {/* <div>{A.ibNumber}</div> */}
            <div>{A.type}</div>
            <div className="text-right">{A.commissionContribution}</div>
            <div className="text-right">{A.status}</div>
          </div>
          <div>{affiliateNetwork && renderNode(affiliateNetwork)}</div>
          {!affiliateNetwork && (
            <div className="px-6 py-12 text-center text-sm text-gray-500">{emptyMessage}</div>
          )}
        </div>

        <div className="min-w-0 space-y-2 p-3 md:hidden">
          {affiliateNetwork ? (
            renderMobileNode(affiliateNetwork)
          ) : (
            <div className="py-10 text-center text-sm text-gray-500">{emptyMessage}</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
