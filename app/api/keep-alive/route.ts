import { getSupabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// Menandakan Next.js agar API Route ini tidak di-cache secara statis (harus dinamis)
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  // Jika CRON_SECRET dikonfigurasi di environment, verifikasi token tersebut.
  // Vercel Cron secara otomatis mengirimkan header: Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' }, 
      { status: 401 }
    )
  }

  try {
    const supabase = getSupabase()
    
    // Lakukan query super ringan ke tabel 'members' untuk memicu koneksi database
    const { data, error } = await supabase
      .from('members')
      .select('id')
      .limit(1)
    
    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection kept alive successfully',
      timestamp: new Date().toISOString(),
      data: data
    })
  } catch (error: any) {
    console.error('Keep-alive cron error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown database error'
      }, 
      { status: 500 }
    )
  }
}
