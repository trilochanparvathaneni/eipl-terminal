"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BrandLockup } from "@/components/brand/BrandLockup"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid email or password")
    } else {
      router.replace("/dashboard")
      router.refresh()
    }
  }

  const demoLogins = [
    { label: "Super Admin", email: "superadmin@eipl.com" },
    { label: "Terminal Admin", email: "admin@eipl.com" },
    { label: "Client", email: "client@tridentchemp.com" },
    { label: "Transporter", email: "dispatch@safehaul.com" },
    { label: "Security", email: "security@eipl.com" },
    { label: "Surveyor", email: "surveyor@eipl.com" },
    { label: "HSE Officer", email: "hse@eipl.com" },
    { label: "Auditor", email: "auditor@eipl.com" },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <BrandLockup variant="auth" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground mb-3 text-center">
                Demo logins (password: <code className="bg-muted px-1 rounded">password123</code>)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {demoLogins.map((demo) => (
                  <Button
                    key={demo.email}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setEmail(demo.email)
                      setPassword("password123")
                    }}
                  >
                    {demo.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
