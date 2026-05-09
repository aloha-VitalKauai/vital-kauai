import { Suspense } from 'react'
import SetupAccountClient from './SetupAccountClient'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SetupAccountClient />
    </Suspense>
  )
}
