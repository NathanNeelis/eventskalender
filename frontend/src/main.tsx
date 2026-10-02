import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import 'leaflet/dist/leaflet.css'
import './index.css'

import { createTheme, MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/en-gb'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'

dayjs.locale('en-gb')

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  headings: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'en-gb', firstDayOfWeek: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ModalsProvider>
            <Notifications position="top-right" />
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ModalsProvider>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
)
