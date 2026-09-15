import { StyleSheet } from 'react-native';

export const colors = {
  themeBG: "#f7fafd",
  primary: "#005086",
  white: "#FFFFFF",
  blackFont: "#414750",
};

export const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  extraBold: "Poppins_800ExtraBold",
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeBG,
    // backgroundColor:'red'
  },
  flexClass: {
    flexDirection: "row",
    alignItems: "center",
  },
});
