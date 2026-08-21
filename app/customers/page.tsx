'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, PlusCircle, Trash2, Edit } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({ ho_ten: '', so_dien_thoai: '', email: '' })

  useEffect(() => { fetchCustomers() }, [])

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    if (data) setCustomers(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing && editId) {
      await supabase.from('customers').update(formData).eq('id', editId)
      alert('Cập nhật khách hàng thành công!')
      setIsEditing(false); setEditId(null)
    } else {
      await supabase.from('customers').insert([formData])
      alert('Thêm khách hàng thành công!')
    }
    setFormData({ ho_ten: '', so_dien_thoai: '', email: '' })
    fetchCustomers()
  }

  const handleDelete = async (id: string) => {
    if(!confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Users size={32} className="text-purple-600" />
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Khách Hàng (CRM)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">{isEditing ? 'Sửa thông tin' : 'Thêm khách hàng'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Họ và tên</label>
              <input required type="text" className="w-full border rounded p-2" value={formData.ho_ten} onChange={e => setFormData({...formData, ho_ten: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Số điện thoại</label>
              <input required type="text" className="w-full border rounded p-2" value={formData.so_dien_thoai} onChange={e => setFormData({...formData, so_dien_thoai: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-blue-600">Email (Để gửi hóa đơn)</label>
              <input type="email" placeholder="VD: khachhang@gmail.com" className="w-full border rounded p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-purple-600 text-white p-3 rounded hover:bg-purple-700 font-semibold flex items-center justify-center gap-2">
                {isEditing ? <Edit size={20}/> : <PlusCircle size={20}/>} {isEditing ? 'LƯU LẠI' : 'THÊM MỚI'}
              </button>
              {isEditing && (
                <button type="button" onClick={() => {setIsEditing(false); setFormData({ ho_ten: '', so_dien_thoai: '', email: '' })}} className="bg-gray-200 p-3 rounded font-semibold">HỦY</button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b font-semibold">Danh sách Khách hàng</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4">Họ và Tên</th>
                <th className="p-4">Số điện thoại</th>
                <th className="p-4">Email</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold">{c.ho_ten}</td>
                  <td className="p-4">{c.so_dien_thoai}</td>
                  <td className="p-4 text-blue-600">{c.email || <span className="text-gray-400 italic">Chưa có</span>}</td>
                  <td className="p-4 text-center flex justify-center gap-3">
                    <button onClick={() => { setIsEditing(true); setEditId(c.id); setFormData({ ho_ten: c.ho_ten, so_dien_thoai: c.so_dien_thoai, email: c.email || '' }) }} className="text-blue-500"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-400"><Trash2 size={18} /></button>
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