'use client'

import { useState, useEffect } from 'react'
import { supabase, type Member, type Transaction, type MemberWithPayments } from '@/lib/supabase'
import {
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
    Clock,
    Users,
    ArrowLeft,
    ImageIcon,
    Loader2,
    BadgeCheck,
    X,
    AlertTriangle,
    TrendingUp,
    Banknote,
    UserPlus,
    Plus,
    ChevronDown,
    Trash2,
    HandCoins,
    Search,
    MoreVertical,
    KeyRound,
    Settings,
    FileSpreadsheet,
    FileText,
    Download,
    Pencil,
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

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [authError, setAuthError] = useState(false)
    const [activeTab, setActiveTab] = useState<'pending' | 'master'>('pending')
    const [pendingTransactions, setPendingTransactions] = useState<TransactionWithMember[]>([])
    const [members, setMembers] = useState<MemberWithPayments[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [showAddMember, setShowAddMember] = useState(false)
    const [newMemberName, setNewMemberName] = useState('')
    const [newMemberSize, setNewMemberSize] = useState('M')
    const [newMemberPrice, setNewMemberPrice] = useState('160000')
    const [addingMember, setAddingMember] = useState(false)
    const [addMemberError, setAddMemberError] = useState<string | null>(null)
    // Delete member
    const [deleteConfirm, setDeleteConfirm] = useState<MemberWithPayments | null>(null)
    const [deleting, setDeleting] = useState(false)
    // Manual payment
    const [showManualPayment, setShowManualPayment] = useState(false)
    const [manualMemberId, setManualMemberId] = useState('')
    const [manualAmount, setManualAmount] = useState('')
    const [manualNote, setManualNote] = useState('')
    const [manualLoading, setManualLoading] = useState(false)
    const [manualError, setManualError] = useState<string | null>(null)
    const [memberSearch, setMemberSearch] = useState('')
    const [openActionMenu, setOpenActionMenu] = useState<string | null>(null)
    // Edit member
    const [editMember, setEditMember] = useState<MemberWithPayments | null>(null)
    const [editName, setEditName] = useState('')
    const [editSize, setEditSize] = useState('M')
    const [editLoading, setEditLoading] = useState(false)
    const [editError, setEditError] = useState<string | null>(null)
    // Change password
    const [showChangePassword, setShowChangePassword] = useState(false)
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [changePwLoading, setChangePwLoading] = useState(false)
    const [changePwError, setChangePwError] = useState<string | null>(null)
    const [changePwSuccess, setChangePwSuccess] = useState(false)
    const [loginLoading, setLoginLoading] = useState(false)


    // Auth - verify against Supabase
    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoginLoading(true)
        setAuthError(false)

        const { data, error } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single()

        if (error || !data) {
            // Fallback to env var if table doesn't exist yet
            const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'kppmkarpil2026'
            if (password === adminPassword) {
                setIsAuthenticated(true)
            } else {
                setAuthError(true)
            }
        } else {
            if (password === data.value) {
                setIsAuthenticated(true)
            } else {
                setAuthError(true)
            }
        }
        setLoginLoading(false)
    }

    // Change password
    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setChangePwError(null)
        setChangePwSuccess(false)

        if (!oldPassword || !newPassword || !confirmPassword) {
            setChangePwError('Semua field wajib diisi')
            return
        }
        if (newPassword.length < 6) {
            setChangePwError('Password baru minimal 6 karakter')
            return
        }
        if (newPassword !== confirmPassword) {
            setChangePwError('Konfirmasi password tidak cocok')
            return
        }

        setChangePwLoading(true)

        // Verify old password
        const { data: current } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single()

        if (!current || current.value !== oldPassword) {
            setChangePwError('Password lama salah')
            setChangePwLoading(false)
            return
        }

        // Update password
        const { error } = await supabase
            .from('admin_settings')
            .update({ value: newPassword, updated_at: new Date().toISOString() })
            .eq('key', 'admin_password')

        if (error) {
            setChangePwError('Gagal mengubah password: ' + error.message)
        } else {
            setChangePwSuccess(true)
            setOldPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => {
                setShowChangePassword(false)
                setChangePwSuccess(false)
            }, 1500)
        }
        setChangePwLoading(false)
    }

    // Load data
    useEffect(() => {
        if (!isAuthenticated) return

        async function fetchData() {
            setLoading(true)

            // Fetch pending transactions
            const { data: txData } = await supabase
                .from('transactions')
                .select('*, members(name, size)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })

            if (txData) setPendingTransactions(txData as TransactionWithMember[])

            // Fetch all members with payment summaries
            const { data: memberData } = await supabase
                .from('members')
                .select('*')
                .order('name')

            if (memberData) {
                // Get all approved transactions
                const { data: allTx } = await supabase
                    .from('transactions')
                    .select('member_id, amount')
                    .eq('status', 'approved')

                const paidMap = new Map<string, number>()
                allTx?.forEach(t => {
                    paidMap.set(t.member_id, (paidMap.get(t.member_id) || 0) + t.amount)
                })

                const enriched: MemberWithPayments[] = memberData.map(m => {
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
            }

            setLoading(false)
        }

        fetchData()
    }, [isAuthenticated, refreshKey])

    async function handleApprove(id: string) {
        setActionLoading(id)
        const { error } = await supabase
            .from('transactions')
            .update({ status: 'approved' })
            .eq('id', id)

        if (!error) {
            setRefreshKey(k => k + 1)
        }
        setActionLoading(null)
    }

    async function handleReject(id: string) {
        setActionLoading(id)
        const { error } = await supabase
            .from('transactions')
            .update({ status: 'rejected' })
            .eq('id', id)

        if (!error) {
            setRefreshKey(k => k + 1)
        }
        setActionLoading(null)
    }

    // Delete member
    async function handleDeleteMember() {
        if (!deleteConfirm) return
        setDeleting(true)
        // Delete all transactions for this member first
        await supabase
            .from('transactions')
            .delete()
            .eq('member_id', deleteConfirm.id)
        // Then delete the member
        const { error } = await supabase
            .from('members')
            .delete()
            .eq('id', deleteConfirm.id)
        if (!error) {
            setRefreshKey(k => k + 1)
        }
        setDeleteConfirm(null)
        setDeleting(false)
    }

    // Edit member
    function openEditMember(m: MemberWithPayments) {
        setEditMember(m)
        setEditName(m.name)
        setEditSize(m.size)
        setEditError(null)
    }

    async function handleEditMember(e: React.FormEvent) {
        e.preventDefault()
        if (!editMember) return
        if (!editName.trim()) {
            setEditError('Nama peserta wajib diisi')
            return
        }

        setEditLoading(true)
        setEditError(null)

        const { error } = await supabase
            .from('members')
            .update({
                name: editName.trim(),
                size: editSize,
            })
            .eq('id', editMember.id)

        if (error) {
            setEditError('Gagal menyimpan: ' + error.message)
        } else {
            setEditMember(null)
            setRefreshKey(k => k + 1)
        }
        setEditLoading(false)
    }

    // Manual payment (for cash)
    async function handleManualPayment(e: React.FormEvent) {
        e.preventDefault()
        if (!manualMemberId) {
            setManualError('Pilih anggota terlebih dahulu')
            return
        }
        const amt = parseInt(manualAmount)
        if (isNaN(amt) || amt <= 0) {
            setManualError('Jumlah pembayaran tidak valid')
            return
        }


        setManualLoading(true)
        setManualError(null)

        const { error } = await supabase
            .from('transactions')
            .insert({
                member_id: manualMemberId,
                amount: amt,
                proof_url: null,
                status: 'approved', // cash payments are auto-approved
                notes: manualNote || 'Pembayaran cash (input manual admin)',
            })

        if (error) {
            setManualError('Gagal menyimpan: ' + error.message)
        } else {
            setManualMemberId('')
            setManualAmount('')
            setManualNote('')
            setShowManualPayment(false)
            setRefreshKey(k => k + 1)
        }
        setManualLoading(false)
    }

    const manualQuickAmounts = [5000, 10000, 15000, 20000, 30000, 50000, 80000, 100000, 160000]

    // Format number with dot separator: 160000 -> "160.000"
    function formatAmountDisplay(val: string): string {
        const num = val.replace(/\D/g, '')
        if (!num) return ''
        return Number(num).toLocaleString('id-ID')
    }

    // Handle amount input change - strip non-digits, store raw
    function handleManualAmountChange(val: string) {
        const raw = val.replace(/\D/g, '')
        setManualAmount(raw)
    }

    // Stats
    const totalMembers = members.length
    const lunasCount = members.filter(m => m.is_lunas).length
    const totalCollected = members.reduce((sum, m) => sum + m.total_paid, 0)
    const totalTarget = members.reduce((sum, m) => sum + m.total_price, 0)

    // Size recap calculation
    function getSizeRecap() {
        const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
        const sizeCount: Record<string, number> = {}
        members.forEach(m => {
            sizeCount[m.size] = (sizeCount[m.size] || 0) + 1
        })
        // Return sorted by the predefined order
        return sizeOrder
            .filter(size => sizeCount[size])
            .map(size => ({ size, count: sizeCount[size] }))
    }

    // Export to Excel
    function handleExportExcel() {
        const wb = XLSX.utils.book_new()

        // Sheet 1: Daftar Anggota & Ukuran
        const memberRows = members.map((m, i) => ({
            'No': i + 1,
            'Nama': m.name,
            'Ukuran': m.size,
            'Total Harga': m.total_price,
            'Terbayar': m.total_paid,
            'Sisa': m.remaining,
            'Status': m.is_lunas ? 'LUNAS' : 'Belum Lunas',
        }))
        const ws1 = XLSX.utils.json_to_sheet(memberRows)

        // Set column widths
        ws1['!cols'] = [
            { wch: 4 },   // No
            { wch: 20 },  // Nama
            { wch: 10 },  // Ukuran
            { wch: 15 },  // Total Harga
            { wch: 15 },  // Terbayar
            { wch: 15 },  // Sisa
            { wch: 14 },  // Status
        ]
        XLSX.utils.book_append_sheet(wb, ws1, 'Daftar Anggota')

        // Sheet 2: Rekap Ukuran
        const sizeRecap = getSizeRecap()
        const recapRows = sizeRecap.map(r => ({
            'Ukuran': r.size,
            'Jumlah': r.count,
        }))
        recapRows.push({ 'Ukuran': 'TOTAL', 'Jumlah': members.length })
        const ws2 = XLSX.utils.json_to_sheet(recapRows)
        ws2['!cols'] = [
            { wch: 10 },
            { wch: 10 },
        ]
        XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Ukuran')

        XLSX.writeFile(wb, `Data_PDH_Karpil_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    // Export to PDF
    function handleExportPDF() {
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()

        // Title
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('Data Anggota PDH', pageWidth / 2, 20, { align: 'center' })
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('KPPM GKJW Karangpilang', pageWidth / 2, 27, { align: 'center' })
        doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, 33, { align: 'center' })

        // Table 1: Daftar Anggota
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Daftar Nama & Ukuran', 14, 44)

        const memberTableBody = members.map((m, i) => [
            (i + 1).toString(),
            m.name,
            m.size,
            formatCurrency(m.total_paid),
            formatCurrency(m.remaining),
            m.is_lunas ? 'LUNAS' : 'Belum Lunas',
        ])

        autoTable(doc, {
            startY: 48,
            head: [['No', 'Nama', 'Ukuran', 'Terbayar', 'Sisa', 'Status']],
            body: memberTableBody,
            headStyles: {
                fillColor: [22, 163, 74],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 12 },
                1: { cellWidth: 40 },
                2: { halign: 'center', cellWidth: 20 },
                3: { halign: 'right', cellWidth: 30 },
                4: { halign: 'right', cellWidth: 30 },
                5: { halign: 'center', cellWidth: 30 },
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            alternateRowStyles: {
                fillColor: [240, 253, 244],
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw === 'LUNAS') {
                        data.cell.styles.textColor = [22, 163, 74]
                        data.cell.styles.fontStyle = 'bold'
                    } else {
                        data.cell.styles.textColor = [220, 38, 38]
                    }
                }
            },
        })

        // Table 2: Rekap Ukuran
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastTableY = (doc as any).lastAutoTable?.finalY || 48 + (members.length * 10)
        const recapStartY = lastTableY + 14

        // Check if we need a new page
        if (recapStartY > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage()
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Rekap Ukuran', 14, 20)

            const sizeRecap = getSizeRecap()
            const recapBody = sizeRecap.map(r => [r.size, r.count.toString()])
            recapBody.push(['TOTAL', members.length.toString()])

            autoTable(doc, {
                startY: 24,
                head: [['Ukuran', 'Jumlah']],
                body: recapBody,
                headStyles: {
                    fillColor: [22, 163, 74],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 30 },
                    1: { halign: 'center', cellWidth: 30 },
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
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
                tableWidth: 60,
            })
        } else {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Rekap Ukuran', 14, recapStartY)

            const sizeRecap = getSizeRecap()
            const recapBody = sizeRecap.map(r => [r.size, r.count.toString()])
            recapBody.push(['TOTAL', members.length.toString()])

            autoTable(doc, {
                startY: recapStartY + 4,
                head: [['Ukuran', 'Jumlah']],
                body: recapBody,
                headStyles: {
                    fillColor: [22, 163, 74],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 30 },
                    1: { halign: 'center', cellWidth: 30 },
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 4,
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
                tableWidth: 60,
            })
        }

        doc.save(`Data_PDH_Karpil_${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    const sizeOptions = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

    async function handleAddMember(e: React.FormEvent) {
        e.preventDefault()
        if (!newMemberName.trim()) {
            setAddMemberError('Nama peserta wajib diisi')
            return
        }

        const price = parseInt(newMemberPrice)
        if (isNaN(price) || price <= 0) {
            setAddMemberError('Harga tidak valid')
            return
        }

        setAddingMember(true)
        setAddMemberError(null)

        const { error } = await supabase
            .from('members')
            .insert({
                name: newMemberName.trim(),
                size: newMemberSize,
                total_price: price,
            })

        if (error) {
            setAddMemberError('Gagal menambahkan peserta: ' + error.message)
        } else {
            setNewMemberName('')
            setNewMemberSize('M')
            setNewMemberPrice('160000')
            setShowAddMember(false)
            setRefreshKey(k => k + 1)
        }
        setAddingMember(false)
    }

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
                <div className="w-full max-w-sm animate-slide-up">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-green-700 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
                        <p className="text-sm text-muted mt-1">KPPM GKJW Karangpilang</p>
                    </div>

                    <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 space-y-4" style={{ boxShadow: 'var(--shadow-md)' }}>
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setAuthError(false) }}
                                    placeholder="Masukkan password admin"
                                    className="w-full pl-10 pr-10 py-3.5 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {authError && (
                                <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Password salah
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loginLoading}
                            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold py-3.5 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-green-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loginLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Memverifikasi...
                                </>
                            ) : (
                                'Masuk'
                            )}
                        </button>
                        <Link href="/" className="block text-center text-sm text-muted hover:text-primary transition-colors mt-2">
                            ← Kembali ke halaman utama
                        </Link>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-md w-full animate-fade-in" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img src={previewImage} alt="Bukti" className="w-full rounded-xl" />
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showChangePassword && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowChangePassword(false); setChangePwError(null); setChangePwSuccess(false) }}>
                    <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-primary" />
                                <h3 className="text-base font-bold text-foreground">Ubah Password</h3>
                            </div>
                            <button onClick={() => { setShowChangePassword(false); setChangePwError(null); setChangePwSuccess(false) }} className="text-muted hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {changePwSuccess ? (
                            <div className="p-8 text-center">
                                <div className="w-14 h-14 bg-green-50 rounded-full mx-auto flex items-center justify-center mb-3">
                                    <CheckCircle2 className="w-7 h-7 text-primary" />
                                </div>
                                <p className="text-sm font-bold text-foreground">Password berhasil diubah!</p>
                                <p className="text-xs text-muted mt-1">Gunakan password baru saat login berikutnya.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
                                {changePwError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {changePwError}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Password Lama</label>
                                    <input
                                        type="password"
                                        value={oldPassword}
                                        onChange={e => setOldPassword(e.target.value)}
                                        placeholder="Masukkan password saat ini"
                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Password Baru</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Minimal 6 karakter"
                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1.5">Konfirmasi Password Baru</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Ketik ulang password baru"
                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={changePwLoading || !oldPassword || !newPassword || !confirmPassword}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold py-3.5 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                >
                                    {changePwLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound className="w-4 h-4" />
                                            Simpan Password Baru
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-50 glass border-b border-white/20">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="text-muted hover:text-primary transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-primary-dark tracking-tight flex items-center gap-1.5">
                                <ShieldCheck className="w-5 h-5" />
                                Admin Panel
                            </h1>
                            <p className="text-xs text-muted">Kelola pembayaran cicilan PDH</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowChangePassword(true)}
                            className="text-muted hover:text-primary transition-colors p-2 rounded-full hover:bg-green-50"
                            title="Ubah Password"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsAuthenticated(false)}
                            className="text-xs text-muted hover:text-red-500 transition-colors px-3 py-1.5 rounded-full hover:bg-red-50"
                        >
                            Keluar
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                    <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-xs text-muted font-medium">Anggota</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{totalMembers}</p>
                        <p className="text-xs text-muted mt-0.5">{lunasCount} sudah lunas</p>
                    </div>
                    <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                                <Banknote className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-xs text-muted font-medium">Terkumpul</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(totalCollected)}</p>
                        <p className="text-xs text-muted mt-0.5">dari {formatCurrency(totalTarget)}</p>
                    </div>
                </div>

                {/* Overall Progress */}
                <div className="bg-white rounded-xl p-4 animate-fade-in" style={{ boxShadow: 'var(--shadow)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Progress Keseluruhan
                        </span>
                        <span className="text-xs font-bold text-primary">
                            {totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-full h-2.5 transition-all duration-500"
                            style={{ width: `${totalTarget > 0 ? Math.min(100, (totalCollected / totalTarget) * 100) : 0}%` }}
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-white rounded-xl p-1 animate-fade-in" style={{ boxShadow: 'var(--shadow)' }}>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'pending'
                            ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md'
                            : 'text-muted hover:text-foreground'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            Menunggu
                            {pendingTransactions.length > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'pending' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {pendingTransactions.length}
                                </span>
                            )}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('master')}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'master'
                            ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md'
                            : 'text-muted hover:text-foreground'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <Users className="w-4 h-4" />
                            Master Data
                        </span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Pending Approvals Tab */}
                        {activeTab === 'pending' && (
                            <div className="space-y-3 animate-fade-in">
                                {pendingTransactions.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-2xl" style={{ boxShadow: 'var(--shadow)' }}>
                                        <div className="w-16 h-16 bg-green-50 rounded-full mx-auto flex items-center justify-center mb-3">
                                            <CheckCircle2 className="w-7 h-7 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">Semua sudah diproses!</p>
                                        <p className="text-xs text-muted mt-1">Tidak ada pembayaran yang menunggu persetujuan</p>
                                    </div>
                                ) : (
                                    pendingTransactions.map(tx => (
                                        <div
                                            key={tx.id}
                                            className="bg-white rounded-xl overflow-hidden"
                                            style={{ boxShadow: 'var(--shadow)' }}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-foreground">{tx.members.name}</h4>
                                                        <p className="text-xs text-muted mt-0.5">
                                                            {formatDate(tx.created_at)} • Ukuran {tx.members.size}
                                                        </p>
                                                    </div>
                                                    <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Pending
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {/* Receipt thumbnail */}
                                                    {tx.proof_url && (
                                                        <button
                                                            onClick={() => setPreviewImage(tx.proof_url)}
                                                            className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors relative group"
                                                        >
                                                            <img src={tx.proof_url} alt="Bukti" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        </button>
                                                    )}

                                                    <div className="flex-1">
                                                        <p className="text-lg font-bold text-foreground">{formatCurrency(tx.amount)}</p>
                                                        <div className="flex gap-2 mt-2">
                                                            <button
                                                                onClick={() => handleApprove(tx.id)}
                                                                disabled={actionLoading === tx.id}
                                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                                            >
                                                                {actionLoading === tx.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                )}
                                                                Setujui
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(tx.id)}
                                                                disabled={actionLoading === tx.id}
                                                                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                                            >
                                                                {actionLoading === tx.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                )}
                                                                Tolak
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Master Table Tab */}
                        {activeTab === 'master' && (
                            <div className="animate-fade-in space-y-4">
                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setShowAddMember(true)}
                                        className="bg-white rounded-xl p-3.5 flex items-center gap-3 hover:bg-green-50/50 transition-colors group"
                                        style={{ boxShadow: 'var(--shadow)' }}
                                    >
                                        <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                            <UserPlus className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-foreground">Tambah Peserta</p>
                                            <p className="text-[10px] text-muted">Daftarkan anggota</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowManualPayment(true)}
                                        className="bg-white rounded-xl p-3.5 flex items-center gap-3 hover:bg-blue-50/50 transition-colors group"
                                        style={{ boxShadow: 'var(--shadow)' }}
                                    >
                                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                            <HandCoins className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-foreground">Input Cash</p>
                                            <p className="text-[10px] text-muted">Pembayaran manual</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Export Buttons */}
                                <div className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--shadow)' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Download className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-bold text-foreground">Ekspor Data</h3>
                                    </div>
                                    <p className="text-xs text-muted mb-3">Unduh daftar nama, ukuran, dan rekap jumlah per ukuran</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={handleExportExcel}
                                            disabled={members.length === 0}
                                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-md shadow-green-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <FileSpreadsheet className="w-4 h-4" />
                                            Excel
                                        </button>
                                        <button
                                            onClick={handleExportPDF}
                                            disabled={members.length === 0}
                                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-semibold py-3 rounded-xl hover:from-red-600 hover:to-rose-700 transition-all shadow-md shadow-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <FileText className="w-4 h-4" />
                                            PDF
                                        </button>
                                    </div>

                                    {/* Size Recap Preview */}
                                    {members.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">Rekap Ukuran</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getSizeRecap().map(r => (
                                                    <span
                                                        key={r.size}
                                                        className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-xs"
                                                    >
                                                        <span className="font-bold text-foreground">{r.size}</span>
                                                        <span className="text-muted">×</span>
                                                        <span className="font-semibold text-primary">{r.count}</span>
                                                    </span>
                                                ))}
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                                                    <span className="font-bold text-emerald-700">Total</span>
                                                    <span className="text-emerald-500">×</span>
                                                    <span className="font-semibold text-emerald-700">{members.length}</span>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Add Member Modal */}
                                {showAddMember && (
                                    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
                                        <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <UserPlus className="w-5 h-5 text-primary" />
                                                    <h3 className="text-base font-bold text-foreground">Tambah Peserta</h3>
                                                </div>
                                                <button onClick={() => setShowAddMember(false)} className="text-muted hover:text-foreground transition-colors">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <form onSubmit={handleAddMember} className="p-5 space-y-4">
                                                {addMemberError && (
                                                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                        {addMemberError}
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Nama Peserta</label>
                                                    <input
                                                        type="text"
                                                        value={newMemberName}
                                                        onChange={e => setNewMemberName(e.target.value)}
                                                        placeholder="Masukkan nama lengkap"
                                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                        autoFocus
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Ukuran Baju</label>
                                                    <div className="relative">
                                                        <select
                                                            value={newMemberSize}
                                                            onChange={e => setNewMemberSize(e.target.value)}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                        >
                                                            {sizeOptions.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Total Harga (Rp)</label>
                                                    <input
                                                        type="number"
                                                        value={newMemberPrice}
                                                        onChange={e => setNewMemberPrice(e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={addingMember || !newMemberName.trim()}
                                                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold py-3.5 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                                >
                                                    {addingMember ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Menyimpan...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserPlus className="w-4 h-4" />
                                                            Tambah Peserta
                                                        </>
                                                    )}
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}

                                {/* Manual Payment Modal */}
                                {showManualPayment && (
                                    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowManualPayment(false)}>
                                        <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up max-h-[90vh] overflow-y-auto" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
                                                <div className="flex items-center gap-2">
                                                    <HandCoins className="w-5 h-5 text-blue-600" />
                                                    <h3 className="text-base font-bold text-foreground">Input Pembayaran Cash</h3>
                                                </div>
                                                <button onClick={() => setShowManualPayment(false)} className="text-muted hover:text-foreground transition-colors">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <form onSubmit={handleManualPayment} className="p-5 space-y-4">
                                                {manualError && (
                                                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                        {manualError}
                                                    </div>
                                                )}

                                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                                    <p className="text-[11px] text-blue-800">
                                                        💰 Pembayaran cash akan langsung tercatat sebagai <strong>disetujui</strong> tanpa perlu approval lagi.
                                                    </p>
                                                </div>

                                                {/* Member Selection */}
                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Pilih Anggota</label>
                                                    <div className="relative mb-2">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                        <input
                                                            type="text"
                                                            value={memberSearch}
                                                            onChange={e => setMemberSearch(e.target.value)}
                                                            placeholder="Cari nama..."
                                                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                    <div className="max-h-36 overflow-y-auto border border-border rounded-lg divide-y divide-gray-50">
                                                        {members
                                                            .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                                                            .map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    type="button"
                                                                    onClick={() => { setManualMemberId(m.id); setMemberSearch('') }}
                                                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 transition-colors flex items-center justify-between ${manualMemberId === m.id ? 'bg-green-50 text-primary font-semibold' : ''}`}
                                                                >
                                                                    <span>{m.name}</span>
                                                                    <span className="text-[10px] text-muted">
                                                                        {m.is_lunas ? '✅ Lunas' : `Sisa ${formatCurrency(m.remaining)}`}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                    {manualMemberId && (
                                                        <p className="text-xs text-primary font-medium mt-1.5">
                                                            ✓ {members.find(m => m.id === manualMemberId)?.name}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Amount */}
                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Jumlah Pembayaran</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">Rp</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={formatAmountDisplay(manualAmount)}
                                                            onChange={e => handleManualAmountChange(e.target.value)}
                                                            placeholder="0"
                                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-border rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {manualQuickAmounts.map(q => (
                                                            <button
                                                                key={q}
                                                                type="button"
                                                                onClick={() => setManualAmount(q.toString())}
                                                                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${manualAmount === q.toString()
                                                                    ? 'bg-blue-600 text-white shadow-md'
                                                                    : 'bg-gray-100 text-muted hover:bg-blue-50 hover:text-blue-600'
                                                                    }`}
                                                            >
                                                                {formatCurrency(q)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Notes */}
                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Catatan (opsional)</label>
                                                    <input
                                                        type="text"
                                                        value={manualNote}
                                                        onChange={e => setManualNote(e.target.value)}
                                                        placeholder="Contoh: Bayar cash saat latihan"
                                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={manualLoading || !manualMemberId || !manualAmount}
                                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                                                >
                                                    {manualLoading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Menyimpan...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <HandCoins className="w-4 h-4" />
                                                            Simpan Pembayaran Cash
                                                        </>
                                                    )}
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}

                                {/* Delete Confirmation Modal */}
                                {deleteConfirm && (
                                    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
                                        <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up p-6 text-center" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                            <div className="w-14 h-14 bg-red-50 rounded-full mx-auto flex items-center justify-center mb-4">
                                                <Trash2 className="w-6 h-6 text-red-500" />
                                            </div>
                                            <h3 className="text-base font-bold text-foreground mb-1">Hapus Peserta?</h3>
                                            <p className="text-sm text-muted mb-1">
                                                <strong>{deleteConfirm.name}</strong> (Ukuran {deleteConfirm.size})
                                            </p>
                                            <p className="text-xs text-red-500 mb-5">
                                                Semua data pembayaran anggota ini juga akan dihapus. Tindakan ini tidak bisa dibatalkan.
                                            </p>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setDeleteConfirm(null)}
                                                    className="flex-1 bg-gray-100 text-foreground font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors text-sm"
                                                >
                                                    Batal
                                                </button>
                                                <button
                                                    onClick={handleDeleteMember}
                                                    disabled={deleting}
                                                    className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                                                >
                                                    {deleting ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                    Hapus
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Edit Member Modal */}
                                {editMember && (
                                    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setEditMember(null); setEditError(null) }}>
                                        <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up" style={{ boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <Pencil className="w-5 h-5 text-amber-600" />
                                                    <h3 className="text-base font-bold text-foreground">Edit Data</h3>
                                                </div>
                                                <button onClick={() => { setEditMember(null); setEditError(null) }} className="text-muted hover:text-foreground transition-colors">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <form onSubmit={handleEditMember} className="p-5 space-y-4">
                                                {editError && (
                                                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                        {editError}
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Nama Peserta</label>
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        placeholder="Masukkan nama lengkap"
                                                        className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                        autoFocus
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1.5">Ukuran Baju</label>
                                                    <div className="relative">
                                                        <select
                                                            value={editSize}
                                                            onChange={e => setEditSize(e.target.value)}
                                                            className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                        >
                                                            {sizeOptions.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                                    </div>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={editLoading || !editName.trim()}
                                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-3.5 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
                                                >
                                                    {editLoading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Menyimpan...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Pencil className="w-4 h-4" />
                                                            Simpan Perubahan
                                                        </>
                                                    )}
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}

                                <div
                                    className="bg-white rounded-xl overflow-hidden"
                                    style={{ boxShadow: 'var(--shadow)' }}
                                >
                                    {/* Mobile card layout */}
                                    <div className="divide-y divide-gray-100">
                                        {members.map((m) => (
                                            <div
                                                key={m.id}
                                                className="p-4 hover:bg-green-50/30 transition-colors relative"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${m.is_lunas
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {m.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-sm text-foreground">{m.name}</h4>
                                                            <p className="text-xs text-muted">Ukuran {m.size}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {m.is_lunas ? (
                                                            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                                <BadgeCheck className="w-3.5 h-3.5" />
                                                                LUNAS
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                                                                Sisa {formatCurrency(m.remaining)}
                                                            </span>
                                                        )}
                                                        {/* Action Menu */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setOpenActionMenu(openActionMenu === m.id ? null : m.id)}
                                                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-muted hover:text-foreground"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                            {openActionMenu === m.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-40" onClick={() => setOpenActionMenu(null)} />
                                                                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-border py-1 z-50 w-44 animate-fade-in" style={{ boxShadow: 'var(--shadow-md)' }}>
                                                                        <button
                                                                            onClick={() => {
                                                                                openEditMember(m)
                                                                                setOpenActionMenu(null)
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-amber-50 flex items-center gap-2 transition-colors"
                                                                        >
                                                                            <Pencil className="w-3.5 h-3.5 text-amber-600" />
                                                                            Edit Peserta
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setManualMemberId(m.id)
                                                                                setShowManualPayment(true)
                                                                                setOpenActionMenu(null)
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-blue-50 flex items-center gap-2 transition-colors"
                                                                        >
                                                                            <HandCoins className="w-3.5 h-3.5 text-blue-600" />
                                                                            Input Cash
                                                                        </button>
                                                                        <div className="border-t border-gray-100 my-1" />
                                                                        <button
                                                                            onClick={() => {
                                                                                setDeleteConfirm(m)
                                                                                setOpenActionMenu(null)
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                            Hapus Peserta
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="flex items-center gap-3 mt-2">
                                                    <div className="flex-1">
                                                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                            <div
                                                                className={`rounded-full h-1.5 transition-all duration-500 ${m.is_lunas ? 'bg-emerald-500' : 'bg-amber-400'
                                                                    }`}
                                                                style={{
                                                                    width: `${Math.min(100, (m.total_paid / m.total_price) * 100)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-medium text-muted shrink-0">
                                                        {formatCurrency(m.total_paid)} / {formatCurrency(m.total_price)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Footer */}
                <footer className="text-center pb-6 pt-4">
                    <p className="text-xs text-muted">
                        © 2026 KPPM GKJW Karangpilang • Admin Panel
                    </p>
                </footer>
            </main>
        </div>
    )
}
