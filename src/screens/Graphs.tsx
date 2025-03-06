import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types"; // ✅ Import from types.ts

// Define navigation types
type GraphsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Graphs">;
type GraphsScreenRouteProp = RouteProp<RootStackParamList, "Graphs">;

type Props = {
  navigation: GraphsScreenNavigationProp;
  route: GraphsScreenRouteProp;
};

export default function Graphs({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>⬅ Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionText}>This is the Graphs section</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  sectionText: {
    fontSize: 20,
    color: "green",
    fontWeight: "bold",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
  },
  backText: {
    fontSize: 18,
    color: "blue",
  },
});
