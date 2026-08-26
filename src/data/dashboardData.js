import { CalendarDays, ReceiptText, TriangleAlert, UserRoundCheck, WalletCards, WalletMinimal } from 'lucide-react';

export const dashboardStats = [
  { title: 'Expected Today', value: '₹ 1,25,000', note: 'From 45 Customers', icon: WalletCards, tone: 'blue', progress: 72 },
  { title: 'Collected Today', value: '₹ 87,450', note: 'From 32 Customers', icon: WalletMinimal, tone: 'green', progress: 66 },
  { title: 'Pending / Overdue', value: '₹ 37,550', note: 'From 18 Customers', icon: TriangleAlert, tone: 'orange', progress: 66 },
  { title: 'Upcoming 7 Days', value: '₹ 2,15,000', note: 'From 63 Customers', icon: CalendarDays, tone: 'purple', progress: 66 },
  { title: 'Active Loans', value: '128', note: 'Total Active Loans', icon: UserRoundCheck, tone: 'indigo', progress: 68 },
  { title: "Today's Expenses", value: '₹ 4,650', note: '12 Expenses', icon: ReceiptText, tone: 'pink', progress: 66 },
];

export const collectionRows = [
  { id: 'SFC-0001', name: 'Ravi Kumar', cycle: 'Daily', amount: '₹ 1,000', status: 'Due Today' },
  { id: 'SFC-0002', name: 'Kavin Raj', cycle: 'Daily', amount: '₹ 1,000', status: 'Paid' },
  { id: 'SFC-0003', name: 'Surya Prakash', cycle: 'Daily', amount: '₹ 1,000', status: 'Due Today' },
  { id: 'SFC-0004', name: 'Dhinesh B', cycle: 'Daily', amount: '₹ 1,000', status: 'Overdue' },
  { id: 'SFC-0005', name: 'Mani M', cycle: 'Daily', amount: '₹ 1,000', status: 'Paid' },
];
