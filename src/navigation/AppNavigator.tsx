import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { SobreScreen } from "../screens/SobreScreen";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: true,
            headerTitleStyle: { fontFamily: "Montserrat_700Bold", fontSize: 17 },
            contentStyle: { flex: 1 }
          }}
        >
          <Stack.Screen
            name="Home"
            options={{ headerShown: false, title: "CET Comunicação" }}
          >
            {() => <HomeScreen />}
          </Stack.Screen>
          <Stack.Screen name="Sobre" options={{ title: "Sobre" }}>
            {({ navigation }) => <SobreScreen onGoBack={() => navigation.goBack()} />}
          </Stack.Screen>
        </Stack.Navigator>
    </NavigationContainer>
  );
}
