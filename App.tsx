import React, { useState, useEffect } from "react";
import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { DeviceEventEmitter } from 'react-native';
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
interface SmsMessage {
  _id: string;
  body: string;
  date: string;
  address: string;
}
interface BaseCategoryItem {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  isMain: boolean;
}

interface OtherCategoryItem extends BaseCategoryItem {
  subCategories: SubCategoryItem[];
}

type CategoryItem = BaseCategoryItem | OtherCategoryItem;

// 2. Type guard for Other category
const isOtherCategory = (item: CategoryItem): item is OtherCategoryItem => {
  return item.name === 'Other' && 'subCategories' in item;
};


interface SubCategoryItem {
  name: string;
  amount: number;
  percentage: number;
}

interface TransactionFromSMS {
  id: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  body: string;
}

interface SmsMessage {
  _id: string;
  body: string;
  date: string;
}

// Add this near your other type definitions
interface TransactionFromSMS {
  id: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  body: string;
}

const storage = new MMKV();
class SimpleLinearRegression {
  public slope: number = 0;
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


// Modified ProjectedNetWorth component


// ⏱ Ensure checkpoint only initialized once
const ensureCheckpoint = () => {
  const existing = storage.getNumber('lastCheckpoint');
  if (!existing) {
    const now = Date.now();
    console.log('🆕 First-time install, setting checkpoint:', now);
    storage.set('lastCheckpoint', now);
  } else {
    console.log('📌 Existing checkpoint:', existing);
  }
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
  const [uncategorizedTransactions, setUncategorizedTransactions] = useState<TransactionFromSMS[]>([]);
  const [currentSMSTransaction, setCurrentSMSTransaction] = useState<TransactionFromSMS | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<'income' | 'expense'>('income');
  const [showSMSGreeting, setShowSMSGreeting] = useState(() => {
    const stored = storage.getString('uncategorizedTransactions');
    return !!stored && JSON.parse(stored).length > 0;
  });

  // 4. Enhanced persistence
  useEffect(() => {
    try {
      storage.set('transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Failed to save transactions:', error);
    }
  }, [transactions]);
  DeviceEventEmitter.addListener('sms_onReceive', (event) => {
    console.log('New SMS Received:', event);
    processSMS(); // Your processing function
  });
  useEffect(() => {
    ensureCheckpoint();
  }, []);
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
    const loadUncategorized = async () => {
      const stored = storage.getString('uncategorizedTransactions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          setShowSMSGreeting(true);
          setCurrentSMSTransaction(parsed[0]);
        }
      }
    };

    loadUncategorized();
    processSMS();
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('sms_onReceive', () => {
      console.log('SMS Received!');
      processSMS();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const uniqueCategories = Array.from(
      new Set(transactions.filter(t => t.type !== "balance").map(t => t.category))
    );
    setCategories(uniqueCategories);
  }, [transactions]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Add this useEffect to handle SMS transaction selection
  useEffect(() => {
    if (currentSMSTransaction) {
      // Mark this SMS as processed
      const processed = JSON.parse(storage.getString('processedSMS') || '[]');
      storage.set('processedSMS', JSON.stringify([...processed, currentSMSTransaction.id]));

      // Remove this transaction from uncategorized list
      const remaining = uncategorizedTransactions.filter(
        t => t.id !== currentSMSTransaction.id
      );

      // Update storage and state
      storage.set('uncategorizedTransactions', JSON.stringify(remaining));
      setUncategorizedTransactions(remaining);

      // Move to next transaction if available
      if (remaining.length > 0) {
        setCurrentSMSTransaction(remaining[0]);
        // Don't close the popup, just update it with the next transaction
      } else {
        setCurrentSMSTransaction(null);
        setShowSMSGreeting(false);
        setShowPopup(false);
      }
    }
  }, [currentSMSTransaction]);
  // Add at app startup:
  useEffect(() => {
    const checkPermissions = async () => {
      const hasPermission = await requestSMSPermission();
      if (!hasPermission) {
        Alert.alert('Permission required', 'Enable SMS access in settings');
      }
    };
    checkPermissions();
  }, []);

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
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [prefillData, setPrefillData] = useState<TransactionFromSMS | null>(null);
  const localDate = new Date(date);
  const formattedDate = `${localDate.getFullYear()}-${(localDate.getMonth() + 1)
    .toString().padStart(2, '0')}-${localDate.getDate().toString().padStart(2, '0')}`;
  const formatTableDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };
  const getCurrentLocalDate = () => {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
  };

  useEffect(() => {
    if (prefillData) {
      setAmount(prefillData.amount.toString());
      setDate(new Date(prefillData.date));
      setTransactionType(prefillData.type);  // 👈 This is the key line
    }
  }, [prefillData]);

  useEffect(() => {
    console.log("Set transaction type from SMS:", prefillData?.type);
  }, [transactionType]);


  const markAsProcessed = (id: string) => {
    const processed = JSON.parse(storage.getString('processedSMS') || '[]');
    storage.set('processedSMS', JSON.stringify([...processed, id]));
  };

  // Helper functions for local date handling
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatLocalDateString = (date: Date): string => {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  };

  const processFinancialData = (data: Transaction[]) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set to local midnight

    // Find the most recent balance up to current LOCAL date
    const allTransactions = [...data].sort((a, b) =>
      parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
    );

    const currentBalance = allTransactions.find(t =>
      parseLocalDate(t.date) <= currentDate
    )?.runningBalance || 0;

    setNetWorth(currentBalance);

    // Get recent transactions (last 5 up to current LOCAL date)
    const recent = data
      .filter(item =>
        item.type !== "balance" &&
        parseLocalDate(item.date) <= currentDate
      )
      .slice(-6)
      .reverse();

    setRecentTransactions(recent);

    // Monthly calculations using LOCAL dates
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let maxIncome = 0;
    let maxExpense = 0;
    let maxIncomeCategory = "";
    let maxExpenseCategory = "";

    data.forEach(transaction => {
      const transactionDate = parseLocalDate(transaction.date);
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
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }).toUpperCase();
  };

  const useCalculateProjection = (transactions: Transaction[]) => {
    const calculateProjection = () => {
      if (transactions.length < 2) return {
        currentNet: 0,
        projectedNet: 0,
        dailyChange: 0
      };

      // Use LOCAL dates for regression
      const validTransactions = transactions
        .filter(t => t.date && !isNaN(parseLocalDate(t.date).getTime()))
        .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

      const firstDate = parseLocalDate(validTransactions[0].date).getTime();
      const X = validTransactions.map(t =>
        (parseLocalDate(t.date).getTime() - firstDate) / (1000 * 3600 * 24)
      );
      const y = validTransactions.map(t => t.runningBalance);

      const regression = new SimpleLinearRegression();
      regression.train(X, y);

      const currentNet = y[y.length - 1];
      const lastX = X[X.length - 1];
      const projectedDate = lastX + 30;
      const projectedNet = regression.predict(projectedDate);

      return {
        currentNet,
        projectedNet,
        dailyChange: regression.slope
      };
    };

    return calculateProjection();
  };

  const ProjectedNetWorth: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const { currentNet, projectedNet, dailyChange } = useCalculateProjection(transactions);

    if (!transactions.length) return (
      <Text style={styles.infoText}>Add at least 5 transactions to see forecasts</Text>
    );

    if (transactions.length <= 4) return (
      <Text style={styles.infoText}>Add one more transaction to enable predictions</Text>
    );

    return (
      <View>
        <View>
          <Text style={[styles.totalsLabel, { fontSize: 15, marginBottom: 4 }]}>
            30 DAY PROJECTION:
          </Text>

          <View style={styles.projectionValueContainer}>
            <Text style={[
              styles.projectionValue,
              { fontSize: 36, fontWeight: "bold", color: 'white' }
            ]}>
              {projectedNet >= 100000
                ? `₹${(projectedNet / 100000).toFixed(2)}L`
                : projectedNet >= 1000
                  ? `₹${(projectedNet / 1000).toFixed(2)}K`
                  : `₹${projectedNet}`
              }
              <Text style={{ color: dailyChange >= 0 ? '#22c55e' : '#ef4444' }}>
                {dailyChange >= 0 ? ' ▲' : ' ▼'}
              </Text>
            </Text>
          </View>
        </View>


        <Text style={[styles.trendText, { fontSize: 15, marginLeft: 200, marginTop: -39 }]}>
          {dailyChange >= 0 ? 'Increasing' : 'Decreasing'} by
          ₹{Number(Math.abs(dailyChange).toFixed(2)).toLocaleString('en-IN')}/day
        </Text>
      </View>
    );
  };

  const requestSMSPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Access Permission',
            message: 'This app needs access to your SMS to automatically add transactions.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error(err);
        return false;
      }
    }
    return false;
  };

  const checkSMSPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
        ]);

        if (
          granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('SMS permissions granted');
          return true;
        }
        console.log('SMS permission denied');
        return false;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };



  // Update the processSMS function
  const processSMS = async () => {
    console.log('🔔 SMS Processing Initiated');

    try {
      const hasPermission = await checkSMSPermissions();
      if (!hasPermission) {
        console.warn('🚫 SMS permissions not granted');
        return;
      }

      const checkpoint = storage.getNumber('lastCheckpoint') || Date.now(); // fallback only on first boot
      const filter = {
        box: 'inbox',
        maxCount: 100, // or whatever
        minDate: checkpoint, // 👈 this ensures you only get newer SMS
      };



      SmsAndroid.list(
        JSON.stringify(filter),
        (error) => console.error('❌ SMS Fetch Error:', error),
        async (count, smsList) => {
          console.log(`📥 Received ${count} potential SMS transactions`);

          try {
            const messages: SmsMessage[] = JSON.parse(smsList);
            console.log('🔍 Parsing SMS messages...');

            const processedIds = new Set(
              JSON.parse(storage.getString('processedSMS') || '[]')
            );

            const newTransactions = messages
              .map((msg) => {
                console.log(`✉️ Processing SMS ID: ${msg._id}`);
                const transaction = parseSMSMessage(msg);

                if (!transaction) {
                  console.log(`⏩ Skipping non-transaction SMS: ${msg.body.substring(0, 30)}...`);
                  return null;
                }

                console.log(`🆕 Potential Transaction Found:
  - ID: ${transaction.id}
  - Amount: ${transaction.amount}
  - Type: ${transaction.type.toUpperCase()}
  - Date: ${transaction.date}`);

                return transaction;
              })
              .filter((t): t is TransactionFromSMS => {
                const isNew = t !== null && !processedIds.has(t.id);
                if (!isNew && t) {
                  console.log(`♻️ Already processed transaction ID: ${t.id}`);
                }
                return isNew;
              });

            console.log(`✅ Found ${newTransactions.length} new transactions`);

            // In processSMS function after finding newTransactions:
            // Replace the existing newTransactions handling with:
            if (newTransactions.length > 0) {
              newTransactions.forEach((transaction, index) => {
                Alert.alert(
                  'Transaction detected',
                  `Amount: ${formatCurrency(transaction.amount)}\n\nDate: ${new Date(transaction.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                  })}\n\nType: ${transaction.type.toUpperCase()}

Message Preview:
"${transaction.body.slice(0, 100)}..."`, // Limit long SMS messages
                  [
                    {
                      text: 'Ignore',
                      onPress: () => markAsProcessed(transaction.id),
                      style: 'cancel',
                    },
                    {
                      text: 'Add',
                      onPress: () => {
                        setPrefillData(transaction);
                        setShowPopup(true);
                        markAsProcessed(transaction.id);

                        // Final transaction triggers new checkpoint
                        if (index === newTransactions.length - 1) {
                          storage.set('lastCheckpoint', Date.now());
                        }
                      },
                    },
                  ],
                  { cancelable: false } // Prevent user from dismissing without decision
                );

              });
            } else {
              storage.set('lastCheckpoint', Date.now());
            }
          } catch (parseError) {
            console.error('❌ SMS Parse Error:', parseError);
          }
        }
      );
    } catch (error) {
      console.error('❌ SMS Processing Failed:', error);
    }
  };



  const parseSMSMessage = (msg: SmsMessage): TransactionFromSMS | null => {
    if (!msg.body) return null;

    // Amount parsing remains the same
    const amountMatch = msg.body.match(/(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!amountMatch) return null;
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Type detection remains the same
    const lowerBody = msg.body.toLowerCase();
    const type = lowerBody.includes('credit') || lowerBody.includes('received') ? 'income'
      : lowerBody.includes('debit') || lowerBody.includes('paid') || lowerBody.includes('spent') ? 'expense'
        : null;
    if (!type) return null;

    // Date handling with proper scoping
    let transactionDate: string;
    const dateRegex = /on\s+(\d{2})-(\d{2})-(\d{4})/i;
    const dateMatch = msg.body.match(dateRegex);

    if (dateMatch) {
      // Handle explicit date from message
      const [_, day, month, year] = dateMatch;
      transactionDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      // Handle SMS timestamp with local date
      const smsDate = new Date(Number(msg.date));
      if (isNaN(smsDate.getTime())) return null;

      // Create local date without time components
      const localSmsDate = new Date(
        smsDate.getFullYear(),
        smsDate.getMonth(),
        smsDate.getDate()
      );

      transactionDate = formatLocalDateString(localSmsDate);
    }

    return {
      id: msg._id,
      amount,
      date: transactionDate, // Use the properly formatted date
      type,
      body: msg.body
    };
  };


  const generateChartData = (data: Transaction[]) => {
    if (!data || data.length === 0) return;

    // 1) Filter out "balance" entries
    const transactionData = data.filter(item =>
      item.type !== "balance" &&
      parseLocalDate(item.date) <= new Date()
    );

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
    return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
  };


  const formatAmount = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatNetWorth = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
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
    const today = getCurrentLocalDate();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()); // 🆕 6-month filter
    const categories: { [key: string]: number } = {};
    let totalIncome = 0;

    transactions.forEach(transaction => {
      const transactionDate = parseLocalDate(transaction.date);
      if (
        transactionDate >= sixMonthsAgo && // 🆕 Only last 6 months
        transactionDate <= today &&
        transaction.type === 'income'
      ) {
        categories[transaction.category] = (categories[transaction.category] || 0) + transaction.amount;
        totalIncome += transaction.amount;
      }
    });

    const sortedCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a);

    if (sortedCategories.length > 3) {
      const minTopValue = sortedCategories[2][1];
      const topCategories = sortedCategories.filter(([, amount]) => amount >= minTopValue);
      const otherCategories = sortedCategories.filter(([, amount]) => amount < minTopValue);
      const otherTotal = otherCategories.reduce((sum, [, amount]) => sum + amount, 0);

      return [
        ...topCategories.map(([name, amount], index) => ({
          name,
          amount: Math.abs(amount),
          percentage: (amount / totalIncome) * 100,
          color: categoryColors[index % 4],
          isMain: true
        })),
        {
          name: 'Other',
          amount: otherTotal,
          percentage: (otherTotal / totalIncome) * 100,
          color: categoryColors[3],
          subCategories: otherCategories.map(([name, amount]) => ({
            name,
            amount: Math.abs(amount),
            percentage: (amount / totalIncome) * 100
          })),
          isMain: false
        }
      ];
    };

    return sortedCategories.map(([name, amount], index) => ({
      name,
      amount: Math.abs(amount),
      percentage: (amount / totalIncome) * 100,
      color: categoryColors[index % 4],
      isMain: true
    }));
  };

  const calculateExpenseCategories = () => {
    const today = getCurrentLocalDate();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()); // 🆕 6-month filter
    const categories: { [key: string]: number } = {};
    let totalExpense = 0;

    transactions.forEach(transaction => {
      const transactionDate = parseLocalDate(transaction.date);
      if (
        transactionDate >= sixMonthsAgo && // 🆕 Only last 6 months
        transactionDate <= today &&
        transaction.type === 'expense'
      ) {
        const absoluteAmount = Math.abs(transaction.amount);
        categories[transaction.category] = (categories[transaction.category] || 0) + absoluteAmount;
        totalExpense += absoluteAmount;
      }
    });

    const sortedCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a);

    if (sortedCategories.length > 3) {
      const minTopValue = sortedCategories[2][1];
      const topCategories = sortedCategories.filter(([, amount]) => amount >= minTopValue);
      const otherCategories = sortedCategories.filter(([, amount]) => amount < minTopValue);
      const otherTotal = otherCategories.reduce((sum, [, amount]) => sum + amount, 0);

      return [
        ...topCategories.map(([name, amount], index) => ({
          name,
          amount: Math.abs(amount),
          percentage: (amount / totalExpense) * 100,
          color: categoryColors[(index % 4) + 4],
          isMain: true
        })),
        {
          name: 'Other',
          amount: otherTotal,
          percentage: (otherTotal / totalExpense) * 100,
          color: categoryColors[7],
          subCategories: otherCategories.map(([name, amount]) => ({
            name,
            amount: Math.abs(amount),
            percentage: (amount / totalExpense) * 100
          })),
          isMain: false
        }
      ];
    };

    return sortedCategories.map(([name, amount], index) => ({
      name,
      amount,
      percentage: (amount / totalExpense) * 100,
      color: categoryColors[(index % 4) + 4],
      isMain: true
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
    const periods: { start: Date; end: Date }[] = []; // Explicitly type the array
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate last 6 weeks including current week
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - (i * 7)); // Previous Sundays

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Saturdays

      periods.push({ start: weekStart, end: weekEnd }); // Proper object syntax
    }

    return periods.reverse(); // Oldest first
  };

  const generateGraphLabels = () => {
    const periods = getBiMonthlyPeriods(); // Store the result first
    return periods.map((period, index) => {
      const isCurrentWeek = index === periods.length - 1;
      return isCurrentWeek
        ? 'Current'
        : `${period.start.getDate()}-${period.end.getDate()}`; // Use template literals
    });
  };

  const formatAmountIN = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
  };


  // Keep calculateIncomeData/calculateExpenseData functions EXACTLY the same
  // (they'll now use weekly periods automatically)

  const calculateCategoryForecast = (type: 'income' | 'expense') => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get all transactions of the specified type
    const typeTransactions = transactions.filter(t => t.type === type);

    // Group by category
    const categories: { [key: string]: Transaction[] } = {};
    typeTransactions.forEach(t => {
      if (!categories[t.category]) {
        categories[t.category] = [];
      }
      categories[t.category].push(t);
    });

    const result = [];

    for (const category in categories) {
      const categoryTransactions = categories[category];

      // Filter current month transactions
      const currentMonthTransactions = categoryTransactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
      const currentAmount = currentMonthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Filter historical transactions (excluding current month)
      const historicalTransactions = categoryTransactions.filter(t => {
        const date = new Date(t.date);
        return !(date.getMonth() === currentMonth && date.getFullYear() === currentYear);
      });

      // Group historical by month to calculate monthly averages
      const monthlyTotals: { [key: string]: number } = {};
      historicalTransactions.forEach(t => {
        const date = new Date(t.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Math.abs(t.amount);
      });

      const monthlyAmounts = Object.values(monthlyTotals);
      const monthsCount = monthlyAmounts.length;
      const averageAmount = monthsCount > 0 ?
        monthlyAmounts.reduce((sum, amount) => sum + amount, 0) / monthsCount :
        0;

      // Calculate percentage change
      let percentageChange = 0;
      if (averageAmount > 0) {
        percentageChange = ((currentAmount - averageAmount) / averageAmount) * 100;
      } else if (currentAmount > 0) {
        percentageChange = 100; // Infinite growth from 0
      }

      result.push({
        name: category,
        currentAmount,
        averageAmount,
        percentageChange,
        monthsCount
      });
    }

    // Sort by percentage change (most improved first for income, most reduced first for expenses)
    return result.sort((a, b) => {
      if (type === 'income') {
        return b.percentageChange - a.percentageChange;
      } else {
        return a.percentageChange - b.percentageChange;
      }
    });
  };

  const handleTransactionProcessed = () => {
    console.group('💾 Processing Transaction');

    if (!currentSMSTransaction) {
      return;
    }

    console.log(`🆔 Processing Transaction ID: ${currentSMSTransaction.id}`);

    // Update processed SMS
    const processed = JSON.parse(storage.getString('processedSMS') || '[]');
    const newProcessed = [...processed, currentSMSTransaction.id];
    storage.set('processedSMS', JSON.stringify(newProcessed));
    console.log(`📝 Marked transaction ${currentSMSTransaction.id} as processed`);

    // Update uncategorized transactions
    const remaining = uncategorizedTransactions.filter(
      t => t.id !== currentSMSTransaction.id
    );
    setUncategorizedTransactions(remaining);
    storage.set('uncategorizedTransactions', JSON.stringify(remaining));
    console.log(`🗑️ Removed transaction from uncategorized list`);

    // Handle next transaction
    if (remaining.length > 0) {
      console.log(`➡️ Next transaction ID: ${remaining[0].id}`);
      setCurrentSMSTransaction(remaining[0]);
    } else {
      console.log('⏹️ No more transactions to process');
      setShowPopup(false);
    }

    console.groupEnd();
  };

  interface SMSGreetingProps {
    onClose: () => void;
    transaction: TransactionFromSMS | null;
    count: number;
  }

  const SMSGreeting: React.FC<SMSGreetingProps> = ({ onClose, transaction, count }) => {
    if (!transaction) return null; // Add null check
    console.log("Rendering SMS Greeting with count:", count);
    return (
      <View style={styles.smsAlert}>
        <Text style={styles.smsAlertText}>
          🎉 We found {count} new transaction{count !== 1 ? 's' : ''} in your SMS!
        </Text>
        <TouchableOpacity
          style={styles.smsAlertButton}
          onPress={() => {
            // Pre-fill form with SMS data before showing popup
            if (currentSMSTransaction) {
              setAmount(currentSMSTransaction.amount.toString());
              setTransactionType(currentSMSTransaction.type);
              setDescription(currentSMSTransaction.body.substring(0, 40));
              try {
                setDate(new Date(currentSMSTransaction.date));
              } catch (e) {
                setDate(new Date());
              }
            }
            setShowPopup(true);
            onClose();
          }}
        >
          <Text style={styles.smsAlertButtonText}>Add Now</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
    const triangle = isIncrease ? '▲' : '▼';

    return (
      <View style={styles.indicatorRow}>
        {/* Label (e.g., "INCOME:") */}
        <Text style={[styles.labelText, { width: 80 }]}>{label}:</Text>

        {/* Triangle Indicator */}
        <Text style={[{ color }, { fontSize: 25, width: 20, paddingBottom: 5, marginHorizontal: 4, }]}>
          {triangle}
        </Text>

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
      return Math.abs( // Flip negative expenses to positive values
        transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return (
              tDate >= period.start &&
              tDate <= period.end &&
              t.type === 'expense'
            );
          })
          .reduce((sum, t) => sum + t.amount, 0)
      );
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
            style={[styles.logoImage, { tintColor: "transparent" }]}
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
                <View>
                  <View style={styles.tileRow}>
                    {/* Plus Button */}
                    <TouchableOpacity
                      style={[styles.transactionTile, {
                        borderColor: "#07a69b",
                        width: "30%",
                      }]}
                      onPress={() => setShowPopup(true)}
                    >
                      <Image
                        source={require("./src/assets/images/plus.png")}
                        style={[styles.actionIcon, { transform: [{ scale: 1.3 }] }]} // scale up 1.5x
                        resizeMode="contain"
                      />

                    </TouchableOpacity>

                    {/* Delete Mode Toggle */}
                    <TouchableOpacity
                      style={[styles.transactionTile, {
                        borderColor: isDeleteMode ? "#E53935" : "#07a69b",
                        width: "30%",
                      }]}
                      onPress={() => {
                        setIsDeleteMode(!isDeleteMode);
                        setShowSearchBar(false);
                      }}
                    >
                      <Image
                        source={require("./src/assets/images/delete.png")}
                        style={[styles.actionIcon, { tintColor: isDeleteMode ? "#E53935" : "#07a69b" }]}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>

                    {/* Search Toggle Button */}
                    <TouchableOpacity
                      style={[styles.transactionTile, {
                        borderColor: "#07a69b",
                        width: "30%",
                      }]}
                      onPress={() => {
                        setShowSearchBar(!showSearchBar);
                        setSearchQuery('');
                        setIsDeleteMode(false);
                      }}
                    >
                      <Image
                        source={require("./src/assets/images/search.png")}
                        style={styles.actionIcon}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Delete Mode Indicator */}
                  {isDeleteMode && (
                    <View>

                    </View>
                  )}
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
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        if (isDeleteMode) {
                          Alert.alert(
                            "Delete Transaction",
                            `Are you sure you want to delete this transaction?\n\n
                  Date: ${formatTableDate(transaction.date)}\n
                  Category: ${transaction.category}\n
                  Amount: ${formatCurrency(transaction.amount)}\n
                  Description: ${transaction.description}`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => {
                                  const newTransactions = transactions.filter(
                                    t => t !== transaction
                                  );
                                  setTransactions(newTransactions);
                                  setIsDeleteMode(false);
                                }
                              }
                            ]
                          );
                        }
                      }}
                    >
                      <View style={[
                        styles.tableRow,
                        isDeleteMode && styles.deleteModeRow
                      ]}>
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
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {activeTab === "Graphs" && (
            <>
              {/* Move the Title Outside the Chart Box */}
              <Text style={[styles.netWorthTitle, { paddingTop: 10 }]}>WEEKLY FINANCIAL TRENDS</Text>

              {/* Chart Container */}
              <View style={styles.trendsContainer}>
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
                  width={Dimensions.get('window').width - 68}
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
              <Text style={[styles.totalsLabel, { paddingTop: 15 }]}>6-MONTH INCOME</Text>
              <View style={styles.pieChartsContainer}>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedChartType('income');
                    setShowCategoryModal(true);
                  }}
                >
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
                </TouchableOpacity>
                <Text style={styles.netWorthTitle}>6-MONTH EXPENSE</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedChartType('expense');
                    setShowCategoryModal(true);
                  }}
                >
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
                </TouchableOpacity>
              </View>
            </>
          )}

          {activeTab === "Forecast" && (
            <View style={styles.forecastContainer}>
              <View style={[styles.netWorthBox, { marginTop: 9, borderColor: "#d1c732" }]}>
                <ProjectedNetWorth transactions={transactions} />
              </View>

              {/* Income Categories Section */}
              <Text style={[styles.totalsLabel, { marginBottom: 5, marginTop: 5 }]}>
                INCOME CATEGORIES
              </Text>
              <ScrollView
                style={[
                  styles.categoryScrollView,
                  { maxHeight: 240 } // Only three items (adjust as needed)
                ]}
                nestedScrollEnabled={true}
                alwaysBounceVertical={true}
              >
                <View style={styles.categorySection}>
                  {calculateCategoryForecast('income').length > 0 ? (
                    calculateCategoryForecast('income').map((category, index) => (
                      <View key={`income-${index}`} style={styles.categoryItem}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <View style={styles.categoryDetails}>
                          <Text style={styles.categoryAmount}>
                            {formatAmountIN(category.currentAmount)}
                          </Text>
                          <Text
                            style={[
                              styles.categoryComparison,
                              category.percentageChange >= 0
                                ? styles.positive
                                : styles.negative
                            ]}
                          >
                            {category.percentageChange >= 0 ? '▲' : '▼'}
                            {Math.abs(category.percentageChange).toFixed(1)}%
                          </Text>
                        </View>
                        <Text style={styles.categoryAverage}>
                          Avg: {formatAmountIN(category.averageAmount)} (past {category.monthsCount} months)
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noDataText}>No income data available</Text>
                  )}
                </View>
              </ScrollView>

              {/* Expense Categories Section */}
              <Text style={[styles.totalsLabel, { marginBottom: 5, marginTop: 25 }]}>
                EXPENSE CATEGORIES
              </Text>
              <ScrollView
                style={[
                  styles.categoryScrollView,
                  { maxHeight: 240 } // Only three items (adjust as needed)
                ]}
                nestedScrollEnabled={true}
                alwaysBounceVertical={false}
              >
                <View style={styles.categorySection}>
                  {calculateCategoryForecast('expense').length > 0 ? (
                    [...calculateCategoryForecast('expense')]
                      .sort((a, b) => b.percentageChange - a.percentageChange) // Most negative at top
                      .map((category, index) => (
                        <View key={`expense-${index}`} style={styles.categoryItem}>
                          <Text style={styles.categoryName}>{category.name}</Text>
                          <View style={styles.categoryDetails}>
                            <Text style={styles.categoryAmount}>
                              {formatAmountIN(category.currentAmount)}
                            </Text>
                            <Text
                              style={[
                                styles.categoryComparison,
                                category.percentageChange >= 0 ? styles.negative : styles.positive
                              ]}
                            >
                              {category.percentageChange >= 0 ? '▲' : '▼'}
                              {Math.abs(category.percentageChange).toFixed(1)}%
                            </Text>
                          </View>
                          <Text style={styles.categoryAverage}>
                            Avg: {formatAmountIN(category.averageAmount)} (past {category.monthsCount} months)
                          </Text>
                        </View>
                      ))
                  ) : (
                    <Text style={styles.noDataText}>No expense data available</Text>
                  )}

                </View>
              </ScrollView>
            </View>
          )}


        </View>
      </ScrollView>
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.popupContainer}>
          <View style={[styles.popupContent, { maxHeight: '100%' }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <Text style={[styles.netWorthTitle, { marginBottom: 15, marginTop: -20, fontSize: 20 }]}>
              {selectedChartType.toUpperCase()} CATEGORY
            </Text>

            <ScrollView
              style={styles.categoryScrollView}
              showsVerticalScrollIndicator={false}
            >
              {(selectedChartType === 'income'
                ? calculateIncomeCategories()
                : calculateExpenseCategories()).map((item, index) => (
                  <View key={`${selectedChartType}-${index}`}>
                    {/* Main Category Item */}
                    <View style={styles.categoryItem}>
                      <View style={styles.categoryDetails}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.legendColor, {
                            backgroundColor: item.color,
                            opacity: item.isMain ? 1 : 0.6,
                          }]} />
                          <Text style={[styles.categoryName, { color: 'white' }]}>
                            {item.name}
                            {!item.isMain}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <Text style={[styles.categoryAmount, {
                            marginLeft: 90,
                            color: selectedChartType === 'income' ? '#4CAF50' : '#E53935' // Added conditional color
                          }]}>
                            {formatCurrency(item.amount)}
                          </Text>
                          <Text style={styles.categoryPercentage}>
                            ({item.percentage.toFixed(1)}%)
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Subcategories for "Other" */}
                    {isOtherCategory(item) && (
                      <View style={styles.otherCategoriesContainer}>
                        {item.subCategories?.map((subItem, subIndex) => (
                          <View key={subIndex} style={[styles.subCategoryItem]}>
                            <View style={[styles.legendColor, {
                              backgroundColor: item.color,
                              opacity: 0.4,
                              marginLeft: 0,
                            }]} />
                            <View style={styles.subCategoryDetails}>
                              <Text style={[styles.subCategoryName, { marginLeft: -2 }]}>
                                {subItem.name}
                              </Text>
                              <Text style={styles.subCategoryAmount}>
                                <Text style={{ color: selectedChartType === 'income' ? '#4CAF50' : '#E53935' }}>
                                  {formatCurrency(subItem.amount)}
                                </Text>
                                <Text style={{ color: '#a8aeaa' }}>
                                  {' '}({subItem.percentage.toFixed(1)}%)
                                </Text>
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
              value={currentSMSTransaction?.amount.toString() || amount}
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
                {currentSMSTransaction?.date ||
                  date.toLocaleDateString("en-US", {
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
                if (prefillData) {
                  // Use prefillData values as defaults
                  const newTransaction = {
                    amount: prefillData.amount,
                    type: prefillData.type,
                    date: prefillData.date,
                    // ... other fields with user inputs
                  };
                  // Submit logic here
                }
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
                  date: formattedDate,
                  type: transactionType,
                  category: selectedCategory,
                  amount: transactionType === "income"
                    ? Math.abs(Number(amount))
                    : -Math.abs(Number(amount)),
                  runningBalance: 0,
                  description: description || "No description"
                };

                console.log('Creating transaction with category:', newTransaction.category);
                handleTransactionProcessed();
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
                setDate(new Date())
                setPrefillData(null); // Clear prefill after submit
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
  subCategoryDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 8,
  },
  otherCategoriesContainer: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#404040',
    paddingLeft: 10,
    marginBottom: 10,
  },
  subCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subCategoryName: {
    color: '#a8aeaa',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  subCategoryAmount: {
    color: '#a8aeaa',
    fontSize: 14,
    marginLeft: 8,
  },
  categoryPercentage: {
    color: '#a8aeaa',
    fontSize: 14,
    marginLeft: 8,
  },
  smsAlert: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#07a69b',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 100,
  },
  smsAlertText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  smsAlertButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginLeft: 10,
  },
  smsAlertButtonText: {
    color: '#07a69b',
    fontWeight: 'bold',
  },
  smsNotice: {
    color: '#07a69b',
    marginBottom: 15,
    fontStyle: 'italic',
    fontSize: 14,
  },
  categoryScrollView: {
    maxHeight: Dimensions.get('window').height * 0.4,
    marginTop: 20,
  },
  categorySection: {
    marginBottom: 25,
    backgroundColor: '#343635',
    borderRadius: 15,
    padding: 15,
  },
  categorySectionTitle: {
    color: '#07a69b',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  categoryItem: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#505050',
  },
  categoryName: {
    color: '#d1c732',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  debugButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 10,
    zIndex: 999
  },
  debugText: {
    color: 'white',
    fontWeight: 'bold'
  },
  categoryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  deleteModeRow: {
    borderRightWidth: 4,
    borderRightColor: '#E53935',
    borderRadius: 20,
  },
  deleteModeIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E53935',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  deleteModeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelDeleteButton: {
    backgroundColor: 'white',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  cancelDeleteText: {
    color: '#E53935',
    fontWeight: 'bold',
  },
  categoryAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryComparison: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryAverage: {
    color: '#a8aeaa',
    fontSize: 12,
  },
  noDataText: {
    color: '#a8aeaa',
    textAlign: 'center',
    marginVertical: 10,
  },
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
    color: '#4CAF50', // Green
  },
  negative: {
    color: '#E53935', // Red
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
    padding: 1,
    paddingBottom: 0,
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
    marginBottom: 0,
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
    marginBottom: 40,
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