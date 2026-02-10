import { Role } from '@prisma/client'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: Role
      clientId: string | null
      transporterId: string | null
      terminalId: string | null
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: Role
    clientId: string | null
    transporterId: string | null
    terminalId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    clientId: string | null
    transporterId: string | null
    terminalId: string | null
  }
}
