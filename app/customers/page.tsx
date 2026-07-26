'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PlusCircle, Trash2, Users } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [formData, setFormData] = useState({ 
    ho_ten: '', 
    so_dien_thoai: '', 
    dia_chi: '', 
    nguon_khach: 'Facebook' 
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCustomers(data)
  }

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('customers').insert([formData])
    
    if (!error) {
      alert('Thêm khách hàng thành công!')
      setFormData({ ho_ten: '', so_dien_thoai: '', dia_chi: '', nguon_khach: 'Facebook' })
      fetchCustomers()
    } else {
      alert('Lỗi: ' + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (!error) fetchCustomers()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Users size={32} className="text-purple-600" />
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Khách Hàng</h1>
      </div>

      {/* Form thêm khách hàng */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Thêm khách hàng mới</h2>
        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Họ tên *</label>
            <input required type="text" className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-200" 
              value={formData.ho_ten} onChange={e => setFormData({...formData, ho_ten: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Số điện thoại *</label>
            <input required type="text" className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-200" 
              value={formData.so_dien_thoai} onChange={e => setFormData({...formData, so_dien_thoai: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Địa chỉ</label>
            <input type="text" className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-200" 
              value={formData.dia_chi} onChange={e => setFormData({...formData, dia_chi: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nguồn khách</label>
            <select className="w-full border rounded p-2 focus:ring-2 focus:ring-purple-200" 
              value={formData.nguon_khach} onChange={e => setFormData({...formData, nguon_khach: e.target.value})}>
              <option>Facebook</option><option>TikTok</option><option>Truyền miệng</option><option>Khác</option>
            </select>
          </div>
          <button type="submit" className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 flex items-center justify-center gap-2">
            <PlusCircle size={20} /> Lưu
          </button>
        </form>
      </div>

      {/* Bảng danh sách */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold">Họ tên</th>
              <th className="p-4 font-semibold">Số điện thoại</th>
              <th className="p-4 font-semibold">Địa chỉ</th>
              <th className="p-4 font-semibold">Nguồn</th>
              <th className="p-4 font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{c.ho_ten}</td>
                <td className="p-4">{c.so_dien_thoai}</td>
                <td className="p-4">{c.dia_chi}</td>
                <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">{c.nguon_khach}</span></td>
                <td className="p-4">
                  <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}