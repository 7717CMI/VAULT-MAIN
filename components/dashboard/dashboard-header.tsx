"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  Menu,
  Bell,
  User,
  LogOut,
  FileText,
  Download,
  ClipboardList,
  LayoutDashboard,
  TrendingUp,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Trending Reports", href: "/dashboard/reports/trending", icon: TrendingUp },
  { name: "Upcoming Reports", href: "/dashboard/reports/upcoming", icon: Clock },
  { name: "Recent Reports", href: "/dashboard/reports/recent", icon: FileText },
  { name: "Requested Reports", href: "/dashboard/reports/requested", icon: ClipboardList },
  { name: "Downloaded Reports", href: "/dashboard/reports/downloaded", icon: Download },
]

export function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
      {/* Top Bar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-0">
          <img src="/logo.svg" alt="Coherent Market Insights" className="h-10 w-auto" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 xl:flex">
          {navigation.slice(0, 4).map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-accent",
                pathname === item.href ? "text-accent" : "text-muted-foreground"
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 xl:flex">
          {/* Notifications */}
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/reports/recent">
              <Bell className="size-4" />
              <span className="sr-only">Recent reports</span>
            </Link>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <User className="size-4" />
                <span className="hidden sm:inline">Account</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">
                  <User className="mr-2 size-4" /> Edit Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/reports/requested">
                  <ClipboardList className="mr-2 size-4" /> Requested Reports
                </Link>
              </DropdownMenuItem>
             
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 size-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="xl:hidden">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-sm">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex flex-col gap-6 pt-6">
              <Link
                href="/dashboard"
                className="flex items-center"
                onClick={() => setMobileOpen(false)}
              >
                <img src="/logo.svg" alt="Coherent Market Insights" className="h-9 w-auto" />
              </Link>
              <nav className="flex flex-col gap-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-secondary",
                      pathname === item.href ? "text-accent" : "text-foreground"
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.name}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-border pt-4">
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-secondary"
                >
                  <User className="size-4" />
                  Edit Profile
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false)
                    handleLogout()
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-destructive transition-colors hover:bg-secondary"
                >
                  <LogOut className="size-4" />
                  Logout
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

    </header>
  )
}
