import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, Image, TouchableOpacity, ScrollView } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

export default function App() {
  const [selectedRange, setSelectedRange] = useState("Month");
  const [activeTab, setActiveTab] = useState("Account"); // Tracks which tab is active

  // Example data (modify with actual data)
  const chartData = {
    labels: ["1", "5", "10", "15", "20", "25", "30"], // Time points
    datasets: [
      {
        data: [3000, 5000, 4000, 7000, 2500, 8000, 6000], // Income
        color: () => "#4CAF50", // Green for income
        strokeWidth: 2,
      },
      {
        data: [2000, 4000, 5000, 6000, 3000, 5000, 7000], // Expenses
        color: () => "#E53935", // Red for expenses
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#030a09" />

      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={require("./src/assets/images/logo.png")}  
          style={[styles.logoImage, { tintColor: "#4CAF50" }]} 
          resizeMode="contain"
        />
      </View>

      {/* Main Content Based on Active Tab */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.contentContainer}>

          {activeTab === "Account" && (
            <>
              {/* Net Worth Section */}
              <View style={styles.netWorthContainer}>
                <View style={styles.netWorthBox}>
                  <Text style={styles.netWorthTitle}>MY NET WORTH</Text>
                  <Text style={styles.netWorthValue}>₹6.83L</Text>
                </View>
              </View>

              {/* Recent Transactions */}
              <View style={styles.recentTransactionsContainer}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>RECENT TRANSACTIONS</Text>
                  <TouchableOpacity style={styles.addMoreButton}>
                    <Text style={styles.addMoreText}>More</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.tileRow}>
                  <View style={[styles.transactionTile, styles.incomeTile]}>
                    <Text style={styles.tileTitle}>INCOME</Text>
                    <Text style={[styles.tileValue, styles.incomeText]}>₹10,000</Text>
                  </View>

                  <View style={[styles.transactionTile, styles.expenseTile]}>
                    <Text style={styles.tileTitle}>RENT</Text>
                    <Text style={[styles.tileValue, styles.expenseText]}>₹-8,500</Text>
                  </View>

                  <View style={[styles.transactionTile, styles.expenseTile]}>
                    <Text style={styles.tileTitle}>GROCERIES</Text>
                    <Text style={[styles.tileValue, styles.expenseText]}>₹-3,200</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {activeTab === "Graphs" && (
            <>
              <Text style={styles.totalsLabel}>TRENDS</Text>
              <View style={styles.trendsContainer}>
                <View style={styles.toggleRow}>
                  {["Day", "Week", "Month", "Year"].map((range) => (
                    <TouchableOpacity
                      key={range}
                      style={[
                        styles.toggleButton,
                        selectedRange === range && styles.selectedToggleButton,
                      ]}
                      onPress={() => setSelectedRange(range)}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          selectedRange === range && styles.selectedToggleText,
                        ]}
                      >
                        {range}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Graph */}
                <View style={styles.chartContainer}>
                  <LineChart
                    data={chartData}
                    width={Dimensions.get("window").width - 70}  
                    height={220}
                    yAxisSuffix="₹"
                    yAxisInterval={1} 
                    chartConfig={{
                      backgroundColor: "#212121",
                      backgroundGradientFrom: "#212121",
                      backgroundGradientTo: "#212121",
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      style: { borderRadius: 15 },
                    }}
                    bezier
                    style={{ borderRadius: 15 }}
                  />
                </View>
              </View>
            </>
          )}

          {activeTab === "Transactions" && (
            <View style={styles.transactionsScreen}>
              <Text style={styles.screenTitle}>Transactions</Text>
              {/* Add transaction-related content here */}
            </View>
          )}

          {activeTab === "Forecast" && (
            <View style={styles.forecastScreen}>
              <Text style={styles.screenTitle}>Forecast</Text>
              {/* Add forecast-related content here */}
            </View>
          )}
          
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Account")}>
          <Image
            source={require("./src/assets/images/account.png")}
            style={[styles.navIconImage, { tintColor: activeTab === "Account" ? "#4CAF50" : "#a8aeaa" }]}
          />
          {activeTab !== "Account" && <Text style={styles.navLabel}>Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Transactions")}>
          <Image
            source={require("./src/assets/images/transactions.png")}
            style={[styles.navIconImage, { tintColor: activeTab === "Transactions" ? "#4CAF50" : "#a8aeaa" }]}
          />
          {activeTab !== "Transactions" && <Text style={styles.navLabel}>Transactions</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Forecast")}>
          <Image
            source={require("./src/assets/images/forecast.png")}
            style={[styles.navIconImage, { tintColor: activeTab === "Forecast" ? "#4CAF50" : "#a8aeaa" }]}
          />
          {activeTab !== "Forecast" && <Text style={styles.navLabel}>Forecast</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Graphs")}>
          <Image
            source={require("./src/assets/images/graphs.png")}
            style={[styles.navIconImage, { tintColor: activeTab === "Graphs" ? "#4CAF50" : "#a8aeaa" }]}
          />
          {activeTab !== "Graphs" && <Text style={styles.navLabel}>Graphs</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
  },
  transactionsScreen: {
    alignItems: "center",
    marginTop: 20,
  },
  forecastScreen: {
    alignItems: "center",
    marginTop: 20,
  },
  chartContainer: {
    alignItems: "center", // Center the chart
    justifyContent: "center",
    width: "100%",
    marginTop: 10,
  },
  
  trendsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#343635",
    borderRadius: 15,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  toggleButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  selectedToggleButton: {
    backgroundColor: "#4CAF50",
  },
  toggleText: {
    color: "#a8aeaa",
    fontSize: 14,
  },
  selectedToggleText: {
    color: "#fff",
    fontWeight: "bold",
  },

  moreIndicator: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#a8aeaa",
    textAlign: "center",
  },
  recentTransactionsContainer: {
    marginBottom: 20,
  },
  transactionTile: {
    backgroundColor: "#343635",
    borderRadius: 15,
    padding: 15,
    width: "30%",
    alignItems: "center",
    borderWidth: 1,
  },
  incomeTile: {
    borderColor: "#4CAF50",
  },
  expenseTile: {
    borderColor: "#E53935",
  },
  container: {
    flex: 1,
    backgroundColor: "#212121",
  },
  header: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 10,
  },
  logoImage: {
    width: 150,
    height: 50,
    resizeMode: "contain",
  },
  scrollView: {
    flex: 1,
    marginBottom: 60, // Add bottom margin to prevent content from being hidden behind navbar
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80, // Extra padding to ensure content doesn't get cut off
  },
  disclaimer: {
    color: "#a8aeaa",
    fontSize: 12,
    textAlign: "right",
    marginTop: 10,
  },
 
  tileTitle: {
    color: "#a8aeaa",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 5,
    fontFamily: "sans-serif-light",
  },
  tileValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  incomeText: {
    color: "#4CAF50", // Green text for income
  },
  expenseText: {
    color: "#E53935", // Red text for expenses
  },
  
  netWorthContainer: {
    marginTop: 10,
  },
  netWorthLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  netWorthBox: {
    backgroundColor: "#343635",
    borderRadius: 20,
    padding: 15,
    borderWidth: 5,
    borderColor: "#4CAF50",
    marginBottom: 20,
  },
  netWorthTitle: {
    color: "#a8aeaa",
    fontSize: 14,
    marginBottom: 5,
  },
  netWorthValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  totalsLabel: {
    color: "#a8aeaa",
    fontSize: 14,
  },
  totalsValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  addMoreButton: {
    backgroundColor: "#2a3c38",
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addMoreText: {
    color: "#4CAF50",
    fontSize: 12,
  },
  tilesGrid: {
    marginBottom: 20,
  },
  tileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  tile: {
    backgroundColor: "#343635",
    borderRadius: 15,
    padding: 10,
    width: "30%",
    alignItems: "center",
  },
  emptyTile: {
    width: "30%",
  },
  tileIcon: {
    width: 30,
    height: 30,
    tintColor: "#00BFA5",
    marginBottom: 5,
  },
  expensesSection: {
    marginVertical: 15,
  },
  
  // Bottom Navigation Bar Styles
  bottomNavContainer: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a",
    borderTopWidth: 1,
    borderTopColor: "#3a3a3a",
    height: 60,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  navIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  
  navIconImage: {
    width: 24,
    height: 24,
    tintColor: "#a8aeaa", // Default gray tint (will be overridden by inline style for active)
  },
  navLabel: {
    fontSize: 10,
    color: "#a8aeaa",
  },
  activeNavLabel: {
    color: "#4CAF50", // Green for active tab
    fontWeight: "bold",
  },
});