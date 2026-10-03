import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  NavLink,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconCalendarEvent,
  IconMoon,
  IconSun,
  IconUsers,
} from "@tabler/icons-react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useLiveUpdates } from "./api/live";
import ChatWidget from "./components/ChatWidget";
import Footer from "./components/footer";
import EventsPage from "./pages/EventsPage";
import TeamPage from "./pages/TeamPage";

const NAV = [
  { to: "/", label: "Events", icon: IconCalendarEvent },
  { to: "/team", label: "Team", icon: IconUsers },
];

export default function App() {
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");
  const live = useLiveUpdates();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <IconCalendarEvent
              size={28}
              color="var(--mantine-color-indigo-6)"
            />
            <Title order={3}>
              MDSC
              <Text span inherit c="indigo">
                events kalender
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
                active={
                  to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to)
                }
                variant="light"
                style={{
                  borderRadius: "var(--mantine-radius-md)",
                  width: "auto",
                }}
              />
            ))}
            <Tooltip
              label={live ? "Live updates on" : "Reconnecting to live updates…"}
            >
              <Box
                w={10}
                h={10}
                mx={6}
                style={{ borderRadius: "50%" }}
                bg={live ? "teal.5" : "gray.4"}
                aria-label={live ? "Live" : "Offline"}
              />
            </Tooltip>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Toggle colour scheme"
              onClick={() =>
                setColorScheme(scheme === "light" ? "dark" : "light")
              }
            >
              {scheme === "light" ? (
                <IconMoon size={18} />
              ) : (
                <IconSun size={18} />
              )}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Column layout: page content grows, so the footer sits at the bottom even on short pages */}
      <AppShell.Main style={{ display: "flex", flexDirection: "column" }}>
        <Box style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<EventsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
        <Footer />
      </AppShell.Main>
      <ChatWidget />
    </AppShell>
  );
}
