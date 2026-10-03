import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/**
 * Subscribes to the backend's change stream and refreshes cached data when events or
 * team members change — whether by the chat agent, another browser tab or a colleague.
 * Returns whether the stream is currently connected.
 */
export function useLiveUpdates(): boolean {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource('/api/stream')

    source.addEventListener('ready', () => {
      setConnected(true)
      // We may have missed changes while disconnected
      qc.invalidateQueries()
    })
    source.addEventListener('events_changed', () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['event'] })
      qc.invalidateQueries({ queryKey: ['organisations'] })
    })
    source.addEventListener('colleagues_changed', () => {
      qc.invalidateQueries({ queryKey: ['colleagues'] })
    })
    // EventSource reconnects by itself; just reflect the state
    source.onerror = () => setConnected(false)

    return () => source.close()
  }, [qc])

  return connected
}
