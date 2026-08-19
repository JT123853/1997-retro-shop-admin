'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, Users, Calculator, LogOut, Lock } from 'lucide-react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<string>('staff') // Mặc định là staff
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  
  const pathname = usePathname()

  useEffect(() => {
    // Kiểm tra trạng thái đăng nhập khi vừa mở web
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkRole(session.user.email)
      else setLoading(false)
    })

    // Lắng nghe sự kiện đăng nhập / đăng xuất
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkRole(session?.user?.email)
      else setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Hàm kiểm tra quyền từ database
  const checkRole = async (userEmail: string | undefined) => {
    if (!userEmail) return
    const { data } = await supabase.from('user_roles').select('role').eq('email', userEmail).single()
    if (data) setRole(data.role)
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      alert('Đăng nhập thất bại. Vui lòng kiểm tra lại Email/Mật khẩu!')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/' // Tải lại trang để xóa cache
  }

  // 1. MÀN HÌNH CHỜ (Loading)
  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium">Đang xác thực hệ thống...</div>

 // 2. MÀN HÌNH ĐĂNG NHẬP (Dành cho người chưa đăng nhập)
  if (!session) {
    return (
      <div 
        className="flex h-screen items-center justify-center bg-cover bg-center relative"
        style={{ backgroundImage: "url('/bg-login.jpg')" }} // Trỏ đến file ảnh trong thư mục public
      >
        {/* Lớp phủ mờ màu đen giúp form đăng nhập nổi bật và dễ đọc chữ hơn */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        
        {/* Khung đăng nhập (thêm relative và z-10 để nổi lên trên lớp phủ) */}
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-[400px] relative z-10">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full"><Lock className="text-blue-600" size={32} /></div>
          </div>
          <h1 className="text-2xl font-black text-center mb-2 text-slate-800 tracking-wider">1997 RETRO</h1>
          <p className="text-center text-gray-500 mb-8 text-sm">Hệ thống quản trị nội bộ</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Email đăng nhập</label>
              <input required type="email" placeholder="admin@1997.com" className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700">Mật khẩu</label>
              <input required type="password" placeholder="••••••••" className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-bold text-lg transition-colors mt-4">
              ĐĂNG NHẬP
            </button>
          </form>
        </div>
      </div>
    )
  }

  // 3. MÀN HÌNH HỆ THỐNG CHÍNH (Đã đăng nhập)
  
  // Logic chặn UI: Nếu là Staff mà cố tình gõ link vào trang quản lý sẽ bị chặn
  const isAdminRoute = pathname === '/' || pathname === '/inventory' || pathname === '/accounting'
  const isBlocked = role === 'staff' && isAdminRoute

  return (
    <div className="flex h-screen overflow-hidden">
      
      {/* Sidebar điều hướng */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 text-2xl font-black border-b border-slate-800 tracking-wider flex items-center justify-center">
          1997 RETRO
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto mt-4">
          <p className="text-xs font-bold text-slate-500 mb-2 ml-2 uppercase tracking-widest">Nghiệp vụ Bán hàng</p>
          <Link href="/sales" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${pathname === '/sales' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <ShoppingCart size={20} className={pathname === '/sales' ? 'text-white' : 'text-green-400'} /> 
            <span className="font-medium">Sales (POS)</span>
          </Link>
          <Link href="/customers" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${pathname === '/customers' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <Users size={20} className={pathname === '/customers' ? 'text-white' : 'text-purple-400'} /> 
            <span className="font-medium">Khách hàng</span>
          </Link>
          
          {/* Chuyên mục riêng cho Admin */}
          {role === 'admin' && (
            <>
              <p className="text-xs font-bold text-slate-500 mb-2 ml-2 mt-6 uppercase tracking-widest">Quản trị Hệ thống</p>
              <Link href="/" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${pathname === '/' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <LayoutDashboard size={20} className={pathname === '/' ? 'text-white' : 'text-blue-400'} /> 
                <span className="font-medium">Dashboard</span>
              </Link>
              <Link href="/inventory" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${pathname === '/inventory' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <Package size={20} className={pathname === '/inventory' ? 'text-white' : 'text-orange-400'} /> 
                <span className="font-medium">Tồn kho</span>
              </Link>
              <Link href="/accounting" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${pathname === '/accounting' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <Calculator size={20} className={pathname === '/accounting' ? 'text-white' : 'text-yellow-400'} /> 
                <span className="font-medium">Kế toán</span>
              </Link>
            </>
          )}
        </nav>

        {/* Thông tin User & Đăng xuất */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-blue-400 border border-slate-700">
              {role === 'admin' ? 'A' : 'S'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-slate-200 truncate">{session.user.email}</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest">{role === 'admin' ? 'Quản lý' : 'Nhân viên'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-600 p-2.5 rounded-lg text-sm font-semibold transition-colors">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Nội dung chính */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {isBlocked ? (
           <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <Lock size={64} className="text-gray-300 mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Truy cập bị từ chối</h1>
              <p className="text-gray-500">Tài khoản của bạn không có quyền truy cập vào khu vực quản trị này.</p>
           </div>
        ) : (
          children
        )}
      </main>

    </div>
  )
}