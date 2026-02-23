import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        _supabase = createClient('https://placeholder.supabase.co', 'placeholder-key')
        return _supabase
    }

    _supabase = createClient(url, key)
    return _supabase
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient = typeof window !== 'undefined'
    ? getSupabase()
    : new Proxy({} as SupabaseClient, {
        get: (_, prop) => {
            const client = getSupabase()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = (client as any)[prop]
            if (typeof value === 'function') {
                return value.bind(client)
            }
            return value
        },
    })

export type Member = {
    id: string
    name: string
    size: string
    total_price: number
    created_at: string
}

export type Transaction = {
    id: string
    member_id: string
    amount: number
    proof_url: string | null
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    members?: Member
}

export type MemberWithPayments = Member & {
    total_paid: number
    remaining: number
    is_lunas: boolean
}
