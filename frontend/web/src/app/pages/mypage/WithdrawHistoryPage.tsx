import { motion } from 'motion/react';
import { 
  Calendar, 
  Download,
  ArrowUpRight,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Search
} from 'lucide-react';

export function WithdrawHistoryPage() {
  const withdrawalHistory = [
    {
      id: 1,
      date: '2026-03-10',
      amount: 1249.00,
      network: 'TRC-20',
      walletAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzg...8WQL',
      fee: 1.00,
      received: 1248.00,
      status: 'completed',
      txHash: '0x1a2b3c4d5e6f7g8h9i0j...'
    },
    {
      id: 2,
      date: '2026-02-25',
      amount: 500.00,
      network: 'ERC-20',
      walletAddress: '0x742d35Cc6634C0532925a3b8...9f1d',
      fee: 5.00,
      received: 495.00,
      status: 'completed',
      txHash: '0x9z8y7x6w5v4u3t2s1r0q...'
    },
    {
      id: 3,
      date: '2026-02-18',
      amount: 750.00,
      network: 'TRC-20',
      walletAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzg...8WQL',
      fee: 1.00,
      received: 749.00,
      status: 'completed',
      txHash: '0x3c4d5e6f7g8h9i0j1k2l...'
    },
    {
      id: 4,
      date: '2026-02-10',
      amount: 300.00,
      network: 'TRC-20',
      walletAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzg...8WQL',
      fee: 1.00,
      received: 299.00,
      status: 'pending',
      txHash: null
    },
    {
      id: 5,
      date: '2026-02-05',
      amount: 1000.00,
      network: 'ERC-20',
      walletAddress: '0x742d35Cc6634C0532925a3b8...9f1d',
      fee: 5.00,
      received: 995.00,
      status: 'failed',
      txHash: null
    },
    {
      id: 6,
      date: '2026-01-28',
      amount: 650.00,
      network: 'TRC-20',
      walletAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzg...8WQL',
      fee: 1.00,
      received: 649.00,
      status: 'completed',
      txHash: '0x5e6f7g8h9i0j1k2l3m4n...'
    },
  ];

  const stats = [
    { label: 'Total Withdrawn', value: '$4,243.00', color: 'blue' },
    { label: 'Pending Withdrawals', value: '$299.00', color: 'yellow' },
    { label: 'Successful', value: '4', color: 'green' },
    { label: 'Failed', value: '1', color: 'red' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-[#00FF94]" />;
      case 'pending':
        return <Clock size={16} className="text-[#FFB800]" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-[#00FF94]/10 text-[#00FF94]';
      case 'pending':
        return 'bg-[#FFB800]/10 text-[#FFB800]';
      case 'failed':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const shortenAddress = (address: string) => {
    if (address.length < 20) return address;
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6 hover:border-[#0052FF]/50 transition-colors"
          >
            <h3 className="text-gray-400 text-sm mb-2">{stat.label}</h3>
            <p className={`text-2xl font-semibold ${
              stat.color === 'blue' ? 'text-[#0052FF]' :
              stat.color === 'yellow' ? 'text-[#FFB800]' :
              stat.color === 'green' ? 'text-[#00FF94]' :
              'text-red-400'
            }`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Withdrawal History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="bg-[#0f0f17] border border-[#1a1a24] rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#1a1a24]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Withdrawal History</h2>
              <p className="text-gray-400 text-sm">Track all your withdrawal transactions and their status</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 bg-[#1a1a24] text-white rounded-lg border border-[#2a2a3a] text-sm focus:outline-none focus:border-[#0052FF] transition-colors"
                />
              </div>
              <select className="px-4 py-2 bg-[#1a1a24] text-white rounded-lg border border-[#2a2a3a] text-sm focus:outline-none focus:border-[#0052FF] transition-colors">
                <option>All Status</option>
                <option>Completed</option>
                <option>Pending</option>
                <option>Failed</option>
              </select>
              <button className="px-4 py-2 bg-[#0052FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052FF]/90 transition-colors flex items-center gap-2">
                <Download size={16} />
                Export
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#1a1a24]">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Network
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Wallet Address
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Fee
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Received
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a24]">
              {withdrawalHistory.map((withdrawal, index) => (
                <motion.tr
                  key={withdrawal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.5 + (index * 0.05) }}
                  className="hover:bg-[#1a1a24]/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <Calendar size={14} className="text-gray-500" />
                      {new Date(withdrawal.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-white text-sm font-semibold">
                      ${withdrawal.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-gray-500 text-xs">USDT</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#0052FF]/10 text-[#0052FF]">
                      {withdrawal.network}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-300 text-xs font-mono">
                      {shortenAddress(withdrawal.walletAddress)}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-red-400 text-sm font-medium">
                      -${withdrawal.fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-[#00FF94] text-sm font-semibold">
                      ${withdrawal.received.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadge(withdrawal.status)}`}>
                      {getStatusIcon(withdrawal.status)}
                      {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {withdrawal.status === 'completed' && withdrawal.txHash ? (
                      <button className="text-[#0052FF] hover:text-[#0052FF]/80 text-xs font-medium flex items-center gap-1 transition-colors">
                        <ArrowUpRight size={14} />
                        View TX
                      </button>
                    ) : withdrawal.status === 'failed' ? (
                      <button className="text-gray-500 text-xs font-medium">
                        —
                      </button>
                    ) : (
                      <button className="text-[#FFB800] text-xs font-medium">
                        Processing
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-[#1a1a24] flex items-center justify-between flex-wrap gap-4">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white font-medium">1-6</span> of <span className="text-white font-medium">6</span> withdrawals
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-[#1a1a24] text-gray-400 rounded-lg text-sm hover:bg-[#2a2a3a] hover:text-white transition-colors">
              Previous
            </button>
            <button className="px-4 py-2 bg-[#0052FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052FF]/90 transition-colors">
              1
            </button>
            <button className="px-4 py-2 bg-[#1a1a24] text-white rounded-lg text-sm hover:bg-[#2a2a3a] transition-colors">
              Next
            </button>
          </div>
        </div>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7 }}
        className="mt-6 bg-[#0f0f17] border border-[#1a1a24] rounded-xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
            <Download size={24} className="text-[#0052FF]" />
          </div>
          <div className="flex-1">
            <h3 className="text-white text-lg font-semibold mb-2">Need Help with Withdrawals?</h3>
            <p className="text-gray-400 text-sm mb-4">
              If you have any questions about your withdrawal transactions or need assistance, our support team is here to help 24/7.
            </p>
            <button className="px-6 py-2.5 bg-[#1a1a24] text-white rounded-lg hover:bg-[#2a2a3a] transition-colors text-sm font-medium">
              Contact Support
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
