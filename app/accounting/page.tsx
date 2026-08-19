'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calculator, PlusCircle, Trash2, Wallet } from 'lucide-react'

export default function AccountingPage() {
  const [customExpenses, setCustomExpenses] = useState<any[]>([])
  const [summary, setSummary] = useState({ tong_thu_thuc_te: 0, tong_chi_phi_rieng: 0 })
  const [formData, setFormData] = useState({
    ten_khoan_chi: '',
    so_tien: 0,
    ghi_chu: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchFinanceData()
  }, [])

  const fetchFinanceData = async () => {
    // 1. Lấy danh sách chi phí riêng
    const { data: expData } = await supabase
      .from('custom_expenses')
      .select('*')
      .order('created_at', { ascending: false })

    if (expData) {
      setCustomExpenses(expData)
      const tongChi = expData.reduce((acc, curr) => acc + Number(curr.so_tien), 0)
      setSummary(prev => ({ ...prev, tong_chi_phi_rieng: tongChi }))
    }

    // 2. Lấy doanh thu THỰC TẾ (Bỏ qua các đơn bị BOM)
    const { data: salesData } = await supabase
      .from('sales')
      .select('tong_tien')
      .eq('trang_thai_don', 'THANH_CONG')
      
    if (salesData) {
      const tongThu = salesData.reduce((acc, curr) => acc + Number(curr.tong_tien), 0)
      setSummary(prev => ({ ...prev, tong_thu_thuc_te: tongThu }))
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { error } = await supabase.from('custom_expenses').insert([formData])
    
    if (!error) {
      alert('Đã ghi nhận khoản chi thành công!')
      setFormData({ ten_khoan_chi: '', so_tien: 0, ghi_chu: '' })
      fetchFinanceData()
    } else {
      alert('Lỗi: ' + error.message)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if(!confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) return
    const { error } = await supabase.from('custom_expenses').delete().eq('id', id)
    if (!error) fetchFinanceData()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Calculator size={32} className="text-yellow-600" />
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Chi Phí Vận Hành (Ngoài giá vốn)</h1>
      </div>

      {/* Tóm tắt dòng tiền */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Doanh thu thực tế (Đã trừ hàng Bom)</p>
          <p className="text-2xl font-bold text-green-600">{summary.tong_thu_thuc_te.toLocaleString('vi-VN')} đ</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Tổng chi phí vận hành riêng</p>
          <p className="text-2xl font-bold text-red-600">{summary.tong_chi_phi_rieng.toLocaleString('vi-VN')} đ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form nhập chi phí riêng */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2 flex items-center gap-2">
            <Wallet size={20} className="text-gray-500" /> Thêm khoản chi mới
          </h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tên khoản chi</label>
              <input required type="text" placeholder="VD: Tiền mặt bằng, Tiền Ads..." className="w-full border rounded p-2 focus:ring-2 focus:ring-yellow-200"
                value={formData.ten_khoan_chi} onChange={e => setFormData({...formData, ten_khoan_chi: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Số tiền (VNĐ)</label>
              <input required type="number" min="0" className="w-full border rounded p-2 focus:ring-2 focus:ring-yellow-200 font-bold text-red-600" 
                value={formData.so_tien} onChange={e => setFormData({...formData, so_tien: Number(e.target.value)})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ghi chú chi tiết</label>
              <textarea rows={3} className="w-full border rounded p-2 focus:ring-2 focus:ring-yellow-200" 
                placeholder="VD: Chuyển khoản chú chủ nhà tháng 10..."
                value={formData.ghi_chu} onChange={e => setFormData({...formData, ghi_chu: e.target.value})} />
            </div>

            <button type="submit" disabled={isSubmitting} className={`w-full text-white p-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors ${isSubmitting ? 'bg-gray-400' : 'bg-slate-800 hover:bg-slate-900'}`}>
              <PlusCircle size={20} /> {isSubmitting ? 'Đang lưu...' : 'Ghi nhận chi phí'}
            </button>
          </form>
        </div>

        {/* Bảng lịch sử chi phí */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b font-semibold text-gray-700">Sổ phụ chi phí vận hành</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4">Ngày ghi nhận</th>
                <th className="p-4">Khoản chi</th>
                <th className="p-4">Ghi chú</th>
                <th className="p-4 text-right">Số tiền</th>
                <th className="p-4 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customExpenses.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-500">{new Date(t.created_at).toLocaleDateString('vi-VN')}</td>
                  <td className="p-4 font-bold text-gray-800">{t.ten_khoan_chi}</td>
                  <td className="p-4 text-gray-600 max-w-[200px] truncate" title={t.ghi_chu}>{t.ghi_chu}</td>
                  <td className="p-4 text-right font-bold text-red-600">{Number(t.so_tien).toLocaleString('vi-VN')} đ</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {customExpenses.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Chưa có khoản chi nào được ghi nhận.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}