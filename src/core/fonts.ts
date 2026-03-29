import { useFonts } from "@expo-google-fonts/montserrat";
import {
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold
} from "@expo-google-fonts/montserrat";

export function useAppFonts() {
  return useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold
  });
}
