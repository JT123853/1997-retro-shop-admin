import './globals.css'
import ClientLayout from './ClientLayout'

export const metadata = {
  title: '1997 Retro Shop Admin',
  description: 'Hệ thống quản trị nội bộ 1997 Retro Shop',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body className="bg-gray-100 overflow-hidden">
        {/* Chuyển toàn bộ logic giao diện sang file ClientLayout */}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}