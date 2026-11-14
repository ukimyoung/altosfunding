import { useAppShell } from '../layouts/AppShell';
import { BC } from '../config/navigation';
import { tok } from '../theme/tokens';

export function PlaceholderPage({ pageId }: { pageId: string }) {
  const { dark } = useAppShell();
  const t = tok(dark);
  const parts = BC[pageId]?.parts ?? [pageId];

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: t.text,
            fontFamily: "'Noto Sans KR',sans-serif",
            marginBottom: 6,
          }}
        >
          {parts[parts.length - 1]}
        </div>
        <div style={{ fontSize: 12, color: t.textHint, fontFamily: "'Noto Sans KR',sans-serif" }}>
          이 섹션은 준비 중입니다
        </div>
      </div>
    </div>
  );
}
