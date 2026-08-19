'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, TrendingUp, Clock, Truck, Package, Activity, BarChart3, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<any[]>([])
  const [leadTime, setLeadTime] = useState<number>(7) 
  const [isLoading, setIsLoading] = useState(true)
  const [exportPeriod, setExportPeriod] = useState('ALL') // State lưu kỳ báo cáo

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    // Lấy dữ liệu tồn kho và dữ liệu bán hàng (CHỈ lấy đơn THANH_CONG, loại bỏ đơn BỊ BOM)
    const [invRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('*'),
      supabase.from('sales').select('*').eq('trang_thai_don', 'THANH_CONG')
    ])

    if (invRes.data && salesRes.data) {
      const inventory = invRes.data
      const sales = salesRes.data
      const now = new Date().getTime()

      const processedData = inventory.map(item => {
        const itemSales = sales.filter(s => s.inventory_id === item.id)
        
        // 1. Tính toán Tốc độ bán (Sales Velocity)
        const totalSold = itemSales.reduce((acc, curr) => acc + curr.so_luong_ban, 0)
        let salesPerDay = 0
        let avgDaysPerShirt = 0
        let daysElapsed = 1

        if (totalSold > 0) {
          const dates = itemSales.map(s => new Date(s.ngay_ban).getTime())
          const earliestSale = Math.min(...dates)
          daysElapsed = (now - earliestSale) / (1000 * 3600 * 24)
          if (daysElapsed < 1) daysElapsed = 1 
          salesPerDay = totalSold / daysElapsed
          avgDaysPerShirt = daysElapsed / totalSold
        }

        // 2. Tính Tỷ lệ bán xuyên suốt (STR)
        const totalReceived = item.so_luong + totalSold
        const sellThroughRate = totalReceived > 0 ? (totalSold / totalReceived) * 100 : 0

        // 3. Tính toán tài chính cho GMROI
        const totalRevenue = itemSales.reduce((acc, curr) => acc + Number(curr.tong_tien), 0)
        const cogs = totalSold * Number(item.gia_nhap)
        const grossMargin = totalRevenue - cogs 
        
        const currentCapitalTiedUp = item.so_luong * Number(item.gia_nhap) 
        
        let gmroi = 0
        let isCapitalRecovered = false

        if (currentCapitalTiedUp > 0) {
          gmroi = grossMargin / currentCapitalTiedUp
        } else if (currentCapitalTiedUp === 0 && totalSold > 0) {
          isCapitalRecovered = true 
        }

        return {
          ...item,
          totalSold,
          salesPerDay,
          avgDaysPerShirt,
          sellThroughRate,
          totalRevenue,
          grossMargin,
          currentCapitalTiedUp,
          gmroi,
          isCapitalRecovered
        }
      })

      processedData.sort((a, b) => b.totalSold - a.totalSold)
      setDashboardData(processedData)
    }
    setIsLoading(false)
  }

  // Hàm xuất file Excel báo cáo có Lọc Thời Gian
  const handleExportExcel = async () => {
    alert('Đang tính toán và tổng hợp dữ liệu Excel, vui lòng đợi giây lát...')
    
    const [salesRes, expenseRes] = await Promise.all([
      supabase.from('sales').select('*, inventory(ten_ao, gia_nhap)').eq('trang_thai_don', 'THANH_CONG'),
      supabase.from('custom_expenses').select('*')
    ])

    let sales = salesRes.data || []
    let expenses = expenseRes.data || []

    // XỬ LÝ LOGIC LỌC THỜI GIAN
    const now = new Date()
    let startDate = new Date(0) // Mặc định từ năm 1970
    let endDate = new Date(3000, 0, 1) // Đến năm 3000

    if (exportPeriod === 'CURRENT_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    } else if (exportPeriod === 'LAST_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    } else if (exportPeriod === 'CURRENT_QUARTER') {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
      endDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59)
    }

    // Lọc mảng dữ liệu dựa trên ngày
    sales = sales.filter(s => {
      const d = new Date(s.ngay_ban)
      return d >= startDate && d <= endDate
    })
    expenses = expenses.filter(e => {
      const d = new Date(e.created_at)
      return d >= startDate && d <= endDate
    })

    let tongDoanhThu = 0
    let tongGiaVon = 0
    
    const excelSalesData = sales.map(s => {
      tongDoanhThu += Number(s.tong_tien)
      const giaVonDonHang = s.so_luong_ban * Number(s.inventory?.gia_nhap || 0)
      tongGiaVon += giaVonDonHang

      return {
        'Ngày Bán': new Date(s.ngay_ban).toLocaleDateString('vi-VN'),
        'Nhân viên': s.ten_nhan_vien || 'N/A',
        'Sản Phẩm': s.inventory?.ten_ao,
        'Số Lượng': s.so_luong_ban,
        'Chiết Khấu (%)': s.khuyen_mai,
        'Ghi Chú Giảm Giá': s.ghi_chu_giam_gia,
        'Doanh Thu Thực Tế (VNĐ)': s.tong_tien,
        'Giá Vốn (VNĐ)': giaVonDonHang,
        'Lợi Nhuận Gộp (VNĐ)': s.tong_tien - giaVonDonHang
      }
    })

    const tongChiPhiVanhHanh = expenses.reduce((acc, curr) => acc + Number(curr.so_tien), 0)
    const excelExpenseData = expenses.map(e => ({
      'Ngày Chi': new Date(e.created_at).toLocaleDateString('vi-VN'),
      'Khoản Chi': e.ten_khoan_chi,
      'Ghi Chú': e.ghi_chu,
      'Số Tiền (VNĐ)': e.so_tien
    }))

    const summaryData = [
      { 'Chỉ Số': 'Kỳ báo cáo', 'Giá Trị (VNĐ)': exportPeriod },
      { 'Chỉ Số': 'Tổng Doanh Thu Thực Tế', 'Giá Trị (VNĐ)': tongDoanhThu },
      { 'Chỉ Số': 'Tổng Giá Vốn Hàng Bán', 'Giá Trị (VNĐ)': tongGiaVon },
      { 'Chỉ Số': 'Lợi Nhuận Gộp', 'Giá Trị (VNĐ)': tongDoanhThu - tongGiaVon },
      { 'Chỉ Số': 'Tổng Chi Phí Vận Hành', 'Giá Trị (VNĐ)': tongChiPhiVanhHanh },
      { 'Chỉ Số': 'LỢI NHUẬN RÒNG (LÃI THUẦN)', 'Giá Trị (VNĐ)': (tongDoanhThu - tongGiaVon) - tongChiPhiVanhHanh }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Tóm Tắt Lãi Lỗ")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelSalesData), "Chi Tiết Bán Hàng")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelExpenseData), "Chi Tiết Chi Phí")

    XLSX.writeFile(wb, `Bao_Cao_Tai_Chinh_1997Retro_${exportPeriod}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
  }

  const bestSellers = dashboardData.filter(d => d.totalSold > 0).slice(0, 5)
  
  const warnings = dashboardData.map(item => {
    const reorderPoint = Math.ceil(item.salesPerDay * leadTime)
    const daysUntilEmpty = item.salesPerDay > 0 ? Math.floor(item.so_luong / item.salesPerDay) : 999
    
    return {
      ...item,
      reorderPoint,
      daysUntilEmpty,
      isWarning: item.so_luong <= reorderPoint && item.so_luong > 0,
      isOutOfStock: item.so_luong === 0
    }
  }).filter(item => item.isWarning || item.isOutOfStock)
    .sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty)

  if (isLoading) return <div className="p-8 text-center text-gray-500">Đang chạy mô hình phân tích dữ liệu...</div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity size={32} className="text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Quản Trị Chiến Lược</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          
          {/* Cụm Dropdown chọn tháng/quý & Nút Xuất Excel */}
          <div className="flex items-center bg-white rounded-lg shadow-sm border overflow-hidden w-full sm:w-auto">
            <select 
              className="p-2 border-r bg-gray-50 text-sm font-medium text-gray-700 outline-none cursor-pointer"
              value={exportPeriod}
              onChange={(e) => setExportPeriod(e.target.value)}
            >
              <option value="ALL">Toàn thời gian</option>
              <option value="CURRENT_MONTH">Tháng này</option>
              <option value="LAST_MONTH">Tháng trước</option>
              <option value="CURRENT_QUARTER">Quý này</option>
            </select>
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 font-semibold transition-colors"
            >
              <Download size={18} /> Xuất Excel
            </button>
          </div>

          {/* Cài đặt Lead Time */}
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border flex items-center gap-3 w-full sm:w-auto justify-center">
            <Truck size={20} className="text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Lead Time (Chờ hàng):</label>
            <div className="flex items-center gap-1">
              <input 
                type="number" min="1" 
                className="w-16 border rounded p-1 text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-200" 
                value={leadTime} 
                onChange={e => setLeadTime(Number(e.target.value) || 1)} 
              />
              <span className="text-sm text-gray-500">ngày</span>
            </div>
          </div>
        </div>
      </div>

      {/* TẦNG 1: VẬN HÀNH CHUỖI CUNG ỨNG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Module Tốc độ bán */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-gray-50 flex items-center gap-2">
            <TrendingUp className="text-green-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Top Sản Phẩm (Sales Velocity)</h2>
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            {bestSellers.length > 0 ? (
              <div className="space-y-6">
                {bestSellers.map((item, index) => (
                  <div key={item.id} className="relative">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <span className="font-bold text-gray-800 text-lg">#{index + 1} {item.ten_ao}</span>
                        <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">Size {item.size}</span>
                      </div>
                      <div className="text-right font-bold text-green-600">{item.totalSold} áo đã bán</div>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-md border">
                      <div className="flex items-center gap-1">
                        <Clock size={16} className="text-blue-500"/> 
                        TB: <span className="font-semibold text-gray-700">{item.avgDaysPerShirt.toFixed(1)} ngày/áo</span>
                      </div>
                      <div className="border-l pl-4 flex items-center gap-1">
                        <Package size={16} className="text-orange-500"/>
                        Tốc độ: <span className="font-semibold text-gray-700">{item.salesPerDay.toFixed(2)} áo/ngày</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Chưa đủ dữ liệu.</p>
            )}
          </div>
        </div>

        {/* Module Cảnh báo Demand Sensing */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-red-50 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={20} />
            <h2 className="text-lg font-semibold text-red-800">Cảnh Báo Điểm Đặt Hàng (ROP)</h2>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="p-4 font-semibold text-gray-600">Sản phẩm</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">Tồn / ROP</th>
                  <th className="p-4 font-semibold text-gray-600">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {warnings.map(item => (
                  <tr key={item.id} className={item.isOutOfStock ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.ten_ao}</div>
                      <div className="text-xs text-gray-500">Size {item.size}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-lg font-bold ${item.isOutOfStock ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.so_luong}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-medium text-gray-600">{item.salesPerDay > 0 ? item.reorderPoint : 'N/A'}</span>
                    </td>
                    <td className="p-4">
                      {item.isOutOfStock ? (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">ĐỨT GÃY</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold w-fit">CẦN NHẬP</span>
                          <span className="text-xs text-gray-500">Hết trong: <b className="text-gray-700">{item.daysUntilEmpty} ngày</b></span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {warnings.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-gray-500">Kho đang ở mức an toàn.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TẦNG 2: PHÂN TÍCH TÀI CHÍNH (GMROI & STR) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-blue-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Hiệu Quả Vốn & Khả Năng Sinh Lời (GMROI & STR)</h2>
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-gray-600 w-1/4">Sản phẩm / Size</th>
                <th className="p-4 font-semibold text-gray-600 text-center">
                  Tỷ lệ bán xuyên suốt (STR)<br/>
                  <span className="text-xs font-normal text-gray-400">(Đã bán / Tổng nhập)</span>
                </th>
                <th className="p-4 font-semibold text-gray-600 text-right">
                  Lợi nhuận gộp<br/>
                  <span className="text-xs font-normal text-gray-400">(Đã trừ vốn)</span>
                </th>
                <th className="p-4 font-semibold text-gray-600 text-right">
                  Vốn đang chôn<br/>
                  <span className="text-xs font-normal text-gray-400">(Giá trị tồn kho)</span>
                </th>
                <th className="p-4 font-semibold text-gray-600 text-right">
                  Chỉ số GMROI<br/>
                  <span className="text-xs font-normal text-gray-400">(Lợi nhuận / 1đ vốn)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboardData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{item.ten_ao}</div>
                    <div className="text-xs text-gray-500">Size: {item.size}</div>
                  </td>
                  
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                        <div 
                          className={`h-2 rounded-full ${item.sellThroughRate > 70 ? 'bg-green-500' : item.sellThroughRate > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                          style={{ width: `${Math.min(item.sellThroughRate, 100)}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-gray-700 w-12">{item.sellThroughRate.toFixed(0)}%</span>
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    <div className="font-medium text-green-600">
                      {item.grossMargin > 0 ? '+' : ''}{(item.grossMargin).toLocaleString('vi-VN')} đ
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    <div className="font-medium text-orange-600">
                      {(item.currentCapitalTiedUp).toLocaleString('vi-VN')} đ
                    </div>
                  </td>

                  <td className="p-4 text-right">
                    {item.isCapitalRecovered ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold border border-green-200">
                        ĐÃ THU HỒI VỐN
                      </span>
                    ) : item.gmroi > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className={`font-bold text-lg ${item.gmroi >= 1.5 ? 'text-green-600' : item.gmroi >= 0.5 ? 'text-blue-600' : 'text-red-500'}`}>
                          {item.gmroi.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Chưa sinh lời</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  )
}