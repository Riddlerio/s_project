import { useEffect, useState } from 'react'

/** 서버가 DEMO 모드(샘플 데이터)를 켠 경우에만 true. 샘플 계정 비밀번호는 브라우저로 받지 않는다. */
export function useDemoMode(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    fetch('/api/config/public', { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : null)
      .then(config => { if (active) setEnabled(config?.demoModeEnabled === true) })
      .catch(() => { if (active) setEnabled(false) })
    return () => { active = false }
  }, [])
  return enabled
}
