'use client'

import { useState, useEffect } from 'react'
import { supabase, type Member, type Transaction, type MemberWithPayments } from '@/lib/supabase'
import {
    Users,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    TrendingUp,
    Sparkles,
    Shirt,
    Coins,
    Calendar,
} from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

type TransactionWithMember = Transaction & {
    members: { name: string; size: string }
}

export default function PublicRecapPage() {
    const [members, setMembers] = useState<MemberWithPayments[]>([])
    const [recentTransactions, setRecentTransactions] = useState<TransactionWithMember[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'semua' | 'lunas' | 'belum_lunas' | 'belum_bayar'>('semua')
    const [sortBy, setSortBy] = useState<'name' | 'paid_desc' | 'remaining_desc'>('name')
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    // Fetch data from Supabase
    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // Fetch all members
                const { data: memberData, error: memberError } = await supabase
                    .from('members')
                    .select('*')
                    .order('name')

                if (memberError) throw memberError

                // Fetch all transactions
                const { data: txData, error: txError } = await supabase
                    .from('transactions')
                    .select('*, members(name, size)')
                    .order('created_at', { ascending: false })

                if (txError) throw txError

                // Filter to approved transactions to calculate payment summaries
                const approvedTransactions = txData?.filter(t => t.status === 'approved') || []
                const paidMap = new Map<string, number>()
                approvedTransactions.forEach(t => {
                    paidMap.set(t.member_id, (paidMap.get(t.member_id) || 0) + t.amount)
                })

                const enriched: MemberWithPayments[] = (memberData || []).map(m => {
                    const totalPaid = paidMap.get(m.id) || 0
                    const remaining = m.total_price - totalPaid
                    return {
                        ...m,
                        total_paid: totalPaid,
                        remaining: Math.max(0, remaining),
                        is_lunas: remaining <= 0,
                    }
                })

                setMembers(enriched)

                // Get 10 most recent transactions (approved or pending)
                const limitTx = txData ? txData.slice(0, 10) as TransactionWithMember[] : []
                setRecentTransactions(limitTx)
                setLastUpdated(new Date())
            } catch (err) {
                console.error('Error fetching data:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [refreshKey])

    // Calculate overall stats
    const totalMembers = members.length
    const lunasCount = members.filter(m => m.is_lunas).length
    const totalCollected = members.reduce((sum, m) => sum + m.total_paid, 0)
    const totalTarget = members.reduce((sum, m) => sum + m.total_price, 0)
    const totalPending = recentTransactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0)

    const remainingCollected = totalTarget - totalCollected
    const completionRate = totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0

    // Size recap
    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
    const sizeCount: Record<string, number> = {}
    members.forEach(m => {
        sizeCount[m.size] = (sizeCount[m.size] || 0) + 1
    })
    const sizeRecap = sizeOrder
        .filter(size => sizeCount[size])
        .map(size => ({ size, count: sizeCount[size] }))

    // Filter and Sort members list
    const filteredMembers = members
        .filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesStatus =
                statusFilter === 'semua'
                    ? true
                    : statusFilter === 'lunas'
                    ? m.is_lunas
                    : statusFilter === 'belum_lunas'
                    ? !m.is_lunas && m.total_paid > 0
                    : m.total_paid === 0 // belum_bayar

            return matchesSearch && matchesStatus
        })
        .sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name)
            } else if (sortBy === 'paid_desc') {
                return b.total_paid - a.total_paid
            } else {
                return b.remaining - a.remaining
            }
        })

    // Export to Excel
    function handleExportExcel() {
        const wb = XLSX.utils.book_new()

        const memberRows = members.map((m, i) => ({
            'No': i + 1,
            'Nama': m.name,
            'Ukuran': m.size,
            'Total Tagihan': m.total_price,
            'Terbayar': m.total_paid,
            'Sisa': m.remaining,
            'Status': m.is_lunas ? 'LUNAS' : (m.total_paid > 0 ? 'Mencicil' : 'Belum Bayar'),
        }))
        const ws1 = XLSX.utils.json_to_sheet(memberRows)
        ws1['!cols'] = [
            { wch: 5 },   // No
            { wch: 25 },  // Nama
            { wch: 10 },  // Ukuran
            { wch: 15 },  // Total Tagihan
            { wch: 15 },  // Terbayar
            { wch: 15 },  // Sisa
            { wch: 15 },  // Status
        ]
        XLSX.utils.book_append_sheet(wb, ws1, 'Daftar Anggota')

        const recapRows = sizeRecap.map(r => ({
            'Ukuran': r.size,
            'Jumlah': r.count,
        }))
        recapRows.push({ 'Ukuran': 'TOTAL KAOS', 'Jumlah': members.length })
        const ws2 = XLSX.utils.json_to_sheet(recapRows)
        ws2['!cols'] = [
            { wch: 12 },
            { wch: 10 },
        ]
        XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Ukuran')

        XLSX.writeFile(wb, `Rekap_Pembayaran_PDH_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    // Export to PDF
    function handleExportPDF() {
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()

        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('Rekapitulasi Pembayaran PDH', pageWidth / 2, 20, { align: 'center' })
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('KPPM GKJW Karangpilang', pageWidth / 2, 26, { align: 'center' })
        doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, 32, { align: 'center' })

        // Stats Summary
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('RANGKUMAN KEUANGAN:', 14, 42)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`• Total Anggota: ${totalMembers} Orang`, 14, 48)
        doc.text(`• Lunas: ${lunasCount} Orang (${totalMembers > 0 ? Math.round((lunasCount/totalMembers)*100) : 0}%)`, 14, 53)
        doc.text(`• Total Uang Masuk: ${formatCurrency(totalCollected)}`, 90, 48)
        doc.text(`• Total Sisa Tagihan: ${formatCurrency(remainingCollected)}`, 90, 53)

        // Line separator
        doc.setLineWidth(0.2)
        doc.line(14, 58, pageWidth - 14, 58)

        // Table 1: Daftar Anggota
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('Detail Status Pembayaran Anggota', 14, 65)

        const memberTableBody = members.map((m, i) => [
            (i + 1).toString(),
            m.name,
            m.size,
            formatCurrency(m.total_price),
            formatCurrency(m.total_paid),
            formatCurrency(m.remaining),
            m.is_lunas ? 'LUNAS' : (m.total_paid > 0 ? 'Mencicil' : 'Belum Bayar'),
        ])

        autoTable(doc, {
            startY: 69,
            head: [['No', 'Nama', 'Ukuran', 'Tagihan', 'Terbayar', 'Sisa', 'Status']],
            body: memberTableBody,
            headStyles: {
                fillColor: [22, 163, 74],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { cellWidth: 42 },
                2: { halign: 'center', cellWidth: 16 },
                3: { halign: 'right', cellWidth: 26 },
                4: { halign: 'right', cellWidth: 26 },
                5: { halign: 'right', cellWidth: 26 },
                6: { halign: 'center', cellWidth: 26 },
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 2.5,
            },
            alternateRowStyles: {
                fillColor: [240, 253, 244],
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 6) {
                    if (data.cell.raw === 'LUNAS') {
                        data.cell.styles.textColor = [22, 163, 74]
                        data.cell.styles.fontStyle = 'bold'
                    } else if (data.cell.raw === 'Mencicil') {
                        data.cell.styles.textColor = [245, 158, 11]
                    } else {
                        data.cell.styles.textColor = [220, 38, 38]
                    }
                }
            },
        })

        // Table 2: Rekap Ukuran
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastTableY = (doc as any).lastAutoTable?.finalY || 100
        const recapStartY = lastTableY + 12

        // Check if fits on page, else create new page
        if (recapStartY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage()
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('Rekapitulasi Ukuran Kaos', 14, 20)

            const recapBody = sizeRecap.map(r => [r.size, r.count.toString()])
            recapBody.push(['TOTAL KAOS', members.length.toString()])

            autoTable(doc, {
                startY: 24,
                head: [['Ukuran', 'Jumlah Pesanan']],
                body: recapBody,
                headStyles: {
                    fillColor: [22, 163, 74],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 25 },
                    1: { halign: 'center', cellWidth: 25 },
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3.5,
                },
                alternateRowStyles: {
                    fillColor: [240, 253, 244],
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.row.index === sizeRecap.length) {
                        data.cell.styles.fontStyle = 'bold'
                        data.cell.styles.fillColor = [220, 252, 231]
                    }
                },
                tableWidth: 50,
            })
        } else {
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text('Rekapitulasi Ukuran Kaos', 14, recapStartY)

            const recapBody = sizeRecap.map(r => [r.size, r.count.toString()])
            recapBody.push(['TOTAL KAOS', members.length.toString()])

            autoTable(doc, {
                startY: recapStartY + 4,
                head: [['Ukuran', 'Jumlah Pesanan']],
                body: recapBody,
                headStyles: {
                    fillColor: [22, 163, 74],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 25 },
                    1: { halign: 'center', cellWidth: 25 },
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3.5,
                },
                alternateRowStyles: {
                    fillColor: [240, 253, 244],
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.row.index === sizeRecap.length) {
                        data.cell.styles.fontStyle = 'bold'
                        data.cell.styles.fillColor = [220, 252, 231]
                    }
                },
                tableWidth: 50,
            })
        }

        doc.save(`Rekap_Ukuran_PDH_${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-green-100/50 pb-16">
            {/* Top Premium Navbar */}
            <header className="sticky top-0 z-40 w-full glass border-b border-green-100/50 px-4 py-3 sm:px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 hover:bg-green-100/50 rounded-full transition-colors group">
                            <ArrowLeft className="w-5 h-5 text-green-700 group-hover:-translate-x-0.5 transition-transform" />
                        </Link>
                        <div>
                            <span className="text-[10px] font-bold text-green-600 tracking-wider uppercase">KPPM GKJW KARANGPILANG</span>
                            <h1 className="text-base sm:text-lg font-extrabold text-green-950 flex items-center gap-1.5 leading-tight">
                                Rekap Cicilan PDH
                                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse-soft" />
                            </h1>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-green-100 text-green-800 hover:bg-green-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-green-600 ${loading ? 'animate-spin' : ''}`} />
                        <span>Update Data</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 mt-6 sm:px-6">
                {/* Visual Banner */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-700 via-emerald-700 to-emerald-800 text-white p-6 sm:p-8 shadow-xl animate-fade-in mb-6">
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-green-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/3 translate-y-12 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <span className="bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-3">
                                Laporan Ketua KPPM
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Pantau Keuangan PDH</h2>
                            <p className="text-emerald-100 text-sm mt-1.5 max-w-xl">
                                Laporan keuangan pembayaran PDH secara real-time dan terbuka. Tidak perlu login untuk memudahkan akses berkala.
                            </p>
                            {lastUpdated && (
                                <p className="text-[11px] text-emerald-200/80 mt-4 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Terakhir diperbarui: {formatDate(lastUpdated.toISOString())}
                                </p>
                            )}
                        </div>

                        {/* Ring progress */}
                        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shrink-0 self-start md:self-auto">
                            <div className="relative w-16 h-16 flex items-center justify-center">
                                {/* Outer SVG ring */}
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="32"
                                        cy="32"
                                        r="28"
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth="5"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="32"
                                        cy="32"
                                        r="28"
                                        stroke="#10b981"
                                        strokeWidth="5"
                                        fill="transparent"
                                        strokeDasharray={175.9}
                                        strokeDashoffset={175.9 - (175.9 * Math.min(100, completionRate)) / 100}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <span className="absolute text-sm font-black text-white">{Math.round(completionRate)}%</span>
                            </div>
                            <div>
                                <div className="text-xs text-emerald-200 font-medium">Uang Terkumpul</div>
                                <div className="text-lg font-black text-white">{formatCurrency(totalCollected)}</div>
                                <div className="text-[11px] text-emerald-300">Target: {formatCurrency(totalTarget)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                        <p className="text-green-800 text-sm font-semibold animate-pulse-soft">Memuat laporan PDH...</p>
                    </div>
                )}

                {!loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
                        {/* Left Side: Stats and Size Recap */}
                        <div className="space-y-6 lg:col-span-1">
                            {/* Detailed Stats Card */}
                            <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm space-y-4">
                                <h3 className="font-extrabold text-green-950 text-sm tracking-wide uppercase flex items-center gap-1.5">
                                    <Coins className="w-4.5 h-4.5 text-green-600" />
                                    Statistik Pembayaran
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-xl border border-green-100/30">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                <Users className="w-4 h-4 text-green-700" />
                                            </div>
                                            <span className="text-xs font-semibold text-green-900">Total Anggota</span>
                                        </div>
                                        <span className="text-sm font-extrabold text-green-950">{totalMembers} Orang</span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/30">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                            </div>
                                            <span className="text-xs font-semibold text-green-900">Lunas</span>
                                        </div>
                                        <span className="text-sm font-extrabold text-green-950">
                                            {lunasCount} <span className="text-[11px] font-normal text-muted">/ {totalMembers}</span>
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100/30">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                                <Clock className="w-4 h-4 text-amber-700" />
                                            </div>
                                            <span className="text-xs font-semibold text-green-900">Pending (Menunggu)</span>
                                        </div>
                                        <span className="text-sm font-extrabold text-amber-800">{formatCurrency(totalPending)}</span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-red-50/30 rounded-xl border border-red-100/20">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                                <TrendingUp className="w-4 h-4 text-red-700" />
                                            </div>
                                            <span className="text-xs font-semibold text-green-900">Sisa Piutang</span>
                                        </div>
                                        <span className="text-sm font-extrabold text-red-600">{formatCurrency(remainingCollected)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Size Breakdown Card */}
                            <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm">
                                <h3 className="font-extrabold text-green-950 text-sm tracking-wide uppercase flex items-center gap-1.5 mb-4">
                                    <Shirt className="w-4.5 h-4.5 text-green-600" />
                                    Rekapitulasi Ukuran Kaos
                                </h3>

                                <div className="space-y-3">
                                    {sizeRecap.length === 0 ? (
                                        <p className="text-xs text-muted text-center py-4">Belum ada data ukuran</p>
                                    ) : (
                                        sizeRecap.map(r => {
                                            const pct = totalMembers > 0 ? (r.count / totalMembers) * 100 : 0
                                            return (
                                                <div key={r.size} className="space-y-1">
                                                    <div className="flex justify-between text-xs font-semibold text-green-900">
                                                        <span>Ukuran {r.size}</span>
                                                        <span>{r.count} Kaos ({Math.round(pct)}%)</span>
                                                    </div>
                                                    <div className="w-full bg-green-50 rounded-full h-2">
                                                        <div
                                                            className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    <div className="pt-2 border-t border-green-50 flex justify-between items-center text-xs font-bold text-green-950">
                                        <span>Total Pesanan Kaos</span>
                                        <span>{totalMembers} Pcs</span>
                                    </div>
                                </div>
                            </div>

                            {/* Export Buttons */}
                            <div className="bg-white rounded-2xl border border-green-100 p-4 shadow-sm flex flex-col gap-2.5">
                                <h4 className="text-xs font-bold text-green-900 uppercase tracking-wide">Ekspor Data Rekap</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleExportExcel}
                                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-semibold hover:bg-emerald-100 active:scale-98 transition-all pointer-events-auto cursor-pointer"
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                        <span>Excel (.xlsx)</span>
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-red-50 text-red-800 border border-red-100 text-xs font-semibold hover:bg-red-100 active:scale-98 transition-all pointer-events-auto cursor-pointer"
                                    >
                                        <FileText className="w-4 h-4 text-red-600" />
                                        <span>PDF (.pdf)</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Members list and filters */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Main Card */}
                            <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
                                {/* Search & Filters Header */}
                                <div className="p-4 sm:p-5 border-b border-green-50 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <h3 className="font-extrabold text-green-950 text-base flex items-center gap-1.5">
                                            Daftar Pembayaran Anggota
                                            <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                                {filteredMembers.length}
                                            </span>
                                        </h3>
                                    </div>

                                    {/* Filters Controls */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {/* Search Input */}
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600/70" />
                                            <input
                                                type="text"
                                                placeholder="Cari nama anggota..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-green-50/30 border border-green-100/80 rounded-xl text-sm text-green-950 placeholder-green-600/50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                                            />
                                        </div>

                                        {/* Status Filters */}
                                        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                                className="px-3 py-2 bg-green-50/30 border border-green-100/80 rounded-xl text-xs font-semibold text-green-905 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                            >
                                                <option value="semua">Semua Status</option>
                                                <option value="lunas">Lunas</option>
                                                <option value="belum_lunas">Mencicil</option>
                                                <option value="belum_bayar">Belum Bayar</option>
                                            </select>

                                            <select
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value as any)}
                                                className="px-3 py-2 bg-green-50/30 border border-green-100/80 rounded-xl text-xs font-semibold text-green-905 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                            >
                                                <option value="name">Urut Nama A-Z</option>
                                                <option value="paid_desc">Uang Terbanyak</option>
                                                <option value="remaining_desc">Sisa Terbesar</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Members List Table / Cards */}
                                <div className="divide-y divide-green-50/60 overflow-x-auto">
                                    {/* Desktop Table View */}
                                    <table className="w-full text-left border-collapse min-w-[500px] hidden sm:table">
                                        <thead>
                                            <tr className="bg-green-50/40 text-[11px] font-bold uppercase tracking-wider text-green-800">
                                                <th className="py-3 px-4 w-12 text-center">No</th>
                                                <th className="py-3 px-4">Nama</th>
                                                <th className="py-3 px-4 text-center w-20">Ukuran</th>
                                                <th className="py-3 px-4 text-right">Terbayar</th>
                                                <th className="py-3 px-4 text-right">Sisa</th>
                                                <th className="py-3 px-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-green-50/60 text-sm">
                                            {filteredMembers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-10 text-muted font-medium text-xs">
                                                        Tidak ada anggota yang cocok dengan filter.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredMembers.map((m, idx) => (
                                                    <tr key={m.id} className="hover:bg-green-50/20 transition-colors">
                                                        <td className="py-3 px-4 text-center font-bold text-green-600/70 text-xs">{idx + 1}</td>
                                                        <td className="py-3 px-4 font-bold text-green-950">{m.name}</td>
                                                        <td className="py-3 px-4 text-center"><span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-bold text-xs">{m.size}</span></td>
                                                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatCurrency(m.total_paid)}</td>
                                                        <td className="py-3 px-4 text-right font-medium text-red-600">{formatCurrency(m.remaining)}</td>
                                                        <td className="py-3 px-4 text-center">
                                                            {m.is_lunas ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                    Lunas
                                                                </span>
                                                            ) : m.total_paid > 0 ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse-soft">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    Mencicil
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 border border-red-100 text-red-700">
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                    Belum Bayar
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Mobile Card-List View */}
                                    <div className="sm:hidden p-4 space-y-3">
                                        {filteredMembers.length === 0 ? (
                                            <p className="text-center py-8 text-muted font-medium text-xs">
                                                Tidak ada anggota yang cocok dengan filter.
                                            </p>
                                        ) : (
                                            filteredMembers.map((m, idx) => (
                                                <div key={m.id} className="p-3 bg-green-50/20 border border-green-100/50 rounded-xl space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-green-600/70">#{idx + 1}</span>
                                                            <h4 className="font-bold text-green-950 text-sm">{m.name}</h4>
                                                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-800 font-bold">{m.size}</span>
                                                        </div>
                                                        <div>
                                                            {m.is_lunas ? (
                                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                                    Lunas
                                                                </span>
                                                            ) : m.total_paid > 0 ? (
                                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                                                    Mencicil
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 border border-red-100 text-red-700">
                                                                    Belum Bayar
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-green-50/50">
                                                        <div>
                                                            <span className="text-[10px] text-muted block">Terbayar</span>
                                                            <span className="font-bold text-emerald-700">{formatCurrency(m.total_paid)}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-muted block">Sisa Tagihan</span>
                                                            <span className="font-bold text-red-600">{formatCurrency(m.remaining)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity Log */}
                            <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm">
                                <h3 className="font-extrabold text-green-950 text-sm tracking-wide uppercase flex items-center gap-1.5 mb-4">
                                    <Clock className="w-4.5 h-4.5 text-green-600" />
                                    10 Transaksi Terakhir
                                </h3>

                                <div className="space-y-3.5">
                                    {recentTransactions.length === 0 ? (
                                        <p className="text-xs text-muted text-center py-6">Belum ada transaksi</p>
                                    ) : (
                                        recentTransactions.map((tx) => (
                                            <div key={tx.id} className="flex justify-between items-start gap-4 p-3 hover:bg-green-50/30 rounded-xl transition-colors border border-green-50/20">
                                                <div className="flex gap-3">
                                                    <div className={`p-2 rounded-xl shrink-0 ${
                                                        tx.status === 'approved' 
                                                            ? 'bg-emerald-100 text-emerald-700' 
                                                            : tx.status === 'rejected' 
                                                            ? 'bg-red-100 text-red-700' 
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {tx.status === 'approved' ? (
                                                            <CheckCircle2 className="w-4.5 h-4.5" />
                                                        ) : tx.status === 'rejected' ? (
                                                            <XCircle className="w-4.5 h-4.5" />
                                                        ) : (
                                                            <Clock className="w-4.5 h-4.5" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-green-950 flex items-center gap-1.5">
                                                            {tx.members?.name || 'Anggota'}
                                                            <span className="px-1 text-[10px] font-bold rounded bg-gray-100 text-gray-600">{tx.members?.size || '-'}</span>
                                                        </div>
                                                        <div className="text-[10px] text-muted font-medium mt-0.5">{formatDate(tx.created_at)}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-extrabold text-green-950">{formatCurrency(tx.amount)}</div>
                                                    <div className={`text-[10px] font-bold ${
                                                        tx.status === 'approved' 
                                                            ? 'text-emerald-600' 
                                                            : tx.status === 'rejected' 
                                                            ? 'text-red-500' 
                                                            : 'text-amber-600'
                                                    }`}>
                                                        {tx.status === 'approved' ? 'Disetujui' : tx.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
