'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, type Member, type Transaction } from '@/lib/supabase'
import {
  Search,
  Upload,
  Send,
  History,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  CreditCard,
  ArrowRight,
  Smartphone,
  X,
  ImageIcon,
  Loader2,
  ShieldCheck,
  QrCode,
  ChevronUp,
  MessageCircle,
  Banknote,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Disetujui' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Ditolak' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Menunggu' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock, label: status }

  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

export default function MemberDashboard() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [amount, setAmount] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showQris, setShowQris] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'cash'>('qris')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load members
  useEffect(() => {
    async function fetchMembers() {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name')
      if (data) setMembers(data)
      if (error) setError('Gagal memuat data anggota')
      setLoading(false)
    }
    fetchMembers()
  }, [])

  // Load transactions when member selected
  useEffect(() => {
    if (!selectedMember) {
      setTransactions([])
      return
    }
    async function fetchTransactions() {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', selectedMember!.id)
        .order('created_at', { ascending: false })
      if (data) setTransactions(data)
    }
    fetchTransactions()
  }, [selectedMember, submitSuccess])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPaid = transactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0)

  const remaining = selectedMember ? selectedMember.total_price - totalPaid : 0
  const isLunas = selectedMember ? remaining <= 0 : false

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setProofFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setProofPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  function removeFile() {
    setProofFile(null)
    setProofPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember || !amount || !proofFile) {
      setError('Mohon lengkapi semua data dan upload bukti transfer')
      return
    }

    const amountNum = parseInt(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Jumlah pembayaran tidak valid')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Upload proof image
      const fileExt = proofFile.name.split('.').pop()
      const fileName = `${selectedMember.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, proofFile)

      if (uploadError) throw new Error('Gagal mengupload bukti: ' + uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      // Insert transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          member_id: selectedMember.id,
          amount: amountNum,
          proof_url: publicUrl,
          status: 'pending',
        })

      if (insertError) throw new Error('Gagal menyimpan transaksi: ' + insertError.message)

      // Send email notification to admin (fire-and-forget, non-blocking)
      try {
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberName: selectedMember.name,
            amount: amountNum,
            proofUrl: publicUrl,
          }),
        }).catch(() => { }) // Silently ignore email errors
      } catch { } // Silently ignore

      setSubmitSuccess(prev => !prev)
      setAmount('')
      setProofFile(null)
      setProofPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Show success briefly
      setError(null)
      const successEl = document.getElementById('success-toast')
      if (successEl) {
        successEl.classList.remove('hidden')
        setTimeout(() => successEl.classList.add('hidden'), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const quickAmounts = [5000, 10000, 15000, 20000, 30000, 50000, 80000, 100000, 160000]

  // Format number with dot separator: 160000 -> "160.000"
  function formatAmountDisplay(val: string): string {
    const num = val.replace(/\D/g, '')
    if (!num) return ''
    return Number(num).toLocaleString('id-ID')
  }

  // Handle amount input change - strip non-digits, store raw
  function handleAmountChange(val: string) {
    const raw = val.replace(/\D/g, '')
    setAmount(raw)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted text-sm">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-primary-dark tracking-tight">Cicilan PDH</h1>
            <p className="text-xs text-muted">KPPM GKJW Karangpilang</p>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors px-3 py-1.5 rounded-full hover:bg-green-50"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Success Toast */}
        <div
          id="success-toast"
          className="hidden fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg animate-slide-up flex items-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Pembayaran berhasil dikirim!</span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Member Selection */}
        <div className="animate-fade-in" ref={dropdownRef}>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Pilih Anggota
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between bg-white border border-border rounded-xl px-4 py-3.5 text-left hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              style={{ boxShadow: 'var(--shadow)' }}
            >
              <span className={selectedMember ? 'text-foreground font-medium' : 'text-muted'}>
                {selectedMember ? selectedMember.name : 'Cari nama anggota...'}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-xl overflow-hidden z-40 animate-fade-in"
                style={{ boxShadow: 'var(--shadow-lg)' }}
              >
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Cari nama..."
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-muted text-center py-4">Tidak ditemukan</p>
                  ) : (
                    filteredMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedMember(m)
                          setIsDropdownOpen(false)
                          setSearchQuery('')
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-green-50 transition-colors flex items-center justify-between ${selectedMember?.id === m.id ? 'bg-green-50 text-primary font-semibold' : ''
                          }`}
                      >
                        <span>{m.name}</span>
                        <span className="text-xs text-muted bg-gray-100 px-2 py-0.5 rounded-md">
                          {m.size}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Balance Card */}
        {selectedMember && (
          <div className="animate-slide-up">
            <div
              className="bg-gradient-to-br from-emerald-600 to-green-700 rounded-2xl p-5 text-white relative overflow-hidden"
              style={{ boxShadow: '0 8px 32px rgba(22, 163, 74, 0.3)' }}
            >
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-green-200 text-xs font-medium uppercase tracking-wider">Saldo Cicilan</p>
                    <h2 className="text-2xl font-bold mt-1">{selectedMember.name}</h2>
                  </div>
                  {isLunas && (
                    <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-white/30 animate-pulse-soft">
                      ✨ LUNAS
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                    <CreditCard className="w-4 h-4 mx-auto mb-1 text-green-200" />
                    <p className="text-green-200 text-[10px] uppercase tracking-wider mb-0.5">Total</p>
                    <p className="font-bold text-sm">{formatCurrency(selectedMember.total_price)}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                    <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-green-200" />
                    <p className="text-green-200 text-[10px] uppercase tracking-wider mb-0.5">Terbayar</p>
                    <p className="font-bold text-sm">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                    <Wallet className="w-4 h-4 mx-auto mb-1 text-green-200" />
                    <p className="text-green-200 text-[10px] uppercase tracking-wider mb-0.5">Sisa</p>
                    <p className="font-bold text-sm">{formatCurrency(Math.max(0, remaining))}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all duration-500"
                      style={{ width: `${Math.min(100, (totalPaid / selectedMember.total_price) * 100)}%` }}
                    />
                  </div>
                  <p className="text-right text-green-200 text-xs mt-1">
                    {Math.round(Math.min(100, (totalPaid / selectedMember.total_price) * 100))}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Method Selection & Forms */}
        {selectedMember && !isLunas && (
          <div className="animate-slide-up space-y-4">
            {/* Payment Method Tabs */}
            <div
              className="bg-white rounded-2xl p-1.5 flex gap-1"
              style={{ boxShadow: 'var(--shadow)' }}
            >
              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${paymentMethod === 'qris'
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md'
                  : 'text-muted hover:text-foreground hover:bg-gray-50'
                  }`}
              >
                <QrCode className="w-4 h-4" />
                QRIS
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${paymentMethod === 'cash'
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md'
                  : 'text-muted hover:text-foreground hover:bg-gray-50'
                  }`}
              >
                <Banknote className="w-4 h-4" />
                Cash
              </button>
            </div>

            {/* QRIS Flow */}
            {paymentMethod === 'qris' && (
              <>
                {/* QRIS Code */}
                <div
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: 'var(--shadow)' }}
                >
                  <button
                    type="button"
                    onClick={() => setShowQris(!showQris)}
                    className="w-full flex items-center justify-between p-4 hover:bg-green-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
                        <QrCode className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-bold text-foreground">Scan QRIS untuk Bayar</h3>
                        <p className="text-xs text-muted">Waroeng Dans • Tap untuk buka QR</p>
                      </div>
                    </div>
                    {showQris ? (
                      <ChevronUp className="w-4 h-4 text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted" />
                    )}
                  </button>

                  {showQris && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center">
                        <div className="w-full max-w-[280px] aspect-square relative rounded-lg overflow-hidden border-2 border-gray-200 bg-white">
                          <Image
                            src="/qris.jpg"
                            alt="QRIS Waroeng Dans"
                            fill
                            className="object-contain p-2"
                            priority
                          />
                        </div>
                        <div className="mt-3 text-center">
                          <p className="text-xs font-semibold text-foreground">Waroeng Dans</p>
                          <p className="text-[10px] text-muted mt-0.5">NMID: ID1024321074139</p>
                        </div>
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-full">
                          <p className="text-[11px] text-amber-800 text-center">
                            💡 Scan QRIS di atas, lalu screenshot bukti transfernya dan upload di bawah
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* QRIS Payment Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div
                    className="bg-white rounded-2xl p-5 space-y-4"
                    style={{ boxShadow: 'var(--shadow)' }}
                  >
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Send className="w-4 h-4 text-primary" />
                      Upload Bukti Transfer
                    </h3>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1.5">Jumlah Pembayaran</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatAmountDisplay(amount)}
                          onChange={e => handleAmountChange(e.target.value)}
                          placeholder="0"
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-border rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                      </div>

                      {/* Quick amount chips */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {quickAmounts.map(q => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setAmount(q.toString())}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${amount === q.toString()
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-gray-100 text-muted hover:bg-green-50 hover:text-primary'
                              }`}
                          >
                            {formatCurrency(q)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1.5">Bukti Transfer</label>
                      {!proofPreview ? (
                        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-green-50/50 transition-all">
                          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                            <Upload className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Upload foto bukti transfer</p>
                            <p className="text-xs text-muted mt-0.5">JPG, PNG atau HEIC • Maks 5MB</p>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="relative rounded-xl overflow-hidden border border-border">
                          <img src={proofPreview} alt="Preview" className="w-full h-48 object-cover" />
                          <button
                            type="button"
                            onClick={removeFile}
                            className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/70 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
                            <p className="text-white text-xs flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {proofFile?.name}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isSubmitting || !amount || !proofFile}
                      className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold py-3.5 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Mengirim...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Kirim Pembayaran
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Cash Flow */}
            {paymentMethod === 'cash' && (
              <div
                className="bg-white rounded-2xl p-5 space-y-4"
                style={{ boxShadow: 'var(--shadow)' }}
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-50 rounded-full mx-auto flex items-center justify-center mb-3">
                    <Banknote className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Pembayaran Cash</h3>
                  <p className="text-sm text-muted mt-1">Hubungi bendahara untuk bayar langsung</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-lg">👤</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Bima</p>
                      <p className="text-xs text-muted">Bendahara KPPM</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">No. WhatsApp</span>
                      <span className="font-medium text-foreground">0858-5366-9568</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Sisa yang harus dibayar</span>
                      <span className="font-bold text-primary">{formatCurrency(Math.max(0, remaining))}</span>
                    </div>
                  </div>
                </div>

                <a
                  href="https://wa.me/6285853669568"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3.5 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat via WhatsApp
                </a>

                <p className="text-[11px] text-muted text-center">
                  Setelah membayar cash, bendahara akan mencatat pembayaranmu di sistem.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Payment History */}
        {selectedMember && transactions.length > 0 && (
          <div className="animate-slide-up">
            <div
              className="bg-white rounded-2xl p-5"
              style={{ boxShadow: 'var(--shadow)' }}
            >
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-primary" />
                Riwayat Pembayaran
              </h3>

              <div className="space-y-3">
                {transactions.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-green-50/50 transition-colors"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{formatCurrency(t.amount)}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-xs text-muted">{formatDate(t.created_at)}</p>
                    </div>
                    {t.proof_url && (
                      <a
                        href={t.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                      >
                        <img src={t.proof_url} alt="Bukti" className="w-full h-full object-cover" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no member selected */}
        {!selectedMember && (
          <div className="animate-fade-in text-center py-16">
            <div className="w-20 h-20 bg-green-50 rounded-full mx-auto flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Selamat Datang!</h2>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Pilih nama anggota di atas untuk melihat saldo cicilan dan melakukan pembayaran.
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center pb-6 pt-4">
          <p className="text-xs text-muted">
            © 2026 KPPM GKJW Karangpilang
          </p>
        </footer>
      </main>
    </div>
  )
}
