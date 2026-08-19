'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, CheckCircle, Printer, Mail, RotateCcw, Search, Calendar } from 'lucide-react'

export default function SalesPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  
  // State cho bộ lọc
  const [filterName, setFilterName] = useState('')
  const [filterDate, setFilterDate] = useState('')
  
  const [formData, setFormData] = useState({
    customer_id: '',
    inventory_id: '',
    so_luong_ban: 1,
    gia_ban: 0,
    khuyen_mai: 0,
    ghi_chu_giam_gia: '',
    ten_nhan_vien: '', // Trường mới thêm
    phuong_thuc_thanh_toan: 'Chuyển khoản',
    van_chuyen: 'Nhận tại cửa hàng'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [invRes, custRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('*').gt('so_luong', 0), 
      supabase.from('customers').select('*'),
      // Tăng giới hạn lên 100 đơn để tiện lọc
      supabase.from('sales').select('*, customers(ho_ten), inventory(ten_ao, id)').order('ngay_ban', { ascending: false }).limit(100)
    ])
    
    if (invRes.data) setInventory(invRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (salesRes.data) setSalesHistory(salesRes.data)
  }

  const tongTienThanhToan = formData.so_luong_ban * formData.gia_ban * (1 - (formData.khuyen_mai || 0) / 100)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer_id || !formData.inventory_id) {
      alert("Vui lòng chọn khách hàng và sản phẩm!")
      return
    }

    const { error } = await supabase.from('sales').insert([{
      ...formData,
      tong_tien: tongTienThanhToan,
      trang_thai_don: 'THANH_CONG'
    }])
    
    if (!error) {
      alert('Tạo đơn thành công!')
      // Giữ lại tên nhân viên để không phải nhập lại cho đơn sau
      setFormData({...formData, so_luong_ban: 1, gia_ban: 0, khuyen_mai: 0, ghi_chu_giam_gia: ''})
      fetchData() 
    } else {
      alert('Lỗi: ' + error.message)
    }
  }

  const handleReturnOrder = async (saleId: string, inventoryId: string, quantity: number, currentStatus: string) => {
    if (currentStatus !== 'THANH_CONG') {
      alert('Đơn hàng này đã được xử lý hoàn trả trước đó!')
      return
    }
    if (!confirm('Xác nhận khách bom/trả hàng? Hệ thống sẽ tự động cộng lại số lượng áo vào kho.')) return

    const { error: updateError } = await supabase.from('sales').update({ trang_thai_don: 'BI_BOM' }).eq('id', saleId)
    if (updateError) { alert('Lỗi cập nhật đơn: ' + updateError.message); return }

    const { data: invData } = await supabase.from('inventory').select('so_luong').eq('id', inventoryId).single()
    if (invData) {
      await supabase.from('inventory').update({ so_luong: invData.so_luong + quantity }).eq('id', inventoryId)
    }
    alert('Đã ghi nhận hàng bị bom và hoàn trả kho thành công!')
    fetchData()
  }

  // Lọc dữ liệu hiển thị theo Tên và Ngày
  const filteredHistory = salesHistory.filter(s => {
    const matchName = filterName ? s.customers?.ho_ten?.toLowerCase().includes(filterName.toLowerCase()) : true
    // Ép kiểu ngày từ CSDL (ISO) về dạng YYYY-MM-DD theo chuẩn input date của trình duyệt
    const matchDate = filterDate ? new Date(s.ngay_ban).toLocaleDateString('en-CA') === filterDate : true
    return matchName && matchDate
  })

  // (Phần In và Email giữ nguyên như trước - bạn có thể tự chèn thêm tên nhân viên vào template HTML nếu cần)
  const handlePrint = (sale: any) => { /* ... Giữ nguyên ... */ }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShoppingCart size={32} className="text-green-600" />
        <h1 className="text-3xl font-bold text-gray-900">Màn hình Bán Hàng (POS)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Tạo đơn mới</h2>
          <form onSubmit={handleCheckout} className="space-y-4">
            
            {/* THÊM TRƯỜNG NHẬP TÊN NHÂN VIÊN */}
            <div>
              <label className="block text-sm font-medium mb-1 text-blue-700">Nhân viên trực ca (Bắt buộc)</label>
              <input required type="text" placeholder="VD: Trang, Hùng..." className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-200" 
                  value={formData.ten_nhan_vien} onChange={e => setFormData({...formData, ten_nhan_vien: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Khách hàng</label>
              <select required className="w-full border rounded p-2 focus:ring-2 focus:ring-green-200"
                value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})}>
                <option value="">-- Chọn khách hàng --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.ho_ten} - {c.so_dien_thoai}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Sản phẩm</label>
              <select required className="w-full border rounded p-2 focus:ring-2 focus:ring-green-200"
                value={formData.inventory_id} onChange={e => setFormData({...formData, inventory_id: e.target.value})}>
                <option value="">-- Chọn áo --</option>
                {inventory.map(i => <option key={i.id} value={i.id}>{i.ten_ao} (Size: {i.size} - Tồn: {i.so_luong})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Số lượng</label>
                <input required type="number" min="1" className="w-full border rounded p-2" 
                  value={formData.so_luong_ban} onChange={e => setFormData({...formData, so_luong_ban: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Đơn giá (VNĐ)</label>
                <input required type="number" min="0" className="w-full border rounded p-2" 
                  value={formData.gia_ban} onChange={e => setFormData({...formData, gia_ban: Number(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Giảm giá (%)</label>
                <input type="number" min="0" max="100" className="w-full border rounded p-2 text-blue-600 font-bold" 
                  value={formData.khuyen_mai} onChange={e => setFormData({...formData, khuyen_mai: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lý do giảm giá</label>
                <input type="text" placeholder="VD: Khách quen..." className="w-full border rounded p-2 text-sm" 
                  value={formData.ghi_chu_giam_gia} onChange={e => setFormData({...formData, ghi_chu_giam_gia: e.target.value})} />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded text-right mt-4 border border-gray-200">
              <span className="text-gray-500 text-sm">Tổng tiền thanh toán</span>
              <div className="text-2xl font-bold text-green-600">
                {tongTienThanhToan.toLocaleString('vi-VN')} đ
              </div>
            </div>

            <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-semibold text-lg">
              <CheckCircle size={24} /> TẠO ĐƠN
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col">
          
          {/* BỘ LỌC TÌM KIẾM */}
          <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row items-center gap-4 justify-between">
            <span className="font-semibold text-gray-700">Lịch sử đơn hàng ({filteredHistory.length})</span>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative">
                <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
                <input type="text" placeholder="Tên khách hàng..." className="pl-8 p-2 border rounded text-sm w-full sm:w-48"
                  value={filterName} onChange={(e) => setFilterName(e.target.value)} />
              </div>
              <div className="relative">
                <Calendar size={16} className="absolute left-2 top-2.5 text-gray-400" />
                <input type="date" className="pl-8 p-2 border rounded text-sm w-full sm:w-40 text-gray-600"
                  value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
              </div>
              {(filterName || filterDate) && (
                <button onClick={() => {setFilterName(''); setFilterDate('')}} className="text-sm text-red-500 hover:underline whitespace-nowrap">Xóa lọc</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4">Ngày & Người tạo</th>
                  <th className="p-4">Khách hàng</th>
                  <th className="p-4">Sản phẩm</th>
                  <th className="p-4 text-right">Tổng tiền</th>
                  <th className="p-4 text-center">Trạng thái</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredHistory.map((s) => (
                  <tr key={s.id} className={s.trang_thai_don === 'BI_BOM' ? 'bg-red-50 text-gray-400' : 'hover:bg-gray-50'}>
                    <td className="p-4">
                      <div className="font-medium">{new Date(s.ngay_ban).toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs text-blue-600 font-semibold">{s.ten_nhan_vien || 'Admin'}</div>
                    </td>
                    <td className="p-4 font-medium">{s.customers?.ho_ten}</td>
                    <td className="p-4">
                      {s.inventory?.ten_ao} (SL: {s.so_luong_ban})
                      {s.khuyen_mai > 0 && <span className="ml-1 text-xs text-red-600">(-{s.khuyen_mai}%)</span>}
                    </td>
                    <td className="p-4 text-right font-bold text-green-600">{s.tong_tien?.toLocaleString('vi-VN')} đ</td>
                    <td className="p-4 text-center">
                      {s.trang_thai_don === 'BI_BOM' ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">BỊ BOM</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">Thành công</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => handlePrint(s)} title="In hóa đơn" className="text-gray-500 hover:text-blue-600">
                          <Printer size={18} />
                        </button>
                        {s.trang_thai_don === 'THANH_CONG' && (
                          <button onClick={() => handleReturnOrder(s.id, s.inventory_id, s.so_luong_ban, s.trang_thai_don)} title="Báo hàng bị bom (Hoàn kho)" className="text-red-500 hover:text-red-700">
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Không tìm thấy đơn hàng nào phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}