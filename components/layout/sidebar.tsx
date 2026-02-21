"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
  { href: "/meetings", icon: Calendar, label: "商談管理" },
  { href: "/clients", icon: Users, label: "顧客管理" },
  { href: "/staff", icon: UserCog, label: "スタッフ管理", adminOnly: true },
  { href: "/evaluations", icon: BarChart3, label: "評価・分析" },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      {/* ロゴ */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">
            S
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">営業管理</p>
            <p className="text-xs text-muted-foreground">Sales Manager</p>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter((item) => !item.adminOnly || userRole === "ADMIN" || userRole === "MANAGER")
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* ユーザー情報 */}
      <div className="border-t p-3">
        <div className="mb-2 px-3 py-2">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel(userRole)}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>
    </aside>
  );
}

function roleLabel(role?: string): string {
  if (role === "ADMIN") return "管理者";
  if (role === "MANAGER") return "マネージャー";
  return "営業スタッフ";
}
