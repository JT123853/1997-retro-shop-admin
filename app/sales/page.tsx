'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, CheckCircle, Printer, RotateCcw, Trash2, Mail, Search, Calendar } from 'lucide-react'

export default function SalesPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  
  const [cart, setCart] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [searchDate, setSearchDate] = useState('')

  const [formData, setFormData] = useState({
    customer_id: '', 
    ten_nhan_vien: '', 
    khuyen_mai: 0, 
    ghi_chu_giam_gia: '', 
    phuong_thuc_thanh_toan: 'Chuyển khoản', 
    van_chuyen: 'Ship COD',
    other_shipping: '',
    tien_coc: 0,
    ghi_chu_coc_dan_do: '',
    phi_dieu_chinh: 0,
    ly_do_dieu_chinh: ''
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
            ma_don_hang: orderId, 
            ngay_ban: s.ngay_ban, 
            ten_nhan_vien: s.ten_nhan_vien,
            customers: s.customers, 
            khuyen_mai: s.khuyen_mai, 
            ghi_chu_giam_gia: s.ghi_chu_giam_gia,
            van_chuyen: s.van_chuyen,
            phuong_thuc_thanh_toan: s.phuong_thuc_thanh_toan,
            tien_coc: s.tien_coc || 0,
            ghi_chu_coc_dan_do: s.ghi_chu_coc_dan_do || '',
            phi_dieu_chinh: s.phi_dieu_chinh || 0,
            ly_do_dieu_chinh: s.ly_do_dieu_chinh || '',
            trang_thai_don: s.trang_thai_don, 
            tong_tien_don: 0, 
            items: []
          }
        }
        grouped[orderId].items.push(s)
        grouped[orderId].tong_tien_don += Number(s.tong_tien)
      })
      setSalesHistory(Object.values(grouped).sort((a: any, b: any) => new Date(b.ngay_ban).getTime() - new Date(a.ngay_ban).getTime()))
    }
  }

  // Tính toán tài chính
  const subTotal = cart.reduce((acc, item) => acc + (Number(item.gia_ban) * item.so_luong_ban), 0)
  const discountAmount = subTotal * ((Number(formData.khuyen_mai) || 0) / 100)
  const finalTotal = subTotal - discountAmount + (Number(formData.phi_dieu_chinh) || 0)
  const remainingDue = finalTotal - (Number(formData.tien_coc) || 0)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customer_id) return alert("Vui lòng chọn khách hàng!")
    if (cart.length === 0) return alert("Giỏ hàng trống!")
    if (formData.phi_dieu_chinh !== 0 && !formData.ly_do_dieu_chinh.trim()) {
      return alert("Bạn đã chỉnh sửa phí/kê giá đơn hàng, vui lòng nhập rõ lý do!")
    }

    const finalShipping = formData.van_chuyen === 'Khác' 
      ? `Khác: ${formData.other_shipping || 'Dịch vụ ngoài'}` 
      : formData.van_chuyen

    const orderId = `DH-${Date.now()}`
    
    // Phân bổ phí điều chỉnh theo tỷ trọng từng item để tổng_tien khớp chính xác
    const salesInserts = cart.map((item, index) => {
      const itemSub = Number(item.gia_ban) * item.so_luong_ban
      const itemRatio = subTotal > 0 ? (itemSub / subTotal) : (1 / cart.length)
      const itemAdjust = (Number(formData.phi_dieu_chinh) || 0) * itemRatio
      const itemTotal = (itemSub * (1 - (Number(formData.khuyen_mai) || 0) / 100)) + itemAdjust

      return {
        ma_don_hang: orderId,
        customer_id: formData.customer_id,
        inventory_id: item.inventory_id,
        so_luong_ban: item.so_luong_ban,
        gia_ban: Number(item.gia_ban),
        khuyen_mai: Number(formData.khuyen_mai) || 0,
        ghi_chu_giam_gia: formData.ghi_chu_giam_gia,
        ten_nhan_vien: formData.ten_nhan_vien,
        tong_tien: itemTotal,
        trang_thai_don: 'THANH_CONG',
        phuong_thuc_thanh_toan: formData.phuong_thuc_thanh_toan,
        van_chuyen: finalShipping,
        tien_coc: index === 0 ? (Number(formData.tien_coc) || 0) : 0,
        ghi_chu_coc_dan_do: formData.ghi_chu_coc_dan_do,
        phi_dieu_chinh: itemAdjust,
        ly_do_dieu_chinh: formData.ly_do_dieu_chinh
      }
    })

    const { error } = await supabase.from('sales').insert(salesInserts)
    if (!error) { 
      alert('Chốt đơn thành công! Đã cập nhật đầy đủ ghi chú và khấu trừ kho.')
      setCart([])
      setFormData({
        ...formData, 
        khuyen_mai: 0, 
        ghi_chu_giam_gia: '', 
        tien_coc: 0, 
        ghi_chu_coc_dan_do: '',
        phi_dieu_chinh: 0,
        ly_do_dieu_chinh: '',
        other_shipping: ''
      })
      fetchData() 
    } else {
      alert('Lỗi: ' + error.message)
    }
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
    if (order.phi_dieu_chinh !== 0) bodyText += `Phụ thu / Điều chỉnh: ${order.phi_dieu_chinh > 0 ? '+' : ''}${order.phi_dieu_chinh.toLocaleString('vi-VN')} đ (${order.ly_do_dieu_chinh})\n`;
    bodyText += `TỔNG ĐƠN: ${order.tong_tien_don?.toLocaleString('vi-VN')} đ\n`;
    if (order.tien_coc > 0) {
      bodyText += `Đã đặt cọc: -${order.tien_coc.toLocaleString('vi-VN')} đ\n`;
      bodyText += `CÒN PHẢI THU (COD): ${(order.tong_tien_don - order.tien_coc).toLocaleString('vi-VN')} đ\n`;
    }
    bodyText += `Vận chuyển: ${order.van_chuyen}\n`;
    if (order.ghi_chu_coc_dan_do) bodyText += `Dặn dò: ${order.ghi_chu_coc_dan_do}\n`;
    bodyText += `\nTrân trọng,\n1997 Retro Shop`;
    window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  }

  const handlePrint = (order: any) => {
    const receiptWindow = window.open('', '_blank', 'width=400,height=750')
    const printSubTotal = order.items.reduce((acc: number, i: any) => acc + (i.gia_ban * i.so_luong_ban), 0);
    const discountAmt = printSubTotal * (order.khuyen_mai / 100);
    const remaining = order.tong_tien_don - (order.tien_coc || 0);

    const itemsHtml = order.items.map((i: any) => `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 13px;">${i.inventory?.ten_ao} - Size: ${i.inventory?.size || 'N/A'}</div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #333;">
          <span>SL: ${i.so_luong_ban} x ${Number(i.gia_ban).toLocaleString('vi-VN')}</span>
          <span>${(i.gia_ban * i.so_luong_ban).toLocaleString('vi-VN')} đ</span>
        </div>
      </div>
    `).join('')

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
        <p style="font-size: 12px; margin: 3px 0;"><strong>Vận chuyển:</strong> ${order.van_chuyen}</p>
        
        <div class="divider"></div>
        
        <div style="margin: 10px 0;">
          ${itemsHtml}
        </div>
        
        <div class="divider"></div>
        
        <p class="text-right" style="font-size: 13px; margin: 3px 0;">Tạm tính: ${printSubTotal.toLocaleString('vi-VN')} đ</p>
        ${order.khuyen_mai > 0 ? `<p class="text-right" style="font-size: 13px; margin: 3px 0;">Giảm (${order.khuyen_mai}\%): -${discountAmt.toLocaleString('vi-VN')} đ</p>` : ''}
        ${order.phi_dieu_chinh !== 0 ? `<p class="text-right" style="font-size: 13px; margin: 3px 0;">Điều chỉnh: ${order.phi_dieu_chinh > 0 ? '+' : ''}${order.phi_dieu_chinh.toLocaleString('vi-VN')} đ</p>` : ''}
        
        <h3 class="text-right" style="margin: 8px 0; font-size: 17px;">TỔNG ĐƠN: ${order.tong_tien_don?.toLocaleString('vi-VN')} đ</h3>
        
        ${order.tien_coc > 0 ? `
          <p class="text-right" style="font-size: 13px; margin: 3px 0; color: #000;">Đã đặt cọc: -${order.tien_coc.toLocaleString('vi-VN')} đ</p>
          <h3 class="text-right" style="margin: 5px 0; font-size: 18px; color: red;">THU COD: ${remaining.toLocaleString('vi-VN')} đ</h3>
        ` : ''}

        ${order.ghi_chu_coc_dan_do ? `
          <div class="divider"></div>
          <p style="font-size: 11px; margin: 3px 0;"><strong>* Dặn dò:</strong> ${order.ghi_chu_coc_dan_do}</p>
        ` : ''}
        
        <div class="divider"></div>
        
        <p class="text-center" style="margin-top: 12px; font-size: 11px; font-style: italic; line-height: 1.4;">
          Cảm ơn quý khách đã mua sắm tại 1997 Retro Shop!<br/>
          (Hàng mua rồi miễn đổi trả sau 3 ngày)
        </p>
      </body>
      </html>
    `
    if (receiptWindow) {
      receiptWindow.document.write(html)
      receiptWindow.document.close()
      receiptWindow.focus()
      setTimeout(() => { receiptWindow.print(); receiptWindow.close() }, 250)
    }
  }

  const filteredHistory = salesHistory.filter(order => {
    let matchSearch = true;
    let matchDate = true;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCustomer = order.customers?.ho_ten?.toLowerCase().includes(term);
      const matchOrderId = order.ma_don_hang?.toLowerCase().includes(term);
      const matchProduct = order.items.some((item: any) => item.inventory?.ten_ao?.toLowerCase().includes(term));
      const matchNote = order.ghi_chu_coc_dan_do?.toLowerCase().includes(term);
      matchSearch = !!(matchCustomer || matchOrderId || matchProduct || matchNote);
    }

    if (searchDate) {
      const orderDateStr = new Date(order.ngay_ban).toLocaleDateString('en-CA');
      matchDate = orderDateStr === searchDate;
    }

    return matchSearch && matchDate;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShoppingCart size={32} className="text-green-600" />
        <h1 className="text-3xl font-bold text-gray-900">Màn hình Bán Hàng (POS 1.2 Pro)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CỘT TRÁI: THÔNG TIN HÓA ĐƠN & VẬN CHUYỂN */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-sm border h-fit space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Thông tin Hóa Đơn</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-blue-700">Nhân viên trực</label>
              <input required type="text" className="w-full border rounded p-2 text-sm" value={formData.ten_nhan_vien} onChange={e => setFormData({...formData, ten_nhan_vien: e.target.value})} placeholder="Tên thu ngân" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Khách hàng</label>
              <select className="w-full border rounded p-2 text-sm" value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})}>
                <option value="">-- Chọn KH --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.ho_ten}</option>)}
              </select>
            </div>
          </div>
          
          {/* TỰ ĐỘNG THÊM ÁO */}
          <div className="border-t pt-3">
            <label className="block text-sm font-medium mb-1 text-orange-600">Thêm áo vào giỏ hàng (Tự động thêm)</label>
            <select 
              className="w-full border rounded p-2.5 text-sm bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium cursor-pointer" 
              value={selectedProductId} 
              onChange={e => {
                const productId = e.target.value;
                if (!productId) return;
                
                const product = inventory.find(i => i.id === productId);
                if (!product) return;

                setCart(prevCart => {
                  const existingItem = prevCart.find(c => c.inventory_id === product.id);
                  if (existingItem) {
                    if (existingItem.so_luong_ban >= product.so_luong) {
                      setTimeout(() => alert('Vượt quá số lượng tồn kho!'), 100);
                      return prevCart;
                    }
                    return prevCart.map(c => c.inventory_id === product.id ? { ...c, so_luong_ban: c.so_luong_ban + 1 } : c);
                  } else {
                    return [...prevCart, { 
                      inventory_id: product.id, 
                      ten_ao: product.ten_ao, 
                      size: product.size, 
                      gia_ban: Number(product.gia_ban), 
                      ton_kho: product.so_luong, 
                      so_luong_ban: 1 
                    }];
                  }
                });
                setSelectedProductId('');
              }}
            >
              <option value="">-- Bấm vào đây để chọn áo bán --</option>
              {inventory.map(i => (
                <option key={i.id} value={i.id}>
                  {i.ten_ao} (Size: {i.size}) - Tồn: {i.so_luong} - {Number(i.gia_ban).toLocaleString('vi-VN')}đ
                </option>
              ))}
            </select>
          </div>

          {/* GIAI ĐOẠN 1: PHƯƠNG THỨC GIAO HÀNG */}
          <div className="border-t pt-3 space-y-2">
            <label className="block text-sm font-bold text-gray-700">Phương thức giao hàng</label>
            <select 
              className="w-full border rounded p-2 text-sm bg-gray-50"
              value={formData.van_chuyen}
              onChange={e => setFormData({...formData, van_chuyen: e.target.value})}
            >
              <option value="Ship COD">Ship COD</option>
              <option value="Ship SPX (Shopee Express)">Ship SPX (Shopee Xpress)</option>
              <option value="Ship Viettel Post">Ship Viettel Post</option>
              <option value="Ship J&T Express">Ship J&T Express</option>
              <option value="Nhận tại cửa hàng">Nhận tại cửa hàng</option>
              <option value="Khác">Khác (Dịch vụ ngoài / Hỏa tốc...)</option>
            </select>

            {formData.van_chuyen === 'Khác' && (
              <input 
                type="text" 
                placeholder="Nhập tên dịch vụ vận chuyển ngoài (GHTK, Ahamove...)" 
                className="w-full border rounded p-2 text-sm mt-1"
                value={formData.other_shipping}
                onChange={e => setFormData({...formData, other_shipping: e.target.value})}
              />
            )}
          </div>

          {/* GIAI ĐOẠN 1: TIỀN CỌC VÀ DẶN DÒ */}
          <div className="border-t pt-3 space-y-3">
            <label className="block text-sm font-bold text-gray-700">Thông tin cọc & Ghi chú dặn dò</label>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Khách đã đặt cọc (VNĐ)</label>
              <input 
                type="number" 
                min="0" 
                step="1000"
                placeholder="0" 
                className="w-full border rounded p-2 text-sm text-green-700 font-bold"
                value={formData.tien_coc || ''}
                onChange={e => setFormData({...formData, tien_coc: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dặn dò đặc biệt / Thông tin ship</label>
              <textarea 
                rows={2}
                placeholder="VD: Cọc 100k qua VCB, giao buổi chiều, cho khách xem hàng..."
                className="w-full border rounded p-2 text-sm"
                value={formData.ghi_chu_coc_dan_do}
                onChange={e => setFormData({...formData, ghi_chu_coc_dan_do: e.target.value})}
              />
            </div>
          </div>

          {/* CHIẾT KHẤU */}
          <div className="border-t pt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Giảm giá HĐ (%)</label>
              <input type="number" min="0" max="100" className="w-full border rounded p-2 text-sm text-red-600 font-bold" value={formData.khuyen_mai} onChange={e => setFormData({...formData, khuyen_mai: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Lý do giảm</label>
              <input type="text" className="w-full border rounded p-2 text-sm" value={formData.ghi_chu_giam_gia} onChange={e => setFormData({...formData, ghi_chu_giam_gia: e.target.value})} placeholder="Khách quen, lỗi nhẹ..." />
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: GIỎ HÀNG & HIỆU CHỈNH GIÁ */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-sm border h-fit flex flex-col">
          <h2 className="text-xl font-semibold border-b pb-2">Giỏ hàng ({cart.length} món)</h2>
          
          <div className="flex-1 min-h-[200px] overflow-y-auto mt-3">
            {cart.length === 0 ? (
              <p className="text-center text-gray-400 mt-10">Chưa có sản phẩm nào trong giỏ.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b text-xs text-gray-600">
                  <tr>
                    <th className="p-2">Sản phẩm</th>
                    <th className="p-2 text-center w-20">SL</th>
                    <th className="p-2 text-right w-36">Đơn giá (VNĐ)</th>
                    <th className="p-2 text-right">Thành tiền</th>
                    <th className="p-2 text-center w-12">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cart.map(c => (
                    <tr key={c.inventory_id} className="hover:bg-gray-50">
                      <td className="p-2 font-medium">
                        <div>{c.ten_ao}</div>
                        <span className="text-xs text-blue-600 font-bold">Size: {c.size}</span>
                      </td>
                      <td className="p-2 text-center">
                        <input 
                          type="number" 
                          min="1" 
                          max={c.ton_kho} 
                          className="w-16 border rounded text-center p-1 text-sm" 
                          value={c.so_luong_ban} 
                          onChange={e => setCart(cart.map(item => item.inventory_id === c.inventory_id ? {...item, so_luong_ban: Number(e.target.value)} : item))} 
                        />
                      </td>
                      {/* GIAI ĐOẠN 2: HIỆU CHỈNH GIÁ BÁN TỪNG ÁO */}
                      <td className="p-2 text-right">
                        <input 
                          type="number" 
                          min="0"
                          step="5000"
                          className="w-32 border rounded text-right p-1 text-sm font-semibold text-blue-800 bg-yellow-50 focus:bg-white" 
                          title="Chủ shop có thể chỉnh lại giá lẻ từng món"
                          value={c.gia_ban} 
                          onChange={e => setCart(cart.map(item => item.inventory_id === c.inventory_id ? {...item, gia_ban: Number(e.target.value)} : item))} 
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-gray-800">
                        {(Number(c.gia_ban) * c.so_luong_ban).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => setCart(cart.filter(x => x.inventory_id !== c.inventory_id))} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* GIAI ĐOẠN 2: ĐIỀU CHỈNH PHỤ PHÍ / KÊ GIÁ TỔNG ĐƠN */}
          <div className="bg-amber-50 p-3 rounded-lg mt-4 border border-amber-200">
            <span className="text-xs font-bold text-amber-900 block mb-2">⚡ Hiệu chỉnh giá tổng đơn (Phí ship tỉnh / Đóng gói / Phụ phí)</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Số tiền tăng (+) hoặc giảm (-)</label>
                <input 
                  type="number" 
                  step="5000"
                  placeholder="VD: 30000 hoặc -20000" 
                  className="w-full border rounded p-1.5 text-sm font-bold text-amber-900 bg-white"
                  value={formData.phi_dieu_chinh || ''}
                  onChange={e => setFormData({...formData, phi_dieu_chinh: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Lý do hiệu chỉnh (* Bắt buộc nếu kê giá)</label>
                <input 
                  type="text" 
                  placeholder="VD: Phí ship Viettel đi Cà Mau..." 
                  className="w-full border rounded p-1.5 text-sm bg-white"
                  value={formData.ly_do_dieu_chinh}
                  onChange={e => setFormData({...formData, ly_do_dieu_chinh: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* TỔNG KẾT TÀI CHÍNH */}
          <div className="bg-gray-50 p-4 rounded-lg mt-4 border space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tạm tính hàng:</span> 
              <span>{subTotal.toLocaleString('vi-VN')} đ</span>
            </div>
            {formData.khuyen_mai > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Giảm giá ({formData.khuyen_mai}%):</span> 
                <span>-{discountAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
            {formData.phi_dieu_chinh !== 0 && (
              <div className="flex justify-between text-sm text-amber-800 font-medium">
                <span>Hiệu chỉnh / Phụ phí:</span> 
                <span>{formData.phi_dieu_chinh > 0 ? '+' : ''}{formData.phi_dieu_chinh.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
            <div className="flex justify-between items-end border-t pt-2">
              <span className="font-semibold text-gray-800">TỔNG ĐƠN:</span>
              <span className="text-2xl font-bold text-green-700">{finalTotal.toLocaleString('vi-VN')} đ</span>
            </div>

            {formData.tien_coc > 0 && (
              <>
                <div className="flex justify-between text-sm text-blue-700 pt-1">
                  <span>Khách đã cọc:</span> 
                  <span>-{Number(formData.tien_coc).toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between items-end border-t border-dashed pt-1 text-red-600">
                  <span className="font-bold text-sm">CẦN THU THÊM (COD):</span>
                  <span className="text-xl font-extrabold">{remainingDue.toLocaleString('vi-VN')} đ</span>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={handleCheckout} 
            className="w-full mt-4 bg-green-600 text-white p-3.5 rounded-lg hover:bg-green-700 font-black text-lg flex justify-center items-center gap-2 transition-all shadow-md"
          >
            <CheckCircle size={24} /> CHỐT ĐƠN
          </button>
        </div>

        {/* BẢNG LỊCH SỬ HÓA ĐƠN */}
        <div className="lg:col-span-12 bg-white rounded-lg shadow-sm border overflow-hidden mt-4">
          <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-semibold text-gray-700">Lịch sử Hóa đơn ({filteredHistory.length})</span>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Tìm khách, tên áo, mã đơn, dặn dò..." 
                  className="pl-9 p-2 border rounded w-full text-sm"
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="relative w-full sm:w-auto">
                <Calendar size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="date" 
                  className="pl-9 p-2 border rounded w-full text-sm text-gray-600"
                  value={searchDate} 
                  onChange={(e) => setSearchDate(e.target.value)} 
                />
              </div>
              {(searchTerm || searchDate) && (
                <button onClick={() => {setSearchTerm(''); setSearchDate('')}} className="text-sm text-red-500 hover:underline whitespace-nowrap">Xóa bộ lọc</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-4">Mã Đơn / Ngày</th>
                  <th className="p-4">Khách hàng & Vận chuyển</th>
                  <th className="p-4">Sản phẩm & Ghi chú</th>
                  <th className="p-4 text-right">Tổng đơn / Thu COD</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredHistory.map((order) => {
                  const codBalance = order.tong_tien_don - (order.tien_coc || 0);
                  return (
                    <tr key={order.ma_don_hang} className={order.trang_thai_don === 'BI_BOM' ? 'bg-red-50 text-gray-400' : 'hover:bg-gray-50'}>
                      <td className="p-4">
                        <div className="font-bold text-blue-600">{order.ma_don_hang}</div>
                        <div className="text-xs text-gray-500">{new Date(order.ngay_ban).toLocaleDateString('vi-VN')}</div>
                        <div className="text-[11px] text-gray-400">NV: {order.ten_nhan_vien || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{order.customers?.ho_ten}</div>
                        <div className="text-xs text-gray-500">{order.customers?.so_dien_thoai}</div>
                        <span className="inline-block mt-1 bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                          {order.van_chuyen}
                        </span>
                      </td>
                      <td className="p-4 text-xs">
                        {order.items.map((i: any, idx: number) => (
                          <div key={idx}>
                            • {i.inventory?.ten_ao} <span className="font-bold text-gray-500">(Size {i.inventory?.size})</span> x{i.so_luong_ban} ({Number(i.gia_ban).toLocaleString('vi-VN')}đ)
                          </div>
                        ))}
                        {order.khuyen_mai > 0 && <span className="text-red-500 font-bold block mt-1">Giảm giá: -{order.khuyen_mai}%</span>}
                        {order.phi_dieu_chinh !== 0 && (
                          <span className="text-amber-700 block mt-0.5">
                            Phụ thu: {order.phi_dieu_chinh > 0 ? '+' : ''}{order.phi_dieu_chinh.toLocaleString('vi-VN')}đ ({order.ly_do_dieu_chinh})
                          </span>
                        )}
                        {order.ghi_chu_coc_dan_do && (
                          <div className="mt-1 p-1 bg-yellow-50 border border-yellow-200 rounded text-amber-900 font-medium">
                            📝 {order.ghi_chu_coc_dan_do}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-black text-green-700 text-base">{order.tong_tien_don?.toLocaleString('vi-VN')} đ</div>
                        {order.tien_coc > 0 && (
                          <div className="text-xs mt-0.5">
                            <span className="text-gray-500">Cọc: {order.tien_coc.toLocaleString('vi-VN')}đ</span>
                            <div className="font-bold text-red-600">Thu COD: {codBalance.toLocaleString('vi-VN')}đ</div>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => handlePrint(order)} title="In hóa đơn" className="text-gray-500 hover:text-blue-600">
                            <Printer size={18} />
                          </button>
                          <button onClick={() => handleEmail(order)} title="Gửi Email Hóa Đơn" className="text-gray-500 hover:text-orange-600">
                            <Mail size={18} />
                          </button>
                          {order.trang_thai_don === 'THANH_CONG' ? (
                            <button onClick={() => handleReturnOrder(order)} title="Khách bom đơn" className="text-red-500 hover:text-red-700">
                              <RotateCcw size={18} />
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold bg-red-200 text-red-800 px-1.5 py-0.5 rounded">BOM</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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