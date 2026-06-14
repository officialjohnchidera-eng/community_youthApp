import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaHeart, FaPlus, FaTimes, FaUser, FaCalendarAlt } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function WelfarePage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [members, setMembers] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [formData, setFormData] = useState({
    member_id: '',
    welfare_type: 'bereavement',
    description: '',
    amount_given: '',
    date: '',
  })

  const isWelfareOfficer = user?.position &&
    ['Welfare Officer', 'General President', 'Vice President'].includes(user.position)

  useEffect(() => {
    fetchRecords()
    if (isWelfareOfficer) {
      api.get('/accounts/members/').then(res => setMembers(res.data.filter(m => m.account_status === 'approved')))
    }
  }, [isWelfareOfficer])

  const fetchRecords = async () => {
    try {
      const res = await api.get('/organization/welfare/')
      setRecords(res.data)
    } catch (error) {
      console.log('Welfare fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/organization/welfare/create/', {
        ...formData,
        amount_given: formData.amount_given ? parseFloat(formData.amount_given) : null,
      })
      toast.success('Welfare record created successfully!')
      setShowCreateModal(false)
      setFormData({ member_id: '', welfare_type: 'bereavement', description: '', amount_given: '', date: '' })
      fetchRecords()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create record')
    } finally {
      setCreating(false)
    }
  }

  const welfareTypes = ['bereavement', 'medical', 'financial_assistance', 'other']

  const typeColor = (type) => {
    if (type === 'bereavement') return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    if (type === 'medical') return 'bg-red-500/10 text-red-400 border-red-500/30'
    if (type === 'financial_assistance') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
  }

  const filtered = activeTab === 'all' ? records : records.filter(r => r.welfare_type === activeTab)
  const totalGiven = records.reduce((a, b) => a + parseFloat(b.amount_given || 0), 0)

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Welfare Records</h1>
            <p className="text-gray-400 text-xs mt-0.5">Track member welfare support and assistance</p>
          </div>
          {isWelfareOfficer && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all flex-shrink-0"
            >
              <FaPlus size={10} />
              Add Record
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Records', value: records.length, color: 'emerald' },
            { label: 'Bereavement', value: records.filter(r => r.welfare_type === 'bereavement').length, color: 'purple' },
            { label: 'Medical', value: records.filter(r => r.welfare_type === 'medical').length, color: 'red' },
            { label: 'Total Given', value: `NGN ${totalGiven.toLocaleString()}`, color: 'blue' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-3">
              <p className={`text-lg font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'purple' ? 'text-purple-400' : stat.color === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                {stat.value}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 overflow-x-auto">
          {[
            { key: 'all', label: `All (${records.length})` },
            { key: 'bereavement', label: 'Bereavement' },
            { key: 'medical', label: 'Medical' },
            { key: 'financial_assistance', label: 'Financial' },
            { key: 'other', label: 'Other' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Records List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((record, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-4 hover:border-emerald-500/30 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <FaHeart size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm truncate">{record.member}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${typeColor(record.welfare_type)}`}>
                            {record.welfare_type?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2">{record.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-3 mt-2">
                      {record.amount_given && (
                        <p className="text-emerald-400 text-xs font-medium">NGN {parseFloat(record.amount_given).toLocaleString()} given</p>
                      )}
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt className="text-gray-500 flex-shrink-0" size={9} />
                        <p className="text-gray-500 text-xs">{new Date(record.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs mt-1">By: {record.recorded_by}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaHeart className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No welfare records yet</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Add Welfare Record</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Member</label>
                <select
                  value={formData.member_id}
                  onChange={e => setFormData({ ...formData, member_id: e.target.value })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select member</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name} ({m.user_id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Welfare Type</label>
                <select
                  value={formData.welfare_type}
                  onChange={e => setFormData({ ...formData, welfare_type: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                >
                  {welfareTypes.map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the welfare support..."
                  rows={3}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Amount Given (NGN) — Optional</label>
                <input
                  type="number"
                  value={formData.amount_given}
                  onChange={e => setFormData({ ...formData, amount_given: e.target.value })}
                  placeholder="0"
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">
                  {creating ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}