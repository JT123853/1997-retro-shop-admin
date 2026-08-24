'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, CheckCircle, Printer, RotateCcw, Plus, Trash2, Mail, Search, Calendar } from 'lucide-react'

export default function SalesPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  
  const [cart, setCart] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  // State cho bộ lọc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('')
  const [searchDate, setSearchDate] = useState('')

  const [formData, setFormData] = useState({
    customer_id: '', ten_nhan_vien: '', khuyen_mai: 0, ghi_chu_giam_gia: '', phuong_thuc_thanh_toan: 'Chuyển khoản', van_chuyen: 'Nhận tại cửa hàng'
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [invRes, custRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('*').gt('so_luong', 0), 
      supabase.from('customers').select('*'),
      supabase.from('sales').select('*, customers(*), inventory(ten_ao, id, size)').order('ngay_ban', { ascending: false }).limit(200)
    ])
    
    if (invRes.data) setInventory(invRes.data)
    if (custRes.data) setCustomers(custRes.data)
    
    if (salesRes.data) {
      const grouped: any = {}
      salesRes.data.forEach((s: any) => {
        const orderId = s.ma_don_hang || s.id
        if (!grouped[orderId]) {
          grouped[orderId] = {
            ma_don_hang: orderId, ngay_ban: s.ngay_ban, ten_nhan_vien: s.ten_nhan_vien,
            customers: s.customers, khuyen_mai: s.khuyen_mai, ghi_chu_giam_gia: s.ghi_chu_giam_gia,
            trang_thai_don: s.trang_thai_don, tong_tien_don: 0, items: []
          }
        }
        grouped[orderId].items.push(s)
        grouped[orderId].tong_tien_don += Number(s.tong_tien)
      })
      setSalesHistory(Object.values(grouped).sort((a: any, b: any) => new Date(b.ngay_ban).getTime() - new Date(a.ngay_ban).getTime()))
    }
  }

  const handleAddToCart = () => {
    if (!selectedProductId) return
    const product = inventory.find(i => i.id === selectedProductId)
    if (!product) return

    const existingItem = cart.find(c => c.inventory_id === product.id)
    if (existingItem) {
      if (existingItem.so_luong_ban >= product.so_luong) return alert('Vượt quá số lượng tồn kho!')
      setCart(cart.map(c => c.inventory_id === product.id ? { ...c, so_luong_ban: c.so_luong_ban + 1 } : c))
    } else {
      setCart([...cart, { inventory_id: product.id, ten_ao: product.ten_ao, size: product.size, gia_ban: product.gia_ban, ton_kho: product.so_luong, so_luong_ban: 1 }])
    }
    setSelectedProductId('')
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer_id) return alert("Vui lòng chọn khách hàng!")
    if (cart.length === 0) return alert("Giỏ hàng trống!")

    const orderId = `DH-${Date.now()}`
    const salesInserts = cart.map(item => ({
      ma_don_hang: orderId, customer_id: formData.customer_id, inventory_id: item.inventory_id,
      so_luong_ban: item.so_luong_ban, gia_ban: item.gia_ban, khuyen_mai: formData.khuyen_mai,
      ghi_chu_giam_gia: formData.ghi_chu_giam_gia, ten_nhan_vien: formData.ten_nhan_vien,
      tong_tien: (item.gia_ban * item.so_luong_ban) * (1 - formData.khuyen_mai / 100),
      trang_thai_don: 'THANH_CONG', phuong_thuc_thanh_toan: formData.phuong_thuc_thanh_toan, van_chuyen: formData.van_chuyen
    }))

    const { error } = await supabase.from('sales').insert(salesInserts)
    if (!error) { alert('Chốt đơn thành công!'); setCart([]); fetchData() }
  }

  const handleReturnOrder = async (order: any) => {
    if (order.trang_thai_don !== 'THANH_CONG') return
    if (!confirm('Xác nhận khách bom TOÀN BỘ hóa đơn này? Hệ thống sẽ hoàn áo vào kho.')) return
    await supabase.from('sales').update({ trang_thai_don: 'BI_BOM' }).eq('ma_don_hang', order.ma_don_hang)
    for (const item of order.items) {
      const { data: invData } = await supabase.from('inventory').select('so_luong').eq('id', item.inventory_id).single()
      if (invData) await supabase.from('inventory').update({ so_luong: invData.so_luong + item.so_luong_ban }).eq('id', item.inventory_id)
    }
    alert('Đã hoàn hàng thành công!'); fetchData()
  }

  const handleEmail = (order: any) => {
    const customerEmail = order.customers?.email;
    if (!customerEmail) {
      alert('Khách hàng này chưa có email. Vui lòng cập nhật ở mục Khách Hàng!');
      return;
    }
    const subject = encodeURIComponent(`Hóa đơn mua hàng - 1997 Retro Shop (${order.ma_don_hang})`);
    let bodyText = `Kính chào ${order.customers?.ho_ten},\n\nCảm ơn bạn đã tin tưởng mua sắm tại 1997 Retro Shop!\n\nTHÔNG TIN ĐƠN HÀNG:\n`;
    order.items.forEach((i: any) => {
       bodyText += `- ${i.inventory?.ten_ao} (Size: ${i.inventory?.size || 'N/A'}) x ${i.so_luong_ban} = ${(i.gia_ban * i.so_luong_ban).toLocaleString('vi-VN')} đ\n`;
    });
    bodyText += `-----------------------\n`;
    if (order.khuyen_mai > 0) bodyText += `Chiết khấu: -${order.khuyen_mai}%\n`;
    bodyText += `TỔNG THANH TOÁN: ${order.tong_tien_don?.toLocaleString('vi-VN')} đ\n\nTrân trọng,\n1997 Retro Shop`;
    window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  }

const handlePrint = (order: any) => {
    const receiptWindow = window.open('', '_blank', 'width=400,height=700')
    
    // 1. Tính toán tạm tính (trước khi giảm giá)
    const subTotal = order.items.reduce((acc: number, i: any) => acc + (i.gia_ban * i.so_luong_ban), 0);
    const discountAmount = subTotal * (order.khuyen_mai / 100);

    // 2. Tạo danh sách sản phẩm đẹp mắt
    const itemsHtml = order.items.map((i: any) => `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 13px;">${i.inventory?.ten_ao} - Size: ${i.inventory?.size || 'N/A'}</div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #333;">
          <span>SL: ${i.so_luong_ban} x ${Number(i.gia_ban).toLocaleString('vi-VN')}</span>
          <span>${(i.gia_ban * i.so_luong_ban).toLocaleString('vi-VN')} đ</span>
        </div>
      </div>
    `).join('')

    // 3. Khung HTML của hóa đơn
    const html = `
      <html>
      <head>
        <title>Hóa đơn ${order.ma_don_hang}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 14px; padding: 15px; color: #000; max-width: 80mm; margin: 0 auto; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <!-- THÔNG TIN SHOP CỦA BẠN (CÓ THỂ SỬA LẠI THÔNG TIN BÊN DƯỚI) -->
        <h2 class="text-center" style="margin-bottom: 5px; font-size: 20px;">1997 RETRO SHOP</h2>
        <p class="text-center" style="margin: 3px 0; font-size: 12px;">Đ/c: 123 Đường Cổ Điển, TP.HCM</p>
        <p class="text-center" style="margin: 3px 0; font-size: 12px;">Hotline: 0987.654.321</p>
        <p class="text-center" style="margin: 3px 0; font-size: 12px;">IG/FB: @1997retro.shop</p>
        
        <div class="divider"></div>
        
        <p class="text-center font-bold" style="font-size: 16px;">HÓA ĐƠN BÁN HÀNG</p>
        <p style="font-size: 12px; margin: 3px 0;"><strong>Mã HĐ:</strong> ${order.ma_don_hang}</p>
        <p style="font-size: 12px; margin: 3px 0;"><strong>Ngày:</strong> ${new Date(order.ngay_ban).toLocaleString('vi-VN')}</p>
        <p style="font-size: 12px; margin: 3px 0;"><strong>Thu ngân:</strong> ${order.ten_nhan_vien || 'Admin'}</p>
        <p style="font-size: 12px; margin: 3px 0;"><strong>Khách hàng:</strong> ${order.customers?.ho_ten} ${order.customers?.so_dien_thoai ? ` - ${order.customers.so_dien_thoai}` : ''}</p>
        
        <div class="divider"></div>
        
        <!-- CHI TIẾT SẢN PHẨM -->
        <div style="margin: 10px 0;">
          ${itemsHtml}
        </div>
        
        <div class="divider"></div>
        
        <!-- TỔNG KẾT TIỀN -->
        <p class="text-right" style="font-size: 13px; margin: 5px 0;">Tạm tính: ${subTotal.toLocaleString('vi-VN')} đ</p>
        ${order.khuyen_mai > 0 ? `<p class="text-right" style="font-size: 13px; margin: 5px 0;">Giảm giá (${order.khuyen_mai}%): -${discountAmount.toLocaleString('vi-VN')} đ</p>` : ''}
        
        <h3 class="text-right" style="margin: 10px 0; font-size: 18px;">TỔNG: ${order.tong_tien_don?.toLocaleString('vi-VN')} đ</h3>
        
        <div class="divider"></div>
        
        <!-- LỜI CẢM ƠN CHÂN TRANG -->
        <p class="text-center" style="margin-top: 15px; font-size: 12px; font-style: italic; line-height: 1.4;">
          Cảm ơn quý khách đã mua sắm tại 1997 Retro Shop!<br/>
          Hẹn gặp lại quý khách!
        </p>
      </body>
      </html>
    `
    if (receiptWindow) {
      receiptWindow.document.write(html)
      receiptWindow.document.close()
      receiptWindow.focus()
      // Chờ trình duyệt render HTML xong mới gọi lệnh in
      setTimeout(() => { receiptWindow.print(); receiptWindow.close() }, 250)
    }
  }
  const subTotal = cart.reduce((acc, item) => acc + (item.gia_ban * item.so_luong_ban), 0)
  const finalTotal = subTotal * (1 - (formData.khuyen_mai || 0) / 100)
  // XỬ LÝ LỌC LỊCH SỬ HÓA ĐƠN
  const filteredHistory = salesHistory.filter(order => {
    let matchSearch = true;
    let matchDate = true;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCustomer = order.customers?.ho_ten?.toLowerCase().includes(term);
      const matchOrderId = order.ma_don_hang?.toLowerCase().includes(term);
      // Quét tìm trong danh sách các sản phẩm của hóa đơn đó
      const matchProduct = order.items.some((item: any) => item.inventory?.ten_ao?.toLowerCase().includes(term));
      
      matchSearch = !!(matchCustomer || matchOrderId || matchProduct);
    }

    if (searchDate) {
      // Chuyển đổi ngày bán về chuẩn YYYY-MM-DD để so sánh với input date
      const orderDateStr = new Date(order.ngay_ban).toLocaleDateString('en-CA');
      matchDate = orderDateStr === searchDate;
    }

    return matchSearch && matchDate;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShoppingCart size={32} className="text-green-600" />
        <h1 className="text-3xl font-bold text-gray-900">Màn hình Bán Hàng (POS 1.1)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-sm border h-fit space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Thông tin Hóa Đơn</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-blue-700">Nhân viên trực</label>
              <input required type="text" className="w-full border rounded p-2" value={formData.ten_nhan_vien} onChange={e => setFormData({...formData, ten_nhan_vien: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Khách hàng</label>
              <select className="w-full border rounded p-2" value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})}>
                <option value="">-- Chọn KH --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.ho_ten}</option>)}
              </select>
            </div>
          </div>
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-1 text-orange-600">Thêm áo vào giỏ hàng</label>
            <div className="flex gap-2">
              <select className="flex-1 border rounded p-2 text-sm" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                <option value="">-- Chọn áo để bán --</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>
                    {/* BỔ SUNG HIỂN THỊ SIZE ÁO Ở ĐÂY */}
                    {i.ten_ao} (Size: {i.size}) - Tồn: {i.so_luong} - {Number(i.gia_ban).toLocaleString('vi-VN')}đ
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleAddToCart} className="bg-orange-500 text-white px-4 py-2 rounded font-bold hover:bg-orange-600"><Plus size={20} /></button>
            </div>
          </div>
          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Giảm giá HĐ (%)</label>
              <input type="number" min="0" max="100" className="w-full border rounded p-2 text-red-600 font-bold" value={formData.khuyen_mai} onChange={e => setFormData({...formData, khuyen_mai: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lý do giảm</label>
              <input type="text" className="w-full border rounded p-2 text-sm" value={formData.ghi_chu_giam_gia} onChange={e => setFormData({...formData, ghi_chu_giam_gia: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-sm border h-fit flex flex-col">
          <h2 className="text-xl font-semibold border-b pb-2">Giỏ hàng ({cart.length} món)</h2>
          <div className="flex-1 min-h-[200px] overflow-y-auto mt-4">
            {cart.length === 0 ? <p className="text-center text-gray-400 mt-10">Chưa có sản phẩm nào trong giỏ.</p> : (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b"><tr><th className="p-2">Sản phẩm</th><th className="p-2 text-center">SL</th><th className="p-2 text-right">Đơn giá</th><th className="p-2 text-center">Xóa</th></tr></thead>
                <tbody className="divide-y">
                  {cart.map(c => (
                    <tr key={c.inventory_id}>
                      <td className="p-2 font-medium">{c.ten_ao} <span className="text-xs text-blue-600 font-bold">(Size {c.size})</span></td>
                      <td className="p-2 text-center">
                        <input type="number" min="1" max={c.ton_kho} className="w-16 border rounded text-center p-1" value={c.so_luong_ban} onChange={e => setCart(cart.map(item => item.inventory_id === c.inventory_id ? {...item, so_luong_ban: Number(e.target.value)} : item))} />
                      </td>
                      <td className="p-2 text-right font-bold text-gray-600">{Number(c.gia_ban).toLocaleString('vi-VN')}đ</td>
                      <td className="p-2 text-center"><button onClick={() => setCart(cart.filter(x => x.inventory_id !== c.inventory_id))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-lg mt-4 border">
            <div className="flex justify-between text-sm text-gray-500 mb-2"><span>Tạm tính:</span> <span>{subTotal.toLocaleString('vi-VN')} đ</span></div>
            {formData.khuyen_mai > 0 && <div className="flex justify-between text-sm text-red-500 mb-2"><span>Giảm giá ({formData.khuyen_mai}%):</span> <span>-{(subTotal - finalTotal).toLocaleString('vi-VN')} đ</span></div>}
            <div className="flex justify-between items-end border-t pt-2 mt-2"><span className="font-semibold text-gray-700">TỔNG:</span><span className="text-3xl font-bold text-green-600">{finalTotal.toLocaleString('vi-VN')} đ</span></div>
          </div>
          <button onClick={handleCheckout} className="w-full mt-4 bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 font-black text-xl flex justify-center gap-2"><CheckCircle size={28} /> CHỐT ĐƠN</button>
        </div>

        <div className="lg:col-span-12 bg-white rounded-lg shadow-sm border overflow-hidden mt-4">
          
          {/* THANH TÌM KIẾM MỚI THÊM VÀO */}
          <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-semibold text-gray-700">Lịch sử Hóa đơn ({filteredHistory.length})</span>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input type="text" placeholder="Tìm khách, tên áo, mã đơn..." className="pl-9 p-2 border rounded w-full text-sm"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="relative w-full sm:w-auto">
                <Calendar size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input type="date" className="pl-9 p-2 border rounded w-full text-sm text-gray-600"
                  value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
              </div>
              {(searchTerm || searchDate) && (
                <button onClick={() => {setSearchTerm(''); setSearchDate('')}} className="text-sm text-red-500 hover:underline whitespace-nowrap">Xóa bộ lọc</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 border-b">
                <tr><th className="p-4">Mã Đơn / Ngày</th><th className="p-4">Khách hàng</th><th className="p-4">Sản phẩm</th><th className="p-4 text-right">Tổng thanh toán</th><th className="p-4 text-center">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y">
                {filteredHistory.map((order) => (
                  <tr key={order.ma_don_hang} className={order.trang_thai_don === 'BI_BOM' ? 'bg-red-50 text-gray-400' : 'hover:bg-gray-50'}>
                    <td className="p-4"><div className="font-bold text-blue-600">{order.ma_don_hang}</div><div className="text-xs">{new Date(order.ngay_ban).toLocaleDateString('vi-VN')}</div></td>
                    <td className="p-4 font-medium">{order.customers?.ho_ten}</td>
                    <td className="p-4 text-xs">{order.items.map((i:any, idx:number) => (<div key={idx}>• {i.inventory?.ten_ao} <span className="font-bold text-gray-500">(Size {i.inventory?.size})</span> (x{i.so_luong_ban})</div>))} {order.khuyen_mai > 0 && <span className="text-red-500 font-bold block">Khuyến mãi: -{order.khuyen_mai}%</span>}</td>
                    <td className="p-4 text-right font-black text-green-600 text-base">{order.tong_tien_don?.toLocaleString('vi-VN')} đ</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <button onClick={() => handlePrint(order)} title="In hóa đơn" className="text-gray-500 hover:text-blue-600"><Printer size={20} /></button>
                        <button onClick={() => handleEmail(order)} title="Gửi Email Hóa Đơn" className="text-gray-500 hover:text-orange-600"><Mail size={20} /></button>
                        {order.trang_thai_don === 'THANH_CONG' ? (
                          <button onClick={() => handleReturnOrder(order)} title="Bom toàn bộ đơn" className="text-red-500 hover:text-red-700"><RotateCcw size={20} /></button>
                        ) : (<span className="text-[10px] font-bold bg-red-200 text-red-800 px-2 py-1 rounded">BỊ BOM</span>)}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Không tìm thấy dữ liệu hóa đơn nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  )
}