import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaUserCheck, FaUserTimes, FaClock, FaUser, FaMapMarkerAlt, FaPhone, FaEnvelope } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"
import { useAuth } from "../../context/AuthContext"

export default function ApprovalsPage() {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)

  const isPresident = user?.position &&
    ["General President", "Vice President"].includes(user.position)

  useEffect(() => { 
  if (isPresident) fetchPending() 
}, [isPresident])

  const fetchPending = async () => {
    try {
      const res = await api.get("/accounts/pending-accounts/")
      setPending(res.data)
    } catch (error) {
      console.log("Pending fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    setProcessing(userId)
    try {
      await api.post(`/accounts/verify/${userId}/`, { decision: "approved" })
      toast.success("Account approved! Member has been notified.")
      setPending(prev => prev.filter(m => m.user_id !== userId))
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to approve account")
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error("Please provide a rejection reason"); return }
    setProcessing(rejectTarget)
    try {
      await api.post(`/accounts/verify/${rejectTarget}/`, { decision: "rejected", rejection_reason: rejectionReason })
      toast.success("Account rejected. Member has been notified.")
      setPending(prev => prev.filter(m => m.user_id !== rejectTarget))
      setShowRejectModal(false)
      setRejectionReason("")
      setRejectTarget(null)
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to reject account")
    } finally {
      setProcessing(null)
    }
  }

  if (!isPresident) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <FaUserCheck className="text-gray-600 mx-auto mb-3" size={40} />
          <p className="text-gray-400 font-medium">Access Restricted</p>
          <p className="text-gray-500 text-sm mt-1">Only the President or Vice President can access this page</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Account Approvals</h1>
          <p className="text-gray-400 text-sm mt-1">Review and approve pending member registrations</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{pending.length}</p>
            <p className="text-gray-400 text-xs mt-1">Pending Approvals</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{pending.length > 0 ? "Action Required" : "All Clear"}</p>
            <p className="text-gray-400 text-xs mt-1">Status</p>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
            <FaClock className="text-yellow-400 flex-shrink-0" size={18} />
            <p className="text-yellow-400 text-sm">{pending.length} member{pending.length > 1 ? "s are" : " is"} waiting for your approval. Please review and take action.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : pending.length > 0 ? (
          <div className="space-y-4">
            {pending.map((member, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-5 hover:border-yellow-500/30 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {member.first_name?.[0]}{member.last_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-white font-semibold text-lg">{member.first_name} {member.last_name}</p>
                        <p className="text-emerald-400 text-sm">{member.user_id}</p>
                      </div>
                      <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs px-3 py-1 rounded-full">Pending</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {[
                        { icon: <FaEnvelope size={10} />, value: member.email },
                        { icon: <FaPhone size={10} />, value: member.phone },
                        { icon: <FaMapMarkerAlt size={10} />, value: member.village?.name },
                        { icon: <FaUser size={10} />, value: member.position || "Floor Member" },
                      ].map((item, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="text-gray-500">{item.icon}</span>
                          <span className="text-gray-400 text-xs truncate">{item.value || "N/A"}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-2">Registered: {new Date(member.date_joined).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setRejectTarget(member.user_id); setShowRejectModal(true) }}
                    disabled={processing === member.user_id}
                    className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <FaUserTimes size={12} />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(member.user_id)}
                    disabled={processing === member.user_id}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <FaUserCheck size={12} />
                    {processing === member.user_id ? "Processing..." : "Approve"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaUserCheck className="text-emerald-500 mx-auto mb-3" size={40} />
            <p className="text-white font-medium">No Pending Approvals</p>
            <p className="text-gray-500 text-sm mt-1">All member registrations have been reviewed</p>
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-4">Reject Account</h3>
            <p className="text-gray-400 text-sm mb-4">Please provide a reason for rejection. This will be sent to the member via email.</p>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={4}
              className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-red-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectionReason(""); setRejectTarget(null) }} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">Cancel</button>
              <button onClick={handleReject} disabled={processing === rejectTarget} className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-800 text-white py-3 rounded-xl transition-all font-semibold">{processing === rejectTarget ? "Rejecting..." : "Reject"}</button>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
