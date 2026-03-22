"use client"

import { useState, useEffect } from "react"
import { SectionHeader } from "@/components/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { User, Save, Package, CreditCard, Download, TrendingDown } from "lucide-react"

interface Stats {
  subscriptionPackage: number
  freeCredit: number
  totalDownloads: number
  remainingCredits: number
}

export default function ProfilePage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [contact, setContact] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [stats, setStats] = useState<Stats>({
    subscriptionPackage: 250,
    freeCredit: 2,
    totalDownloads: 0,
    remainingCredits: 250,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch("/api/auth/profile"),
          fetch("/api/reports/stats"),
        ])
        if (profileRes.ok) {
          const data = await profileRes.json()
          setName(data.name || "")
          setEmail(data.email || "")
          setContact(data.contact || "")
        }
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }
      } catch {
        // Defaults
      }
    }
    fetchData()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, contact }),
      })

      if (res.ok) {
        setMessage("Profile updated successfully!")
      } else {
        setMessage("Failed to update profile. Please try again.")
      }
    } catch {
      setMessage("An error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const statCards = [
    { label: "Subscription Package", value: stats.subscriptionPackage, icon: Package },
    { label: "Free Credit", value: stats.freeCredit, icon: CreditCard },
    { label: "Total Downloads", value: stats.totalDownloads, icon: Download },
    { label: "Remaining Credits", value: stats.remainingCredits, icon: TrendingDown },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <User className="size-5 text-accent" />
        <SectionHeader
          title="Edit Profile"
          description="Update your account information"
          align="left"
          className="max-w-none"
        />
      </div>

      {/* Subscription Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subscription Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="flex flex-col items-center gap-1.5 rounded-lg border p-4 text-center"
              >
                <card.icon className="size-5 text-accent" />
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input
                id="contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Your phone number"
              />
            </div>

            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}

            <Button type="submit" disabled={saving} className="mt-2 gap-2">
              {saving ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
