import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { logger } from './logger'

// Track login attempts for basic rate limiting
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const record = loginAttempts.get(email)
  if (!record) return true
  if (now - record.lastAttempt > LOCKOUT_MS) {
    loginAttempts.delete(email)
    return true
  }
  return record.count < MAX_ATTEMPTS
}

function recordAttempt(email: string, success: boolean) {
  if (success) {
    loginAttempts.delete(email)
    return
  }
  const record = loginAttempts.get(email) || { count: 0, lastAttempt: 0 }
  record.count++
  record.lastAttempt = Date.now()
  loginAttempts.set(email, record)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        if (!checkRateLimit(credentials.email)) {
          logger.warn({ email: credentials.email }, 'Login rate limited')
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { client: true, transporter: true },
        })

        if (!user || !user.isActive) {
          recordAttempt(credentials.email, false)
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) {
          recordAttempt(credentials.email, false)
          return null
        }

        recordAttempt(credentials.email, true)
        logger.info({ userId: user.id, role: user.role }, 'User logged in')

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
          transporterId: user.transporterId,
          terminalId: user.terminalId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.clientId = (user as any).clientId
        token.transporterId = (user as any).transporterId
        token.terminalId = (user as any).terminalId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).clientId = token.clientId
        ;(session.user as any).transporterId = token.transporterId
        ;(session.user as any).terminalId = token.terminalId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24h
  },
  secret: process.env.NEXTAUTH_SECRET,
}
