'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  DollarSign, TrendingUp, PieChart, BarChart3, PlusCircle, 
  Trash2, Wallet, Layers, Receipt, ArrowDownCircle, Search, Calendar
} from 'lucide-react'

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
]

const EXPENSE_CATEGORIES = [
  'Tiền thuê mặt bằng / Kho bãi',
  'Quảng cáo & Marketing',
  'Bao bì, túi zip & đóng gói',
  'Cước vận chuyển / Giao hàng',
  'Lương & Thưởng nhân viên',
  'Điện, nước, internet & tiện ích',
  'Phụ kiện & vật tư shop',
  'Chi phí phát sinh khác'
]

export default function AccountingPage() {
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Bộ lọc biểu đồ cột doanh thu: Ngày | Tuần | Tháng | Quý | Năm
  const [chartView, setChartView] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month')

  // Form book chi phí
  const [expenseForm, setExpenseForm] = useState({
    danh_muc: EXPENSE_CATEGORIES[0],
    so_tien: '',
    ngay_chi: new Date().toLocaleDateString('en-CA'),
    nguoi_chi: '',
    ghi_chu: ''
  })
  const [expenseSearch, setExpenseSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [salesRes, expRes] = await Promise.all([
      supabase.from('sales').select('*, inventory(ten_ao, size, gia_nhap), customers(ho_ten)').order('ngay_ban', { ascending: false }),
      supabase.from('expenses').select('*').order('ngay_chi', { ascending: false })
    ])

    if (salesRes.data) {
      setSales(salesRes.data.filter((s: any) => s.trang_thai_don !== 'BI_BOM'))
    }
    if (expRes.data) {
      setExpenses(expRes.data)
    }
    setLoading(false)
  }

  // 1. TỔNG HỢP TÀI CHÍNH TOÀN DIỆN (REVENUE - COGS - OPEX = NET PROFIT)
  const financialSummary = useMemo(() => {
    let totalRevenue = 0
    let totalCOGS = 0
    let totalDeposit = 0

    sales.forEach(s => {
      const rev = Number(s.tong_tien) || 0
      const qty = Number(s.so_luong_ban) || 0
      const cost = Number(s.inventory?.gia_nhap) || 0

      totalRevenue += rev
      totalCOGS += (cost * qty)
      totalDeposit += (Number(s.tien_coc) || 0)
    })

    const grossProfit = totalRevenue - totalCOGS
    const totalExpenses = expenses.reduce((acc, exp) => acc + (Number(exp.so_tien) || 0), 0)
    const netProfit = grossProfit - totalExpenses
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    return { totalRevenue, totalCOGS, grossProfit, totalExpenses, netProfit, netMargin, totalDeposit }
  }, [sales, expenses])

  // 2. BIỂU ĐỒ DOANH THU THEO CHU KỲ (NGÀY, TUẦN, THÁNG, QUÝ, NĂM)
  const timelineData = useMemo(() => {
    const map: { [key: string]: { label: string; revenue: number; orderCount: number; timestamp: number } } = {}

    sales.forEach(s => {
      const date = new Date(s.ngay_ban)
      const rev = Number(s.tong_tien) || 0
      let key = ''
      let label = ''

      if (chartView === 'day') {
        key = date.toLocaleDateString('en-CA')
        label = `${date.getDate()}/${date.getMonth() + 1}`
      } else if (chartView === 'week') {
        const startOfYear = new Date(date.getFullYear(), 0, 1)
        const weekNum = Math.ceil((((date.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7)
        key = `${date.getFullYear()}-W${weekNum}`
        label = `T${weekNum} (${date.getFullYear()})`
      } else if (chartView === 'month') {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`
        label = `Thg ${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`
      } else if (chartView === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `${date.getFullYear()}-Q${quarter}`
        label = `Q${quarter}/${date.getFullYear()}`
      } else if (chartView === 'year') {
        key = `${date.getFullYear()}`
        label = `Năm ${date.getFullYear()}`
      }

      if (!map[key]) {
        map[key] = { label, revenue: 0, orderCount: 0, timestamp: date.getTime() }
      }
      map[key].revenue += rev
      map[key].orderCount += 1
    })

    const sorted = Object.values(map).sort((a, b) => a.timestamp - b.timestamp)
    return sorted.slice(-12)
  }, [sales, chartView])

  const maxRevenue = useMemo(() => {
    return Math.max(...timelineData.map(d => d.revenue), 1)
  }, [timelineData])

  // 3. BREAKDOWN DOANH THU THEO SẢN PHẨM (DONUT CHART)
  const productBreakdown = useMemo(() => {
    const productMap: { [key: string]: { name: string; revenue: number; quantity: number } } = {}
    let grandTotal = 0

    sales.forEach(s => {
      const name = s.inventory?.ten_ao || 'Sản phẩm khác'
      const rev = Number(s.tong_tien) || 0
      const qty = Number(s.so_luong_ban) || 0

      if (!productMap[name]) {
        productMap[name] = { name, revenue: 0, quantity: 0 }
      }
      productMap[name].revenue += rev
      productMap[name].quantity += qty
      grandTotal += rev
    })

    const sorted = Object.values(productMap).sort((a, b) => b.revenue - a.revenue)
    const top = sorted.slice(0, 5)
    const others = sorted.slice(5)
    
    if (others.length > 0) {
      top.push({
        name: 'Các mẫu khác',
        revenue: others.reduce((acc, curr) => acc + curr.revenue, 0),
        quantity: others.reduce((acc, curr) => acc + curr.quantity, 0)
      })
    }

    let accumulatedPercent = 0
    return top.map((item, index) => {
      const percent = grandTotal > 0 ? (item.revenue / grandTotal) * 100 : 0
      const offset = accumulatedPercent
      accumulatedPercent += percent

      return {
        ...item,
        percent,
        offset,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }
    })
  }, [sales])

  // 4. XỬ LÝ BOOK CHI PHÍ MỚI
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseForm.so_tien || Number(expenseForm.so_tien) <= 0) {
      return alert('Vui lòng nhập số tiền chi hợp lệ!')
    }

    const { error } = await supabase.from('expenses').insert([{
      danh_muc: expenseForm.danh_muc,
      so_tien: Number(expenseForm.so_tien),
      ngay_chi: new Date(expenseForm.ngay_chi).toISOString(),
      nguoi_chi: expenseForm.nguoi_chi || 'Quản lý',
      ghi_chu: expenseForm.ghi_chu
    }])

    if (!error) {
      alert('Đã book chi phí thành công!')
      setExpenseForm({
        danh_muc: EXPENSE_CATEGORIES[0],
        so_tien: '',
        ngay_chi: new Date().toLocaleDateString('en-CA'),
        nguoi_chi: '',
        ghi_chu: ''
      })
      fetchData()
    } else {
      alert('Lỗi book chi phí: ' + error.message)
    }
  }

  // 5. XÓA BẢN GHI CHI PHÍ
  const handleDeleteExpense = async (id: any) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phiếu chi này?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) {
      fetchData()
    } else {
      alert('Lỗi xóa chi phí: ' + error.message)
    }
  }

  // Lọc danh sách chi phí
  const filteredExpenses = expenses.filter(exp => 
    exp.danh_muc.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    (exp.ghi_chu && exp.ghi_chu.toLowerCase().includes(expenseSearch.toLowerCase())) ||
    (exp.nguoi_chi && exp.nguoi_chi.toLowerCase().includes(expenseSearch.toLowerCase()))
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* HEADER TÀI CHÍNH */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
            <DollarSign size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Báo Cáo Kế Toán & Quản Trị Chi Phí</h1>
            <p className="text-xs text-gray-500 mt-0.5">Quản lý dòng tiền, ghi nhận chi phí vận hành & lợi nhuận thực tế</p>
          </div>
        </div>
      </div>

      {/* THẺ TỔNG HỢP TÀI CHÍNH (5 THẺ CHUẨN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
          <span className="text-gray-500 text-[11px] font-bold block">TỔNG DOANH THU</span>
          <div className="text-xl font-black text-gray-900">{financialSummary.totalRevenue.toLocaleString('vi-VN')} đ</div>
          <span className="text-[10px] text-gray-400">Doanh thu thuần đã chốt</span>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
          <span className="text-gray-500 text-[11px] font-bold block">LỢI NHUẬN GỘP</span>
          <div className="text-xl font-black text-emerald-600">+{financialSummary.grossProfit.toLocaleString('vi-VN')} đ</div>
          <span className="text-[10px] text-gray-400">Doanh thu - Giá vốn áo</span>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
          <span className="text-gray-500 text-[11px] font-bold block text-red-600">CHI PHÍ ĐÃ BOOK (OPEX)</span>
          <div className="text-xl font-black text-red-600">-{financialSummary.totalExpenses.toLocaleString('vi-VN')} đ</div>
          <span className="text-[10px] text-gray-400">Tổng các khoản chi shop</span>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1 bg-gradient-to-br from-indigo-50/50 to-white">
          <span className="text-indigo-900 text-[11px] font-bold block">LỢI NHUẬN RÒNG (NET)</span>
          <div className={`text-xl font-black ${financialSummary.netProfit >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
            {financialSummary.netProfit.toLocaleString('vi-VN')} đ
          </div>
          <span className="text-[10px] text-indigo-600 font-semibold">Tỷ suất ròng: {financialSummary.netMargin.toFixed(1)}%</span>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
          <span className="text-gray-500 text-[11px] font-bold block">TIỀN CỌC ĐÃ THU</span>
          <div className="text-xl font-black text-amber-700">{financialSummary.totalDeposit.toLocaleString('vi-VN')} đ</div>
          <span className="text-[10px] text-gray-400">Tiền khách trả trước</span>
        </div>
      </div>

      {/* PHẦN 1: BOOK CHI PHÍ & DANH SÁCH PHIẾU CHI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* FORM GHI NHẬN CHI PHÍ MỚI (4 CỘT) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border shadow-sm space-y-4 h-fit">
          <div className="border-b pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Receipt size={20} className="text-red-500" /> Book Chi Phí Vận Hành
            </h2>
            <span className="text-xs text-gray-400">Tạo phiếu chi</span>
          </div>

          <form onSubmit={handleAddExpense} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Danh mục chi phí</label>
              <select 
                className="w-full border rounded-lg p-2 text-sm bg-gray-50"
                value={expenseForm.danh_muc}
                onChange={e => setExpenseForm({ ...expenseForm, danh_muc: e.target.value })}
              >
                {EXPENSE_CATEGORIES.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Số tiền chi (VNĐ)</label>
                <input 
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  placeholder="VD: 150000"
                  className="w-full border rounded-lg p-2 text-sm font-bold text-red-600"
                  value={expenseForm.so_tien}
                  onChange={e => setExpenseForm({ ...expenseForm, so_tien: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày chi</label>
                <input 
                  type="date"
                  required
                  className="w-full border rounded-lg p-2 text-sm text-gray-700"
                  value={expenseForm.ngay_chi}
                  onChange={e => setExpenseForm({ ...expenseForm, ngay_chi: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Người chi / Thủ quỹ</label>
              <input 
                type="text"
                placeholder="VD: Admin, Thu ngân A..."
                className="w-full border rounded-lg p-2 text-sm"
                value={expenseForm.nguoi_chi}
                onChange={e => setExpenseForm({ ...expenseForm, nguoi_chi: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú & Lý do chi tiết</label>
              <textarea 
                rows={2}
                placeholder="VD: Mua 100 túi zip đóng áo, tiền điện tháng 9..."
                className="w-full border rounded-lg p-2 text-sm"
                value={expenseForm.ghi_chu}
                onChange={e => setExpenseForm({ ...expenseForm, ghi_chu: e.target.value })}
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <PlusCircle size={18} /> GHI NHẬN KHOẢN CHI
            </button>
          </form>
        </div>

        {/* BẢNG LỊCH SỬ BOOK CHI PHÍ (8 CỘT) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-red-500" /> Sổ Chi Phí ({filteredExpenses.length})
            </span>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text"
                placeholder="Tìm danh mục, ghi chú, người chi..."
                className="pl-9 p-1.5 border rounded-lg w-full text-xs"
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[340px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-600 border-b sticky top-0">
                <tr>
                  <th className="p-3">Ngày chi</th>
                  <th className="p-3">Danh mục</th>
                  <th className="p-3">Ghi chú / Người chi</th>
                  <th className="p-3 text-right">Số tiền</th>
                  <th className="p-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-red-50/30">
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {new Date(exp.ngay_chi).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="p-3 font-semibold text-gray-800">{exp.danh_muc}</td>
                    <td className="p-3 text-gray-600">
                      <div>{exp.ghi_chu || '-'}</div>
                      <span className="text-[10px] text-gray-400">Người chi: {exp.nguoi_chi || 'Quản lý'}</span>
                    </td>
                    <td className="p-3 text-right font-black text-red-600 text-sm whitespace-nowrap">
                      -{Number(exp.so_tien).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => handleDeleteExpense(exp.id)} 
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Xóa phiếu chi"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">Chưa có khoản chi phí nào được book.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* PHẦN 2: BIỂU ĐỒ DOANH THU & BREAKDOWN SẢN PHẨM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* BIỂU ĐỒ CỘT DOANH THU (7 PHẦN) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-600" /> Biểu Đồ Doanh Thu
              </h2>
              <p className="text-xs text-gray-500">Biến động doanh thu theo các mốc thời gian</p>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
              <button onClick={() => setChartView('day')} className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'day' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Ngày</button>
              <button onClick={() => setChartView('week')} className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'week' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Tuần</button>
              <button onClick={() => setChartView('month')} className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'month' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Tháng</button>
              <button onClick={() => setChartView('quarter')} className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'quarter' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Quý</button>
              <button onClick={() => setChartView('year')} className={`px-3 py-1.5 rounded-lg transition-all ${chartView === 'year' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Năm</button>
            </div>
          </div>

          <div className="h-64 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b">
            {timelineData.map((d, index) => {
              const heightPercent = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
              return (
                <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] rounded-lg py-1 px-2 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                    <div className="font-bold">{d.revenue.toLocaleString('vi-VN')} đ</div>
                    <div className="text-gray-300">{d.orderCount} đơn hàng</div>
                  </div>

                  <div 
                    className="w-full max-w-[42px] bg-gradient-to-t from-indigo-600 to-blue-500 rounded-t-lg transition-all duration-500 group-hover:from-indigo-700 shadow-sm"
                    style={{ height: `${Math.max(heightPercent, 6)}%` }}
                  ></div>

                  <span className="text-[11px] text-gray-500 font-medium mt-2 truncate w-full text-center">
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Đơn vị: VNĐ</span>
            <span>💡 Rê chuột vào từng cột để xem chi tiết doanh thu & số đơn</span>
          </div>
        </div>

        {/* BIỂU ĐỒ TRÒN SẢN PHẨM (5 PHẦN) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PieChart size={20} className="text-emerald-600" /> Cơ Cấu Doanh Thu Sản Phẩm
            </h2>
            <p className="text-xs text-gray-500">Tỷ trọng đóng góp doanh thu theo từng mẫu áo</p>
          </div>

          <div className="flex flex-col items-center justify-center pt-1">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
                <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#F3F4F6" strokeWidth="6" />
                {productBreakdown.map((item, idx) => (
                  <circle
                    key={idx}
                    cx="21"
                    cy="21"
                    r="15.91549430918954"
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="6"
                    strokeDasharray={`${item.percent} ${100 - item.percent}`}
                    strokeDashoffset={-item.offset}
                    className="transition-all duration-700 hover:opacity-80"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ĐÃ BÁN</span>
                <span className="text-sm font-black text-gray-900">
                  {sales.reduce((acc, s) => acc + (Number(s.so_luong_ban) || 0), 0)} áo
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
            {productBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-1 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2 truncate max-w-[190px]">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                  <span className="font-semibold text-gray-800 truncate" title={item.name}>{item.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-gray-900">{Number(item.revenue).toLocaleString('vi-VN')} đ</span>
                  <span className="text-gray-400 font-medium ml-1.5">({item.percent.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}