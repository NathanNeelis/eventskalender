import {
  ActionIcon,
  AppShell,
  Group,
  NavLink,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconCalendarEvent, IconMoon, IconSun, IconUsers } from '@tabler/icons-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import EventsPage from './pages/EventsPage'
import TeamPage from './pages/TeamPage'

const NAV = [
  { to: '/', label: 'Events', icon: IconCalendarEvent },
  { to: '/team', label: 'Team', icon: IconUsers },
]

export default function App() {
  const location = useLocation()
  const { setColorScheme } = useMantineColorScheme()
  const scheme = useComputedColorScheme('light')

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <IconCalendarEvent size={28} color="var(--mantine-color-indigo-6)" />
            <Title order={3}>
              MDSC
              <Text span inherit c="indigo">
                events
              </Text>
            </Title>
          </Group>
          <Group gap={4} wrap="nowrap">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                component={Link}
                to={to}
                label={label}
                leftSection={<Icon size={18} />}
                active={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)}
                variant="light"
                style={{ borderRadius: 'var(--mantine-radius-md)', width: 'auto' }}
              />
            ))}
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Toggle colour scheme"
              onClick={() => setColorScheme(scheme === 'light' ? 'dark' : 'light')}
            >
              {scheme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<EventsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  )
}
