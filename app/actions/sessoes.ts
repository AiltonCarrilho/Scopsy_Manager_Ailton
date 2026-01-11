"use server"

import { db } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"

// Criar nova sessão
export async function createSessao(data: {
    pacienteId: number
    data: string
    valorPraticado: number
    observacoes?: string
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Não autorizado" }

        // Validar se o paciente pertence ao usuário
        const paciente = await db.paciente.findFirst({
            where: { id: data.pacienteId, usuarioId: user.id }
        })
        if (!paciente) return { success: false, error: "Paciente não encontrado" }

        const sessao = await db.sessao.create({
            data: {
                pacienteId: data.pacienteId,
                data: new Date(data.data + 'T12:00:00'),
                valorPraticado: data.valorPraticado,
                tipo: "CONSULTA",
                situacao: "ABERTO",
                observacoes: data.observacoes || null,
            }
        })

        revalidatePath("/sessoes")
        revalidatePath(`/pacientes/${data.pacienteId}`)
        return {
            success: true,
            data: {
                ...sessao,
                valorPraticado: Number(sessao.valorPraticado)
            }
        }
    } catch (error) {
        console.error("Erro ao criar sessão:", error)
        return { success: false, error: "Erro ao criar sessão" }
    }
}

// Listar todas as sessões
export async function getSessoes() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const sessoes = await db.sessao.findMany({
            where: {
                paciente: { usuarioId: user.id }
            },
            include: {
                paciente: {
                    select: { nome: true }
                }
            },
            orderBy: { data: 'desc' },
        })

        // Serializar Decimal para number
        return sessoes.map(s => ({
            ...s,
            valorPraticado: Number(s.valorPraticado),
            pacienteNome: s.paciente.nome,
        }))
    } catch (error) {
        console.error("Erro ao buscar sessões:", error)
        return []
    }
}

// Listar sessões de um paciente específico
export async function getSessoesByPaciente(pacienteId: number) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const sessoes = await db.sessao.findMany({
            where: {
                pacienteId,
                paciente: { usuarioId: user.id }
            },
            orderBy: { data: 'desc' },
        })

        return sessoes.map(s => ({
            ...s,
            valorPraticado: Number(s.valorPraticado),
        }))
    } catch (error) {
        console.error("Erro ao buscar sessões do paciente:", error)
        return []
    }
}

// Listar sessões em aberto (não pagas) de um paciente
export async function getSessoesEmAberto(pacienteId: number) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const sessoes = await db.sessao.findMany({
            where: {
                pacienteId,
                situacao: "ABERTO",
                paciente: { usuarioId: user.id }
            },
            orderBy: { data: 'asc' },
        })

        return sessoes.map(s => ({
            ...s,
            valorPraticado: Number(s.valorPraticado),
        }))
    } catch (error) {
        console.error("Erro ao buscar sessões em aberto:", error)
        return []
    }
}

// Atualizar status de uma sessão
export async function updateSessaoStatus(id: number, situacao: "ABERTO" | "PAGO") {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Não autorizado" }

        // Verificar propriedade
        const ownership = await db.sessao.findFirst({
            where: { id, paciente: { usuarioId: user.id } }
        })
        if (!ownership) return { success: false, error: "Não autorizado" }

        await db.sessao.update({
            where: { id },
            data: {
                situacao,
                dataPagamento: situacao === "PAGO" ? new Date() : null
            }
        })

        revalidatePath("/sessoes")
        revalidatePath("/pagamentos")
        return { success: true }
    } catch (error) {
        console.error("Erro ao atualizar sessão:", error)
        return { success: false, error: "Erro ao atualizar sessão" }
    }
}

// Atualizar sessão completa
export async function updateSessao(id: number, data: {
    data?: Date
    valorPraticado?: number
    situacao?: string
    observacoes?: string
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Não autorizado" }

        const ownership = await db.sessao.findFirst({
            where: { id, paciente: { usuarioId: user.id } }
        })
        if (!ownership) return { success: false, error: "Não autorizado" }

        const sessao = await db.sessao.update({
            where: { id },
            data: {
                data: data.data ? new Date(new Date(data.data).toISOString().split('T')[0] + 'T12:00:00') : undefined,
                valorPraticado: data.valorPraticado,
                situacao: data.situacao,
                observacoes: data.observacoes
            }
        })

        revalidatePath("/sessoes")
        if (sessao.pacienteId) {
            revalidatePath(`/pacientes/${sessao.pacienteId}`)
        }

        return {
            success: true,
            data: {
                ...sessao,
                valorPraticado: Number(sessao.valorPraticado)
            }
        }
    } catch (error) {
        console.error("Erro ao atualizar sessão:", error)
        return { success: false, error: "Erro ao atualizar sessão" }
    }
}

// Deletar sessão
export async function deleteSessao(id: number) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Não autorizado" }

        const ownership = await db.sessao.findFirst({
            where: { id, paciente: { usuarioId: user.id } }
        })
        if (!ownership) return { success: false, error: "Não autorizado" }

        const sessao = await db.sessao.delete({
            where: { id }
        })

        revalidatePath("/sessoes")
        if (sessao.pacienteId) {
            revalidatePath(`/pacientes/${sessao.pacienteId}`)
        }

        return { success: true }
    } catch (error) {
        console.error("Erro ao deletar sessão:", error)
        return { success: false, error: "Erro ao deletar sessão" }
    }
}
