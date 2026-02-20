'use client'

import { SWRConfig } from 'swr'

export default function Providers({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url) => fetch(url).then((res) => res.json()),
        revalidateOnFocus: true,
        dedupingInterval: 5000,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  )
}
