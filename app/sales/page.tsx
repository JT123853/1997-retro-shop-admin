'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, CheckCircle, Printer, Mail } from 'lucide-react'

export default function SalesPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    customer_id: '',
    inventory_id: '',
    so_luong_ban: 1,
    gia_ban: 0,
    khuyen_mai: 0, // Phần trăm giảm giá (0-100)
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
      supabase.from('sales').select('*, customers(ho_ten), inventory(ten_ao)').order('ngay_ban', { ascending: false }).limit(10)
    ])
    
    if (invRes.data) setInventory(invRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (salesRes.data) setSalesHistory(salesRes.data)
  }

  // Tự động tính toán tổng tiền khi số lượng, giá bán hoặc khuyến mãi thay đổi
  const tongTienThanhToan = formData.so_luong_ban * formData.gia_ban * (1 - (formData.khuyen_mai || 0) / 100)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer_id || !formData.inventory_id) {
      alert("Vui lòng chọn khách hàng và sản phẩm!")
      return
    }

    if (formData.khuyen_mai < 0 || formData.khuyen_mai > 100) {
      alert("Khuyến mãi phải nằm trong khoảng từ 0% đến 100%!")
      return
    }

    const { error } = await supabase.from('sales').insert([{
      ...formData,
      tong_tien: tongTienThanhToan
    }])
    
    if (!error) {
      alert('Tạo đơn thành công! Hệ thống đã tự động trừ kho.')
      setFormData({...formData, so_luong_ban: 1, gia_ban: 0, khuyen_mai: 0})
      fetchData() 
    } else {
      alert('Lỗi: ' + error.message)
    }
  }

  // Tính năng In Hóa Đơn
  const handlePrint = (sale: any) => {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600')
    const html = `
      <html>
      <head><title>Hóa đơn - 1997 Retro Shop</title></head>
      <body style="font-family: monospace; padding: 20px; color: #000;">
          <h2 style="text-align: center; margin-bottom: 5px;">1997 RETRO SHOP</h2>
          <p style="text-align: center; margin-top: 0;">Hóa đơn thanh toán</p>
          <hr style="border-top: 1px dashed #000;" />
          <p><strong>Khách hàng:</strong> ${sale.customers?.ho_ten}</p>
          <p><strong>Ngày lập:</strong> ${new Date(sale.ngay_ban).toLocaleString('vi-VN')}</p>
          <hr style="border-top: 1px dashed #000;" />
          <p><strong>Sản phẩm:</strong> ${sale.inventory?.ten_ao}</p>
          <p><strong>Đơn giá:</strong> ${sale.gia_ban?.toLocaleString('vi-VN')} đ</p>
          <p><strong>Số lượng:</strong> ${sale.so_luong_ban}</p>
          <p><strong>Chiết khấu:</strong> ${sale.khuyen_mai}%</p>
          <hr style="border-top: 1px dashed #000;" />
          <h3 style="text-align: right;">TỔNG: ${sale.tong_tien?.toLocaleString('vi-VN')} đ</h3>
          <p style="text-align: center; margin-top: 40px;">Cảm ơn quý khách!</p>
      </body>
      </html>
    `
    if (receiptWindow) {
      receiptWindow.document.write(html)
      receiptWindow.document.close()
      receiptWindow.focus()
      // Chờ giao diện render xong mới gọi lệnh in
      setTimeout(() => { 
        receiptWindow.print()
        receiptWindow.close()
      }, 250)
    }
  }

  // Tính năng Gửi Email Xác Nhận
  const handleEmail = (sale: any) => {
    const subject = encodeURIComponent(`Xác nhận đơn hàng - 1997 Retro Shop`)
    const body = encodeURIComponent(`Kính chào ${sale.customers?.ho_ten},

Cảm ơn bạn đã tin tưởng và mua sắm tại 1997 Retro Shop!

THÔNG TIN ĐƠN HÀNG:
- Sản phẩm: ${sale.inventory?.ten_ao}
- Số lượng: ${sale.so_luong_ban}
- Đơn giá: ${sale.gia_ban?.toLocaleString('vi-VN')} đ
- Khuyến mãi: ${sale.khuyen_mai}%
-------------------------------
- TỔNG THANH TOÁN: ${sale.tong_tien?.toLocaleString('vi-VN')} đ

Phương thức thanh toán: ${sale.phuong_thuc_thanh_toan}
Vận chuyển: ${sale.van_chuyen}

Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ lại với chúng tôi.

Trân trọng,
1997 Retro Shop`)
    
    // Mở ứng dụng mail mặc định trên máy tính/điện thoại của người dùng
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShoppingCart size={32} className="text-green-600" />
        <h1 className="text-3xl font-bold text-gray-900">Màn hình Bán Hàng (POS)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Khung thao tác POS */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Tạo đơn mới</h2>
          <form onSubmit={handleCheckout} className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium mb-1">Khuyến mãi / Giảm giá (%)</label>
              <div className="relative">
                <input type="number" min="0" max="100" className="w-full border rounded p-2 pr-8 text-blue-600 font-bold" 
                  value={formData.khuyen_mai} onChange={e => setFormData({...formData, khuyen_mai: Number(e.target.value)})} />
                <span className="absolute right-3 top-2 text-gray-500 font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Thanh toán & Vận chuyển</label>
              <div className="flex gap-2">
                <select className="w-1/2 border rounded p-2 text-sm" value={formData.phuong_thuc_thanh_toan} onChange={e => setFormData({...formData, phuong_thuc_thanh_toan: e.target.value})}>
                  <option>Chuyển khoản</option><option>Tiền mặt</option><option>COD</option>
                </select>
                <select className="w-1/2 border rounded p-2 text-sm" value={formData.van_chuyen} onChange={e => setFormData({...formData, van_chuyen: e.target.value})}>
                  <option>Nhận tại cửa hàng</option><option>GHTK</option><option>Viettel Post</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded text-right mt-4 border border-gray-200">
              <span className="text-gray-500 text-sm">Tổng tiền thanh toán</span>
              <div className="text-3xl font-bold text-green-600">
                {tongTienThanhToan.toLocaleString('vi-VN')} đ
              </div>
              {formData.khuyen_mai > 0 && (
                <div className="text-sm text-red-500 mt-1">
                  Đã giảm: {((formData.so_luong_ban * formData.gia_ban) - tongTienThanhToan).toLocaleString('vi-VN')} đ
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-semibold text-lg transition-colors">
              <CheckCircle size={24} /> TẠO ĐƠN
            </button>
          </form>
        </div>

        {/* Khung lịch sử đơn hàng */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b font-semibold text-gray-700">Lịch sử 10 đơn gần nhất</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4">Khách hàng</th>
                  <th className="p-4">Sản phẩm</th>
                  <th className="p-4 text-center">SL</th>
                  <th className="p-4 text-right">Tổng tiền</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {salesHistory.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{s.customers?.ho_ten}</td>
                    <td className="p-4 text-gray-600">
                      {s.inventory?.ten_ao}
                      {s.khuyen_mai > 0 && <span className="ml-2 bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">-{s.khuyen_mai}%</span>}
                    </td>
                    <td className="p-4 text-center font-bold">{s.so_luong_ban}</td>
                    <td className="p-4 text-right text-green-600 font-bold">{s.tong_tien?.toLocaleString('vi-VN')} đ</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => handlePrint(s)} title="In hóa đơn" className="text-gray-500 hover:text-blue-600 transition-colors">
                          <Printer size={18} />
                        </button>
                        <button onClick={() => handleEmail(s)} title="Gửi email" className="text-gray-500 hover:text-orange-600 transition-colors">
                          <Mail size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {salesHistory.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Chưa có giao dịch nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}