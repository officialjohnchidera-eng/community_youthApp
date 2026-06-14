import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaBell, FaCheckCircle, FaMoneyBillWave, FaCalendarAlt, FaBullhorn, FaTrash } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => { fetchNotifications() }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications/my-notifications/")
      setNotifications(res.data)
    } catch (error) {
      console.log("Notifications fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (error) {
      console.log("Mark read error:", error)
    }
  }

  const markAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read/")
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success("All notifications marked as read!")
    } catch (error) {
      toast.error("Failed to mark all as read")
    }
  }

  const getIcon = (type) => {
    if (type === "payment") return <FaMoneyBillWave className="text-emerald-400" />
    if (type === "meeting") return <FaCalendarAlt className="text-blue-400" />
    if (type === "announcement") return <FaBullhorn className="text-purple-400" />
    return <FaBell className="text-yellow-400" />
  }

  const getColor = (type) => {
    if (type === "payment") return "bg-emerald-500/10 border-emerald-500/30"
    if (type === "meeting") return "bg-blue-500/10 border-blue-500/30"
    if (type === "announcement") return "bg-purple-500/10 border-purple-500/30"
    return "bg-yellow-500/10 border-yellow-500/30"
  }

  const unread = notifications.filter(n => !n.is_read)
  const read = notifications.filter(n => n.is_read)
  const filtered = activeTab === "all" ? notifications : activeTab === "unread" ? unread : read

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-gray-400 text-sm mt-1">Your personal activity feed</p>
          </div>
          {unread.length > 0 && (
            <button onClick={markAllRead} className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
              <FaCheckCircle size={12} />
              Mark All Read
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: notifications.length, color: "emerald" },
            { label: "Unread", value: unread.length, color: "yellow" },
            { label: "Read", value: read.length, color: "blue" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color === "emerald" ? "text-emerald-400" : stat.color === "yellow" ? "text-yellow-400" : "text-blue-400"}`}>{stat.value}</p>
              <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {[
            { key: "all", label: `All (${notifications.length})` },
            { key: "unread", label: `Unread (${unread.length})` },
            { key: "read", label: `Read (${read.length})` },
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
          <div className="space-y-3">
            {filtered.map((notif, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`bg-gray-800 border rounded-2xl p-4 transition-all cursor-pointer ${notif.is_read ? "border-gray-700 opacity-70" : "border-emerald-500/30 hover:border-emerald-500/50"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${getColor(notif.notification_type)}`}>
                    {getIcon(notif.notification_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`font-semibold text-sm ${notif.is_read ? "text-gray-400" : "text-white"}`}>{notif.title}</p>
                      {!notif.is_read && <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0"></div>}
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{notif.message}</p>
                    <p className="text-gray-600 text-xs mt-2">{new Date(notif.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaBell className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No notifications yet</p>
            <p className="text-gray-500 text-sm mt-1">You will be notified about payments, meetings and announcements</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
