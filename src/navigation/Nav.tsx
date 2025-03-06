import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TouchableOpacity, Image } from "react-native";
import { NavigationProp } from "@react-navigation/native";

type RootStackParamList = {
  Transactions: undefined;
  Forecast: undefined;
  Graphs: undefined;
};

type Props = {
  navigation: NavigationProp<RootStackParamList>;
};

const Tab = createBottomTabNavigator();

export default function Nav({ navigation }: Props) {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Transactions"
        component={() => null} // Placeholder, navigation is handled manually
        options={{
          tabBarButton: () => (
            <TouchableOpacity onPress={() => navigation.navigate("Transactions")}>
              <Image source={require("../assets/images/transactions.png")} style={{ width: 30, height: 30 }} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen
        name="Forecast"
        component={() => null}
        options={{
          tabBarButton: () => (
            <TouchableOpacity onPress={() => navigation.navigate("Forecast")}>
              <Image source={require("../assets/images/forecast.png")} style={{ width: 30, height: 30 }} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen
        name="Graphs"
        component={() => null}
        options={{
          tabBarButton: () => (
            <TouchableOpacity onPress={() => navigation.navigate("Graphs")}>
              <Image source={require("../assets/images/graphs.png")} style={{ width: 30, height: 30 }} />
            </TouchableOpacity>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
