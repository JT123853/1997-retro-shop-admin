'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
// hoặc dùng alias: import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, 
  X, Calendar, Search, Download, Clock, Zap, CheckCircle2, AlertCircle 
} from 'lucide-react'

export default function DashboardPage() {
  const [sales, setSales] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  
  // Bộ lọc thời gian & Cấu hình chuỗi cung ứng
  const [timeRange, setTimeRange] = useState<'all' | 'today' | '7days' | '30days'>('all')
  const [leadTime, setLeadTime] = useState<number>(7)
  const [searchQuery, setSearchQuery] = useState('')

  // State xem đối soát Audit Trail
  const [selectedAuditItem, setSelectedAuditItem] = useState<any | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    const [salesRes, invRes, recRes] = await Promise.all([
      supabase.from('sales').select('*, customers(ho_ten), inventory(ten_ao, size, gia_nhap)').order('ngay_ban', { ascending: false }),
      supabase.from('inventory').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory_receipts').select('*').order('created_at', { ascending: false })
    ])
    if (salesRes.data) setSales(salesRes.data)
    if (invRes.data) setInventory(invRes.data)
    if (recRes.data) setReceipts(recRes.data)
  }

  // Lọc doanh số hợp lệ (loại trừ đơn bị bom) theo khung thời gian
  const validSales = sales.filter(s => {
    if (s.trang_thai_don === 'BI_BOM') return false
    if (timeRange === 'all') return true
    
    const saleDate = new Date(s.ngay_ban).getTime()
    const now = new Date().getTime()
    const diffDays = (now - saleDate) / (1000 * 3600 * 24)

    if (timeRange === 'today') return diffDays <= 1
    if (timeRange === '7days') return diffDays <= 7
    if (timeRange === '30days') return diffDays <= 30
    return true
  })

  // Số ngày để tính Velocity
  const effectiveDays = timeRange === 'today' ? 1 : timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 60

  // 1. TÍNH TOÁN METRICS CHI TIẾT CHO TỪNG SẢN PHẨM
  const productMetrics = inventory.map(item => {
    const itemSales = validSales.filter(s => s.inventory_id === item.id)
    const totalSold = itemSales.reduce((acc, s) => acc + s.so_luong_ban, 0)
    const revenue = itemSales.reduce((acc, s) => acc + Number(s.tong_tien), 0)
    const cogs = totalSold * Number(item.gia_nhap) // Giá vốn hàng bán
    const grossProfit = revenue - cogs
    
    const currentStock = Number(item.so_luong)
    const holdingValue = currentStock * Number(item.gia_nhap)
    
    // Luồng In từ lịch sử nhập
    const itemReceipts = receipts.filter(r => r.inventory_id === String(item.id))
    const totalInFromReceipts = itemReceipts.reduce((acc, r) => acc + Number(r.so_luong_nhap), 0)
    
    // Nếu chưa có nhật ký nhập, tổng nhập lý thuyết = tồn hiện tại + đã bán
    const totalInflow = totalInFromReceipts > 0 ? totalInFromReceipts : (currentStock + totalSold)
    
    const str = totalInflow > 0 ? (totalSold / totalInflow) * 100 : 0
    const gmroi = holdingValue > 0 ? (grossProfit / holdingValue) : (totalSold > 0 ? 999 : 0)

    // Tốc độ bán (Sales Velocity)
    const velocityDaily = totalSold / effectiveDays
    const daysPerItem = velocityDaily > 0 ? (1 / velocityDaily) : 0

    // Điểm đặt hàng ROP: ROP = (Nhu cầu bình quân ngày * Lead Time) + Safety Stock (giả định 1 áo an toàn)
    const rop = Math.ceil((velocityDaily * leadTime) + (velocityDaily > 0 ? 1 : 0))
    let ropStatus: 'OUT' | 'WARNING' | 'SAFE' = 'SAFE'
    if (currentStock === 0) ropStatus = 'OUT'
    else if (currentStock <= rop) ropStatus = 'WARNING'

    return {
      ...item,
      totalSold,
      revenue,
      grossProfit,
      holdingValue,
      str,
      gmroi,
      velocityDaily,
      daysPerItem,
      rop,
      ropStatus,
      totalInflow,
      salesList: itemSales,
      receiptList: itemReceipts
    }
  })

  // 2. TOP SẢN PHẨM BÁN CHẠY (SALES VELOCITY)
  const topProducts = [...productMetrics]
    .filter(p => p.totalSold > 0)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 5)

  // 3. DANH SÁCH CẢNH BÁO ROP
  const ropAlerts = [...productMetrics]
    .filter(p => p.ropStatus !== 'SAFE')
    .sort((a, b) => a.so_luong - b.so_luong)

  // 4. LỌC BẢNG GMROI THEO TỪ KHÓA TÌM KIẾM
  const filteredMetrics = productMetrics.filter(p => 
    p.ten_ao.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.size.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 5. XUẤT BÁO CÁO EXCEL (CHUẨN UTF-8 CSV)
  const handleExportExcel = () => {
    let csvContent = '\uFEFF' // Ký tự BOM chống lỗi font tiếng Việt trong Excel
    csvContent += 'BÁO CÁO QUẢN TRỊ KHO & HIỆU QUẢ VỐN - 1997 RETRO SHOP\n'
    csvContent += `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}\n\n`
    csvContent += 'Tên áo,Size,Đã bán (áo),Tồn kho (áo),Tỷ lệ bán (STR %),Lợi nhuận gộp (đ),Vốn đọng kho (đ),GMROI,ROP Cảnh báo,Tình trạng\n'

    productMetrics.forEach(p => {
      const statusText = p.ropStatus === 'OUT' ? 'ĐỨT GÃY' : p.ropStatus === 'WARNING' ? 'CẦN NHẬP' : 'AN TOÀN'
      csvContent += `"${p.ten_ao}","${p.size}",${p.totalSold},${p.so_luong},${p.str.toFixed(1)}%,${p.grossProfit},${p.holdingValue},${p.gmroi.toFixed(2)},${p.rop},"${statusText}"\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Bao_Cao_Chien_Luoc_1997Retro_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      
      {/* HEADER CHIẾN LƯỢC */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
            <TrendingUp size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Dashboard Quản Trị Chiến Lược</h1>
            <p className="text-xs text-gray-500 mt-0.5">Phân tích chuỗi cung ứng, hiệu quả vốn & tốc độ quay vòng</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Lọc thời gian */}
          <select 
            className="border rounded-lg p-2 text-sm bg-white shadow-sm font-medium text-gray-700"
            value={timeRange}
            onChange={(e: any) => setTimeRange(e.target.value)}
          >
            <option value="all">Toàn thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày qua</option>
            <option value="30days">30 ngày qua</option>
          </select>

          {/* Xuất file Excel */}
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            <Download size={16} /> Xuất Excel
          </button>

          {/* Lead time input */}
          <div className="flex items-center gap-2 bg-white border px-3 py-1.5 rounded-lg shadow-sm text-sm">
            <Clock size={16} className="text-gray-500" />
            <span className="text-xs text-gray-600">Lead Time:</span>
            <input 
              type="number" 
              min="1" 
              className="w-12 border rounded text-center text-sm font-bold p-0.5" 
              value={leadTime} 
              onChange={e => setLeadTime(Math.max(1, Number(e.target.value)))} 
            />
            <span className="text-xs text-gray-500">ngày</span>
          </div>
        </div>
      </div>

      {/* KHỐI 1: TOP SẢN PHẨM & CẢNH BÁO ROP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* TOP SẢN PHẨM (SALES VELOCITY) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Zap size={20} className="text-emerald-500" /> Top Sản Phẩm (Sales Velocity)
            </h2>
            <span className="text-xs text-gray-400">Tốc độ tiêu thụ nhanh nhất</span>
          </div>

          <div className="space-y-3">
            {topProducts.map((p, idx) => (
              <div key={p.id} className="p-3 bg-gray-50 rounded-xl hover:bg-emerald-50/50 border transition-all">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-gray-800 text-sm">
                    #{idx + 1} {p.ten_ao} <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">Size {p.size}</span>
                  </span>
                  <span className="font-extrabold text-emerald-600 text-sm">{p.totalSold} áo đã bán</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 border-t pt-1.5">
                  <span>⏱ TB: <b>{p.daysPerItem > 0 ? p.daysPerItem.toFixed(1) : 0} ngày/áo</b></span>
                  <span>📦 Tốc độ: <b>{p.velocityDaily.toFixed(2)} áo/ngày</b></span>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-center text-gray-400 py-6 text-sm">Chưa có dữ liệu bán trong thời gian này.</p>
            )}
          </div>
        </div>

        {/* CẢNH BÁO ĐIỂM ĐẶT HÀNG (ROP) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-500" /> Cảnh Báo Điểm Đặt Hàng (ROP)
            </h2>
            <span className="text-xs text-gray-400">Dựa trên Lead time {leadTime} ngày</span>
          </div>

          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500 bg-gray-50 border-b">
                <tr>
                  <th className="p-2.5">Sản phẩm</th>
                  <th className="p-2.5 text-center">Tồn / ROP</th>
                  <th className="p-2.5 text-center">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ropAlerts.map(p => (
                  <tr key={p.id} className="hover:bg-red-50/40">
                    <td className="p-2.5 font-medium">
                      <div>{p.ten_ao}</div>
                      <span className="text-gray-400">Size {p.size}</span>
                    </td>
                    <td className="p-2.5 text-center font-bold">
                      <span className="text-red-600">{p.so_luong}</span> / {p.rop}
                    </td>
                    <td className="p-2.5 text-center">
                      {p.ropStatus === 'OUT' ? (
                        <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">ĐỨT GÃY</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">CẦN NHẬP</span>
                      )}
                    </td>
                  </tr>
                ))}
                {ropAlerts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-emerald-600 font-medium">
                      🎉 Tất cả sản phẩm đều đang ở mức tồn kho an toàn!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* KHỐI 2: HIỆU QUẢ VỐN & KHẢ NĂNG SINH LỜI (GMROI & STR) */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Layers className="text-blue-400" size={24} />
            <div>
              <h2 className="text-lg font-bold">Hiệu Quả Vốn & Khả Năng Sinh Lời (GMROI & STR)</h2>
              <span className="text-xs text-slate-400 italic">💡 Nhấp chuột vào bất kỳ sản phẩm nào để mở Báo Cáo Đối Soát Luồng IN - OUT</span>
            </div>
          </div>

          {/* Thanh tìm kiếm trực tiếp áo trong bảng */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm tên áo hoặc size..." 
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b text-xs text-gray-600">
              <tr>
                <th className="p-4">Sản phẩm / Size</th>
                <th className="p-4 text-center">Tỷ lệ bán xuyên suốt (STR)</th>
                <th className="p-4 text-right">Lợi nhuận gộp</th>
                <th className="p-4 text-right">Vốn đang chôn</th>
                <th className="p-4 text-center">Chỉ số GMROI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMetrics.map(item => (
                <tr 
                  key={item.id} 
                  onClick={() => setSelectedAuditItem(item)}
                  className="hover:bg-blue-50/70 cursor-pointer transition-colors group"
                >
                  <td className="p-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-600 flex items-center gap-2">
                      {item.ten_ao}
                      <span className="text-[11px] text-blue-500 font-semibold bg-blue-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        🔍 Xem đối soát
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Size: <b className="text-gray-700">{item.size}</b> | Đã bán: <b className="text-orange-600">{item.totalSold} áo</b> | Tồn kho: <b className="text-slate-800">{item.so_luong} áo</b>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-bold text-sm text-gray-800">{item.str.toFixed(0)}%</div>
                    <div className="w-24 bg-gray-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(item.str, 100)}%` }}></div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-600">
                    +{Number(item.grossProfit).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="p-4 text-right font-medium text-gray-600">
                    {Number(item.holdingValue).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="p-4 text-center">
                    {item.holdingValue === 0 && item.totalSold > 0 ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded">ĐÃ THU HỒI VỐN</span>
                    ) : (
                      <span className="font-black text-blue-700">{item.gmroi.toFixed(2)}x</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredMetrics.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">Không tìm thấy sản phẩm nào khớp với tìm kiếm.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BÁO CÁO ĐỐI SOÁT LUỒNG IN - OUT (AUDIT TRAIL CHUẨN XÁC) */}
      {selectedAuditItem && (() => {
        const totalIn = selectedAuditItem.receiptList.reduce((acc: number, r: any) => acc + Number(r.so_luong_nhap), 0) || selectedAuditItem.totalInflow
        const totalOut = selectedAuditItem.totalSold
        const actualStock = selectedAuditItem.so_luong
        const theoreticalStock = totalIn - totalOut
        const isMatched = theoreticalStock === actualStock

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded">
                    BÁO CÁO ĐỐI SOÁT LUỒNG IN - OUT
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 mt-1.5">
                    {selectedAuditItem.ten_ao} (Size: {selectedAuditItem.size})
                  </h3>
                </div>
                <button onClick={() => setSelectedAuditItem(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              {/* 3 THẺ TỔNG HỢP LOGIC */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-xs font-bold text-emerald-800">TỔNG NHẬP VÀO (IN)</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{totalIn} áo</div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <span className="text-xs font-bold text-orange-800">TỔNG XUẤT BÁN (OUT)</span>
                  <div className="text-2xl font-black text-orange-700 mt-1">{totalOut} áo</div>
                </div>
                <div className={`p-4 border rounded-xl ${isMatched ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-300'}`}>
                  <span className={`text-xs font-bold ${isMatched ? 'text-slate-800' : 'text-red-800'}`}>TỒN KHO THỰC TẾ</span>
                  <div className={`text-2xl font-black mt-1 ${isMatched ? 'text-slate-900' : 'text-red-600'}`}>{actualStock} áo</div>
                </div>
              </div>

              {/* CẢNH BÁO ĐỐI SOÁT (NẾU CÓ CHÊNH LỆCH) */}
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${isMatched ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                {isMatched ? (
                  <>
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                    <span><b>Logic khớp 100%:</b> Tổng nhập ({totalIn}) - Đã bán ({totalOut}) = Tồn kho thực tế ({actualStock} áo).</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span><b>Lệch đối soát:</b> Nhập ({totalIn}) - Bán ({totalOut}) = {theoreticalStock} áo, nhưng trong kho đang lưu {actualStock} áo (Chênh lệch: {actualStock - theoreticalStock} áo). Hãy kiểm tra lại các lần chỉnh kho thủ công.</span>
                  </>
                )}
              </div>

              {/* 2 CỘT CHI TIẾT IN - OUT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* LUỒNG IN */}
                <div className="border rounded-xl p-4 space-y-3 bg-gray-50/50">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 border-b pb-2">
                    <ArrowDownRight size={18} className="text-emerald-600" /> Lịch sử Nhập hàng (Luồng In)
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedAuditItem.receiptList.length > 0 ? selectedAuditItem.receiptList.map((r: any) => (
                      <div key={r.id} className="p-3 bg-white border rounded-lg text-xs space-y-1 shadow-2xl shadow-gray-100">
                        <div className="flex justify-between font-bold">
                          <span className="text-emerald-700 text-sm">+{r.so_luong_nhap} áo nhập</span>
                          <span className="text-gray-500">{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="text-gray-600">Giá vốn: {Number(r.gia_nhap).toLocaleString('vi-VN')} đ</div>
                        <div className="text-gray-500 italic">📝 {r.ghi_chu || 'Nhập kho'}</div>
                      </div>
                    )) : (
                      <div className="p-4 text-center text-xs text-gray-400">Chưa có lịch sử nhập ghi nhận trong hệ thống</div>
                    )}
                  </div>
                </div>

                {/* LUỒNG OUT */}
                <div className="border rounded-xl p-4 space-y-3 bg-gray-50/50">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 border-b pb-2">
                    <ArrowUpRight size={18} className="text-orange-600" /> Lịch sử Bán hàng (Luồng Out)
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedAuditItem.salesList.map((s: any) => (
                      <div key={s.id} className="p-3 bg-white border rounded-lg text-xs space-y-1 shadow-2xl shadow-gray-100">
                        <div className="flex justify-between font-bold">
                          <span className="text-blue-600">{s.ma_don_hang}</span>
                          <span className="text-orange-600 font-extrabold text-sm">Đã bán: x{s.so_luong_ban} áo</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>KH: {s.customers?.ho_ten || 'Khách lẻ'}</span>
                          <span>{new Date(s.ngay_ban).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="text-[11px] text-gray-400">Thu ngân: {s.ten_nhan_vien || 'Admin'}</div>
                      </div>
                    ))}
                    {selectedAuditItem.salesList.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400">Chưa có đơn hàng nào bán sản phẩm này.</div>
                    )}
                  </div>
                </div>

              </div>

              <div className="text-right border-t pt-3">
                <button 
                  onClick={() => setSelectedAuditItem(null)} 
                  className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl text-sm hover:bg-gray-800 transition-all shadow-md"
                >
                  Đóng
                </button>
              </div>

            </div>
          </div>
        )
      })()}

    </div>
  )
}