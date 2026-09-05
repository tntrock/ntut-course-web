import { useEffect, useState } from 'react'

/**
 * 延遲回傳最新的值。搜尋輸入用 120 ms —— 再短會讓每個按鍵都觸發一次查詢,
 * 再長使用者會覺得畫面在拖。
 */
export function useDebounced<T>(value: T, delay = 120): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
