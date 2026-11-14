import { Badge } from "../shared/Badge";
import { ACCT_STATUS_MAP } from "../../constants/status";

export function AcctStatusBadge({ status }: { status: string }) {
  const s = ACCT_STATUS_MAP[status] ?? { bg: "transparent", color: "#888", border: "#ccc" };
  return <Badge label={status} {...s} />;
}
