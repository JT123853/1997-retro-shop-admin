'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PlusCircle, Trash2, Image as ImageIcon, Upload } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [formData, setFormData] = useState({ ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0 })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false })
    if (data) setInventory(data)
  }

  const handleAddShirt = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)

    let imageUrl = ''

    // Nếu người dùng có chọn ảnh, tiến hành upload lên Supabase Storage
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}` // Tạo tên file ngẫu nhiên bằng thời gian

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shirts')
        .upload(fileName, imageFile)

      if (uploadError) {
        alert('Lỗi upload ảnh: ' + uploadError.message)
        setIsUploading(false)
        return
      }

      // Lấy link ảnh Public sau khi upload thành công
      const { data: publicUrlData } = supabase.storage.from('shirts').getPublicUrl(fileName)
      imageUrl = publicUrlData.publicUrl
    }

    // Lưu thông tin áo (kèm link ảnh) vào Database
    const { error } = await supabase.from('inventory').insert([
      {
        ...formData,
        hinh_anh_url: imageUrl || null
      }
    ])
    
    if (!error) {
      alert('Thêm áo thành công!')
      setFormData({ ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0 })
      setImageFile(null) // Reset ô chọn file
      fetchInventory()
    } else {
      alert('Lỗi: ' + error.message)
    }
    
    setIsUploading(false)
  }

  const handleDelete = async (id: string, hinh_anh_url: string) => {
    // Tùy chọn: Xóa luôn ảnh trên Storage nếu muốn tiết kiệm dung lượng
    if (hinh_anh_url) {
      const fileName = hinh_anh_url.split('/').pop()
      if (fileName) await supabase.storage.from('shirts').remove([fileName])
    }

    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (!error) fetchInventory()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ImageIcon size={32} className="text-orange-600" />
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Tồn Kho</h1>
      </div>

      {/* Form nhập áo mới */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Nhập áo mới</h2>
        <form onSubmit={handleAddShirt} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Tên áo</label>
            <input required type="text" className="w-full border rounded p-2 focus:ring-2 focus:ring-orange-200" 
              value={formData.ten_ao} onChange={e => setFormData({...formData, ten_ao: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Size</label>
            <select className="w-full border rounded p-2 focus:ring-2 focus:ring-orange-200" 
              value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})}>
              <option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Số lượng</label>
            <input required type="number" className="w-full border rounded p-2 focus:ring-2 focus:ring-orange-200" 
              value={formData.so_luong} onChange={e => setFormData({...formData, so_luong: Number(e.target.value)})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Giá nhập</label>
            <input required type="number" className="w-full border rounded p-2 focus:ring-2 focus:ring-orange-200" 
              value={formData.gia_nhap} onChange={e => setFormData({...formData, gia_nhap: Number(e.target.value)})} />
          </div>
          
          {/* Nút upload ảnh */}
          <div className="md:col-span-6 flex items-center gap-4 mt-2">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                <Upload size={16} /> Tải ảnh áo lên (Không bắt buộc)
              </label>
              <input type="file" accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" 
                onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)} />
            </div>
            <button type="submit" disabled={isUploading} className={`w-48 text-white p-3 rounded-lg flex items-center justify-center gap-2 ${isUploading ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
              <PlusCircle size={20} /> 
              {isUploading ? 'Đang lưu...' : 'Thêm vào kho'}
            </button>
          </div>
        </form>
      </div>

      {/* Bảng danh sách tồn kho */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold w-24">Hình ảnh</th>
              <th className="p-4 font-semibold">Tên áo</th>
              <th className="p-4 font-semibold">Size</th>
              <th className="p-4 font-semibold">Số lượng</th>
              <th className="p-4 font-semibold">Giá nhập</th>
              <th className="p-4 font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inventory.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-4">
                  {item.hinh_anh_url ? (
                    <img src={item.hinh_anh_url} alt={item.ten_ao} className="w-16 h-16 object-cover rounded-md border" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-md border flex items-center justify-center text-gray-400 text-xs">Trống</div>
                  )}
                </td>
                <td className="p-4 font-medium">{item.ten_ao}</td>
                <td className="p-4">{item.size}</td>
                <td className="p-4 font-bold text-gray-700">{item.so_luong}</td>
                <td className="p-4">{item.gia_nhap.toLocaleString('vi-VN')} đ</td>
                <td className="p-4">
                  <button onClick={() => handleDelete(item.id, item.hinh_anh_url)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inventory.length === 0 && <p className="text-center p-8 text-gray-500">Kho đang trống.</p>}
      </div>
    </div>
  )
}