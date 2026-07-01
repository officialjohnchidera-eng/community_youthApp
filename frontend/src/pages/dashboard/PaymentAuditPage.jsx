import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FaCheckCircle, FaTimesCircle, FaSearch, FaArrowLeft, FaDownload, FaFilter } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'

export default function PaymentAuditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [villageFilter, setVillageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchAudit()
  }, [id])

  const fetchAudit = async () => {
    try {
      const res = await api.get(`/payments/requests/${id}/audit/`)
      setData(res.data)
    } catch (error) {
      toast.error('Failed to load audit data')
      navigate('/dashboard/payments')
    } finally {
      setLoading(false)
    }
  }

  const villages = data ? [...new Set(data.checklist.map(m => m.village))].sort() : []

  const filtered = data?.checklist.filter(member => {
    const matchesSearch =
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.user_id.toLowerCase().includes(search.toLowerCase())
    const matchesVillage = villageFilter === 'all' || member.village === villageFilter
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter
    return matchesSearch && matchesVillage && matchesStatus
  }) || []

  const exportCSV = () => {
    const headers = ['User ID', 'Name', 'Village', 'Position', 'Status']
    const rows = filtered.map(m => [
      m.user_id, m.name, m.village, m.position, m.status.toUpperCase()
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-audit-${data?.payment_request?.title || id}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/payments')}
            className="text-gray-400 hover:text-white transition-all">
            <FaArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{data?.payment_request?.title}</h1>
            <p className="text-gray-400 text-xs mt-0.5">Payment Audit & Compliance Report</p>
          </div>
          <button onClick={exportCSV}
            className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all flex-shrink-0">
            <FaDownload size={10} /> Export
          </button>
        </div>

        {/* Payment Info Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-gray-400 text-xs">Amount</p>
              <p className="text-white font-bold text-xl">NGN {parseFloat(data?.payment_request?.amount || 0).toLocaleString()}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border ${
              data?.payment_request?.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
            }`}>
              {data?.payment_request?.status}
            </span>
          </div>
          {data?.payment_request?.deadline && (
            <p className="text-gray-400 text-xs">
              Deadline: {new Date(data.payment_request.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Members', value: data?.summary?.total_members, color: 'blue' },
            { label: 'Compliance Rate', value: `${data?.summary?.compliance_rate}%`, color: 'purple' },
            { label: 'Paid', value: data?.summary?.paid_count, color: 'emerald' },
            { label: 'Unpaid', value: data?.summary?.unpaid_count, color: 'red' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-3 text-center">
              <p className={`text-2xl font-bold ${
                stat.color === 'emerald' ? 'text-emerald-400' :
                stat.color === 'red' ? 'text-red-400' :
                stat.color === 'blue' ? 'text-blue-400' : 'text-purple-400'
              }`}>{stat.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Compliance Bar */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs">Overall Compliance</p>
            <p className="text-white text-xs font-medium">{data?.summary?.compliance_rate}%</p>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${data?.summary?.compliance_rate}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={villageFilter}
              onChange={e => setVillageFilter(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Villages</option>
              {villages.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid Only</option>
              <option value="unpaid">Unpaid Only</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <p className="text-gray-500 text-xs">
          Showing {filtered.length} of {data?.checklist?.length} members
        </p>

        {/* Checklist */}
        <div className="space-y-2">
          {filtered.map((member, i) => (
            <motion.div
              key={member.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={`bg-gray-800 border rounded-xl p-3 flex items-center gap-3 ${
                member.status === 'paid'
                  ? 'border-emerald-500/20'
                  : 'border-red-500/20'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                member.status === 'paid' ? 'bg-emerald-500' : 'bg-gray-600'
              }`}>
                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{member.name}</p>
                <p className="text-gray-500 text-xs">{member.user_id} · {member.village}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {member.status === 'paid' ? (
                  <>
                    <FaCheckCircle className="text-emerald-400" size={14} />
                    <span className="text-emerald-400 text-xs font-medium">Paid</span>
                  </>
                ) : (
                  <>
                    <FaTimesCircle className="text-red-400" size={14} />
                    <span className="text-red-400 text-xs font-medium">Unpaid</span>
                  </>
                )}
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
              <FaFilter className="text-gray-600 mx-auto mb-3" size={32} />
              <p className="text-gray-400 text-sm">No members match your filters</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}