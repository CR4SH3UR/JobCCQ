/**
 * Layout racine de l'app : navigation par onglets (expo-router).
 * 3 onglets : Emplois (index), Qui recrute (entreprises), Sources.
 */
import { Tabs } from "expo-router";
import { StatusBar, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/theme";

/** Icône d'onglet minimaliste (emoji) — pas de librairie d'icônes externe. */
function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ fontSize: 20, color, lineHeight: 22 }}>{symbol}</Text>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { color: colors.slate900, fontWeight: "700" },
          headerTintColor: colors.slate900,
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.brand600,
          tabBarInactiveTintColor: colors.slate400,
          tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.slate200 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Emplois",
            tabBarLabel: "Emplois",
            tabBarIcon: ({ color }) => <TabIcon symbol="💼" color={color} />,
          }}
        />
        <Tabs.Screen
          name="entreprises"
          options={{
            title: "Qui recrute",
            tabBarLabel: "Qui recrute",
            tabBarIcon: ({ color }) => <TabIcon symbol="🏢" color={color} />,
          }}
        />
        <Tabs.Screen
          name="sources"
          options={{
            title: "Sources",
            tabBarLabel: "Sources",
            tabBarIcon: ({ color }) => <TabIcon symbol="🔗" color={color} />,
          }}
        />
        <Tabs.Screen
          name="favoris"
          options={{
            title: "Favoris",
            tabBarLabel: "Favoris",
            tabBarIcon: ({ color }) => <TabIcon symbol="♥" color={color} />,
          }}
        />
        <Tabs.Screen
          name="emploi/[id]"
          options={{ href: null, title: "Offre" }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}
