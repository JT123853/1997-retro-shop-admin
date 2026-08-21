'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Package, PlusCircle, Trash2, Edit, X, Image as ImageIcon, UploadCloud } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Trạng thái lưu ảnh phóng to
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  
  // Trạng thái xử lý file Upload
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  
  const [formData, setFormData] = useState({
    ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0, gia_ban: 0, hinh_anh: ''
  })

  useEffect(() => { fetchInventory() }, [])

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('created_at', { ascending: false })
    if (data) setInventory(data)
  }

  // Xử lý khi người dùng chọn file ảnh từ máy tính
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setSelectedFile(file)
    // Tạo link preview tạm thời để hiển thị ngay lập tức
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    let finalImageUrl = formData.hinh_anh

    // 1. Nếu có chọn file ảnh mới -> Tiến hành Upload lên Supabase Storage
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('product_images') // Tên bucket vừa tạo ở bước 1
        .upload(fileName, selectedFile)

      if (uploadError) {
        alert('Lỗi khi tải ảnh lên: ' + uploadError.message)
        setUploading(false)
        return
      }

      // 2. Lấy đường dẫn Public URL của bức ảnh vừa tải lên
      const { data: publicUrlData } = supabase.storage
        .from('product_images')
        .getPublicUrl(fileName)
        
      finalImageUrl = publicUrlData.publicUrl
    }

    // 3. Lưu thông tin (kèm link ảnh mới) vào Database
    const dataToSave = { ...formData, hinh_anh: finalImageUrl }

    if (isEditing && editId) {
      await supabase.from('inventory').update(dataToSave).eq('id', editId)
      alert('Cập nhật thành công!')
      setIsEditing(false); setEditId(null)
    } else {
      await supabase.from('inventory').insert([dataToSave])
      alert('Thêm sản phẩm thành công!')
    }

    // Xóa form và reset trạng thái file
    setFormData({ ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0, gia_ban: 0, hinh_anh: '' })
    setSelectedFile(null)
    setPreviewUrl('')
    setUploading(false)
    fetchInventory()
  }

  // Khi bấm nút Sửa, tải hình ảnh cũ lên preview
  const handleEditClick = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setFormData({
      ten_ao: item.ten_ao, size: item.size, so_luong: item.so_luong, 
      gia_nhap: item.gia_nhap, gia_ban: item.gia_ban, hinh_anh: item.hinh_anh || ''
    })
    setPreviewUrl(item.hinh_anh || '')
    setSelectedFile(null) // Hủy file đang chọn dở (nếu có)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Khi bấm Hủy sửa
  const handleCancelEdit = () => {
    setIsEditing(false)
    setFormData({ ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0, gia_ban: 0, hinh_anh: '' })
    setSelectedFile(null)
    setPreviewUrl('')
  }

  const handleDelete = async (id: string) => {
    if(!confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return
    await supabase.from('inventory').delete().eq('id', id)
    fetchInventory()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 relative">
      {/* KHUNG POPUP PHÓNG TO ẢNH */}
      {enlargedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-3xl w-full flex justify-center">
            <button className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors" onClick={() => setEnlargedImage(null)}>
              <X size={36} />
            </button>
            <img src={enlargedImage} alt="Phóng to" className="max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Package size={32} className="text-orange-600" />
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Tồn kho & Hình ảnh</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">{isEditing ? 'Sửa thông tin' : 'Thêm áo mới'}</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* KHU VỰC UPLOAD ẢNH TỪ MÁY TÍNH */}
            <div className="p-4 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-lg text-center">
              <label className="block text-sm font-bold mb-2 text-blue-700">Hình ảnh sản phẩm</label>
              
              {previewUrl ? (
                <div className="relative inline-block mb-3">
                  <img src={previewUrl} alt="Preview" className="h-32 object-cover rounded border shadow-sm" />
                  <button type="button" onClick={() => { setSelectedFile(null); setPreviewUrl(''); setFormData({...formData, hinh_anh: ''}) }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center mb-3">
                  <UploadCloud size={36} className="text-blue-300" />
                </div>
              )}
              
              <input type="file" id="fileUpload" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label htmlFor="fileUpload" className="cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded font-medium text-sm transition-colors inline-block">
                {previewUrl ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy...'}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tên áo / Đội bóng</label>
              <input required type="text" className="w-full border rounded p-2" value={formData.ten_ao} onChange={e => setFormData({...formData, ten_ao: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Size</label>
                <select className="w-full border rounded p-2" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})}>
                  <option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số lượng</label>
                <input required type="number" min="0" className="w-full border rounded p-2" value={formData.so_luong} onChange={e => setFormData({...formData, so_luong: Number(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-red-600">Giá Vốn</label>
                <input required type="number" min="0" className="w-full border rounded p-2 text-red-600" value={formData.gia_nhap} onChange={e => setFormData({...formData, gia_nhap: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-green-600">Giá Bán</label>
                <input required type="number" min="0" className="w-full border rounded p-2 text-green-600 font-bold" value={formData.gia_ban} onChange={e => setFormData({...formData, gia_ban: Number(e.target.value)})} />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={uploading} className={`flex-1 text-white p-3 rounded font-semibold flex justify-center gap-2 ${uploading ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
                {uploading ? 'Đang tải...' : (isEditing ? <><Edit size={20} /> LƯU LẠI</> : <><PlusCircle size={20} /> THÊM MỚI</>)}
              </button>
              {isEditing && (
                <button type="button" onClick={handleCancelEdit} className="bg-gray-200 p-3 rounded font-semibold">HỦY</button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b font-semibold">Danh sách sản phẩm</div>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b shadow-sm">
                <tr>
                  <th className="p-4">Ảnh</th>
                  <th className="p-4">Sản phẩm</th>
                  <th className="p-4 text-center">Tồn</th>
                  <th className="p-4 text-right">Giá bán</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      {item.hinh_anh ? (
                        <img 
                          src={item.hinh_anh} 
                          alt="áo" 
                          className="w-12 h-12 object-cover rounded shadow-sm cursor-pointer hover:opacity-80 transition-opacity border"
                          onClick={() => setEnlargedImage(item.hinh_anh)} // Bấm vào để phóng to
                          title="Bấm để xem ảnh lớn"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 border"><ImageIcon size={20} /></div>
                      )}
                    </td>
                    <td className="p-4 font-medium">{item.ten_ao} <span className="text-gray-500 text-xs ml-1">({item.size})</span></td>
                    <td className="p-4 text-center font-bold">{item.so_luong}</td>
                    <td className="p-4 text-right font-bold text-green-600">{Number(item.gia_ban).toLocaleString('vi-VN')} đ</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => handleEditClick(item)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-700"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}