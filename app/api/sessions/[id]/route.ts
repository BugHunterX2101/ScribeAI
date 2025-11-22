import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await prisma.session.findUnique({
      where: {
        id: params.id
      },
      include: {
        transcripts: {
          select: {
            id: true,
            content: true,
            summary: true
          }
        }
      }
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Failed to fetch session:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}