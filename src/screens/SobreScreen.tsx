import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS } from "../core/theme";
import { useTheme } from "../core/themeProvider";

export function SobreScreen({ onGoBack }: { onGoBack: () => void }) {
  const { theme, toggle } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>cetcomunicacao</Text>
        <Text style={[styles.p, { color: c.muted }]}>
          Projeto Expo SDK 54, TypeScript, React Navigation e tema com AsyncStorage — espelhando a stack do app
          lanchonete, pronto para evoluir com APIs e novas telas.
        </Text>
        <TouchableOpacity
          style={[styles.ghost, { borderColor: c.border }]}
          onPress={toggle}
          activeOpacity={0.85}
        >
          <Text style={[styles.ghostText, { color: c.text }]}>
            Alternar tema ({theme.mode === "dark" ? "claro" : "escuro"})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primary, { backgroundColor: c.primary }]} onPress={onGoBack} activeOpacity={0.9}>
          <Text style={styles.primaryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 14 },
  title: { fontFamily: FONTS.extrabold, fontSize: 20 },
  p: { fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 21 },
  ghost: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  ghostText: { fontFamily: FONTS.bold, fontSize: 14 },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontFamily: FONTS.extrabold, fontSize: 15, color: "#fff" }
});
