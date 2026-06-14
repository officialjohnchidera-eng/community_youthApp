import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaChartBar, FaMoneyBillWave, FaUsers, FaCalendarAlt } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [meetings, setMeetings] = useState([])
  const [villageStatus, setVillageStatus] = useState([])
  const [paymentRequests, setPaymentRequests] = useState([])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [memRes, payRes, meetRes, reqRes] = await Promise.all([
        api.get("/accounts/members/"),
        api.get("/payments/history/"),
        api.get("/events/meetings/"),
        api.get("/payments/requests/"),
      ])
      setMembers(memRes.data)
      setPayments(payRes.data)
      setMeetings(meetRes.data)
      setPaymentRequests(reqRes.data)

      if (reqRes.data.length > 0) {
        const latestRequest = reqRes.data[0]
        const statusRes = await api.get(`/payments/village-status/?payment_request_id=${latestRequest.id}`)
        setVillageStatus(statusRes.data)
      }
    } catch (error) {
      console.log("Reports fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const approved = members.filter(m => m.account_status === "approved")
  const pending = members.filter(m => m.account_status === "pending")
  const successPayments = payments.filter(p => p.status === "success")
  const totalRevenue = successPayments.reduce((a, b) => a + parseFloat(b.amount || 0), 0)
  const upcomingMeetings = meetings.filter(m => m.status === "upcoming")

  const villageData = members.reduce((acc, m) => {
    const name = m.village?.name || "Unknown"
    const existing = acc.find(a => a.name === name)
    if (existing) existing.value++
    else acc.push({ name, value: 1 })
    return acc
  }, [])

  const paymentChartData = [
    { name: "Success", value: successPayments.length, color: "#10b981" },
    { name: "Pending", value: payments.filter(p => p.status === "pending").length, color: "#f59e0b" },
    { name: "Failed", value: payments.filter(p => p.status === "failed").length, color: "#ef4444" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-gray-400 text-sm mt-1">Association analytics and insights</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Members", value: members.length, sub: `${approved.length} approved`, color: "emerald", icon: <FaUsers /> },
                { label: "Total Revenue", value: `NGN ${totalRevenue.toLocaleString()}`, sub: `${successPayments.length} transactions`, color: "blue", icon: <FaMoneyBillWave /> },
                { label: "Total Meetings", value: meetings.length, sub: `${upcomingMeetings.length} upcoming`, color: "purple", icon: <FaCalendarAlt /> },
                { label: "Pending Members", value: pending.length, sub: "awaiting approval", color: "yellow", icon: <FaUsers /> },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                  <div className={`text-xl mb-2 ${stat.color === "emerald" ? "text-emerald-400" : stat.color === "blue" ? "text-blue-400" : stat.color === "purple" ? "text-purple-400" : "text-yellow-400"}`}>{stat.icon}</div>
                  <p className={`text-xl font-bold ${stat.color === "emerald" ? "text-emerald-400" : stat.color === "blue" ? "text-blue-400" : stat.color === "purple" ? "text-purple-400" : "text-yellow-400"}`}>{stat.value}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
                  <p className="text-gray-600 text-xs">{stat.sub}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Payment Status Breakdown</h3>
                {payments.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={paymentChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {paymentChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} labelStyle={{ color: "#f9fafb" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2">
                      {paymentChartData.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-gray-400 text-xs">{item.name} ({item.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-500">No payment data yet</div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Members by Village</h3>
                {villageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={villageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 10 }} />
                      <YAxis stroke="#6b7280" tick={{ fill: "#6b7280", fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "12px" }} labelStyle={{ color: "#f9fafb" }} itemStyle={{ color: "#10b981" }} />
                      <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-500">No member data yet</div>
                )}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Member Status Summary</h3>
              <div className="space-y-3">
                {[
                  { label: "Approved Members", value: approved.length, total: members.length, color: "emerald" },
                  { label: "Pending Members", value: pending.length, total: members.length, color: "yellow" },
                  { label: "Successful Payments", value: successPayments.length, total: payments.length, color: "blue" },
                  { label: "Upcoming Meetings", value: upcomingMeetings.length, total: meetings.length, color: "purple" },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 text-sm">{item.label}</span>
                      <span className="text-gray-400 text-xs">{item.value} / {item.total}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: item.total > 0 ? `${(item.value / item.total) * 100}%` : "0%" }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full rounded-full ${item.color === "emerald" ? "bg-emerald-500" : item.color === "yellow" ? "bg-yellow-500" : item.color === "blue" ? "bg-blue-500" : "bg-purple-500"}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Village Payment Compliance</h3>
                {paymentRequests.length > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-700 px-3 py-1 rounded-full">
                    {paymentRequests[0]?.title}
                  </span>
                )}
              </div>
              {villageStatus.length > 0 ? (
                <div className="space-y-3">
                  {villageStatus.map((v, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-900 rounded-xl p-4 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${v.status === "paid" ? "bg-emerald-400" : "bg-red-400"}`}></div>
                        <div>
                          <p className="text-white font-medium text-sm">{v.village}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {v.paid_by ? `Paid by ${v.paid_by}` : "No payment yet"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium border ${v.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                          {v.status === "paid" ? "✓ Paid" : "✗ Unpaid"}
                        </span>
                        {v.paid_at && (
                          <p className="text-gray-500 text-xs mt-1">
                            {new Date(v.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
                    <span className="text-gray-400 text-sm">Compliance Rate</span>
                    <span className="text-emerald-400 font-semibold text-sm">
                      {villageStatus.filter(v => v.status === "paid").length} / {villageStatus.length} Villages
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No active payment requests</div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

