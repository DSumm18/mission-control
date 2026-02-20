import { Inter, JetBrains_Mono } from 'next/font/google'
import Providers from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata = {
  title: 'Schoolgle Mission Control',
  description: 'Dark command centre for Schoolgle operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-slate-950 text-slate-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
