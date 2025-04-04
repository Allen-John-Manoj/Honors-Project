import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput, // Added TextInput import
  Modal
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import { MMKV } from 'react-native-mmkv';
import { Alert } from 'react-native';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { Dimensions } from "react-native";
import { Picker } from "@react-native-picker/picker"; // Added Picker import
import DateTimePicker from "@react-native-community/datetimepicker"; // Added DateTimePicker import
type Transaction = {
  date: string;
  type: "income" | "expense" | "balance";
  category: string;
  amount: number;
  runningBalance: number;
  description: string; // Required property
};
const storage = new MMKV();
function assertTransactionType(type: string): asserts type is Transaction["type"] {
  if (!["income", "expense", "balance"].includes(type)) {
    throw new Error(`Invalid transaction type: ${type}`);
  }
}

class SimpleLinearRegression {
  private slope: number = 0;
  private intercept: number = 0;

  train(X: number[], y: number[]): void {
    const n = X.length;
    const sumX = X.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = X.reduce((a, _, i) => a + X[i] * y[i], 0);
    const sumX2 = X.reduce((a, b) => a + b * b, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return; // Prevent division by zero

    this.slope = (n * sumXY - sumX * sumY) / denominator;
    this.intercept = (sumY - this.slope * sumX) / n;
  }

  predict(x: number): number {
    return this.slope * x + this.intercept;
  }
}

const useCalculateProjection = (transactions: Transaction[]) => {
  const calculateProjection = () => {
    if (transactions.length < 2) return {
      currentNet: 0,
      projectedNet: 0,
      dailyChange: 0
    };

    // Get valid transactions sorted by date
    const validTransactions = transactions
      .filter(t => t.date && !isNaN(new Date(t.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get first and last balance values
    const firstTransaction = validTransactions[0];
    const lastTransaction = validTransactions[validTransactions.length - 1];
    const currentNet = lastTransaction.runningBalance;

    // Calculate days between first and last transaction
    const startDate = new Date(firstTransaction.date);
    const endDate = new Date(lastTransaction.date);
    const daysBetween = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
    );

    // Calculate total balance change
    const balanceChange = lastTransaction.runningBalance - firstTransaction.runningBalance;

    // Calculate daily change rate
    const dailyChange = daysBetween > 0 ? balanceChange / daysBetween : 0;

    // Project 30 days from last transaction date
    const projectedNet = currentNet + (dailyChange * 30);

    return {
      currentNet,
      projectedNet,
      dailyChange
    };
  };

  return calculateProjection();
};

// Modified ProjectedNetWorth component
const ProjectedNetWorth: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const { currentNet, projectedNet, dailyChange } = useCalculateProjection(transactions);

  if (!transactions.length) return (
    <Text style={styles.infoText}>Add at least 2 transactions to see forecasts</Text>
  );

  if (transactions.length === 1) return (
    <Text style={styles.infoText}>Add one more transaction to enable predictions</Text>
  );

  return (
    <View style={styles.projectionContainer}>
      <View style={styles.currentRow}>
        <Text style={styles.currentLabel}>Current:</Text>
        <Text style={styles.currentValue}>${currentNet.toFixed(2)}</Text>
      </View>

      <View style={styles.projectionRow}>
        <Text style={styles.projectionLabel}>30 Day Projection:</Text>
        <View style={styles.projectionValueContainer}>
          <Text style={[
            styles.projectionValue,
            dailyChange >= 0 ? styles.positive : styles.negative
          ]}>
            ${projectedNet.toFixed(2)}
            {dailyChange >= 0 ? ' ▲' : ' ▼'}
          </Text>
        </View>
      </View>

      <Text style={styles.trendText}>
        {dailyChange >= 0 ? 'Increasing' : 'Decreasing'} by
        ${Math.abs(dailyChange).toFixed(2)}/day
      </Text>
    </View>
  );
};

const loadTransactions = () => {
  try {
    const stored = storage.getString('transactions');
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    assertTransactions(parsed); // Add type validation
    return parsed;
  } catch (error) {
    console.error('Failed to load transactions:', error);
    return [];
  }
};

// 2. Type validation helper
function assertTransactions(data: any): asserts data is Transaction[] {
  if (!Array.isArray(data)) throw new Error('Invalid transaction data');
  data.forEach(t => {
    if (!['income', 'expense', 'balance'].includes(t.type)) {
      throw new Error(`Invalid transaction type: ${t.type}`);
    }
  });
}
export default function App() {
  const [selectedRange, setSelectedRange] = useState("Month");
  const [activeTab, setActiveTab] = useState("Account");
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<{ labels: string[]; datasets: any[] } | null>(null);
  const [netWorth, setNetWorth] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);

  // 4. Enhanced persistence
  useEffect(() => {
    try {
      storage.set('transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Failed to save transactions:', error);
    }
  }, [transactions]);
  useEffect(() => {
    storage.set('transactions', JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    processFinancialData(transactions);
  }, [transactions]); // Process whenever transactions change
  useEffect(() => {
    // This will automatically trigger model retraining
    // whenever transactions change
    if (transactions.length > 1) {
      // Optional: You can add any pre-processing here
    }
  }, [transactions]);

  useEffect(() => {
    const uniqueCategories = Array.from(
      new Set(transactions.filter(t => t.type !== "balance").map(t => t.category))
    );
    setCategories(uniqueCategories);
  }, [transactions]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Modify the filteredTransactions useEffect
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = transactions
      .filter(transaction => {
        const transactionDate = new Date(transaction.date);
        transactionDate.setHours(0, 0, 0, 0);
        const isBeforeToday = transactionDate <= today;

        if (!isBeforeToday) return false;

        if (!searchQuery) return true;

        // Search across all fields
        const searchLower = searchQuery.toLowerCase();
        const formattedDate = formatTableDate(transaction.date).toLowerCase();
        const amountString = Math.abs(transaction.amount).toString();

        return (
          transaction.description.toLowerCase().includes(searchLower) ||
          transaction.category.toLowerCase().includes(searchLower) ||
          formattedDate.includes(searchLower) ||
          amountString.includes(searchQuery) // Keep as number string match
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setFilteredTransactions(filtered);
  }, [transactions, searchQuery]);


  // Function to process the financial data
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [incomeThisMonth, setIncomeThisMonth] = useState(0);
  const [expenseThisMonth, setExpenseThisMonth] = useState(0);
  const [greatestIncome, setGreatestIncome] = useState<{ category: string, amount: number }>({ category: "", amount: 0 });
  const [greatestExpense, setGreatestExpense] = useState<{ category: string, amount: number }>({ category: "", amount: 0 });
  const [showPopup, setShowPopup] = useState(false);
  const formatTableDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };
  const processFinancialData = (data: Transaction[]) => {
    const currentDate = new Date();


    // Find the most recent balance up to current date
    const allTransactions = [...data].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const currentBalance = allTransactions.find(t =>
      new Date(t.date) <= currentDate
    )?.runningBalance || 0;

    setNetWorth(currentBalance);

    // Get recent transactions (last 5 up to current date)
    const recent = data
      .filter(item =>
        item.type !== "balance" &&
        new Date(item.date) <= currentDate
      )
      .slice(-6)
      .reverse();

    setRecentTransactions(recent);

    // Rest of existing processing logic...
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let maxIncome = 0;
    let maxExpense = 0;
    let maxIncomeCategory = "";
    let maxExpenseCategory = "";

    data.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate >= startOfMonth && transactionDate <= currentDate) {
        if (transaction.type === "income") {
          monthlyIncome += transaction.amount;
          if (transaction.amount > maxIncome) {
            maxIncome = transaction.amount;
            maxIncomeCategory = transaction.category;
          }
        } else if (transaction.type === "expense") {
          const absoluteAmount = Math.abs(transaction.amount);
          monthlyExpense += absoluteAmount;
          if (absoluteAmount > maxExpense) {
            maxExpense = absoluteAmount;
            maxExpenseCategory = transaction.category;
          }
        }
      }
    });

    setGreatestIncome({ category: maxIncomeCategory, amount: maxIncome });
    setGreatestExpense({ category: maxExpenseCategory, amount: maxExpense });
    setIncomeThisMonth(monthlyIncome);
    setExpenseThisMonth(monthlyExpense);

    generateChartData(data);
  };

  const formatTransactionDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
      .toUpperCase()
      .replace(" ", " ");
  };

  const prepareData = (transactions: Transaction[]) => {
    const data = transactions
      .filter(t => t.type !== 'balance')
      .map(t => ({
        date: new Date(t.date).getTime(),
        amount: t.amount,
        type: t.type === 'income' ? 1 : 0
      }));

    const sortedData = data.sort((a, b) => a.date - b.date);
    const amounts = sortedData.map(d => d.amount);
    const dates = sortedData.map(d => d.date);
    const types = sortedData.map(d => d.type);

    return { amounts, dates, types };
  };

  // 2. Type validation helper
  function assertTransactions(data: any): asserts data is Transaction[] {
    if (!Array.isArray(data)) throw new Error('Invalid transaction data');
    data.forEach(t => {
      if (!['income', 'expense', 'balance'].includes(t.type)) {
        throw new Error(`Invalid transaction type: ${t.type}`);
      }
    });
  }

  const trainModel = async (amounts: number[], dates: number[]) => {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [1] }));

    model.compile({
      optimizer: 'sgd',
      loss: 'meanSquaredError'
    });

    const xs = tf.tensor2d(dates, [dates.length, 1]);
    const ys = tf.tensor2d(amounts, [amounts.length, 1]);

    await model.fit(xs, ys, { epochs: 100 });

    return model;
  };

  const predictFutureTransactions = async (model: tf.Sequential, futureDates: number[]) => {
    const xs = tf.tensor2d(futureDates, [futureDates.length, 1]);
    const predictions = model.predict(xs) as tf.Tensor;
    return predictions.arraySync() as number[][]; // Explicitly cast to number[][]
  };

  const generateChartData = (data: Transaction[]) => {
    if (!data || data.length === 0) return;

    // 1) Filter out "balance" entries
    const transactionData = data.filter(item => item.type !== "balance");

    // 2) Helper: get the "middle" day of a given month
    const getMiddleDate = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // e.g. 31 => 16, 30 => 15, 29 => 15, 28 => 14
      if (daysInMonth === 31) return 16;
      if (daysInMonth === 30) return 15;
      if (daysInMonth === 29 && isLeapYear) return 15;
      // Default for Feb 28 or non-leap
      return 14;
    };

    // 3) Round "today" down to the nearest bimonthly date (1st or middle)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const roundToBimonthlyDate = (date: Date) => {
      const middle = getMiddleDate(date);
      const day = date.getDate();
      if (day <= middle) {
        // Round to the 1st of this month
        return new Date(date.getFullYear(), date.getMonth(), 1);
      } else {
        // Round to the middle day of this month
        return new Date(date.getFullYear(), date.getMonth(), middle);
      }
    };

    // Start anchor: nearest past bimonthly date
    let anchor = roundToBimonthlyDate(currentDate);

    // 4) We'll store 5 bimonthly points
    const datePoints: string[] = [];
    const balanceData: number[] = [];

    // 5) Generate 5 points (stop if a future date occurs)
    for (let i = 0; i < 5; i++) {
      // Stop if anchor is in the future
      if (anchor > currentDate) break;

      // Format the label (e.g. "Mar 01", "Mar 15")
      const label = anchor.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit"
      });
      datePoints.unshift(label);

      // Calculate the range: if anchor is 1 => period is [1..middle-1],
      // if anchor is middle => period is [middle..endOfMonth].
      const middleDay = getMiddleDate(anchor);
      const anchorDay = anchor.getDate();

      let periodStart = new Date(anchor);
      let periodEnd = new Date(anchor);

      if (anchorDay === 1) {
        // If anchor is 1 => end is middle - 1
        periodEnd.setDate(middleDay - 1);
      } else {
        // If anchor is the middle => end is last day of month
        periodEnd.setDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate());
      }

      // Filter transactions in [periodStart..periodEnd]
      const transactionsInPeriod = transactionData.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= periodStart && tDate <= periodEnd;
      });

      // Use the last transaction's runningBalance or fallback
      const latestBalanceEntry =
        transactionsInPeriod.length > 0
          ? transactionsInPeriod[transactionsInPeriod.length - 1].runningBalance
          : (balanceData.length > 0 ? balanceData[0] : 0);

      balanceData.unshift(latestBalanceEntry as number);

      // Move anchor to the previous bimonthly date
      // If anchor was the 1st, move it to the middle of the PREVIOUS month
      // If anchor was the middle, move it to the 1st of the SAME month
      if (anchorDay === 1) {
        // So we go to last month, at its middle
        const prevMonth = anchor.getMonth() - 1;
        const prevYear = anchor.getFullYear() + (prevMonth < 0 ? -1 : 0);
        const realMonth = (prevMonth + 12) % 12;
        const tempDate = new Date(prevYear, realMonth, 1);
        anchor = new Date(prevYear, realMonth, getMiddleDate(tempDate));
      } else {
        // anchor was the middle => move to the 1st of the same month
        anchor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      }
    }

    // 6) Update the chart data
    setChartData({
      labels: datePoints, // 5 bimonthly labels
      datasets: [
        {
          data: balanceData,
          color: () => "#07a69b", // Teal line
          strokeWidth: 2
        }
      ]
    });
  };


  // Format currency in rupees
  const formatCurrency = (amount: number): string => {
    return `₹${Math.abs(amount)}`;
  };

  const formatAmount = (amount: number): string => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(2)}K`;
    return `₹${amount}`;
  };

  const formatNetWorth = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(2)}K`;
    } else {
      return `₹${amount}`;
    }
  };
  const getCurrentDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const categoryColors = [
    '#4bb361', // Green
    '#22943b', // Light Green
    '#1a5e29', // Pale Green
    '#27e650', // Mint
    '#d13838', // Red
    '#9e2b2b', // Light Red
    '#781a1a', // Pale Red
    '#470101', // Pink
  ];

  const calculateIncomeCategories = () => {
    const today = getCurrentDate();
    const categories: { [key: string]: number } = {};

    let totalIncome = 0;

    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate <= today && transaction.type === 'income') {
        categories[transaction.category] = (categories[transaction.category] || 0) + transaction.amount;
        totalIncome += transaction.amount;
      }
    });

    // Sort categories by amount in descending order
    const sortedCategories = Object.entries(categories)
      .sort(([, amountA], [, amountB]) => amountB - amountA);

    // If more than 3 categories, combine the smallest into "Other"
    if (sortedCategories.length > 3) {
      const topCategories = sortedCategories.slice(0, 3);
      const otherCategories = sortedCategories.slice(3);
      const otherTotal = otherCategories.reduce((sum, [, amount]) => sum + amount, 0);

      return [
        ...topCategories.map(([category, amount], index) => ({
          name: category,
          amount: Math.abs(amount),
          percentage: (amount / totalIncome) * 100,
          color: categoryColors[index % 4], // Green shades for income
          legendFontColor: '#fff',
          legendFontSize: 12
        })),
        {
          name: 'other',
          amount: otherTotal,
          percentage: (otherTotal / totalIncome) * 100,
          color: categoryColors[3], // Use a different color for "Other"
          legendFontColor: '#fff',
          legendFontSize: 12
        }
      ];
    }

    return sortedCategories.map(([category, amount], index) => ({
      name: category,
      amount: Math.abs(amount),
      percentage: (amount / totalIncome) * 100,
      color: categoryColors[index % 4], // Green shades for income
      legendFontColor: '#fff',
      legendFontSize: 12
    }));
  };

  const calculateExpenseCategories = () => {
    const today = getCurrentDate();
    const categories: { [key: string]: number } = {};

    let totalExpense = 0;

    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate <= today && transaction.type === 'expense') {
        categories[transaction.category] = (categories[transaction.category] || 0) + Math.abs(transaction.amount);
        totalExpense += Math.abs(transaction.amount);
      }
    });

    // Sort categories by amount in descending order
    const sortedCategories = Object.entries(categories)
      .sort(([, amountA], [, amountB]) => amountB - amountA);

    // If more than 3 categories, combine the smallest into "Other"
    if (sortedCategories.length > 3) {
      const topCategories = sortedCategories.slice(0, 3);
      const otherCategories = sortedCategories.slice(3);
      const otherTotal = otherCategories.reduce((sum, [, amount]) => sum + amount, 0);

      return [
        ...topCategories.map(([category, amount], index) => ({
          name: category,
          amount,
          percentage: (amount / totalExpense) * 100,
          color: categoryColors[(index % 4) + 4], // Red shades for expenses
          legendFontColor: '#fff',
          legendFontSize: 12
        })),
        {
          name: 'other',
          amount: otherTotal,
          percentage: (otherTotal / totalExpense) * 100,
          color: categoryColors[7], // Use a different color for "Other"
          legendFontColor: '#fff',
          legendFontSize: 12
        }
      ];
    }

    return sortedCategories.map(([category, amount], index) => ({
      name: category,
      amount,
      percentage: (amount / totalExpense) * 100,
      color: categoryColors[(index % 4) + 4], // Red shades for expenses
      legendFontColor: '#fff',
      legendFontSize: 12
    }));
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete ALL your financial data? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            storage.clearAll();
            setTransactions([]);
            setNetWorth(0);
            setRecentTransactions([]);
            setChartData(null);
            setIncomeThisMonth(0);
            setExpenseThisMonth(0);
            setGreatestIncome({ category: "", amount: 0 });
            setGreatestExpense({ category: "", amount: 0 });
            setCategories([]);
            Alert.alert('Success', 'All data has been reset.');
          },
        },
      ]
    );
  };
  const getBiMonthlyPeriods = () => {
    const periods = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Generate 4 bi-monthly periods (2 months back + current month)
    for (let i = 2; i >= 0; i--) {
      const month = currentMonth - i;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const adjustedMonth = (month + 12) % 12;

      // First half (1st to 15th)
      periods.push({
        start: new Date(year, adjustedMonth, 1),
        end: new Date(year, adjustedMonth, 15)
      });

      // Second half (16th to end of month)
      periods.push({
        start: new Date(year, adjustedMonth, 16),
        end: new Date(year, adjustedMonth + 1, 0) // Last day of month
      });
    }

    // Filter out future periods
    return periods.filter(period => period.end <= today);
  };

  const generateGraphLabels = () => {
    return getBiMonthlyPeriods().map(period => {
      const month = period.start.toLocaleString('default', { month: 'short' });
      const range = period.start.getDate() === 1
        ? `1-15`
        : `16-${period.end.getDate()}`;
      return `${month} ${range}`;
    });
  };

  // Helper function to render percentage indicators
  const renderPercentageIndicator = (
    label: string,
    data: number[],
    increaseColor: string,
    decreaseColor: string
  ) => {
    if (data.length < 2) return null;

    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const change = previous !== 0
      ? ((current - previous) / previous) * 100
      : current !== 0 ? 100 : 0;

    const isIncrease = change >= 0;
    const color = isIncrease ? increaseColor : decreaseColor;

    return (
      <View style={styles.indicatorRow}>
        {/* Label (e.g., "INCOME:") */}
        <Text style={[styles.labelText, { width: 80 }]}>{label}:</Text>

        {/* Arrow Icon */}
        <Image
          source={require("./src/assets/images/arrow.png")}
          style={[
            styles.arrowIcon,
            { tintColor: color },
            !isIncrease && styles.rotatedArrow
          ]}
        />

        {/* Percentage Value */}
        <Text style={[styles.percentageText, { color }]}>
          {Math.abs(change).toFixed(1)}%
        </Text>
      </View>
    );
  };

  const calculateIncomeData = () => {
    return getBiMonthlyPeriods().map(period => {
      return transactions
        .filter(t => {
          const tDate = new Date(t.date);
          return tDate >= period.start &&
            tDate <= period.end &&
            t.type === 'income';
        })
        .reduce((sum, t) => sum + t.amount, 0);
    });
  };

  // Repeat similarly for expenses

  const calculateExpenseData = () => {
    return getBiMonthlyPeriods().map(period => {
      return transactions
        .filter(t => {
          const tDate = new Date(t.date);
          return tDate >= period.start &&
            tDate <= period.end &&
            t.type === 'expense'
        })
        .reduce((sum, t) => sum + t.amount, 0);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#212121" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={clearAllData}>
          <Image
            source={require("./src/assets/images/logo.png")}
            style={[styles.logoImage, { tintColor: "#07a69b" }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.contentContainer}>
          {/* Show full content if 'Account' tab is selected */}
          {activeTab === "Account" && (
            <>
              {/* Net Worth Section */}
              <View style={styles.netWorthContainer}>
                <View style={styles.netWorthBox}>
                  <Text style={styles.netWorthTitle}>MY NET WORTH</Text>
                  <Text style={styles.netWorthValue}>{formatNetWorth(netWorth)}</Text>
                </View>
              </View>

              {/* Recent Transactions */}
              <View style={styles.recentTransactionsContainer}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>RECENT TRANSACTIONS</Text>
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={() => setActiveTab("Transactions")}
                  >
                    <Text style={styles.addMoreText}>More</Text>
                  </TouchableOpacity>
                </View>

                {recentTransactions.length > 0 && (
                  <>
                    <View style={styles.tileRow}>
                      {recentTransactions.slice(0, 3).map((transaction, index) => (
                        <View
                          key={index}
                          style={[
                            styles.transactionTile,
                            transaction.type === "income" ? styles.incomeTile : styles.expenseTile
                          ]}
                        >
                          <Text style={styles.tileDate}>
                            {formatTransactionDate(transaction.date)}
                          </Text>
                          <Text style={styles.tileTitle} numberOfLines={1} ellipsizeMode="tail">
                            {transaction.category.toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              styles.tileValue,
                              transaction.type === "income" ? styles.incomeText : styles.expenseText
                            ]}
                          >
                            {transaction.type === "income"
                              ? formatCurrency(transaction.amount)
                              : `${formatCurrency(transaction.amount)}`}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.tileRow}>
                      {recentTransactions.slice(3, 6).map((transaction, index) => (
                        <View
                          key={index}
                          style={[
                            styles.transactionTile,
                            transaction.type === "income" ? styles.incomeTile : styles.expenseTile
                          ]}
                        >
                          <Text style={styles.tileDate}>
                            {formatTransactionDate(transaction.date)}
                          </Text>
                          <Text style={styles.tileTitle} numberOfLines={1} ellipsizeMode="tail">
                            {transaction.category.toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              styles.tileValue,
                              transaction.type === "income" ? styles.incomeText : styles.expenseText
                            ]}
                          >
                            {transaction.type === "income"
                              ? formatCurrency(transaction.amount)
                              : `${formatCurrency(transaction.amount)}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>

              {/* Trends Section */}
              <Text style={styles.totalsLabel}>TRENDS</Text>
              <View style={styles.trendsContainer}>
                {/* Graph */}
                {chartData && (
                  <TouchableOpacity
                    style={styles.chartContainer}
                    onPress={() => setActiveTab("Graphs")}
                  >
                    <LineChart
                      data={chartData}
                      width={Dimensions.get("window").width - 70}
                      height={220}
                      yAxisSuffix="₹"
                      yAxisInterval={1}
                      fromZero={true}
                      chartConfig={{
                        backgroundColor: "#212121",
                        backgroundGradientFrom: "#212121",
                        backgroundGradientTo: "#212121",
                        fillShadowGradientFromOpacity: 0.1,
                        fillShadowGradientToOpacity: 0,
                        decimalPlaces: 0,

                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: { borderRadius: 15 },
                        propsForDots: {
                          r: "4",
                          strokeWidth: "2",
                        },
                        propsForHorizontalLabels: {
                          translateX: 0,
                        },
                      }}
                      bezier
                      style={{ borderRadius: 15 }}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Show only text when 'Transactions', 'Graphs', or 'Forecast' is selected */}
          {activeTab === "Transactions" && (
            <View style={styles.netWorthContainer}>
              {/* Income Box */}
              <View style={[styles.netWorthBox, { borderColor: "#4CAF50", marginBottom: 15 }]}>
                <View style={styles.boxRow}>
                  <View style={styles.mainAmount}>
                    <Text style={styles.netWorthTitle}>INCOME THIS MONTH</Text>
                    <Text style={[styles.netWorthValue, { color: "#4CAF50" }]}>
                      {formatAmount(incomeThisMonth)}
                    </Text>
                  </View>
                  <View style={styles.greatestContainer}>
                    <Text style={styles.greatestLabel}>GREATEST INCOME</Text>
                    <Text style={styles.greatestCategory} numberOfLines={1}>
                      {greatestIncome.category || "N/A"}
                    </Text>
                    <Text style={styles.greatestAmount}>
                      {formatAmount(greatestIncome.amount)}
                    </Text>
                  </View>
                </View>
              </View>



              {/* Expense Box */}
              <View style={[styles.netWorthBox, { borderColor: "#E53935" }]}>
                <View style={styles.boxRow}>
                  <View style={styles.mainAmount}>
                    <Text style={styles.netWorthTitle}>EXPENSE THIS MONTH</Text>
                    <Text style={[styles.netWorthValue, { color: "#E53935" }]}>
                      {formatAmount(expenseThisMonth)}
                    </Text>
                  </View>
                  <View style={styles.greatestContainer}>
                    <Text style={styles.greatestLabel}>GREATEST EXPENSE</Text>
                    <Text style={styles.greatestCategory} numberOfLines={1}>
                      {greatestExpense.category || "N/A"}
                    </Text>
                    <Text style={styles.greatestAmount}>
                      {formatAmount(greatestExpense.amount)}
                    </Text>
                  </View>
                </View>
              </View>
              <View>
                <View style={styles.tileRow}>
                  {/* Plus Button */}
                  <TouchableOpacity
                    style={[styles.transactionTile, {
                      borderColor: "#07a69b",
                      width: "48%",
                    }]}
                    onPress={() => setShowPopup(true)}
                  >
                    <Image
                      source={require("./src/assets/images/plus.png")}
                      style={styles.actionIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>

                  {/* Search Toggle Button */}
                  <TouchableOpacity
                    style={[styles.transactionTile, {
                      borderColor: "#07a69b",
                      width: "48%",
                    }]}
                    onPress={() => {
                      setShowSearchBar(!showSearchBar);
                      setSearchQuery('');
                    }}
                  >
                    <Image
                      source={require("./src/assets/images/search.png")}
                      style={styles.actionIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>

                {/* Search Bar - Now properly below buttons */}
                {showSearchBar && (
                  <View style={styles.searchBarContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search description, date, category, amount..."
                      placeholderTextColor="#a8aeaa"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus={true}
                    />
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => setSearchQuery('')}
                    >
                      <Text style={styles.clearSearchText}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={[styles.totalsLabel, { paddingTop: 15 }]}>TRANSACTION HISTORY</Text>
              <View style={styles.transactionTableContainer}>
                <ScrollView horizontal={false} style={styles.scrollContainer}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.headerCell, { width: '35%' }]}>Description</Text>
                    <Text style={[styles.headerCell, { width: '20%' }]}>Date</Text>
                    <Text style={[styles.headerCell, { width: '25%' }]}>Category</Text>
                    <Text style={[styles.headerCell, { width: '20%' }]}>Amount</Text>
                  </View>

                  {filteredTransactions.map((transaction, index) => (
                    <View key={index} style={styles.tableRow}>
                      <Text
                        style={[styles.tableCell, { width: '35%' }, { paddingRight: 25 }, { color: transaction.type === 'income' ? '#4CAF50' : '#E53935' }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {transaction.description || 'No description'}
                      </Text>
                      <Text style={[styles.tableCell, { width: '20%' }]}>
                        {formatTableDate(transaction.date)}
                      </Text>
                      <Text
                        style={[styles.tableCell, { width: '25%' }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {transaction.category}
                      </Text>
                      <Text style={[
                        styles.tableCell,
                        { width: '20%' },
                        transaction.type === 'income' ? styles.incomeText : styles.expenseText
                      ]}>
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {activeTab === "Graphs" && (
            <>
              {/* Move the Title Outside the Chart Box */}
              <Text style={[styles.netWorthTitle, { paddingTop: 10 }]}>BI-MONTHLY FINANCIAL TRENDS</Text>

              {/* Chart Container */}
              <View style={styles.chartContainer1}>
                <LineChart
                  data={{
                    labels: generateGraphLabels(),
                    datasets: [
                      {
                        data: calculateIncomeData(),
                        color: () => '#4CAF50', // Green for income
                        strokeWidth: 2
                      },
                      {
                        data: calculateExpenseData(),
                        color: () => '#E53935', // Red for expenses
                        strokeWidth: 2
                      }
                    ]
                  }}
                  width={Dimensions.get('window').width - 60}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#212121',
                    backgroundGradientFrom: '#212121',
                    backgroundGradientTo: '#212121',
                    decimalPlaces: 0,
                    fillShadowGradientFromOpacity: 0,
                    fillShadowGradientToOpacity: 0,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2'
                    }
                  }}
                  bezier
                  style={styles.chartStyle}
                />
              </View>

              {/* Percentage Indicators Below the Graph */}
              <View style={styles.percentageContainer}>
                {renderPercentageIndicator(
                  'INCOME',
                  calculateIncomeData(),
                  '#4CAF50',
                  '#E53935'
                )}
                {renderPercentageIndicator(
                  'EXPENSE',
                  calculateExpenseData(),
                  '#E53935',
                  '#4CAF50'
                )}
              </View>
              <Text style={[styles.totalsLabel, { paddingTop: 15 }]}>INCOME BY CATEGORY</Text>
              <View style={styles.pieChartsContainer}>
                {/* Income Categories Pie Chart */}
                <View style={styles.pieChartWrapper}>

                  <View style={styles.pieChartRow}>
                    {/* Pie Chart Container - Adjusted to properly center and contain the chart */}
                    <View style={{
                      ...styles.chartContainer,
                      alignItems: 'flex-start', // Align to start instead of center
                      paddingRight: 20, // Add some space on the right
                    }}>
                      <PieChart
                        data={calculateIncomeCategories()}
                        width={Dimensions.get('window').width * 0.45} // Further reduced width
                        height={220}
                        chartConfig={{
                          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        }}
                        accessor="amount"
                        backgroundColor="transparent"
                        paddingLeft="45"
                        absolute
                        hasLegend={false}
                        style={styles.pieChart}
                        avoidFalseZero
                      />
                    </View>

                    {/* Legend on the Right */}
                    <View style={styles.legendContainer}>
                      {calculateIncomeCategories().map((item, index) => (
                        <View key={index} style={styles.legendItem}>
                          <View style={{ ...styles.legendColor, backgroundColor: item.color }} />
                          <Text style={styles.legendText}>
                            {item.name}: {item.percentage.toFixed(1)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.netWorthTitle}>EXPENSES BY CATEGORY</Text>
                {/* Expense Categories Pie Chart - Same changes applied */}
                <View style={styles.pieChartWrapper}>
                  <View style={styles.pieChartRow}>
                    <View style={{
                      ...styles.chartContainer,
                      alignItems: 'flex-start',
                      paddingRight: 20,
                    }}>
                      <PieChart
                        data={calculateExpenseCategories()}
                        width={Dimensions.get('window').width * 0.45}
                        height={220}
                        chartConfig={{
                          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        }}
                        accessor="amount"
                        backgroundColor="transparent"
                        paddingLeft="45"
                        absolute
                        hasLegend={false}
                        style={styles.pieChart}
                        avoidFalseZero
                      />
                    </View>

                    <View style={styles.legendContainer}>
                      {calculateExpenseCategories().map((item, index) => (
                        <View key={index} style={styles.legendItem}>
                          <View style={{ ...styles.legendColor, backgroundColor: item.color }} />
                          <Text style={styles.legendText}>
                            {item.name}: {item.percentage.toFixed(1)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}


          {activeTab === "Forecast" && (
            <View style={styles.forecastContainer}>
              <Text style={styles.sectionHeader}>FINANCIAL FORECAST</Text>
              <View style={styles.forecastCard}>
                <Text style={styles.cardTitle}>Projected Net Worth</Text>
                <ProjectedNetWorth transactions={transactions} />
                <Text style={styles.cardSubtitle}>Next 30 Days</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={showPopup}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowPopup(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Type Selector */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionType === "income" && styles.activeIncome
                ]}
                onPress={() => setTransactionType("income")}
              >
                <Text style={styles.typeButtonText}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionType === "expense" && styles.activeExpense
                ]}
                onPress={() => setTransactionType("expense")}
              >
                <Text style={styles.typeButtonText}>Expense</Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#a8aeaa"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            {/* Category Selection */}
            <View style={styles.categoryContainer}>
              <Picker
                selectedValue={category}
                style={styles.picker}
                dropdownIconColor="#a8aeaa"
                onValueChange={(itemValue) => setCategory(itemValue)}
              >
                <Picker.Item label="Select Category" value="" />
                {categories.map(cat => (
                  <Picker.Item key={cat} label={cat} value={cat} />
                ))}
              </Picker>
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="New Category"
                placeholderTextColor="#a8aeaa"
                value={newCategory}
                onChangeText={setNewCategory}
                onSubmitEditing={() => {
                  if (newCategory) {
                    console.log('Adding new category:', newCategory);
                    setCategories(prevCategories => [...prevCategories, newCategory]);
                    setCategory(newCategory); // This should set the selected category to the new one
                    console.log('Category should now be:', newCategory);
                    // Don't clear newCategory yet to ensure it's used in the transaction
                  }
                }}
              />
            </View>

            {/* Description Input */}
            <TextInput
              style={styles.input}
              placeholder="Description"
              placeholderTextColor="#a8aeaa"
              value={description}
              onChangeText={setDescription}
            />

            {/* Date Picker */}
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {date.toLocaleDateString("en-US", {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                console.log('Button pressed with values:', {
                  amount: amount,
                  category: category,
                  newCategory: newCategory, // Log the new category value
                  description: description
                });

                if (!amount) {
                  console.log('Amount is empty');
                  return;
                }

                // Handle category selection or creation
                let selectedCategory = category;

                // If no category is selected but a new category was entered
                if (!selectedCategory && newCategory) {
                  // Add the new category to the categories list
                  setCategories(prevCategories => [...prevCategories, newCategory]);
                  selectedCategory = newCategory;
                  console.log('Using new category:', selectedCategory);
                } else if (!selectedCategory) {
                  selectedCategory = "Uncategorized";
                  console.log('Using default category');
                }

                // Create new transaction with proper date format
                const newTransaction: Transaction = {
                  date: new Date(date).toISOString().split('T')[0],
                  type: transactionType,
                  category: selectedCategory,
                  amount: transactionType === "income"
                    ? Math.abs(Number(amount))
                    : -Math.abs(Number(amount)),
                  runningBalance: 0,
                  description: description || "No description"
                };

                console.log('Creating transaction with category:', newTransaction.category);

                // Rest of your transaction processing code
                const currentTransactions = [...transactions];
                const updatedTransactions = [...currentTransactions, newTransaction]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                // When adding a new transaction (in your confirm button handler):
                // Modify this section in your onPress handler:
                const processedData = [...currentTransactions, newTransaction]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Add this validation for better data integrity
                const validatedData = processedData.filter(t =>
                  !isNaN(new Date(t.date).getTime()) &&
                  typeof t.amount === 'number'
                );

                // Then use validatedData instead of processedData
                const groupedByDate: { [date: string]: Transaction[] } = {};
                validatedData.forEach(t => {
                  const dateKey = t.date;
                  if (!groupedByDate[dateKey]) {
                    groupedByDate[dateKey] = [];
                  }
                  groupedByDate[dateKey].push(t);
                });

                // Calculate running balance per day
                let runningBalance = 0;
                const finalTransactions: Transaction[] = [];

                Object.entries(groupedByDate).forEach(([date, dailyTransactions]) => {
                  const dailyTotal = dailyTransactions.reduce((sum, t) => sum + t.amount, 0);
                  runningBalance += dailyTotal;

                  // Update all transactions for this date with the same runningBalance
                  dailyTransactions.forEach(t => {
                    finalTransactions.push({
                      ...t,
                      runningBalance // Same balance for all transactions on this day
                    });
                  });
                });

                setTransactions(finalTransactions);
                setNetWorth(runningBalance);
                // Reset form and close popup
                setShowPopup(false);
                setAmount("");
                setCategory("");
                setNewCategory("");
                setDescription("");
                setDate(new Date());
              }}
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isSearchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <View style={styles.searchModalContainer}>
          <View style={styles.searchModalContent}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search description, date, category, amount..."
              placeholderTextColor="#a8aeaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
            <TouchableOpacity
              style={styles.closeSearchButton}
              onPress={() => {
                setSearchQuery('');
                setIsSearchModalVisible(false);
              }}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavContainer}>
        {/* Account Tab */}
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Account")}>
          <View style={styles.navIconContainer}>
            <Image
              source={require("./src/assets/images/account.png")}
              style={[styles.navIconImage, { tintColor: activeTab === "Account" ? "#07a69b" : "#a8aeaa" }]}
              resizeMode="contain"
            />
          </View>
          {activeTab !== "Account" && <Text style={styles.navLabel}>Account</Text>}
        </TouchableOpacity>

        {/* Transactions Tab */}
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Transactions")}>
          <View style={styles.navIconContainer}>
            <Image
              source={require("./src/assets/images/transactions.png")}
              style={[styles.navIconImage, { tintColor: activeTab === "Transactions" ? "#07a69b" : "#a8aeaa" }]}
              resizeMode="contain"
            />
          </View>
          {activeTab !== "Transactions" && <Text style={styles.navLabel}>Transactions</Text>}
        </TouchableOpacity>

        {/* Forecast Tab */}
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Forecast")}>
          <View style={styles.navIconContainer}>
            <Image
              source={require("./src/assets/images/forecast.png")}
              style={[styles.navIconImage, { tintColor: activeTab === "Forecast" ? "#07a69b" : "#a8aeaa" }]}
              resizeMode="contain"
            />
          </View>
          {activeTab !== "Forecast" && <Text style={styles.navLabel}>Forecast</Text>}
        </TouchableOpacity>

        {/* Graphs Tab */}
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Graphs")}>
          <View style={styles.navIconContainer}>
            <Image
              source={require("./src/assets/images/graphs.png")}
              style={[styles.navIconImage, { tintColor: activeTab === "Graphs" ? "#07a69b" : "#a8aeaa" }]}
              resizeMode="contain"
            />
          </View>
          {activeTab !== "Graphs" && <Text style={styles.navLabel}>Graphs</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  projectionContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  projectionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  currentLabel: {
    fontSize: 16,
    color: '#666',
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectionLabel: {
    fontSize: 18,
    color: '#333',
  },
  projectionValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  positive: {
    color: '#2ecc71', // Green
  },
  negative: {
    color: '#e74c3c', // Red
  },
  trendText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
  },
  infoText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginVertical: 16,
  },
  forecastContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  sectionHeader: {
    color: '#07a69b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  forecastCard: {
    backgroundColor: '#1a1f1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  projectedValue: {
    color: '#07a69b',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardSubtitle: {
    color: '#a8aeaa',
    fontSize: 12,
    marginBottom: 15,
  },
  pieChartsContainer: {
    marginTop: 0,
  },
  pieChartWrapper: {
    marginVertical: 15,
    backgroundColor: '#343635',
    borderRadius: 16,
    padding: 20,
  },
  pieChartRow: {
    flexDirection: 'row', // Align pie chart and legend horizontally
    alignItems: 'center', // Center vertically
  },
  pieChartTitle: {
    color: '#07a69b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  chartContainer: {
    flex: 1, // Take up remaining space
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieChart: {
    borderRadius: 8,
    marginVertical: 0,
  },
  legendContainer: {
    width: 120, // Fixed width for the legend
    marginLeft: 20, // Space between pie chart and legend
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Space between legend items
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  labelText: {
    fontSize: 15,
    // fontWeight: 'bold',
    color: '#a8aeaa',
    textAlign: 'right', // Align text to the right
  },
  chartContainer1: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#343635',
    borderRadius: 16,
  },
  percentageContainer: {
    marginTop: -25, // Space between graph and percentage indicators
    paddingHorizontal: 16, // Padding for text alignment
    paddingVertical: 12, // Padding for better spacing
    backgroundColor: '#343635', // Match the graph container background
    borderRadius: 16, // Rounded corners to match the graph container
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Space between income and expense rows
    marginLeft: 70, // Space between left edge and text
  },
  arrowIcon: {
    width: 30,
    height: 30,
    marginHorizontal: 6, // Space between arrow and text
  },
  rotatedArrow: {
    transform: [{ rotate: '180deg' }],
  },
  percentageText: {
    fontSize: 28, // Larger text size
    fontWeight: 'bold', // Bold text
    includeFontPadding: false, // Consistent text rendering
  },
  // Other styles remain unchanged
  indicatorContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  chartTitle: {
    color: '#07a69b',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartStyle: {
    borderRadius: 16,
    paddingRight: 60,
    marginBottom: 20,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,  // Add space between buttons and search bar
    marginBottom: 15,
    width: '100%',  // Ensure full width
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#212121',
    color: 'white',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
  },
  clearSearchButton: {
    backgroundColor: '#07a69b',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearSearchText: {
    color: 'white',
    fontSize: 20,
    lineHeight: 24,
  },
  searchModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  searchModalContent: {
    backgroundColor: '#343635',
    padding: 20,
    borderRadius: 15,
    width: '90%',
  },
  closeSearchButton: {
    backgroundColor: '#07a69b',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  transactionTableContainer: {
    flex: 1,
    marginTop: 20,
    backgroundColor: '#343635',
    borderRadius: 15,
    padding: 15,
    minHeight: 300, // Ensures minimum scrollable area
  },
  tableHeader: {
    color: '#07a69b',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#505050',
    paddingBottom: 10,
    marginBottom: 5,
  },
  headerCell: {
    color: '#a8aeaa',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  tableCell: {
    color: 'white',
    fontSize: 14,
    paddingRight: 5,
  },
  scrollContainer: {
    maxHeight: 300, // Adjust based on your needs
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: '#404040',
  },
  activeIncome: {
    backgroundColor: '#4CAF50',
  },
  activeExpense: {
    backgroundColor: '#E53935',
  },
  typeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#212121',
    color: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    width: '100%',
  },
  picker: {
    backgroundColor: '#212121',
    color: 'white',
    width: '100%',
  },
  dateButton: {
    backgroundColor: '#212121',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  dateText: {
    color: 'white',
  },
  categoryContainer: {
    marginBottom: 10,
    width: '100%',
  },
  confirmButton: {
    backgroundColor: '#07a69b',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  popupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  popupContent: {
    width: screenWidth * 0.9,
    backgroundColor: '#343635',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  closeButtonText: {
    color: '#a8aeaa',
    fontSize: 24,
  },
  popupText: {
    color: 'white',
    fontSize: 18,
    marginVertical: 15,
  },
  popupActionButton: {
    backgroundColor: '#07a69b',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  actionIcon: {
    width: 32,
    height: 32,
    tintColor: "#07a69b",
  },
  tileDate: {
    color: '#a8aeaa',
    fontSize: 15,
    marginBottom: 4,
    fontFamily: "sans-serif-light",
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  mainAmount: {
    flex: 1,
  },
  greatestContainer: {
    marginLeft: 15,
    paddingLeft: 15,
    borderLeftWidth: 1,
    borderLeftColor: '#404040',
    width: 110,
  },
  greatestLabel: {
    color: '#a8aeaa',
    fontSize: 12,
    marginBottom: 4,
  },
  greatestCategory: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  greatestAmount: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: Dimensions.get("window").height - 150, // Adjust to fit
  },

  redText: {
    color: "red",
    fontSize: 24,
    fontWeight: "bold",
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
    color: "#07a69b",
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
    marginBottom: 60,
  },
  contentContainer: {
    padding: 20,
    flex: 1,
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
    borderColor: "#07a69b",
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
    backgroundColor: "#07a69b",
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addMoreText: {
    color: "white",
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
    color: "#07a69b", // Green for active tab
    fontWeight: "bold",
  },
});