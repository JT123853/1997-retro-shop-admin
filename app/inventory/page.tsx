'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Package, PlusCircle, Trash2, Edit, X, Image as ImageIcon, UploadCloud, Search, History, Calendar } from 'lucide-react'

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  
  // State tìm kiếm kho & tìm kiếm lịch sử nhập
  const [inventorySearch, setInventorySearch] = useState('')
  const [receiptSearch, setReceiptSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock')

  const [formData, setFormData] = useState({
    ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0, gia_ban: 0, hinh_anh: '', ghi_chu_nhap: ''
  })

  useEffect(() => { 
    fetchInventory()
    fetchReceipts()
  }, [])

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('*').order('created_at', { ascending: false })
    if (data) setInventory(data)
  }

  const fetchReceipts = async () => {
    const { data } = await supabase.from('inventory_receipts').select('*').order('created_at', { ascending: false }).limit(200)
    if (data) setReceipts(data)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    let finalImageUrl = formData.hinh_anh

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage.from('product_images').upload(fileName, selectedFile)
      if (uploadError) {
        alert('Lỗi tải ảnh: ' + uploadError.message)
        setUploading(false)
        return
      }
      const { data: publicUrlData } = supabase.storage.from('product_images').getPublicUrl(fileName)
      finalImageUrl = publicUrlData.publicUrl
    }

    if (isEditing && editId) {
      // Tìm sản phẩm trước khi sửa để tính độ lệch số lượng
      const oldItem = inventory.find(i => i.id === editId)
      const diff = Number(formData.so_luong) - (oldItem?.so_luong || 0)

      await supabase.from('inventory').update({
        ten_ao: formData.ten_ao,
        size: formData.size,
        so_luong: Number(formData.so_luong),
        gia_nhap: Number(formData.gia_nhap),
        gia_ban: Number(formData.gia_ban),
        hinh_anh: finalImageUrl
      }).eq('id', editId)

      // Nếu số lượng tăng thêm (bù hàng, nhập thêm) -> Ghi nhận vào lịch sử nhập
      if (diff > 0) {
        await supabase.from('inventory_receipts').insert([{
          inventory_id: editId,
          ten_ao: formData.ten_ao,
          size: formData.size,
          so_luong_nhap: diff,
          gia_nhap: Number(formData.gia_nhap),
          ghi_chu: formData.ghi_chu_nhap || 'Cập nhật điều chỉnh / Bù hàng NCC'
        }])
      }

      alert('Cập nhật thành công!')
      setIsEditing(false)
      setEditId(null)
    } else {
      // Thêm mới sản phẩm -> Thêm vào inventory và tạo 1 record trong inventory_receipts
      const { data: newInv, error } = await supabase.from('inventory').insert([{
        ten_ao: formData.ten_ao,
        size: formData.size,
        so_luong: Number(formData.so_luong),
        gia_nhap: Number(formData.gia_nhap),
        gia_ban: Number(formData.gia_ban),
        hinh_anh: finalImageUrl
      }]).select().single()

      if (!error && newInv) {
        await supabase.from('inventory_receipts').insert([{
          inventory_id: newInv.id,
          ten_ao: formData.ten_ao,
          size: formData.size,
          so_luong_nhap: Number(formData.so_luong),
          gia_nhap: Number(formData.gia_nhap),
          ghi_chu: formData.ghi_chu_nhap || 'Lô hàng mới nhập'
        }])
        alert('Nhập sản phẩm mới thành công!')
      }
    }

    setFormData({ ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0, gia_ban: 0, hinh_anh: '', ghi_chu_nhap: '' })
    setSelectedFile(null)
    setPreviewUrl('')
    setUploading(false)
    fetchInventory()
    fetchReceipts()
  }

  const handleEditClick = (item: any) => {
    setIsEditing(true)
    setEditId(item.id)
    setFormData({
      ten_ao: item.ten_ao, size: item.size, so_luong: item.so_luong, 
      gia_nhap: item.gia_nhap, gia_ban: item.gia_ban, hinh_anh: item.hinh_anh || '', ghi_chu_nhap: ''
    })
    setPreviewUrl(item.hinh_anh || '')
    setSelectedFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Lọc sản phẩm tồn kho
  const filteredInventory = inventory.filter(i => 
    i.ten_ao.toLowerCase().includes(inventorySearch.toLowerCase()) || 
    i.size.toLowerCase().includes(inventorySearch.toLowerCase())
  )

  // Lọc lịch sử nhập hàng
  const filteredReceipts = receipts.filter(r => 
    r.ten_ao.toLowerCase().includes(receiptSearch.toLowerCase()) || 
    r.size.toLowerCase().includes(receiptSearch.toLowerCase()) ||
    (r.ghi_chu && r.ghi_chu.toLowerCase().includes(receiptSearch.toLowerCase()))
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      {enlargedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-3xl w-full flex justify-center">
            <button className="absolute -top-12 right-0 text-white hover:text-red-400" onClick={() => setEnlargedImage(null)}>
              <X size={36} />
            </button>
            <img src={enlargedImage} alt="Phóng to" className="max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package size={32} className="text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Tồn kho & Lịch sử Nhập hàng</h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg border">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'stock' ? 'bg-white shadow text-orange-600' : 'text-gray-600'}`}
          >
            Danh sách kho ({filteredInventory.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
          >
            <History size={16} /> Lịch sử nhập hàng ({filteredReceipts.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORM NHẬP / SỬA HÀNG */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">
            {isEditing ? 'Sửa kho / Bù hàng' : 'Nhập lô hàng mới'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-4 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-lg text-center">
              <label className="block text-sm font-bold mb-2 text-blue-700">Hình ảnh áo</label>
              {previewUrl ? (
                <div className="relative inline-block mb-3">
                  <img src={previewUrl} alt="Preview" className="h-32 object-cover rounded border shadow-sm" />
                  <button type="button" onClick={() => { setSelectedFile(null); setPreviewUrl(''); setFormData({...formData, hinh_anh: ''}) }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center mb-3"><UploadCloud size={36} className="text-blue-300" /></div>
              )}
              <input type="file" id="fileUpload" accept="image/*" onChange={handleFileChange} className="hidden" />
              <label htmlFor="fileUpload" className="cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded font-medium text-sm inline-block">
                {previewUrl ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy...'}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tên áo / Đội bóng</label>
              <input required type="text" className="w-full border rounded p-2 text-sm" value={formData.ten_ao} onChange={e => setFormData({...formData, ten_ao: e.target.value})} placeholder="VD: Barcelona away 26/27 ( Player )" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Size</label>
                <select className="w-full border rounded p-2 text-sm" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})}>
                  <option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số lượng {isEditing ? 'mới' : 'nhập'}</label>
                <input required type="number" min="0" className="w-full border rounded p-2 text-sm" value={formData.so_luong} onChange={e => setFormData({...formData, so_luong: Number(e.target.value)})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-red-600">Giá Vốn Nhập</label>
                <input required type="number" min="0" className="w-full border rounded p-2 text-sm text-red-600" value={formData.gia_nhap} onChange={e => setFormData({...formData, gia_nhap: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-green-600">Giá Bán Lẻ</label>
                <input required type="number" min="0" className="w-full border rounded p-2 text-sm text-green-600 font-bold" value={formData.gia_ban} onChange={e => setFormData({...formData, gia_ban: Number(e.target.value)})} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ghi chú đợt nhập (Lý do bù/nhà cung cấp)</label>
              <input type="text" className="w-full border rounded p-2 text-sm" placeholder="VD: NCC bù áo lỗi đợt 1..." value={formData.ghi_chu_nhap} onChange={e => setFormData({...formData, ghi_chu_nhap: e.target.value})} />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={uploading} className={`flex-1 text-white p-3 rounded font-semibold flex justify-center gap-2 ${uploading ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
                {uploading ? 'Đang lưu...' : (isEditing ? <><Edit size={18} /> LƯU THAY ĐỔI</> : <><PlusCircle size={18} /> NHẬP HÀNG VÀO KHO</>)}
              </button>
              {isEditing && (
                <button type="button" onClick={() => { setIsEditing(false); setFormData({ ten_ao: '', size: 'M', so_luong: 0, gia_nhap: 0, gia_ban: 0, hinh_anh: '', ghi_chu_nhap: '' }); setSelectedFile(null); setPreviewUrl('') }} className="bg-gray-200 p-3 rounded font-semibold text-sm">HỦY</button>
              )}
            </div>
          </form>
        </div>

        {/* TAB 1: DANH SÁCH SẢN PHẨM HIỆN TẠI */}
        {activeTab === 'stock' ? (
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between gap-4">
              <span className="font-semibold text-gray-700">Tồn kho hiện tại</span>
              <div className="relative w-72">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Tìm theo tên áo hoặc size..." 
                  className="pl-9 p-2 border rounded w-full text-sm"
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[650px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0 border-b shadow-sm">
                  <tr>
                    <th className="p-3">Ảnh</th>
                    <th className="p-3">Sản phẩm</th>
                    <th className="p-3 text-center">Tồn</th>
                    <th className="p-3 text-right">Giá bán</th>
                    <th className="p-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        {item.hinh_anh ? (
                          <img src={item.hinh_anh} alt="áo" className="w-12 h-12 object-cover rounded cursor-pointer border" onClick={() => setEnlargedImage(item.hinh_anh)} />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 border"><ImageIcon size={18} /></div>
                        )}
                      </td>
                      <td className="p-3 font-medium">
                        <div>{item.ten_ao}</div>
                        <span className="text-xs text-blue-600 font-bold">Size: {item.size}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-base">{item.so_luong}</td>
                      <td className="p-3 text-right font-bold text-green-600">{Number(item.gia_ban).toLocaleString('vi-VN')} đ</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => handleEditClick(item)} className="text-blue-500 hover:text-blue-700" title="Chỉnh sửa"><Edit size={18} /></button>
                          <button onClick={async () => {
                            if (!confirm('Xóa sản phẩm này khỏi hệ thống?')) return
                            await supabase.from('inventory').delete().eq('id', item.id)
                            fetchInventory()
                          }} className="text-red-400 hover:text-red-700" title="Xóa"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">Không tìm thấy sản phẩm nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TAB 2: LỊCH SỬ NHẬP HÀNG (LUỒNG IN) */
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between gap-4">
              <span className="font-semibold text-gray-700 flex items-center gap-2">
                <History size={18} className="text-blue-600" /> Nhật ký các lần nhập hàng
              </span>
              <div className="relative w-72">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Tìm lịch sử nhập, ghi chú..." 
                  className="pl-9 p-2 border rounded w-full text-sm"
                  value={receiptSearch}
                  onChange={e => setReceiptSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[650px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="p-3">Thời gian nhập</th>
                    <th className="p-3">Tên áo / Size</th>
                    <th className="p-3 text-center">SL Nhập</th>
                    <th className="p-3 text-right">Giá vốn nhập</th>
                    <th className="p-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredReceipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="p-3 text-xs text-gray-500">
                        {new Date(rec.created_at).toLocaleDateString('vi-VN')} {new Date(rec.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-medium">
                        <div>{rec.ten_ao}</div>
                        <span className="text-xs text-blue-600 font-bold">Size: {rec.size}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-green-700">+{rec.so_luong_nhap}</td>
                      <td className="p-3 text-right text-gray-700">{Number(rec.gia_nhap).toLocaleString('vi-VN')} đ</td>
                      <td className="p-3 text-xs text-gray-500 italic">{rec.ghi_chu || 'Nhập kho'}</td>
                    </tr>
                  ))}
                  {filteredReceipts.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">Không có bản ghi nhập hàng nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}