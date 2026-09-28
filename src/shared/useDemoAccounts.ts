import { useEffect, useState } from 'react'

/** 서버가 DEMO 샘플 데이터를 켠 경우에만 true. 운영 서버에서는 데모 계정 안내를 숨긴다. */
export function useDemoAccounts(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    fetch('/api/system/info', { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(info => { if (active) setEnabled(info?.demoAccounts === true) })
      .catch(() => { if (active) setEnabled(false) })
    return () => { active = false }
  }, [])
  return enabled
}
