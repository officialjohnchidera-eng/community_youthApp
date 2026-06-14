import { useState, useEffect } from "react"
import { jsPDF } from "jspdf"
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
  const [user, setUser] = useState(null)

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
    const doc = new jsPDF()
    const logoUrl = "/src/assets/leopard.jpg"
    const img = new Image()
    img.src = logoUrl
    await new Promise((resolve) => { img.onload = resolve })
    doc.setFillColor(15, 17, 23)
    doc.rect(0, 0, 210, 297, "F")
    doc.setFillColor(16, 185, 129)
    doc.roundedRect(88, 13, 30, 30, 4, 4, "F")
    doc.addImage(img, "JPEG", 89, 14, 28, 28)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("UMUAGU GENERAL YOUTH ASSOCIATION", 105, 68, { align: "center" })
    doc.setTextColor(100, 200, 150)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text("Umuagu, Ufuma Orumba LGA, Anambra State", 105, 76, { align: "center" })
    doc.setDrawColor(30, 80, 55)
    doc.setLineWidth(0.5)
    doc.line(15, 82, 195, 82)
    doc.setFillColor(16, 185, 129)
    doc.roundedRect(70, 87, 70, 12, 6, 6, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text("PAYMENT SUCCESSFUL", 105, 95, { align: "center" })
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text("Amount Paid", 105, 112, { align: "center" })
    doc.setTextColor(16, 185, 129)
    doc.setFontSize(32)
    doc.setFont("helvetica", "bold")
    doc.text("NGN " + parseFloat(payment.amount).toLocaleString() + ".00", 105, 128, { align: "center" })
    doc.setDrawColor(30, 80, 55)
    doc.setLineWidth(0.5)
    doc.line(15, 135, 195, 135)
    doc.setFillColor(22, 27, 34)
    doc.roundedRect(12, 140, 186, 110, 4, 4, "F")
    const details = [
      ["Receipt No.", payment.receipt_number || "N/A"],
      ["Reference", payment.paystack_reference || "N/A"],
      ["Received From", payment.member || "N/A"],
      ["Payment For", (payment.payment_request?.payment_type || "N/A").replace(/_/g, " ").toUpperCase()],
      ["Village", payment.village || "N/A"],
      ["Date", new Date(payment.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })],
      ["Paid At", payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A"],
    ]
    let y = 152
    details.forEach(([label, value], index) => {
      if (index > 0) {
        doc.setDrawColor(30, 40, 35)
        doc.setLineWidth(0.3)
        doc.line(18, y - 5, 192, y - 5)
      }
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(120, 150, 130)
      doc.text(label, 20, y)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9.5)
      doc.setTextColor(220, 230, 225)
      doc.text(String(value), 192, y, { align: "right" })
      y += 14
    })
    doc.setFillColor(22, 27, 34)
    doc.roundedRect(12, 258, 186, 22, 4, 4, "F")
    doc.setDrawColor(16, 185, 129)
    doc.setLineWidth(0.5)
    doc.roundedRect(12, 258, 186, 22, 4, 4, "S")
    doc.setTextColor(100, 200, 150)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text("Transaction ID", 105, 266, { align: "center" })
    doc.setTextColor(220, 230, 225)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text(payment.paystack_reference || "N/A", 105, 274, { align: "center" })
    doc.setTextColor(60, 80, 70)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "italic")
    doc.text("This receipt is computer generated and valid without a physical signature.", 105, 285, { align: "center" })
    doc.text("Any alteration renders this document invalid.", 105, 291, { align: "center" })
    doc.save("receipt-" + (payment.receipt_number || payment.paystack_reference || "payment") + ".pdf")
    toast.success("Receipt downloaded!")
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
  const isFinancialExec = user?.position && ["General Treasurer", "Assistant Treasurer", "General President", "Vice President"].includes(user.position)
  const totalPaid = payments.filter((p) => p.status === "success").reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const totalPending = payments.filter((p) => p.status === "pending").reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const failedPayments = payments.filter((p) => p.status === "failed")
  const totalDebt = failedPayments.reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const successfulPayments = payments.filter((p) => p.status === "success")
  const pendingPayments = payments.filter((p) => p.status === "pending")

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
            { label: "Outstanding", value: "NGN " + totalDebt.toLocaleString(), color: "red", icon: <FaExclamationTriangle /> },
            { label: "Transactions", value: payments.length, color: "blue", icon: <FaReceipt /> },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-3">
              <div className={"text-lg mb-1 " + (stat.color === "emerald" ? "text-emerald-400" : stat.color === "yellow" ? "text-yellow-400" : stat.color === "red" ? "text-red-400" : "text-blue-400")}>{stat.icon}</div>
              <p className={"text-lg font-bold " + (stat.color === "emerald" ? "text-emerald-400" : stat.color === "yellow" ? "text-yellow-400" : stat.color === "red" ? "text-red-400" : "text-blue-400")}>{stat.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Debt Banner */}
        {totalDebt > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex items-center gap-3">
            <FaExclamationTriangle className="text-red-400 flex-shrink-0" size={16} />
            <div className="flex-1 min-w-0">
              <p className="text-red-400 font-semibold text-xs">Outstanding Debt</p>
              <p className="text-gray-400 text-xs mt-0.5 truncate">NGN {totalDebt.toLocaleString()} in outstanding payments</p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all flex-shrink-0">Pay Now</button>
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
            <button onClick={() => { setSelectedPaymentRequest(String(req.id)); setShowCreateModal(true) }} className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-lg transition-all flex-shrink-0">Pay Now</button>
          </motion.div>
        ))}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {[
            { key: "overview", label: "All (" + payments.length + ")" },
            { key: "paid", label: "Paid (" + successfulPayments.length + ")" },
            { key: "pending", label: "Pending (" + pendingPayments.length + ")" },
            { key: "debt", label: "Debt (" + failedPayments.length + ")" },
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
              {activeTab === "overview" && (payments.length > 0 ? payments.map((payment, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-3 border border-gray-700">
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
                        <button onClick={() => downloadReceipt(payment)} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded-lg transition-all">
                          <FaDownload size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <FaMoneyBillWave className="text-gray-600 mx-auto mb-3" size={32} />
                  <p className="text-gray-500 text-sm">No transactions yet</p>
                </div>
              ))}

              {activeTab === "paid" && (successfulPayments.length > 0 ? successfulPayments.map((payment, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-3 border border-emerald-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <FaCheckCircle className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-white font-medium text-xs truncate">{payment.payment_request?.title || payment.paystack_reference}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{new Date(payment.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="text-emerald-400 font-semibold text-xs">NGN {parseFloat(payment.amount).toLocaleString()}</p>
                      <button onClick={() => downloadReceipt(payment)} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded-lg transition-all">
                        <FaDownload size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <FaCheckCircle className="text-gray-600 mx-auto mb-3" size={32} />
                  <p className="text-gray-500 text-sm">No successful payments yet</p>
                </div>
              ))}

              {activeTab === "pending" && (pendingPayments.length > 0 ? pendingPayments.map((payment, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-3 border border-yellow-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <FaClock className="text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-white font-medium text-xs truncate">{payment.payment_request?.title || payment.paystack_reference}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{new Date(payment.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <p className="text-yellow-400 font-semibold text-xs">NGN {parseFloat(payment.amount).toLocaleString()}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-400 border-yellow-500/30 mt-1">pending</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <FaClock className="text-gray-600 mx-auto mb-3" size={32} />
                  <p className="text-gray-500 text-sm">No pending payments</p>
                </div>
              ))}

              {activeTab === "debt" && (failedPayments.length > 0 ? (
                <>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3">
                    <p className="text-red-400 text-xs font-semibold">Total Outstanding: NGN {totalDebt.toLocaleString()}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Please clear your outstanding dues to remain in good standing</p>
                  </div>
                  {failedPayments.map((payment, i) => (
                    <div key={i} className="bg-gray-900 rounded-xl p-3 border border-red-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <FaTimesCircle className="text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-white font-medium text-xs truncate">{payment.payment_request?.title || payment.paystack_reference}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{new Date(payment.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <p className="text-red-400 font-semibold text-xs">NGN {parseFloat(payment.amount).toLocaleString()}</p>
                          <button onClick={() => setShowCreateModal(true)} className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-lg transition-all">Retry</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <FaCheckCircle className="text-emerald-500 mx-auto mb-3" size={32} />
                  <p className="text-gray-400 font-medium text-sm">No outstanding debts!</p>
                  <p className="text-gray-500 text-xs mt-1">You are up to date with all payments</p>
                </div>
              ))}
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
                  {requests.map((r) => (
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
                <p className="text-orange-400 text-xs">⚠️ Reactivating will notify all members and Village Presidents to make payment again.</p>
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
}