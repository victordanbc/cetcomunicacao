import { Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useAppFonts } from "./src/core/fonts";
import { ThemeProvider } from "./src/core/themeProvider";

export default function App() {
  const [fontsLoaded] = useAppFonts();
  const fontsOk = fontsLoaded || Platform.OS === "web";

  if (!fontsOk) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={styles.appFill}>
          <AppNavigator />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appFill: { flex: 1, alignSelf: "stretch" },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#0d47a1",
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: { color: "#fff", fontSize: 16 }
});
