import { useState } from 'react'
import { motion } from 'framer-motion'
import { FaSearch, FaCheckCircle, FaTimesCircle, FaReceipt, FaUser, FaMoneyBillWave, FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'

export default function ReceiptVerificationPage() {
  const [receiptNumber, setReceiptNumber] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!receiptNumber.trim()) return
    setLoading(true)
    setSearched(false)
    try {
      const res = await api.get(`/payments/verify-receipt/${receiptNumber.trim().toUpperCase()}/`)
      setResult(res.data)
    } catch (error) {
      setResult({ valid: false, message: 'Receipt not found or payment was not successful.' })
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Receipt Verification</h1>
          <p className="text-gray-400 text-xs mt-0.5">Verify the authenticity of any payment receipt</p>
        </div>

        {/* Search Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <FaReceipt className="text-emerald-400" size={16} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Enter Receipt Number</p>
              <p className="text-gray-400 text-xs">Format: RCP-XXXXXXXX</p>
            </div>
          </div>
          <form onSubmit={handleVerify} className="flex gap-2">
            <input
              type="text"
              value={receiptNumber}
              onChange={e => setReceiptNumber(e.target.value.toUpperCase())}
              placeholder="e.g. RCP-A1B2C3D4"
              className="flex-1 bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500 uppercase"
            />
            <button
              type="submit"
              disabled={loading || !receiptNumber.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white px-4 py-3 rounded-xl transition-all flex items-center gap-2 flex-shrink-0"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FaSearch size={14} />
              )}
            </button>
          </form>
        </motion.div>

        {/* Result */}
        {searched && result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`border rounded-2xl p-5 ${result.valid ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}`}>

            {result.valid ? (
              <>
                {/* Valid Receipt */}
                <div className="flex items-center gap-3 mb-4">
                  <FaCheckCircle className="text-emerald-400 flex-shrink-0" size={24} />
                  <div>
                    <p className="text-emerald-400 font-bold">Valid Receipt</p>
                    <p className="text-gray-400 text-xs">This receipt is authentic and verified</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: <FaReceipt size={12} />, label: 'Receipt Number', value: result.receipt_number },
                    { icon: <FaUser size={12} />, label: 'Member Name', value: result.member },
                    { icon: <FaUser size={12} />, label: 'Member ID', value: result.member_id },
                    { icon: <FaMoneyBillWave size={12} />, label: 'Payment For', value: result.payment_for },
                    { icon: <FaMoneyBillWave size={12} />, label: 'Payment Type', value: result.payment_type },
                    { icon: <FaMoneyBillWave size={12} />, label: 'Amount Paid', value: `NGN ${parseFloat(result.amount).toLocaleString()}` },
                    { icon: <FaMapMarkerAlt size={12} />, label: 'Village', value: result.village },
                    { icon: <FaCalendarAlt size={12} />, label: 'Date Paid', value: result.paid_at ? new Date(result.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A' },
                    { icon: <FaReceipt size={12} />, label: 'Paystack Reference', value: result.paystack_reference },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3">
                      <div className="text-emerald-400 flex-shrink-0">{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-500 text-xs">{item.label}</p>
                        <p className="text-white text-sm font-medium truncate">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Invalid Receipt */}
                <div className="flex items-center gap-3">
                  <FaTimesCircle className="text-red-400 flex-shrink-0" size={24} />
                  <div>
                    <p className="text-red-400 font-bold">Invalid Receipt</p>
                    <p className="text-gray-400 text-xs mt-0.5">{result.message}</p>
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-4">
                  <p className="text-red-300 text-xs">This receipt number does not match any successful payment in our system. It may be forged, incorrect, or the payment may not have been completed.</p>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Info Card */}
        {!searched && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
            <p className="text-gray-400 text-xs font-medium mb-2">How receipt verification works:</p>
            <ul className="space-y-1.5">
              {[
                'Enter the receipt number found on your payment PDF',
                'The system checks against our secure payment records',
                'Valid receipts show full payment details instantly',
                'Invalid receipts are flagged as potentially forged'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5">•</span>
                  <span className="text-gray-500 text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}