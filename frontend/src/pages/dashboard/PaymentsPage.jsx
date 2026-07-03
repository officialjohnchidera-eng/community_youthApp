import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { FaMoneyBillWave, FaCheckCircle, FaClock, FaTimesCircle, FaExclamationTriangle, FaPlus, FaReceipt, FaDownload, FaRedo } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function PaymentsPage() {
  const [payments, setPayments] = useState([])
  const [requests, setRequests] = useState([])
  const [closedRequests, setClosedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showReactivateModal, setShowReactivateModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState("")
  const [villages, setVillages] = useState([])
  const [activeTab, setActiveTab] = useState("overview")
  const [formData, setFormData] = useState({ payment_type: "monthly_dues", village: "" })
  const [requestForm, setRequestForm] = useState({ title: "", description: "", amount: "", payment_type: "monthly_dues", deadline: "" })
  const [reactivateDeadline, setReactivateDeadline] = useState("")
  const [creating, setCreating] = useState(false)
  const [creatingRequest, setCreatingRequest] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [downloadingReceipt, setDownloadingReceipt] = useState(null)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
    api.get("/accounts/villages/").then((res) => setVillages(res.data))
    api.get("/accounts/me/").then((res) => setUser(res.data)).catch(() => {})
  }, [])

  const fetchData = async () => {
    try {
      const [payRes, reqRes] = await Promise.all([
        api.get("/payments/history/"),
        api.get("/payments/requests/"),
      ])
      setPayments(payRes.data)
      setRequests(reqRes.data)
      try {
        const closedRes = await api.get("/payments/requests/closed/")
        setClosedRequests(closedRes.data)
      } catch (e) {}
    } catch (error) {
      console.log("Payments fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const downloadReceipt = async (payment) => {
    setDownloadingReceipt(payment.id)
    const toastId = toast.loading('Generating receipt...')
    try {
      const response = await api.get(`/payments/receipt/${payment.paystack_reference}/`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
      toast.success('Receipt opened!', { id: toastId })
    } catch (error) {
      toast.error('Failed to generate receipt', { id: toastId })
    } finally {
      setDownloadingReceipt(null)
    }
  }

  const handleCreatePayment = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      if (!selectedPaymentRequest) {
        toast.error("Please select a payment request")
        setCreating(false)
        return
      }
      const res = await api.post("/payments/initiate/", {
        payment_request_id: parseInt(selectedPaymentRequest),
        village_id: parseInt(formData.village),
      })
      toast.success("Payment initiated! Redirecting to Paystack...")
      setShowCreateModal(false)
      if (res.data.payment_url) {
        setTimeout(() => { window.location.href = res.data.payment_url }, 1000)
      }
    } catch (error) {
      const errors = error.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError))
      } else {
        toast.error("Failed to initiate payment")
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCreateRequest = async (e) => {
    e.preventDefault()
    setCreatingRequest(true)
    try {
      await api.post("/payments/requests/create/", requestForm)
      toast.success("Payment request created!")
      setShowRequestModal(false)
      setRequestForm({ title: "", description: "", amount: "", payment_type: "monthly_dues", deadline: "" })
      fetchData()
    } catch (error) {
      const errors = error.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError))
      } else {
        toast.error("Failed to create payment request")
      }
    } finally {
      setCreatingRequest(false)
    }
  }

  const handleReactivate = async (e) => {
    e.preventDefault()
    setReactivating(true)
    try {
      await api.post(`/payments/requests/reactivate/${selectedRequest.id}/`, { deadline: reactivateDeadline })
      toast.success("Payment request reactivated!")
      setShowReactivateModal(false)
      setReactivateDeadline("")
      setSelectedRequest(null)
      fetchData()
    } catch (error) {
      toast.error("Failed to reactivate request")
    } finally {
      setReactivating(false)
    }
  }

  const paidRequestIds = new Set(
    payments.filter(p => p.status === "success").map(p => p.payment_request?.id)
  )
  const unpaidRequests = requests.filter(r => !paidRequestIds.has(r.id))
  const outstandingRequests = closedRequests.filter(r => !paidRequestIds.has(r.id))
  const totalOutstanding = outstandingRequests.reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const isFinancialExec = user?.position && ["General Treasurer", "Assistant Treasurer", "General President", "Vice President"].includes(user.position)
  const totalPaid = payments.filter((p) => p.status === "success").reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const totalPending = payments.filter((p) => p.status === "pending").reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const successfulPayments = payments.filter((p) => p.status === "success")
  const pendingPayments = payments.filter((p) => p.status === "pending")
  const failedPayments = payments.filter((p) => p.status === "failed")

  const statusIcon = (status) => {
    if (status === "success") return <FaCheckCircle className="text-emerald-400 flex-shrink-0" />
    if (status === "pending") return <FaClock className="text-yellow-400 flex-shrink-0" />
    return <FaTimesCircle className="text-red-400 flex-shrink-0" />
  }

  const statusColor = (status) => {
    if (status === "success") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    if (status === "pending") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
    return "bg-red-500/10 text-red-400 border-red-500/30"
  }

  const TransactionCard = ({ payment, borderColor = "border-gray-700" }) => (
    <div className={`bg-gray-900 rounded-xl p-3 border ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {statusIcon(payment.status)}
          <div className="min-w-0">
            <p className="text-white font-medium text-xs truncate">{payment.payment_request?.title || payment.paystack_reference}</p>
            <p className="text-gray-400 text-xs mt-0.5 truncate">{payment.paystack_reference}</p>
            <p className="text-gray-500 text-xs">{new Date(payment.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-white font-semibold text-xs">NGN {parseFloat(payment.amount).toLocaleString()}</p>
          <span className={"text-xs px-2 py-0.5 rounded-full border " + statusColor(payment.status)}>{payment.status}</span>
          {payment.status === "success" && (
            <button
              onClick={() => downloadReceipt(payment)}
              disabled={downloadingReceipt === payment.id}
              className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              {downloadingReceipt === payment.id ? (
                <div className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FaDownload size={10} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Payments</h1>
            <p className="text-gray-400 text-xs mt-0.5">Track your dues, debts and contributions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isFinancialExec && (
              <>
                <button onClick={() => setShowReactivateModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all">
                  <FaRedo size={10} /> Reactivate
                </button>
                <button onClick={() => setShowRequestModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all">
                  <FaPlus size={10} /> Create Request
                </button>
              </>
            )}
            {unpaidRequests.length > 0 && (
              <button onClick={() => setShowCreateModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all">
                <FaPlus size={10} /> Make Payment
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Paid", value: "NGN " + totalPaid.toLocaleString(), color: "emerald", icon: <FaCheckCircle /> },
            { label: "Pending", value: "NGN " + totalPending.toLocaleString(), color: "yellow", icon: <FaClock /> },
            { label: "Outstanding Debt", value: "NGN " + totalOutstanding.toLocaleString(), color: "red", icon: <FaExclamationTriangle /> },
            { label: "Transactions", value: payments.length, color: "blue", icon: <FaReceipt /> },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-3">
              <div className={"text-lg mb-1 " + (stat.color === "emerald" ? "text-emerald-400" : stat.color === "yellow" ? "text-yellow-400" : stat.color === "red" ? "text-red-400" : "text-blue-400")}>{stat.icon}</div>
              <p className={"text-lg font-bold " + (stat.color === "emerald" ? "text-emerald-400" : stat.color === "yellow" ? "text-yellow-400" : stat.color === "red" ? "text-red-400" : "text-blue-400")}>{stat.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Outstanding Debt Banner */}
        {totalOutstanding > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
            <div className="flex items-center gap-3 mb-2">
              <FaExclamationTriangle className="text-red-400 flex-shrink-0" size={16} />
              <div>
                <p className="text-red-400 font-semibold text-xs">Outstanding Debt</p>
                <p className="text-gray-400 text-xs mt-0.5">You have unpaid dues from past payment requests</p>
              </div>
            </div>
            <div className="space-y-2">
              {outstandingRequests.map((req, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-red-500/5 rounded-xl p-2">
                  <div className="min-w-0">
                    <p className="text-red-300 text-xs font-medium truncate">{req.title}</p>
                    <p className="text-gray-500 text-xs">NGN {parseFloat(req.amount || 0).toLocaleString()} · Closed</p>
                  </div>
                  <span className="text-red-400 text-xs font-bold flex-shrink-0">OVERDUE</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Unpaid Request Banners */}
        {unpaidRequests.map((req, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-3">
            <FaClock className="text-yellow-400 flex-shrink-0" size={16} />
            <div className="flex-1 min-w-0">
              <p className="text-yellow-400 font-semibold text-xs truncate">{req.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                NGN {parseFloat(req.amount || 0).toLocaleString()} · {req.payment_type.replace(/_/g, " ").toUpperCase()}
                {req.deadline && ` · Due ${new Date(req.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {isFinancialExec && (
                <button
                  onClick={() => navigate(`/dashboard/payments/${req.id}/audit`)}
                  className="bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs px-3 py-1.5 rounded-lg transition-all"
                >
                  Audit
                </button>
              )}
              <button onClick={() => { setSelectedPaymentRequest(String(req.id)); setShowCreateModal(true) }} className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all">Pay Now</button>
            </div>
          </motion.div>
        ))}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {[
            { key: "overview", label: "All (" + payments.length + ")" },
            { key: "paid", label: "Paid (" + successfulPayments.length + ")" },
            { key: "pending", label: "Pending (" + pendingPayments.length + ")" },
            { key: "failed", label: "Failed (" + failedPayments.length + ")" },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={"flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all " + (activeTab === tab.key ? "bg-emerald-500 text-white shadow-lg" : "text-gray-400 hover:text-white")}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTab === "overview" && (
                payments.length > 0
                  ? payments.map((payment, i) => <TransactionCard key={i} payment={payment} />)
                  : <div className="text-center py-8">
                      <FaMoneyBillWave className="text-gray-600 mx-auto mb-3" size={32} />
                      <p className="text-gray-500 text-sm">No transactions yet</p>
                    </div>
              )}

              {activeTab === "paid" && (
                successfulPayments.length > 0
                  ? successfulPayments.map((payment, i) => <TransactionCard key={i} payment={payment} borderColor="border-emerald-500/20" />)
                  : <div className="text-center py-8">
                      <FaCheckCircle className="text-gray-600 mx-auto mb-3" size={32} />
                      <p className="text-gray-500 text-sm">No successful payments yet</p>
                    </div>
              )}

              {activeTab === "pending" && (
                pendingPayments.length > 0
                  ? pendingPayments.map((payment, i) => <TransactionCard key={i} payment={payment} borderColor="border-yellow-500/20" />)
                  : <div className="text-center py-8">
                      <FaClock className="text-gray-600 mx-auto mb-3" size={32} />
                      <p className="text-gray-500 text-sm">No pending payments</p>
                    </div>
              )}

              {activeTab === "failed" && (
                failedPayments.length > 0
                  ? <>
                      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-3 mb-2">
                        <p className="text-gray-400 text-xs">ℹ️ Failed transactions are payment attempts that didn't go through. No money was charged for these.</p>
                      </div>
                      {failedPayments.map((payment, i) => <TransactionCard key={i} payment={payment} borderColor="border-red-500/20" />)}
                    </>
                  : <div className="text-center py-8">
                      <FaCheckCircle className="text-emerald-500 mx-auto mb-3" size={32} />
                      <p className="text-gray-400 font-medium text-sm">No failed transactions</p>
                    </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Make Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md">
            <h3 className="text-white font-bold text-lg mb-6">Make a Payment</h3>
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Select Payment Request</label>
                <select value={selectedPaymentRequest} onChange={(e) => setSelectedPaymentRequest(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="">Select a request</option>
                  {requests.filter(r => !paidRequestIds.has(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>{r.title} — NGN {parseFloat(r.amount).toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Village</label>
                <select value={formData.village} onChange={(e) => setFormData({ ...formData, village: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="">Select village</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                <p className="text-gray-400 text-xs">💡 Once you click Pay Now you will be redirected to Paystack to complete your payment securely.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">{creating ? "Processing..." : "Pay Now"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-6">Create Payment Request</h3>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Title</label>
                <input type="text" value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} required placeholder="e.g. March Monthly Dues" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Description</label>
                <textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} required placeholder="Brief description..." rows={2} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Amount (NGN)</label>
                <input type="number" value={requestForm.amount} onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })} required placeholder="e.g. 5000" className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Payment Type</label>
                <select value={requestForm.payment_type} onChange={(e) => setRequestForm({ ...requestForm, payment_type: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="monthly_dues">Monthly Dues</option>
                  <option value="event">Event Contribution</option>
                  <option value="levy">Levy</option>
                  <option value="fine">Fine</option>
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Deadline</label>
                <input type="datetime-local" value={requestForm.deadline} onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRequestModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={creatingRequest} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 text-white py-3 rounded-xl transition-all font-semibold">{creatingRequest ? "Creating..." : "Create Request"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md">
            <h3 className="text-white font-bold text-lg mb-6">Reactivate Payment Request</h3>
            <form onSubmit={handleReactivate} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Select Closed Request</label>
                <select value={selectedRequest?.id || ""} onChange={(e) => setSelectedRequest(closedRequests.find(r => r.id === parseInt(e.target.value)))} required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="">Select a request</option>
                  {closedRequests.map((r) => (
                    <option key={r.id} value={r.id}>{r.title} — NGN {parseFloat(r.amount).toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">New Deadline</label>
                <input type="datetime-local" value={reactivateDeadline} onChange={(e) => setReactivateDeadline(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                <p className="text-orange-400 text-xs">⚠️ Only members who have NOT paid will see this reactivated request. Members who already paid will not be affected.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowReactivateModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={reactivating} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white py-3 rounded-xl transition-all font-semibold">{reactivating ? "Reactivating..." : "Reactivate"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}cdimport { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { 
  FiTrendingUp, FiCheckCircle, FiClock, FiXCircle, 
  FiAlertTriangle, FiPlus, FiFileText, FiDownload, 
  FiRefreshCw, FiCreditCard, FiPieChart, FiCalendar,
  FiDollarSign, FiArrowRight, FiUser, FiBuilding,
  FiBell, FiFilter, FiSearch
} from "react-icons/fi"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function PaymentsPage() {
  const [payments, setPayments] = useState([])
  const [requests, setRequests] = useState([])
  const [closedRequests, setClosedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showReactivateModal, setShowReactivateModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState("")
  const [villages, setVillages] = useState([])
  const [activeTab, setActiveTab] = useState("overview")
  const [formData, setFormData] = useState({ payment_type: "monthly_dues", village: "" })
  const [requestForm, setRequestForm] = useState({ title: "", description: "", amount: "", payment_type: "monthly_dues", deadline: "" })
  const [reactivateDeadline, setReactivateDeadline] = useState("")
  const [creating, setCreating] = useState(false)
  const [creatingRequest, setCreatingRequest] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [downloadingReceipt, setDownloadingReceipt] = useState(null)
  const [user, setUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
    api.get("/accounts/villages/").then((res) => setVillages(res.data))
    api.get("/accounts/me/").then((res) => setUser(res.data)).catch(() => {})
  }, [])

  const fetchData = async () => {
    try {
      const [payRes, reqRes] = await Promise.all([
        api.get("/payments/history/"),
        api.get("/payments/requests/"),
      ])
      setPayments(payRes.data)
      setRequests(reqRes.data)
      try {
        const closedRes = await api.get("/payments/requests/closed/")
        setClosedRequests(closedRes.data)
      } catch (e) {}
    } catch (error) {
      console.log("Payments fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const downloadReceipt = async (payment) => {
    setDownloadingReceipt(payment.id)
    const toastId = toast.loading('Generating receipt...')
    try {
      const response = await api.get(`/payments/receipt/${payment.paystack_reference}/`, {
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
      toast.success('Receipt opened!', { id: toastId })
    } catch (error) {
      toast.error('Failed to generate receipt', { id: toastId })
    } finally {
      setDownloadingReceipt(null)
    }
  }

  const handleCreatePayment = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      if (!selectedPaymentRequest) {
        toast.error("Please select a payment request")
        setCreating(false)
        return
      }
      const res = await api.post("/payments/initiate/", {
        payment_request_id: parseInt(selectedPaymentRequest),
        village_id: parseInt(formData.village),
      })
      toast.success("Payment initiated! Redirecting to Paystack...")
      setShowCreateModal(false)
      if (res.data.payment_url) {
        setTimeout(() => { window.location.href = res.data.payment_url }, 1000)
      }
    } catch (error) {
      const errors = error.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError))
      } else {
        toast.error("Failed to initiate payment")
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCreateRequest = async (e) => {
    e.preventDefault()
    setCreatingRequest(true)
    try {
      await api.post("/payments/requests/create/", requestForm)
      toast.success("Payment request created!")
      setShowRequestModal(false)
      setRequestForm({ title: "", description: "", amount: "", payment_type: "monthly_dues", deadline: "" })
      fetchData()
    } catch (error) {
      const errors = error.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError))
      } else {
        toast.error("Failed to create payment request")
      }
    } finally {
      setCreatingRequest(false)
    }
  }

  const handleReactivate = async (e) => {
    e.preventDefault()
    setReactivating(true)
    try {
      await api.post(`/payments/requests/reactivate/${selectedRequest.id}/`, { deadline: reactivateDeadline })
      toast.success("Payment request reactivated!")
      setShowReactivateModal(false)
      setReactivateDeadline("")
      setSelectedRequest(null)
      fetchData()
    } catch (error) {
      toast.error("Failed to reactivate request")
    } finally {
      setReactivating(false)
    }
  }

  const paidRequestIds = new Set(
    payments.filter(p => p.status === "success").map(p => p.payment_request?.id)
  )
  const unpaidRequests = requests.filter(r => !paidRequestIds.has(r.id))
  const outstandingRequests = closedRequests.filter(r => !paidRequestIds.has(r.id))
  const totalOutstanding = outstandingRequests.reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const isFinancialExec = user?.position && ["General Treasurer", "Assistant Treasurer", "General President", "Vice President"].includes(user.position)
  const totalPaid = payments.filter((p) => p.status === "success").reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const totalPending = payments.filter((p) => p.status === "pending").reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const successfulPayments = payments.filter((p) => p.status === "success")
  const pendingPayments = payments.filter((p) => p.status === "pending")
  const failedPayments = payments.filter((p) => p.status === "failed")

  const getStatusConfig = (status) => {
    const configs = {
      success: { icon: FiCheckCircle, color: "emerald", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400" },
      pending: { icon: FiClock, color: "amber", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/30", text: "text-amber-700 dark:text-amber-400" },
      failed: { icon: FiXCircle, color: "red", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/30", text: "text-red-700 dark:text-red-400" }
    }
    return configs[status] || configs.pending
  }

  const MetricCard = ({ icon: Icon, label, value, trend, color = "blue" }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-${color}-50 dark:bg-${color}-500/10`}>
          <Icon className={`text-${color}-600 dark:text-${color}-400`} size={20} />
        </div>
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <FiTrendingUp className="text-emerald-500" size={14} />
          <span className="text-xs text-emerald-600 dark:text-emerald-400">{trend}</span>
        </div>
      )}
    </motion.div>
  )

  const TransactionCard = ({ payment }) => {
    const statusConfig = getStatusConfig(payment.status)
    const StatusIcon = statusConfig.icon

    return (
      <div className="bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
              <StatusIcon className={statusConfig.text} size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {payment.payment_request?.title || "Payment Transaction"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(payment.created_at).toLocaleDateString("en-US", { 
                    month: "short", 
                    day: "numeric", 
                    year: "numeric" 
                  })}
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {payment.paystack_reference?.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                ₦{parseFloat(payment.amount).toLocaleString()}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                {payment.status}
              </span>
            </div>
            {payment.status === "success" && (
              <button
                onClick={() => downloadReceipt(payment)}
                disabled={downloadingReceipt === payment.id}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50"
              >
                {downloadingReceipt === payment.id ? (
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiDownload size={16} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const getFilteredPayments = () => {
    let filtered = payments
    if (activeTab === "paid") filtered = successfulPayments
    else if (activeTab === "pending") filtered = pendingPayments
    else if (activeTab === "failed") filtered = failedPayments
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.payment_request?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.paystack_reference?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    return filtered
  }

  const filteredPayments = getFilteredPayments()

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FiCreditCard className="text-emerald-500" />
              Payments
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Manage your transactions and payment requests
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isFinancialExec && (
              <>
                <button 
                  onClick={() => setShowReactivateModal(true)} 
                  className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all flex items-center gap-2"
                >
                  <FiRefreshCw size={14} /> Reactivate
                </button>
                <button 
                  onClick={() => setShowRequestModal(true)} 
                  className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all flex items-center gap-2"
                >
                  <FiPlus size={14} /> Create Request
                </button>
              </>
            )}
            {unpaidRequests.length > 0 && (
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              >
                <FiDollarSign size={14} /> Make Payment
              </button>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={FiCheckCircle} 
            label="Total Paid" 
            value={`₦${totalPaid.toLocaleString()}`}
            trend="+12.5% from last month"
            color="emerald"
          />
          <MetricCard 
            icon={FiClock} 
            label="Pending" 
            value={`₦${totalPending.toLocaleString()}`}
            color="amber"
          />
          <MetricCard 
            icon={FiAlertTriangle} 
            label="Outstanding" 
            value={`₦${totalOutstanding.toLocaleString()}`}
            color="red"
          />
          <MetricCard 
            icon={FiFileText} 
            label="Transactions" 
            value={payments.length}
            color="blue"
          />
        </div>

        {/* Outstanding Debt Alert */}
        {totalOutstanding > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-400">Outstanding Debt</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  You have unpaid dues from {outstandingRequests.length} past payment request{outstandingRequests.length > 1 ? 's' : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {outstandingRequests.map((req) => (
                    <span key={req.id} className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-500/10 px-3 py-1 rounded-full text-xs text-red-700 dark:text-red-400">
                      {req.title}
                      <span className="font-semibold">₦{parseFloat(req.amount || 0).toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Unpaid Requests */}
        {unpaidRequests.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <FiBell className="text-amber-500" size={14} />
              Pending Payments
            </h3>
            {unpaidRequests.map((req) => (
              <motion.div 
                key={req.id} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">{req.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                      ₦{parseFloat(req.amount || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {req.payment_type.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {req.deadline && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Due {new Date(req.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isFinancialExec && (
                    <button
                      onClick={() => navigate(`/dashboard/payments/${req.id}/audit`)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all"
                    >
                      Audit
                    </button>
                  )}
                  <button 
                    onClick={() => { setSelectedPaymentRequest(String(req.id)); setShowCreateModal(true) }} 
                    className="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-all"
                  >
                    Pay Now
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: "overview", label: "All", count: payments.length },
              { key: "paid", label: "Completed", count: successfulPayments.length },
              { key: "pending", label: "Pending", count: pendingPayments.length },
              { key: "failed", label: "Failed", count: failedPayments.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transaction History</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filteredPayments.length} transaction{filteredPayments.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredPayments.length > 0 ? (
              filteredPayments.map((payment, i) => (
                <TransactionCard key={i} payment={payment} />
              ))
            ) : (
              <div className="text-center py-12">
                <FiFileText className="text-gray-300 dark:text-gray-600 mx-auto mb-3" size={40} />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {searchTerm ? "No matching transactions found" : "No transactions yet"}
                </p>
                {!searchTerm && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Your payment history will appear here
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Make Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Make a Payment</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Complete your payment securely</p>
            
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Select Payment Request
                </label>
                <select 
                  value={selectedPaymentRequest} 
                  onChange={(e) => setSelectedPaymentRequest(e.target.value)} 
                  required 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Choose a request...</option>
                  {requests.filter(r => !paidRequestIds.has(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>{r.title} — ₦{parseFloat(r.amount).toLocaleString()}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  <FiBuilding className="inline mr-1.5" size={14} />
                  Village
                </label>
                <select 
                  value={formData.village} 
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })} 
                  required 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select village</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <FiCreditCard size={14} />
                  You will be redirected to Paystack to complete your payment securely
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay Now
                      <FiArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Create Payment Request</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Request payments from members</p>
            
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Title
                </label>
                <input 
                  type="text" 
                  value={requestForm.title} 
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} 
                  required 
                  placeholder="e.g. March Monthly Dues" 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Description
                </label>
                <textarea 
                  value={requestForm.description} 
                  onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} 
                  required 
                  placeholder="Brief description..." 
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Amount (NGN)
                </label>
                <input 
                  type="number" 
                  value={requestForm.amount} 
                  onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })} 
                  required 
                  placeholder="e.g. 5000" 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Payment Type
                </label>
                <select 
                  value={requestForm.payment_type} 
                  onChange={(e) => setRequestForm({ ...requestForm, payment_type: e.target.value })} 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="monthly_dues">Monthly Dues</option>
                  <option value="event">Event Contribution</option>
                  <option value="levy">Levy</option>
                  <option value="fine">Fine</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  <FiCalendar className="inline mr-1.5" size={14} />
                  Deadline
                </label>
                <input 
                  type="datetime-local" 
                  value={requestForm.deadline} 
                  onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })} 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRequestModal(false)} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creatingRequest} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {creatingRequest ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Request
                      <FiArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reactivate Payment Request</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Re-open a closed payment request</p>
            
            <form onSubmit={handleReactivate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Select Closed Request
                </label>
                <select 
                  value={selectedRequest?.id || ""} 
                  onChange={(e) => setSelectedRequest(closedRequests.find(r => r.id === parseInt(e.target.value)))} 
                  required 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Choose a request...</option>
                  {closedRequests.map((r) => (
                    <option key={r.id} value={r.id}>{r.title} — ₦{parseFloat(r.amount).toLocaleString()}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  <FiCalendar className="inline mr-1.5" size={14} />
                  New Deadline
                </label>
                <input 
                  type="datetime-local" 
                  value={reactivateDeadline} 
                  onChange={(e) => setReactivateDeadline(e.target.value)} 
                  required 
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <FiAlertTriangle className="flex-shrink-0 mt-0.5" size={14} />
                  <span>Only members who haven't paid will see this reactivated request. Existing payments won't be affected.</span>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowReactivateModal(false)} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={reactivating} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {reactivating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reactivating...
                    </>
                  ) : (
                    <>
                      Reactivate
                      <FiArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}