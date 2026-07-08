import { useState } from "react"
import { FaSearch, FaCheckCircle, FaExclamationTriangle, FaUserShield, FaSave } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function ClearancePage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [unitCleared, setUnitCleared] = useState(false)
  const [unitNote, setUnitNote] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) {
      toast.error("Enter a User ID or email")
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await api.get(`/payments/clearance/${encodeURIComponent(query.trim())}/`)
      setResult(res.data)
      setUnitCleared(res.data.primary_unit_clearance?.is_cleared || false)
      setUnitNote(res.data.primary_unit_clearance?.note || "")
    } catch (error) {
      const msg = error.response?.data?.error || "Member not found"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveUnitClearance = async () => {
    if (!result) return
    setSaving(true)
    try {
      const res = await api.post(`/payments/clearance/${encodeURIComponent(query.trim())}/set/`, {
        is_cleared: unitCleared,
        note: unitNote,
      })
      toast.success("Primary unit clearance updated")
      setResult({
        ...result,
        primary_unit_clearance: {
          is_cleared: res.data.is_cleared,
          note: res.data.note,
          confirmed_by: res.data.confirmed_by,
          updated_at: res.data.updated_at,
        },
      })
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FaUserShield className="text-emerald-400" /> Member Clearance
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Check a member's central-body standing before extending an event invitation
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter User ID (e.g. UMY0042) or email"
            className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white px-5 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FaSearch size={12} />
            )}
            Search
          </button>
        </form>

        {result && (
          <>
            {/* Member Profile Summary */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold text-lg">{result.member.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{result.member.user_id} · {result.member.email}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {result.member.village} · {result.member.position}
                  </p>
                </div>
                <span className={
                  "text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap " +
                  (result.member.account_status === "approved"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30")
                }>
                  {result.member.account_status}
                </span>
              </div>
            </div>

            {/* Central Standing Summary */}
            <div className={
              "border rounded-2xl p-4 " +
              (result.central_standing.is_cleared
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-red-500/10 border-red-500/30")
            }>
              <div className="flex items-center gap-3">
                {result.central_standing.is_cleared ? (
                  <FaCheckCircle className="text-emerald-400 flex-shrink-0" size={24} />
                ) : (
                  <FaExclamationTriangle className="text-red-400 flex-shrink-0" size={24} />
                )}
                <div>
                  <p className={"font-bold text-sm " + (result.central_standing.is_cleared ? "text-emerald-400" : "text-red-400")}>
                    {result.central_standing.is_cleared
                      ? "Cleared — Central Body"
                      : `Owing NGN ${result.central_standing.total_owing.toLocaleString()} across ${result.central_standing.outstanding_count} item(s)`}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Based on event contributions and fines only. Dues/levy are village-level and not reflected here.
                  </p>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">Event & Fine History</h3>
              {result.history.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No event or fine requests recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {result.history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 bg-gray-900 rounded-xl p-3">
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate">{item.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {item.payment_type.replace(/_/g, " ").toUpperCase()} · NGN {parseFloat(item.amount).toLocaleString()}
                          {item.deadline && ` · ${new Date(item.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                      <span className={
                        "text-xs px-2 py-1 rounded-full border flex-shrink-0 " +
                        (item.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-400 border-red-500/30")
                      }>
                        {item.status === "paid" ? "Paid" : "Missed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Unit Clearance (manual) */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
              <h3 className="text-white font-semibold text-sm mb-1">Primary Unit Clearance</h3>
              <p className="text-gray-400 text-xs mb-3">
                Manually recorded after verbal or evidence-based confirmation with the member's primary village unit.
                This is not tracked automatically by the app.
              </p>

              {result.primary_unit_clearance && (
                <p className="text-gray-500 text-xs mb-3">
                  Last updated by {result.primary_unit_clearance.confirmed_by || "N/A"} on{" "}
                  {result.primary_unit_clearance.updated_at
                    ? new Date(result.primary_unit_clearance.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "N/A"}
                </p>
              )}

              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setUnitCleared(true)}
                  className={
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all " +
                    (unitCleared
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-gray-900 text-gray-400 border-gray-700 hover:border-emerald-500/50")
                  }
                >
                  Cleared with Unit
                </button>
                <button
                  type="button"
                  onClick={() => setUnitCleared(false)}
                  className={
                    "flex-1 py-2 rounded-xl text-xs font-medium border transition-all " +
                    (!unitCleared
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-gray-900 text-gray-400 border-gray-700 hover:border-red-500/50")
                  }
                >
                  Not Cleared
                </button>
              </div>

              <textarea
                value={unitNote}
                onChange={(e) => setUnitNote(e.target.value)}
                placeholder="Note (e.g. confirmed verbally with Village Youth President on ...)"
                rows={2}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500 mb-3"
              />

              <button
                onClick={handleSaveUnitClearance}
                disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FaSave size={12} />
                )}
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
