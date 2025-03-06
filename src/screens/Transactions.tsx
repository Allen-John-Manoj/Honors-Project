import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types"; // ✅ Import from types.ts

// Define navigation types
type TransactionsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Transactions">;
type TransactionsScreenRouteProp = RouteProp<RootStackParamList, "Transactions">;

type Props = {
  navigation: TransactionsScreenNavigationProp;
  route: TransactionsScreenRouteProp;
};

export default function Transactions({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>⬅ Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionText}>This is the Transactions section</Text>
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
