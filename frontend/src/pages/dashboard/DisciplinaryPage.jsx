import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaGavel, FaPlus, FaTimes, FaExclamationTriangle, FaCheckCircle, FaClock } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"
import { useAuth } from "../../context/AuthContext"

export default function DisciplinaryPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [members, setMembers] = useState([])
  const [activeTab, setActiveTab] = useState("all")
  const [formData, setFormData] = useState({ member_id: "", offense: "", action_taken: "", fine_amount: "", status: "pending" })

  const isExecutive = user?.position?.title &&
    ["General President", "Vice President", "General Secretary"].includes(user.position.title)

  useEffect(() => {
    fetchRecords()
    if (isExecutive) {
      api.get("/accounts/members/").then(res => setMembers(res.data.filter(m => m.account_status === "approved")))
    }
  }, [])

  const fetchRecords = async () => {
    try {
      const res = await api.get("/organization/disciplinary/")
      setRecords(res.data)
    } catch (error) {
      console.log("Disciplinary fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post("/organization/disciplinary/create/", {
        ...formData,
        fine_amount: formData.fine_amount ? parseFloat(formData.fine_amount) : null,
      })
      toast.success("Disciplinary record created!")
      setShowCreateModal(false)
      setFormData({ member_id: "", offense: "", action_taken: "", fine_amount: "", status: "pending" })
      fetchRecords()
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create record")
    } finally {
      setCreating(false)
    }
  }

  const statusIcon = (status) => {
    if (status === "resolved") return <FaCheckCircle className="text-emerald-400" />
    if (status === "pending") return <FaClock className="text-yellow-400" />
    return <FaExclamationTriangle className="text-red-400" />
  }

  const statusColor = (status) => {
    if (status === "resolved") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    if (status === "pending") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
    return "bg-red-500/10 text-red-400 border-red-500/30"
  }

  const filtered = activeTab === "all" ? records : records.filter(r => r.status === activeTab)
  const pending = records.filter(r => r.status === "pending")
  const resolved = records.filter(r => r.status === "resolved")

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Disciplinary</h1>
            <p className="text-gray-400 text-sm mt-1">Track member offenses and disciplinary actions</p>
          </div>
          {isExecutive && (
            <button onClick={() => setShowCreateModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <FaPlus size={12} />
              Add Record
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Cases", value: records.length, color: "emerald" },
            { label: "Pending", value: pending.length, color: "yellow" },
            { label: "Resolved", value: resolved.length, color: "blue" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color === "emerald" ? "text-emerald-400" : stat.color === "yellow" ? "text-yellow-400" : "text-blue-400"}`}>{stat.value}</p>
              <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {[
            { key: "all", label: `All (${records.length})` },
            { key: "pending", label: `Pending (${pending.length})` },
            { key: "resolved", label: `Resolved (${resolved.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${activeTab === tab.key ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((record, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-5 hover:border-emerald-500/30 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaGavel className="text-red-400" size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{record.member}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(record.status)}`}>{record.status}</span>
                      </div>
                      <p className="text-gray-300 text-sm mt-1"><span className="text-gray-500">Offense:</span> {record.offense}</p>
                      <p className="text-gray-300 text-sm mt-1"><span className="text-gray-500">Action:</span> {record.action_taken}</p>
                      {record.fine_amount && (
                        <p className="text-red-400 text-xs mt-1 font-medium">Fine: NGN {parseFloat(record.fine_amount).toLocaleString()}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-2">{new Date(record.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">{statusIcon(record.status)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaGavel className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No disciplinary records</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Add Disciplinary Record</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><FaTimes /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Member</label>
                <select value={formData.member_id} onChange={e => setFormData({ ...formData, member_id: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="">Select member</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name} ({m.user_id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Offense</label>
                <textarea value={formData.offense} onChange={e => setFormData({ ...formData, offense: e.target.value })} placeholder="Describe the offense..." rows={2} required className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Action Taken</label>
                <textarea value={formData.action_taken} onChange={e => setFormData({ ...formData, action_taken: e.target.value })} placeholder="Describe action taken..." rows={2} required className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Fine Amount (NGN) — Optional</label>
                <input type="number" value={formData.fine_amount} onChange={e => setFormData({ ...formData, fine_amount: e.target.value })} placeholder="0" className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Status</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">{creating ? "Saving..." : "Save Record"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
