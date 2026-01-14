import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    try {
        // Faz uma query simples para manter o Supabase ativo
        const result = await db.$queryRaw`SELECT 1 as ping`

        return NextResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            message: 'Scopsy Manager está ativo!'
        }, { status: 200 })
    } catch (error) {
        console.error('Health check failed:', error)
        return NextResponse.json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            message: 'Erro na conexão com o banco de dados'
        }, { status: 500 })
    }
}
