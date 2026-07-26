import './globals.css'
import Link from 'next/link'
import { LayoutDashboard, Package, ShoppingCart, Users, Calculator } from 'lucide-react'

export const metadata = {
  title: '1997 Retro Shop Admin',
  description: 'Hệ thống quản trị nội bộ 1997 Retro Shop',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body className="flex h-screen bg-gray-100 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
          <div className="p-6 text-2xl font-bold border-b border-slate-800 tracking-wider">
            1997 RETRO
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Link href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <LayoutDashboard size={20} className="text-blue-400" /> 
              <span>Dashboard</span>
            </Link>
            <Link href="/sales" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <ShoppingCart size={20} className="text-green-400" /> 
              <span>Sales (POS)</span>
            </Link>
            <Link href="/inventory" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Package size={20} className="text-orange-400" /> 
              <span>Tồn kho</span>
            </Link>
            <Link href="/customers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Users size={20} className="text-purple-400" /> 
              <span>Khách hàng</span>
            </Link>
            <Link href="/accounting" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
              <Calculator size={20} className="text-yellow-400" /> 
              <span>Kế toán</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </body>
    </html>
  )
}