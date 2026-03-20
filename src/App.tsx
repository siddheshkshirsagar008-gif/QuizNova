import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Play,
  Hash,
  Brain, 
  Trophy, 
  History, 
  Moon, 
  Sun, 
  SunMedium,
  Sunset,
  Check,
  ChevronRight, 
  ChevronLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Timer,
  BarChart3,
  ArrowLeft,
  Info,
  Download,
  LayoutDashboard,
  Settings,
  Key,
  ExternalLink,
  X,
  Lock,
  User,
  LogOut,
  Shield,
  UserCircle,
  Cpu,
  Palette,
  Bell,
  HelpCircle,
  Save,
  Volume2,
  Zap,
  RefreshCw,
  Database,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { extractTextFromPDF } from './services/pdfService';
import { generateMCQsFromText, generateMCQsFromConceptText, MCQ } from './services/geminiService';
import { cn, formatTime, getLocalDateString } from './lib/utils';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import Markdown from 'react-markdown';

// --- Types ---

type AppState = 'auth' | 'landing' | 'uploading' | 'processing' | 'mode_selection' | 'quiz' | 'results' | 'history' | 'tier_selection' | 'parsing_config';

interface QuizResult {
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  totalTime: number;
  avgTimePerQuestion: number;
  performanceSummary: string;
  username?: string;
  date?: string;
  topics?: string[];
  level?: string;
  detailedReport?: {
    question: string;
    userAnswer: number | null;
    correctAnswer: number;
    options: string[];
    explanation: string;
  }[];
  id?: number;
  created_at?: string;
}

// --- Components ---

const ThemeToggle = ({ isDark, toggle }: { isDark: boolean, toggle: () => void }) => (
  <button 
    onClick={toggle}
    className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all"
    title="Toggle Theme"
  >
    {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
  </button>
);

const SettingsButton = ({ onClick }: { onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all"
    title="Settings"
  >
    <Settings className="w-5 h-5 text-slate-400 hover:text-white" />
  </button>
);

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  currentKey, 
  onSave, 
  onLogout,
  user,
  isDark,
  accentColor,
  notifications,
  onToggleNotifications,
  exportData,
  onUpgrade,
  history,
  onUpdateAccentColor,
  onResetUsage
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  currentKey: string, 
  onSave: (key: string) => void, 
  onLogout: () => void,
  user: { username: string, email: string, full_name?: string, bio?: string, api_key: string, tier: 'free' | 'pro', daily_usage: number } | null,
  isDark: boolean,
  accentColor: string,
  notifications: boolean,
  onToggleNotifications: () => void,
  exportData: () => void,
  onUpgrade: () => void,
  history: any[],
  onUpdateAccentColor: (color: string) => void,
  onResetUsage: () => Promise<void>
}) => {
  const [key, setKey] = useState(currentKey);
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'stats' | 'preferences' | 'database'>('api');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('sound_enabled') !== 'false');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/db-status')
        .then(res => res.json())
        .then(data => setDbConfigured(data.configured))
        .catch(() => setDbConfigured(false));
    }
  }, [isOpen]);

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('sound_enabled', String(newVal));
  };

  const stats = {
    totalQuizzes: Array.isArray(history) ? history.length : 0,
    avgAccuracy: (Array.isArray(history) && history.length > 0)
      ? Math.round(history.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / history.length) 
      : 0,
    totalQuestions: Array.isArray(history) ? history.reduce((acc, curr) => acc + (curr.attempted || 0), 0) : 0,
    totalTime: Array.isArray(history) ? history.reduce((acc, curr) => acc + (curr.total_time || 0), 0) : 0
  };

  const maskKey = (k: string) => {
    if (!k) return "Not Configured";
    if (k.length <= 8) return "********";
    return `${k.substring(0, 4)}...${k.substring(k.length - 4)}`;
  };

  const tabs = [
    { id: 'api', label: 'AI Engine', icon: Cpu },
    { id: 'stats', label: 'Learning Stats', icon: BarChart3 },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'database', label: 'Database', icon: Database },
  ];

  const bgColor = isDark ? "bg-slate-900" : "bg-white";
  const borderColor = isDark ? "border-slate-800" : "border-slate-200";
  const textColor = isDark ? "text-white" : "text-slate-900";
  const subTextColor = isDark ? "text-slate-400" : "text-slate-500";
  const sidebarBg = isDark ? "bg-slate-950/50" : "bg-slate-50";
  const itemBg = isDark ? "bg-slate-800/50" : "bg-slate-100";
  const inputBg = isDark ? "bg-slate-800" : "bg-slate-50";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn("absolute inset-0 backdrop-blur-sm", isDark ? "bg-slate-950/80" : "bg-slate-900/40")}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn("relative w-full max-w-3xl border rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[550px]", bgColor, borderColor)}
          >
            {/* Sidebar */}
            <div className={cn("w-full md:w-64 border-r p-6 flex flex-col", sidebarBg, borderColor)}>
              <div className="flex items-center gap-3 mb-8 px-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", `bg-${accentColor}-500`)}>
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h2 className={cn("text-lg font-bold", textColor)}>Settings</h2>
              </div>

              <nav className="space-y-1 flex-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                      activeTab === tab.id 
                        ? `bg-${accentColor}-500 text-white shadow-lg shadow-${accentColor}-500/20` 
                        : cn(subTextColor, isDark ? "hover:text-white hover:bg-white/5" : "hover:text-slate-900 hover:bg-slate-200")
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="mt-auto pt-6 border-t border-slate-800/50">
                <button
                  onClick={onLogout}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                    "text-red-500 hover:bg-red-500/10"
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 overflow-y-auto">
              <button onClick={onClose} className={cn("absolute top-6 right-6 transition-colors", isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-900")}>
                <X className="w-6 h-6" />
              </button>

              <AnimatePresence mode="wait">
                {activeTab === 'api' && (
                  <motion.div
                    key="api"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className={cn("text-xl font-bold mb-1", textColor)}>AI Configuration</h3>
                      <p className={cn("text-sm", subTextColor)}>Manage your Gemini AI settings and quotas.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className={cn("block text-sm font-medium mb-2", subTextColor)}>Gemini API Key</label>
                        <div className="relative">
                          <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Enter your API key"
                            className={cn("w-full border rounded-xl pl-11 pr-12 py-3 focus:outline-none focus:ring-2 transition-all text-sm", inputBg, borderColor, textColor, `focus:ring-${accentColor}-500`)}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded", key ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>
                              {key ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                          Your key is stored securely. For your safety, the full key is hidden. Status: <span className={key ? "text-emerald-500 font-bold" : "text-slate-500"}>{key ? "Connected" : "Disconnected"}</span>
                        </p>
                      </div>

                      <div className={cn("p-5 rounded-2xl border", itemBg, borderColor)}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Zap className={cn("w-4 h-4", `text-${accentColor}-500`)} />
                            <span className={cn("text-sm font-bold", textColor)}>Daily MCQ Quota</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                            user?.tier === 'pro' ? "text-amber-500 bg-amber-500/10" : "text-blue-500 bg-blue-500/10"
                          )}>
                            {user?.tier === 'pro' ? 'Pro' : 'Free'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={subTextColor}>Usage Status</span>
                            <span className={cn("font-bold", textColor)}>
                              {user?.daily_usage || 0} / {user?.tier === 'pro' ? 500 : 50}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, ((user?.daily_usage || 0) / (user?.tier === 'pro' ? 500 : 50)) * 100)}%` }}
                              className={cn("h-full rounded-full", `bg-${accentColor}-500`)}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 italic">
                            Quota resets every 24 hours at midnight UTC.
                          </p>
                        </div>
                      </div>

                      <div className={cn("p-5 rounded-2xl border space-y-3", `bg-${accentColor}-500/5 border-${accentColor}-500/10`)}>
                        <div className={cn("flex items-center gap-2", `text-${accentColor}-500`)}>
                          <HelpCircle className="w-4 h-4" />
                          <span className="text-sm font-semibold">Need a key?</span>
                        </div>
                        <p className={cn("text-xs leading-relaxed", subTextColor)}>
                          Get a free API key from Google AI Studio to increase your generation limits and access faster models.
                        </p>
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={cn("inline-flex items-center gap-2 text-xs font-bold transition-colors", `text-${accentColor}-500 hover:text-${accentColor}-600`)}
                        >
                          Get API Key from Google <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <button 
                      onClick={() => onSave(key)}
                      className={cn("w-full py-3.5 text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-sm", `bg-${accentColor}-500 hover:bg-${accentColor}-600 shadow-${accentColor}-500/20`)}
                    >
                      Apply Changes
                    </button>
                  </motion.div>
                )}

                {activeTab === 'database' && (
                  <motion.div
                    key="database"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className={cn("text-xl font-bold mb-1", textColor)}>Database Configuration</h3>
                      <p className={cn("text-sm", subTextColor)}>Connect your Supabase project to persist data.</p>
                    </div>

                    <div className={cn("p-6 rounded-2xl border flex items-center justify-between", itemBg, borderColor)}>
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", dbConfigured ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500")}>
                          <Database className="w-6 h-6" />
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold", textColor)}>Supabase Status</p>
                          <p className="text-xs text-slate-500">{dbConfigured ? "Connected & Operational" : "Not Configured"}</p>
                        </div>
                      </div>
                      <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", dbConfigured ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                        {dbConfigured ? "Online" : "Offline"}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={cn("p-5 rounded-2xl border space-y-4", isDark ? "bg-slate-950/50" : "bg-slate-50")}>
                        <h4 className={cn("text-sm font-bold flex items-center gap-2", textColor)}>
                          <HelpCircle className="w-4 h-4 text-indigo-500" />
                          How to find your credentials
                        </h4>
                        <ol className="text-xs space-y-3 text-slate-500 list-decimal pl-4">
                          <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">Supabase Dashboard</a>.</li>
                          <li>Select your project and go to <strong>Project Settings</strong> (⚙️ gear icon).</li>
                          <li>Navigate to <strong>API</strong> in the sidebar.</li>
                          <li>Copy the <strong>Project URL</strong> and <strong>anon public</strong> key.</li>
                          <li>For the backend, go to <strong>Project Settings</strong> → <strong>API</strong> and copy the <strong>service_role</strong> key.</li>
                        </ol>
                      </div>

                      <div className={cn("p-5 rounded-2xl border space-y-3", `bg-${accentColor}-500/5 border-${accentColor}-500/10`)}>
                        <h4 className={cn("text-sm font-bold flex items-center gap-2", textColor)}>
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          Where to put them
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          For security, credentials must be added to the platform's <strong>Secrets</strong> menu.
                        </p>
                        <div className="bg-slate-950/80 p-3 rounded-lg font-mono text-[10px] text-indigo-300 space-y-1">
                          <p>1. Open ⚙️ Settings (Top Right)</p>
                          <p>2. Go to "Secrets" tab</p>
                          <p>3. Add the following keys:</p>
                          <p className="text-white pl-2">VITE_SUPABASE_URL</p>
                          <p className="text-white pl-2">VITE_SUPABASE_ANON_KEY</p>
                          <p className="text-white pl-2">SUPABASE_SERVICE_ROLE_KEY</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'stats' && (
                  <motion.div
                    key="stats"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className={cn("text-xl font-bold mb-1", textColor)}>Learning Statistics</h3>
                      <p className={cn("text-sm", subTextColor)}>Overview of your performance and progress.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn("p-4 rounded-2xl border", itemBg, borderColor)}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Quizzes</p>
                        <p className={cn("text-2xl font-bold", textColor)}>{stats.totalQuizzes}</p>
                      </div>
                      <div className={cn("p-4 rounded-2xl border", itemBg, borderColor)}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Avg. Accuracy</p>
                        <p className={cn("text-2xl font-bold text-emerald-500")}>{stats.avgAccuracy}%</p>
                      </div>
                      <div className={cn("p-4 rounded-2xl border", itemBg, borderColor)}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Questions</p>
                        <p className={cn("text-2xl font-bold", textColor)}>{stats.totalQuestions}</p>
                      </div>
                      <div className={cn("p-4 rounded-2xl border", itemBg, borderColor)}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Study Time</p>
                        <p className={cn("text-2xl font-bold", textColor)}>{formatTime(stats.totalTime)}</p>
                      </div>
                    </div>

                    <div className={cn("p-6 rounded-2xl border", itemBg, borderColor)}>
                      <h4 className={cn("text-sm font-bold mb-4", textColor)}>Performance Insight</h4>
                      <p className={cn("text-xs leading-relaxed", subTextColor)}>
                        {stats.totalQuizzes === 0 
                          ? "Start your first quiz to see performance insights here!" 
                          : stats.avgAccuracy > 80 
                            ? "Excellent work! You're consistently showing high accuracy across your learning sessions." 
                            : stats.avgAccuracy > 60 
                              ? "Good progress. Focus on reviewing wrong answers to push your accuracy above 80%." 
                              : "Keep practicing. Regular study sessions will help improve your retention and accuracy."
                        }
                      </p>
                    </div>
                  </motion.div>
                )}



                {activeTab === 'preferences' && (
                  <motion.div
                    key="preferences"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className={cn("text-xl font-bold mb-1", textColor)}>Preferences</h3>
                      <p className={cn("text-sm", subTextColor)}>Customize your experience and manage data.</p>
                    </div>

                    <div className="space-y-4">
                      <div className={cn("p-4 rounded-xl border flex items-center justify-between", itemBg, borderColor)}>
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className={cn("text-sm font-medium", textColor)}>Notifications</p>
                            <p className="text-[11px] text-slate-500">System alerts and reminders</p>
                          </div>
                        </div>
                        <button 
                          onClick={onToggleNotifications}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative p-1",
                            notifications ? `bg-${accentColor}-500` : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                            notifications ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                      </div>

                      <div className={cn("p-4 rounded-xl border flex items-center justify-between", itemBg, borderColor)}>
                        <div className="flex items-center gap-3">
                          <Palette className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className={cn("text-sm font-medium", textColor)}>Accent Color</p>
                            <p className="text-[11px] text-slate-500">Personalize your interface</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {['indigo', 'emerald', 'rose', 'amber', 'purple'].map((color) => (
                            <button
                              key={color}
                              onClick={() => onUpdateAccentColor(color)}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all",
                                color === 'indigo' ? "bg-indigo-500" : 
                                color === 'emerald' ? "bg-emerald-500" :
                                color === 'rose' ? "bg-rose-500" :
                                color === 'amber' ? "bg-amber-500" : "bg-purple-500",
                                accentColor === color ? "border-white scale-125 shadow-lg" : "border-transparent hover:scale-110"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <div className={cn("p-4 rounded-xl border flex items-center justify-between", itemBg, borderColor)}>
                        <div className="flex items-center gap-3">
                          <Volume2 className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className={cn("text-sm font-medium", textColor)}>Sound Effects</p>
                            <p className="text-[11px] text-slate-500">Audio feedback during quizzes</p>
                          </div>
                        </div>
                        <button 
                          onClick={toggleSound}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative p-1",
                            soundEnabled ? `bg-${accentColor}-500` : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                            soundEnabled ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                      </div>

                      <div className={cn("pt-4 border-t space-y-3", borderColor)}>
                        <h4 className={cn("text-sm font-medium mb-2", textColor)}>Data Management</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button 
                            onClick={exportData}
                            className={cn("flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border shadow-sm hover:shadow-md", inputBg, borderColor, textColor, "hover:bg-slate-200 dark:hover:bg-slate-700")}
                          >
                            <Download className="w-5 h-5 text-slate-400" />
                            <div className="text-left">
                              <p className="text-sm font-bold">Export History</p>
                              <p className="text-[11px] text-slate-500">Download results as JSON</p>
                            </div>
                          </button>

                          <button 
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to reset your daily usage? This is for testing purposes.')) {
                                setIsResetting(true);
                                await onResetUsage();
                                setIsResetting(false);
                                setResetSuccess(true);
                                setTimeout(() => setResetSuccess(false), 3000);
                              }
                            }}
                            disabled={isResetting}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border shadow-sm hover:shadow-md",
                              inputBg, borderColor, textColor, 
                              "hover:bg-rose-500/10 hover:border-rose-500/30",
                              isResetting && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <RefreshCw className={cn("w-5 h-5 text-slate-400", isResetting && "animate-spin")} />
                            <div className="text-left">
                              <p className={cn("text-sm font-bold", resetSuccess ? "text-emerald-500" : "")}>
                                {resetSuccess ? "Usage Reset!" : "Reset Usage"}
                              </p>
                              <p className="text-[11px] text-slate-500">Reset your daily MCQ quota</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AuthScreen = ({ onLogin, isDark, accentColor }: { onLogin: (user: any) => void, isDark: boolean, accentColor: string }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const body = isLogin 
        ? { username, password } 
        : { username, password, fullName, email };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLogin(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const bgColor = isDark ? "bg-slate-950" : "bg-slate-50";
  const cardBg = isDark ? "bg-slate-900/50" : "bg-white";
  const borderColor = isDark ? "border-slate-800" : "border-slate-200";
  const textColor = isDark ? "text-white" : "text-slate-900";
  const subTextColor = isDark ? "text-slate-400" : "text-slate-500";
  const inputBg = isDark ? "bg-slate-800" : "bg-slate-50";

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4", bgColor)}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl backdrop-blur-xl", cardBg, borderColor)}
      >
        <div className="text-center mb-8">
          <div className={cn("w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg", `bg-${accentColor}-500`)}>
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h2 className={cn("text-3xl font-bold tracking-tight", textColor)}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className={cn("mt-2", subTextColor)}>
            {isLogin ? 'Log in to access your quizzes' : 'Join the modern learning platform'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className={cn("block text-sm font-medium mb-1.5 ml-1", subTextColor)}>Full Name</label>
                <input 
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={cn("w-full px-5 py-3.5 rounded-2xl border focus:outline-none focus:ring-2 transition-all", inputBg, borderColor, textColor, `focus:ring-${accentColor}-500`)}
                  placeholder="Milind Kshirsagar"
                />
              </div>
              <div>
                <label className={cn("block text-sm font-medium mb-1.5 ml-1", subTextColor)}>Email Address</label>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn("w-full px-5 py-3.5 rounded-2xl border focus:outline-none focus:ring-2 transition-all", inputBg, borderColor, textColor, `focus:ring-${accentColor}-500`)}
                  placeholder="milind@example.com"
                />
              </div>
            </>
          )}

          <div>
            <label className={cn("block text-sm font-medium mb-1.5 ml-1", subTextColor)}>Username</label>
            <input 
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn("w-full px-5 py-3.5 rounded-2xl border focus:outline-none focus:ring-2 transition-all", inputBg, borderColor, textColor, `focus:ring-${accentColor}-500`)}
              placeholder="milindk"
            />
          </div>

          <div>
            <label className={cn("block text-sm font-medium mb-1.5 ml-1", subTextColor)}>Password</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn("w-full px-5 py-3.5 rounded-2xl border focus:outline-none focus:ring-2 transition-all", inputBg, borderColor, textColor, `focus:ring-${accentColor}-500`)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 mt-4",
              `bg-${accentColor}-500 text-white hover:bg-${accentColor}-600 shadow-${accentColor}-500/20`
            )}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className={cn("text-sm font-medium hover:underline", `text-${accentColor}-500`)}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DEFAULT_USER = {
  username: 'guest',
  email: 'guest@example.com',
  full_name: 'Guest User',
  bio: 'Welcome to Quiz Learner!',
  api_key: '',
  tier: 'pro' as const,
  daily_usage: 0,
  id: 'guest-id'
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const savedUser = localStorage.getItem('user_info');
    return savedUser ? 'landing' : 'auth';
  });
  const [analysis, setAnalysis] = useState<{ topics: string[], level: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string, email: string, full_name?: string, bio?: string, api_key: string, tier: 'free' | 'pro', daily_usage: number } | null>(
    localStorage.getItem('user_info') ? JSON.parse(localStorage.getItem('user_info')!) : DEFAULT_USER
  );
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') !== 'light');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accent_color') || 'indigo');
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notifications') === 'true');
  const [defaultQuizSize, setDefaultQuizSize] = useState(Number(localStorage.getItem('default_quiz_size')) || 10);
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [quizType, setQuizType] = useState<'study' | 'exam'>('study');
  const [historySearch, setHistorySearch] = useState('');
  const [fullText, setFullText] = useState<string>('');
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<MCQ[]>([]);
  const [quizMode, setQuizMode] = useState<number | 'all'>(10);
  const [currentRound, setCurrentRound] = useState(0);
  const [ROUND_SIZE, setRoundSize] = useState(10);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationType, setExplanationType] = useState<'short' | 'detailed'>('short');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [userApiKey, setUserApiKey] = useState(() => {
    const saved = localStorage.getItem('user_gemini_api_key') || '';
    if (saved.startsWith('smk_')) {
      localStorage.removeItem('user_gemini_api_key');
      return '';
    }
    return saved;
  });
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<any[] | null>(null);
  const [fullTextPages, setFullTextPages] = useState<string[]>([]);
  const [parsingMode, setParsingMode] = useState<'start' | 'question' | 'page'>('start');
  const [parsingValue, setParsingValue] = useState('');
  const [parsingStartIndex, setParsingStartIndex] = useState('1');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const textColor = isDarkMode ? "text-white" : "text-slate-900";
  const subTextColor = isDarkMode ? "text-slate-400" : "text-slate-500";

  useEffect(() => {
    const syncUser = async () => {
      if (currentUser && currentUser.username !== 'guest') {
        try {
          const res = await fetch(`/api/me?username=${encodeURIComponent(currentUser.username)}&clientDate=${encodeURIComponent(getLocalDateString())}`);
          if (!res.ok) {
            console.warn(`User sync failed with status: ${res.status}`);
            return;
          }
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn(`User sync received non-JSON response: ${contentType}`);
            return;
          }
          const data = await res.json();
          const updatedUser = { ...currentUser, ...data };
          setCurrentUser(updatedUser);
          localStorage.setItem('user_info', JSON.stringify(updatedUser));
        } catch (err: any) {
          const errorMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          console.error("Failed to sync user info", errorMsg);
        }
      }
    };
    syncUser();
    // Only run on mount to sync existing session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    if (paymentStatus === 'success') {
      const isMock = params.get('mock') === 'true';
      // Refresh user info to get the new tier
      if (currentUser) {
        // For mock payments, we manually update the tier in the DB for the session
        if (isMock) {
          fetch('/api/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
          }).then(res => res.json()).then(data => {
            if (data.success) {
              const updatedUser = { ...currentUser, tier: 'pro' as const };
              setCurrentUser(updatedUser);
              localStorage.setItem('user_info', JSON.stringify(updatedUser));
            }
          });
        } else {
          // Real payment: refresh from DB
          const updatedUser = { ...currentUser, tier: 'pro' as const };
          setCurrentUser(updatedUser);
          localStorage.setItem('user_info', JSON.stringify(updatedUser));
        }
      }
      setError(isMock 
        ? 'Demo Mode: Mock payment successful! Your account has been upgraded to Pro.' 
        : 'Payment successful! Your account has been upgraded to Pro.');
      // Clear the URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancel') {
      setError('Payment cancelled. You can try again whenever you\'re ready.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [currentUser]);

  const handleUpgrade = async () => {
    if (!currentUser) return;
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1499 })
      });
      const order = await res.json();
      
      if (order.isMock) {
        // Handle mock payment
        const verifyRes = await fetch('/api/verify-razorpay-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            isMock: true,
            username: currentUser.username
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          setCurrentUser({...currentUser, tier: 'pro'});
          setState('landing');
          alert("Successfully upgraded to Pro!");
        }
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "SMKTech Quiz Learner",
        description: "Pro Subscription",
        order_id: order.id,
        handler: async function (response: any) {
          const verifyRes = await fetch('/api/verify-razorpay-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              username: currentUser.username
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setCurrentUser({...currentUser, tier: 'pro'});
            setState('landing');
            alert("Successfully upgraded to Pro!");
          } else {
            setError("Payment verification failed.");
          }
        },
        prefill: {
          name: currentUser.full_name || currentUser.username,
          email: currentUser.email,
        },
        theme: {
          color: "#6366f1",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Upgrade failed:", err.message || err);
      setError("An error occurred. Please try again later.");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetUsage = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/usage/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...currentUser, daily_usage: 0 };
        setCurrentUser(updatedUser);
        localStorage.setItem('user_info', JSON.stringify(updatedUser));
      }
    } catch (err: any) {
      console.error("Failed to reset usage", err.message || err);
    }
  };

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    localStorage.setItem('user_info', JSON.stringify(user));
    localStorage.setItem('isLoggedIn', 'true');
    setState('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user_info');
    setCurrentUser(DEFAULT_USER);
    setState('auth');
    setShowSettings(false);
  };

  const exportHistory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "quiz_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadCurrentReport = () => {
    const totalTime = Math.floor((endTime - startTime) / 1000);
    const attempted = userAnswers.filter(a => a !== null).length;
    const correct = userAnswers.filter((a, i) => a === selectedQuestions[i].correctAnswerIndex).length;
    const accuracy = Math.round((correct / selectedQuestions.length) * 100);
    
    const reportData = {
      user: currentUser?.username,
      date: new Date().toLocaleString(),
      accuracy: `${accuracy}%`,
      correctAnswers: correct,
      totalQuestions: selectedQuestions.length,
      timeTaken: formatTime(totalTime),
      questions: selectedQuestions.map((q, i) => ({
        question: q.question,
        yourAnswer: q.options[userAnswers[i] as number] || "Not Answered",
        correctAnswer: q.options[q.correctAnswerIndex],
        isCorrect: userAnswers[i] === q.correctAnswerIndex,
        explanation: q.shortExplanation
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `quiz_report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const updateAccentColor = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('accent_color', color);
  };

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem('notifications', String(newVal));
  };

  const updateDefaultQuizSize = (size: number) => {
    setDefaultQuizSize(size);
    localStorage.setItem('default_quiz_size', String(size));
  };

  const saveApiKey = (key: string) => {
    localStorage.setItem('user_gemini_api_key', key);
    setUserApiKey(key);
    setShowSettings(false);
  };

  useEffect(() => {
    if (state === 'landing' && currentUser) {
      fetchHistory();
    }
  }, [state, currentUser]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchHistory = async () => {
    try {
      const url = currentUser?.username 
        ? `/api/results?username=${encodeURIComponent(currentUser.username)}`
        : '/api/results';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Received non-JSON response from server');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        console.warn("History data is not an array:", data);
        setHistory([]);
      }
    } catch (err: any) {
      console.error("Error fetching history:", err.message || err);
      setHistory([]);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!currentUser) return;
    const file = acceptedFiles[0];
    if (!file || file.type !== 'application/pdf') {
      setError("Please upload a valid PDF file.");
      return;
    }

    setState('processing');
    setError(null);
    setAnalysis(null);

    try {
      const pages = await extractTextFromPDF(file);
      setFullTextPages(pages);
      setFullText(pages.join('\n'));
      setState('parsing_config');
    } catch (err: any) {
      setError(err.message || "An error occurred during processing.");
      setState('landing');
    }
  };

  const startGeneration = async () => {
    if (!currentUser) return;
    
    setState('processing');
    setError(null);
    setAnalysis(null);

    try {
      const result = await generateMCQsFromConceptText(fullTextPages, ROUND_SIZE, {
        mode: parsingMode,
        value: parsingValue,
        startIndex: parseInt(parsingStartIndex) || 1
      });
      setQuestions(result.questions);
      setAnalysis(result.analysis);
      
      setState('mode_selection');
    } catch (err: any) {
      setError(err.message || "An error occurred during processing.");
      setState('parsing_config');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false 
  });

  const nextRound = async () => {
    if (!currentUser) return;
    setError(null);
    
    const baseStart = parseInt(parsingStartIndex) || 1;
    const nextStart = baseStart + (currentRound + 1) * ROUND_SIZE;
    
    // Check if we already have these questions in the list
    if (questions.length < nextStart + ROUND_SIZE - 1) {
      setIsGeneratingMore(true);
      try {
        let textToProcess = fullText;
        if (parsingMode === 'page') {
          const pageNum = parseInt(parsingValue || "1");
          if (!isNaN(pageNum) && pageNum > 0 && pageNum <= fullTextPages.length) {
            textToProcess = fullTextPages.slice(pageNum - 1).join("\n");
          }
        }

        const nextBatch = await generateMCQsFromText(textToProcess, nextStart, ROUND_SIZE, baseStart);
        if (nextBatch.length > 0) {
          const updatedQuestions = [...questions, ...nextBatch];
          setQuestions(updatedQuestions);
          // Start the quiz with the new batch
          startQuiz('all', currentRound + 1, updatedQuestions);
        } else {
          setError("No more questions could be generated from this document.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to generate more questions.");
      } finally {
        setIsGeneratingMore(false);
      }
    } else {
      startQuiz('all', currentRound + 1);
    }
  };

  const startQuiz = async (mode: number | 'all', roundIndex: number = 0, overrideQuestions?: MCQ[]) => {
    if (!currentUser) return;
    
    setQuizMode(mode);
    setCurrentRound(roundIndex);
    
    let q = overrideQuestions ? [...overrideQuestions] : [...questions];
    
    // Sequential vs Random logic
    if (quizType === 'exam') {
      // Exam Mode: Randomly shuffle questions
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      
      if (mode !== 'all') {
        // Take N random questions from the shuffled pool
        q = q.slice(0, mode);
      } else {
        // Take the current round's slice from the shuffled pool
        q = q.slice(roundIndex * ROUND_SIZE, (roundIndex + 1) * ROUND_SIZE);
      }
    } else {
      // Practice Mode: Strictly sequential (as per document order)
      if (mode !== 'all') {
        // Take the first N questions in order
        q = q.slice(0, mode);
      } else {
        // Take the current round's questions in exact order
        q = q.slice(roundIndex * ROUND_SIZE, (roundIndex + 1) * ROUND_SIZE);
      }
    }
    
    setSelectedQuestions(q);
    setUserAnswers(new Array(q.length).fill(null));
    setCurrentQuestionIndex(0);
    setStartTime(Date.now());
    setState('quiz');
  };

  const handleAnswer = (optionIndex: number) => {
    if (userAnswers[currentQuestionIndex] !== null) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setUserAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < selectedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowExplanation(false);
      setExplanationType('short');
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setShowExplanation(false);
      setExplanationType('short');
    }
  };

  const finishQuiz = async () => {
    try {
      const end = Date.now();
      setEndTime(end);
      
      const totalTime = Math.floor((end - startTime) / 1000);
      const attempted = userAnswers.filter(a => a !== null).length;
      const correct = userAnswers.filter((a, i) => a === selectedQuestions[i].correctAnswerIndex).length;
      const wrong = attempted - correct;
      const accuracy = selectedQuestions.length > 0 ? (correct / selectedQuestions.length) * 100 : 0;
      const avgTime = selectedQuestions.length > 0 ? totalTime / selectedQuestions.length : 0;

      const detailedReport = quizType === 'exam' ? selectedQuestions.map((q, i) => ({
        question: q.question,
        userAnswer: userAnswers[i],
        correctAnswer: q.correctAnswerIndex,
        options: q.options,
        explanation: q.detailedExplanation
      })) : undefined;

      const result: QuizResult = {
        totalQuestions: selectedQuestions.length,
        attempted,
        correct,
        wrong,
        accuracy,
        totalTime,
        avgTimePerQuestion: avgTime,
        performanceSummary: getPerformanceSummary(accuracy),
        topics: analysis?.topics,
        level: analysis?.level,
        detailedReport,
        username: currentUser?.username
      };

      setState('results');

      // Save to DB
      console.log("Saving quiz result to DB:", result);
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to save result to server:", res.status, errorData);
      } else {
        const data = await res.json();
        console.log("Successfully saved result with ID:", data.id);
      }
      
      // Refresh history to update dashboard stats
      console.log("Refreshing history...");
      await fetchHistory().catch(e => console.error("Failed to fetch history", e.message || e));
    } catch (err: any) {
      console.error("Error finishing quiz:", err.message || err);
      setState('results');
    }
  };

  const getPerformanceSummary = (accuracy: number) => {
    if (accuracy >= 90) return "Outstanding! You have a deep understanding of the material.";
    if (accuracy >= 75) return "Great job! You've mastered most of the concepts.";
    if (accuracy >= 50) return "Good effort. A bit more review will help you solidify your knowledge.";
    return "Keep practicing. Review the explanations to improve your understanding.";
  };

  // --- Render Helpers ---

  const renderTierSelection = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full max-w-4xl grid md:grid-cols-2 gap-8 p-4",
        )}
      >
        {/* Free Tier */}
        <div className={cn(
          "border rounded-3xl p-8 flex flex-col shadow-xl transition-all hover:shadow-2xl",
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="mb-6">
            <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-500 text-xs font-bold uppercase tracking-wider">Current Plan</span>
            <h3 className={cn("text-3xl font-bold mt-4", isDarkMode ? "text-white" : "text-slate-900")}>Free Learner</h3>
            <p className={cn("mt-2", isDarkMode ? "text-slate-400" : "text-slate-600")}>Perfect for casual self-study.</p>
          </div>
          
          <div className="text-4xl font-bold mb-8">₹0<span className="text-sm font-normal text-slate-500">/month</span></div>
          
          <ul className="space-y-4 mb-10 flex-1">
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-emerald-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>200 MCQs per day</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-emerald-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Basic explanations</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-emerald-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Ads supported</span>
            </li>
          </ul>
          
          <button 
            onClick={() => setState('landing')}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border shadow-sm",
              isDarkMode ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            Continue with Free
          </button>
        </div>

        {/* Pro Tier */}
        <div className={cn(
          "border rounded-3xl p-8 flex flex-col shadow-2xl relative overflow-hidden transition-all hover:shadow-indigo-500/10",
          isDarkMode ? "bg-slate-900 border-indigo-500/30" : "bg-white border-indigo-200"
        )}>
          <div className="absolute top-0 right-0 bg-indigo-500 text-white px-6 py-1 rounded-bl-2xl text-xs font-bold uppercase tracking-widest">Recommended</div>
          
          <div className="mb-6">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold uppercase tracking-wider">Power User</span>
            <h3 className={cn("text-3xl font-bold mt-4", isDarkMode ? "text-white" : "text-slate-900")}>Pro Scholar</h3>
            <p className={cn("mt-2", isDarkMode ? "text-slate-400" : "text-slate-600")}>For serious exam preparation.</p>
          </div>
          
          <div className="text-4xl font-bold mb-8">₹1,499<span className="text-sm font-normal text-slate-500">/month</span></div>
          
          <ul className="space-y-4 mb-10 flex-1">
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-indigo-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>2,000 MCQs per day</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-indigo-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Detailed AI explanations</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-indigo-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Zero Ads</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="w-5 h-5 text-indigo-500" />
              <span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>Priority generation</span>
            </li>
          </ul>
          
          <button 
            onClick={handleUpgrade}
            disabled={isForgotLoading}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2",
              isForgotLoading ? "bg-indigo-500/50 text-white" : "bg-indigo-500 text-white hover:bg-indigo-600"
            )}
          >
            {isForgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Upgrade to Pro'}
          </button>
        </div>
      </motion.div>
    </div>
  );

  const renderLanding = () => {
    const totalQuizzes = Array.isArray(history) ? history.length : 0;
    const avgAccuracy = (Array.isArray(history) && history.length > 0)
      ? (history.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / history.length).toFixed(1)
      : 0;
    const totalQuestions = Array.isArray(history) ? history.reduce((acc, curr) => acc + (curr.total_questions || 0), 0) : 0;

    const getGreetingInfo = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return { text: "Good morning", icon: Sun };
      if (hour >= 12 && hour < 17) return { text: "Good afternoon", icon: SunMedium };
      if (hour >= 17 && hour < 21) return { text: "Good evening", icon: Sunset };
      return { text: "Good night", icon: Moon };
    };

    const greeting = getGreetingInfo();

    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <greeting.icon className={cn("w-4 h-4", `text-${accentColor}-500`)} />
              <span className={cn("text-xs font-bold uppercase tracking-widest", isDarkMode ? "text-slate-500" : "text-slate-400")}>
                {greeting.text}
              </span>
            </div>
            <h1 className={cn("text-4xl md:text-5xl font-bold mb-3 tracking-tight", isDarkMode ? "text-white" : "text-slate-900")}>
              Welcome back, <span className={cn("font-extrabold drop-shadow-sm", `text-${accentColor}-500`)} style={{ textShadow: isDarkMode ? `0 0 20px var(--tw-shadow-color)` : 'none' }}>{currentUser?.username || 'Learner'}</span>!
            </h1>
            <p className={cn("text-lg", isDarkMode ? "text-slate-400" : "text-slate-600")}>What would you like to master today?</p>
          </motion.div>

          <div className="flex gap-4">
            <button 
              onClick={() => { fetchHistory(); setState('history'); }}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-medium",
                isDarkMode 
                  ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" 
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-900 shadow-sm"
              )}
            >
              <History className="w-5 h-5" />
              History
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Quizzes Taken', value: totalQuizzes, icon: FileText, color: 'indigo' },
            { label: 'Avg. Accuracy', value: `${avgAccuracy}%`, icon: CheckCircle2, color: 'emerald' },
            { label: 'Total Questions', value: totalQuestions, icon: Brain, color: 'purple' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "p-6 rounded-[2rem] border backdrop-blur-xl flex items-center gap-5",
                isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              )}
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", `bg-${stat.color}-500/20 text-${stat.color}-500`)}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div>
                <p className={cn("text-sm font-medium", isDarkMode ? "text-slate-500" : "text-slate-400")}>{stat.label}</p>
                <p className={cn("text-2xl font-bold", isDarkMode ? "text-white" : "text-slate-900")}>{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Usage & Ads Section */}
        <div className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={cn(
            "lg:col-span-1 p-6 rounded-[2rem] border flex flex-col justify-between",
            isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn("font-bold text-sm uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-400")}>Daily Usage Limit</h3>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-tighter",
                  currentUser?.tier === 'pro' ? "text-amber-500 bg-amber-500/10" : "text-blue-500 bg-blue-500/10"
                )}>
                  {currentUser?.tier === 'pro' ? 'Pro Tier' : 'Free Tier'}
                </span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className={cn("text-3xl font-bold", isDarkMode ? "text-white" : "text-slate-900")}>
                  {currentUser?.daily_usage || 0}
                  <span className="text-slate-500 text-xl font-normal mx-1">/</span>
                  <span className="text-slate-500 text-xl font-normal">
                    {currentUser?.tier === 'pro' ? 500 : 50}
                  </span>
                </span>
                <span className="text-slate-500 text-sm mb-1">Questions</span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Limit Resets Daily</span>
            </div>
          </div>

          <div className={cn(
            "lg:col-span-2 p-6 rounded-[2rem] border flex items-center justify-center relative overflow-hidden group cursor-pointer",
            isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200 shadow-sm"
          )}>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-center relative z-10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Sponsored Advertisement</p>
              <h4 className={cn("text-xl font-bold mb-1", isDarkMode ? "text-slate-300" : "text-slate-700")}>Master Your Exams with SMKTech Pro</h4>
              <p className="text-sm text-slate-500">Get unlimited access, detailed explanations, and zero ads.</p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] hover:bg-indigo-600">
                Learn More <ExternalLink className="w-3 h-3" />
              </div>
            </div>
            <div className="absolute top-2 right-4 text-[8px] font-bold text-slate-500 uppercase">Ad</div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn("text-3xl font-bold", isDarkMode ? "text-white" : "text-slate-900")}>New Learning Session</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Questions to generate:</span>
              <div className={cn(
                "flex p-1 rounded-xl border",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              )}>
                {[10, 25, 50].map((num) => (
                  <button
                    key={num}
                    onClick={() => setRoundSize(num)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      ROUND_SIZE === num 
                        ? "bg-indigo-500 text-white shadow-sm" 
                        : isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div 
            {...getRootProps()} 
            className={cn(
              "relative group cursor-pointer p-12 rounded-3xl border-2 border-dashed transition-all duration-300 min-h-[300px] flex flex-col items-center justify-center",
              isDragActive 
                ? `border-${accentColor}-500 bg-${accentColor}-500/10 scale-105` 
                : isDarkMode 
                  ? "border-slate-700 hover:border-indigo-500 hover:bg-white/5" 
                  : "border-slate-300 hover:border-indigo-500 hover:bg-slate-50"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center">
              <div className={cn("w-20 h-20 mb-6 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", `bg-${accentColor}-500/20`)}>
                <Upload className={cn("w-10 h-10", `text-${accentColor}-500`)} />
              </div>
              <p className={cn("text-lg font-medium", isDarkMode ? "text-slate-200" : "text-slate-800")}>
                {isDragActive ? "Drop your PDF here" : "Drag & drop PDF or click to browse"}
              </p>
              <p className={cn("text-sm mt-2 text-center", isDarkMode ? "text-slate-500" : "text-slate-400")}>Supports PDF files up to 20MB. AI will analyze and generate custom questions.</p>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500"
            >
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  const renderParsingConfig = () => (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "p-8 rounded-[2.5rem] border shadow-2xl",
          isDarkMode ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
        )}
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h2 className={cn("text-2xl font-bold", textColor)}>Parsing Configuration</h2>
            <p className={cn("text-sm", subTextColor)}>Choose how you want to extract questions</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'start', label: 'Parse from Starting', icon: Play },
              { id: 'question', label: 'Specified Index', icon: Hash },
              { id: 'page', label: 'From Page Number', icon: FileText }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setParsingMode(option.id as any)}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all duration-200",
                  parsingMode === option.id 
                    ? "border-indigo-500 bg-indigo-500/10 scale-105 shadow-lg shadow-indigo-500/10" 
                    : isDarkMode ? "border-slate-800 hover:border-slate-700 bg-slate-800/30" : "border-slate-100 hover:border-slate-200 bg-slate-50"
                )}
              >
                <option.icon className={cn("w-6 h-6", parsingMode === option.id ? "text-indigo-500" : subTextColor)} />
                <span className={cn("text-sm font-bold", parsingMode === option.id ? textColor : subTextColor)}>{option.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {parsingMode !== 'start' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={cn("block text-sm font-medium", subTextColor)}>
                      {parsingMode === 'question' ? 'Starting Question Number' : 'Page Number'}
                    </label>
                    <input 
                      type="text"
                      value={parsingValue}
                      onChange={(e) => {
                        setParsingValue(e.target.value);
                        if (parsingMode === 'question') {
                          setParsingStartIndex(e.target.value);
                        }
                      }}
                      placeholder={parsingMode === 'question' ? 'e.g. 45' : 'e.g. 12'}
                      className={cn(
                        "w-full px-6 py-4 rounded-2xl border-2 focus:outline-none focus:ring-4 transition-all text-lg font-medium",
                        isDarkMode 
                          ? "bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20 focus:border-indigo-500" 
                          : "bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500"
                      )}
                    />
                  </div>
                  
                  {parsingMode === 'page' && (
                    <div className="space-y-2">
                      <label className={cn("block text-sm font-medium", subTextColor)}>
                        Starting Question Index
                      </label>
                      <input 
                        type="text"
                        value={parsingStartIndex}
                        onChange={(e) => setParsingStartIndex(e.target.value)}
                        placeholder="e.g. 1"
                        className={cn(
                          "w-full px-6 py-4 rounded-2xl border-2 focus:outline-none focus:ring-4 transition-all text-lg font-medium",
                          isDarkMode 
                            ? "bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20 focus:border-indigo-500" 
                            : "bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500"
                        )}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => setState('landing')}
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                isDarkMode ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Cancel
            </button>
            <button 
              onClick={startGeneration}
              className={cn(
                "flex-[2] py-4 rounded-2xl font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-xl",
                `bg-${accentColor}-500 hover:bg-${accentColor}-600 shadow-${accentColor}-500/20`
              )}
            >
              Start Generating MCQs
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="relative">
        <div className={cn("w-32 h-32 rounded-full border-4 animate-spin", isDarkMode ? "border-indigo-500/20 border-t-indigo-500" : "border-indigo-100 border-t-indigo-500")} />
        <Brain className={cn("w-12 h-12 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse", `text-${accentColor}-500`)} />
      </div>
      <h2 className={cn("text-2xl font-bold mt-8", isDarkMode ? "text-white" : "text-slate-900")}>
        AI is analyzing your document...
      </h2>
      <p className={cn("mt-2", isDarkMode ? "text-slate-400" : "text-slate-600")}>
        Extracting key concepts and generating custom questions for you.
      </p>
    </div>
  );

  const renderModeSelection = () => (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h2 className={cn("text-4xl font-bold mb-4", isDarkMode ? "text-white" : "text-slate-900")}>Configure Your Session</h2>
        <p className={cn("text-lg", isDarkMode ? "text-slate-400" : "text-slate-600")}>Select your preferred learning style and length</p>
      </div>

      {analysis && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-12 p-8 rounded-[2rem] border",
            isDarkMode ? "bg-indigo-500/5 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"
          )}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className={cn("font-bold text-lg", isDarkMode ? "text-white" : "text-slate-900")}>AI Content Analysis</h3>
              <p className="text-sm text-slate-500">Main 2: Concept-based Generation</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Identified Topics</p>
              <div className="flex flex-wrap gap-2">
                {analysis.topics.map((topic, i) => (
                  <span key={i} className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium",
                    isDarkMode ? "bg-slate-800 text-slate-300" : "bg-white text-slate-600 border border-slate-200"
                  )}>
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Educational Level</p>
              <span className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold",
                isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-500 text-white"
              )}>
                <Trophy className="w-4 h-4" />
                {analysis.level}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className={cn("p-8 rounded-[2rem] border", isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={cn("text-xl font-bold flex items-center gap-2", isDarkMode ? "text-white" : "text-slate-900")}>
              <LayoutDashboard className={cn("w-5 h-5", `text-${accentColor}-500`)} />
              Quiz Mode
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Remaining</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold",
                isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
              )}>
                {Math.max(0, (currentUser?.tier === 'pro' ? 500 : 50) - (currentUser?.daily_usage || 0))} Left
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { id: 'study', title: 'Practice Mode', desc: 'Instant feedback & explanations', icon: Info },
              { id: 'exam', title: 'Exam Mode', desc: 'Results only at the very end', icon: Shield }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setQuizType(type.id as any)}
                className={cn(
                  "p-4 rounded-2xl border flex items-center gap-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-left",
                  quizType === type.id 
                    ? `bg-${accentColor}-500 border-${accentColor}-500 text-white shadow-lg shadow-${accentColor}-500/20` 
                    : isDarkMode 
                      ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", quizType === type.id ? "bg-white/20" : isDarkMode ? "bg-slate-700" : "bg-slate-200")}>
                  <type.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">{type.title}</p>
                  <p className="text-xs opacity-70">{type.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={cn("p-8 rounded-[2rem] border", isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <h3 className={cn("text-xl font-bold mb-6 flex items-center gap-2", isDarkMode ? "text-white" : "text-slate-900")}>
            <Timer className={cn("w-5 h-5", `text-${accentColor}-500`)} />
            Quiz Length
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 10, title: 'Quick Sprint', desc: `${Math.min(10, questions.length)} Questions`, icon: Timer, color: 'from-blue-500 to-cyan-500' },
              { id: 20, title: 'Deep Dive', desc: `${Math.min(20, questions.length)} Questions`, icon: Brain, color: 'from-indigo-500 to-purple-500' },
              { id: 'all', title: 'Mastery', desc: `All ${questions.length} Questions`, icon: Trophy, color: 'from-orange-500 to-pink-500' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => startQuiz(mode.id as any)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden shadow-sm hover:shadow-md",
                  isDarkMode ? "bg-slate-800 border-slate-700 hover:border-indigo-500" : "bg-slate-50 border-slate-200 hover:border-indigo-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br", mode.color)}>
                      <mode.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className={cn("font-bold", isDarkMode ? "text-white" : "text-slate-900")}>{mode.title}</p>
                      <p className="text-xs text-slate-500">{mode.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-5 h-5 transition-colors", isDarkMode ? "text-slate-600 group-hover:text-white" : "text-slate-400 group-hover:text-slate-900")} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button 
          onClick={() => setState('landing')}
          className={cn(
            "px-8 py-4 rounded-2xl font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-sm hover:shadow-md",
            isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
          )}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  const stripQuestionNumber = (text: string) => {
    return text.replace(/^(?:Q|Question\s*)?\d+[\.\:\-\s]+/, '').trim();
  };

  const renderQuiz = () => {
    const q = selectedQuestions[currentQuestionIndex];
    const userAnswer = userAnswers[currentQuestionIndex];
    const isAnswered = userAnswer !== null;
    const answeredCount = userAnswers.filter(a => a !== null).length;
    const progress = selectedQuestions.length > 0 ? (answeredCount / selectedQuestions.length) * 100 : 0;

    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isDarkMode ? "bg-indigo-500/20" : "bg-indigo-100")}>
              <span className="text-indigo-500 font-bold">
                {quizMode === 'all' ? currentRound * ROUND_SIZE + currentQuestionIndex + 1 : currentQuestionIndex + 1}
              </span>
            </div>
            <div>
              <h3 className={cn("text-sm font-medium uppercase tracking-wider", isDarkMode ? "text-slate-400" : "text-slate-500")}>Question</h3>
              <p className={cn("font-bold", isDarkMode ? "text-white" : "text-slate-900")}>
                {quizMode === 'all' ? currentRound * ROUND_SIZE + currentQuestionIndex + 1 : currentQuestionIndex + 1} of {quizMode === 'all' ? questions.length : selectedQuestions.length}
              </p>
            </div>
          </div>

          <button 
            onClick={() => finishQuiz()}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] border shadow-lg",
              isDarkMode 
                ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white shadow-red-500/10" 
                : "bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border-red-200 shadow-red-500/5"
            )}
          >
            End Quiz
          </button>

          <div className="text-right">
            <h3 className={cn("text-sm font-medium uppercase tracking-wider", isDarkMode ? "text-slate-400" : "text-slate-500")}>Progress</h3>
            <div className={cn("w-48 h-3 rounded-full mt-2 overflow-hidden border relative", isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200")}>
              <motion.div 
                className={cn("h-full absolute left-0 top-0", `bg-${accentColor}-500`)}
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{Math.round(progress)}% Complete</p>
          </div>
        </div>

        {/* Question Card */}
        <motion.div 
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "border rounded-3xl p-8 shadow-2xl",
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}
        >
          <h2 className={cn("text-2xl font-bold mb-8 leading-relaxed", isDarkMode ? "text-white" : "text-slate-900")}>
            {stripQuestionNumber(q.question)}
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {q.options.map((option, idx) => {
              const isCorrect = idx === q.correctAnswerIndex;
              const isSelected = userAnswer === idx;
              
              let buttonClass = "p-6 rounded-2xl border-2 text-left transition-all duration-200 flex items-center justify-between group hover:scale-[1.01] active:scale-[0.99]";
              
              if (!isAnswered) {
                buttonClass += isDarkMode 
                  ? " border-slate-800 hover:border-indigo-500 hover:bg-indigo-500/5 text-slate-300" 
                  : " border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700";
              } else if (quizType === 'exam') {
                if (isSelected) {
                  buttonClass += ` border-${accentColor}-500 bg-${accentColor}-500/10 text-${accentColor}-500`;
                } else {
                  buttonClass += isDarkMode ? " border-slate-800 opacity-50 text-slate-500" : " border-slate-100 opacity-50 text-slate-400";
                }
              } else if (isCorrect) {
                buttonClass += " border-emerald-500 bg-emerald-500/10 text-emerald-600";
              } else if (isSelected && !isCorrect) {
                buttonClass += " border-red-500 bg-red-500/10 text-red-600";
              } else {
                buttonClass += isDarkMode ? " border-slate-800 opacity-50 text-slate-500" : " border-slate-100 opacity-50 text-slate-400";
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswered}
                  onClick={() => handleAnswer(idx)}
                  className={buttonClass}
                >
                  <span className="font-medium">{option}</span>
                  {isAnswered && quizType === 'study' && isCorrect && <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-500" />}
                  {isAnswered && quizType === 'study' && isSelected && !isCorrect && <XCircle className="w-6 h-6 shrink-0 text-red-500" />}
                  {isAnswered && quizType === 'exam' && isSelected && <CheckCircle2 className={cn("w-6 h-6 shrink-0", `text-${accentColor}-500`)} />}
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 mt-8">
            {currentQuestionIndex > 0 && (
              <button 
                onClick={prevQuestion}
                className={cn(
                  "flex-1 py-4 font-bold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2",
                  isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>
            )}
            
            {!isAnswered ? (
              <button 
                onClick={nextQuestion}
                className={cn(
                  "flex-1 py-4 font-bold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2",
                  isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                Skip
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={nextQuestion}
                className={cn(
                  "flex-1 py-4 text-white font-bold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20",
                  `bg-${accentColor}-500 hover:bg-${accentColor}-600`
                )}
              >
                {currentQuestionIndex === selectedQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isAnswered && quizType === 'study' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={cn("mt-8 pt-8 border-t", isDarkMode ? "border-slate-800" : "border-slate-100")}
              >
                {!showExplanation ? (
                  <button 
                    onClick={() => setShowExplanation(true)}
                    className={cn("flex items-center gap-2 transition-colors font-medium", `text-${accentColor}-500 hover:text-${accentColor}-600`)}
                  >
                    <Info className="w-5 h-5" />
                    <span>Explain this answer</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                      <button 
                        onClick={() => setExplanationType('short')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          explanationType === 'short' 
                            ? `bg-${accentColor}-500 text-white` 
                            : isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        Short
                      </button>
                      <button 
                        onClick={() => setExplanationType('detailed')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          explanationType === 'detailed' 
                            ? `bg-${accentColor}-500 text-white` 
                            : isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        Detailed
                      </button>
                      <button 
                        onClick={() => setShowExplanation(false)}
                        className="ml-auto text-slate-500 hover:text-slate-700 text-sm"
                      >
                        Hide
                      </button>
                    </div>
                    
                    <div className={cn(
                      "p-6 rounded-2xl border leading-relaxed",
                      isDarkMode ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                    )}>
                      {explanationType === 'short' ? (
                        <p>{q.shortExplanation}</p>
                      ) : (
                        <div className={cn("prose max-w-none", isDarkMode ? "prose-invert" : "prose-slate")}>
                          <Markdown>{q.detailedExplanation}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  };

  const renderResults = () => {
    const totalTime = Math.floor((endTime - startTime) / 1000);
    const attempted = userAnswers.filter(a => a !== null).length;
    const correct = userAnswers.filter((a, i) => a === selectedQuestions[i].correctAnswerIndex).length;
    const wrong = attempted - correct;
    const accuracy = Math.round((correct / selectedQuestions.length) * 100);
    const avgTime = Math.round(totalTime / selectedQuestions.length);

    const pieData = [
      { name: 'Correct', value: correct, color: '#10b981' },
      { name: 'Wrong', value: wrong, color: '#ef4444' },
      { name: 'Unattempted', value: selectedQuestions.length - attempted, color: '#64748b' }
    ];

    const barData = [
      { name: 'Accuracy', value: accuracy },
      { name: 'Attempted', value: (attempted / selectedQuestions.length) * 100 }
    ];

    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6"
          >
            <Trophy className="w-12 h-12 text-indigo-500" />
          </motion.div>
          <h2 className={cn("text-4xl font-bold mb-4", isDarkMode ? "text-white" : "text-slate-900")}>Quiz Completed!</h2>
          <p className={cn("text-xl max-w-2xl mx-auto", isDarkMode ? "text-slate-400" : "text-slate-600")}>{getPerformanceSummary(accuracy)}</p>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center gap-3 text-red-400 max-w-md mx-auto"
            >
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats Grid */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Score', value: `${correct}/${selectedQuestions.length}`, icon: CheckCircle2, color: 'text-emerald-500' },
              { label: 'Accuracy', value: `${accuracy}%`, icon: BarChart3, color: 'text-indigo-500' },
              { label: 'Total Time', value: formatTime(totalTime), icon: Timer, color: 'text-orange-500' },
              { label: 'Avg Speed', value: `${avgTime}s/q`, icon: Timer, color: 'text-purple-500' }
            ].map((stat, i) => (
              <div key={i} className={cn(
                "p-6 rounded-3xl border",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              )}>
                <stat.icon className={cn("w-6 h-6 mb-4", stat.color)} />
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">{stat.label}</p>
                <p className={cn("text-2xl font-bold", isDarkMode ? "text-white" : "text-slate-900")}>{stat.value}</p>
              </div>
            ))}

            {/* Charts */}
            <div className={cn(
              "col-span-2 p-8 rounded-3xl border min-h-[300px]",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
              <h3 className={cn("text-lg font-bold mb-6", isDarkMode ? "text-white" : "text-slate-900")}>Performance Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" stroke={isDarkMode ? "#64748b" : "#94a3b8"} />
                    <YAxis stroke={isDarkMode ? "#64748b" : "#94a3b8"} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                        border: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                        borderRadius: '12px',
                        color: isDarkMode ? '#f8fafc' : '#0f172a'
                      }}
                      itemStyle={{ color: isDarkMode ? '#fff' : '#0f172a' }}
                    />
                    <Bar dataKey="value" fill={isDarkMode ? "#6366f1" : "#4f46e5"} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={cn(
              "col-span-2 p-8 rounded-3xl border min-h-[300px]",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
              <h3 className={cn("text-lg font-bold mb-6", isDarkMode ? "text-white" : "text-slate-900")}>Answer Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                        border: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                        borderRadius: '12px',
                        color: isDarkMode ? '#f8fafc' : '#0f172a'
                      }}
                      itemStyle={{ color: isDarkMode ? '#fff' : '#0f172a' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Report for Exam Mode */}
          {quizType === 'exam' && (
            <div className="lg:col-span-3 mt-8">
              <div className={cn(
                "p-8 rounded-3xl border",
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center justify-between mb-8">
                  <h3 className={cn("text-xl font-bold", isDarkMode ? "text-white" : "text-slate-900")}>Detailed Test Report</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs text-slate-500 font-medium">Correct</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-xs text-slate-500 font-medium">Incorrect</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedQuestions.map((q, idx) => {
                    const userAnswer = userAnswers[idx];
                    const isCorrect = userAnswer === q.correctAnswerIndex;
                    
                    return (
                      <div key={idx} className={cn(
                        "p-6 rounded-2xl border transition-all",
                        isCorrect 
                          ? (isDarkMode ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100")
                          : (userAnswer === null 
                              ? (isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200")
                              : (isDarkMode ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100"))
                      )}>
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                            isCorrect ? "bg-emerald-500 text-white" : (userAnswer === null ? "bg-slate-500 text-white" : "bg-red-500 text-white")
                          )}>
                            <span className="text-sm font-bold">{idx + 1}</span>
                          </div>
                          <div className="flex-1">
                            <p className={cn("text-lg font-medium mb-4", isDarkMode ? "text-white" : "text-slate-900")}>
                              {stripQuestionNumber(q.question)}
                            </p>
                            
                            <div className="grid md:grid-cols-2 gap-3 mb-4">
                              {q.options.map((opt, optIdx) => {
                                const isUserChoice = userAnswer === optIdx;
                                const isCorrectChoice = q.correctAnswerIndex === optIdx;
                                
                                return (
                                  <div key={optIdx} className={cn(
                                    "p-3 rounded-xl border text-sm flex items-center justify-between",
                                    isCorrectChoice 
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                      : isUserChoice 
                                        ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-bold"
                                        : (isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-600")
                                  )}>
                                    <span>{opt}</span>
                                    {isCorrectChoice && <Check className="w-4 h-4" />}
                                    {isUserChoice && !isCorrectChoice && <X className="w-4 h-4" />}
                                  </div>
                                );
                              })}
                            </div>

                            <div className={cn(
                              "p-4 rounded-xl text-sm",
                              isDarkMode ? "bg-slate-800/50 text-slate-400" : "bg-slate-100 text-slate-600"
                            )}>
                              <p className="font-bold mb-1 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Explanation
                              </p>
                              <Markdown>{q.detailedExplanation}</Markdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4">
            {quizMode === 'all' && (
              <button 
                onClick={nextRound}
                disabled={isGeneratingMore}
                className={cn(
                  "w-full py-4 text-white font-bold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20",
                  isGeneratingMore ? "bg-emerald-500/50" : "bg-emerald-500 hover:bg-emerald-600"
                )}
              >
                {isGeneratingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Next Round...
                  </>
                ) : (
                  <>
                    Next Round (Questions {(currentRound + 1) * ROUND_SIZE + 1} - {(currentRound + 2) * ROUND_SIZE})
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
            <button 
              onClick={() => setState('landing')}
              className={cn(
                "w-full py-4 text-white font-bold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20",
                `bg-${accentColor}-500 hover:bg-${accentColor}-600`
              )}
            >
              Take Another Quiz
            </button>
            <button 
              onClick={downloadCurrentReport}
              className={cn(
                "w-full py-4 font-bold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm",
                isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <Download className="w-5 h-5" />
              Download Results
            </button>
            <button 
              onClick={() => { fetchHistory(); setState('history'); }}
              className={cn(
                "w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border",
                isDarkMode ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
              )}
            >
              View History
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const filteredHistory = history.filter(item => 
      item.accuracy.toString().includes(historySearch) || 
      new Date(item.created_at).toLocaleDateString().includes(historySearch) ||
      (item.level && item.level.toLowerCase().includes(historySearch.toLowerCase()))
    );

    const chartData = [...history].reverse().map((item, i) => ({
      name: `Quiz ${i + 1}`,
      accuracy: item.accuracy
    }));

    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className={cn("text-3xl font-bold mb-2", isDarkMode ? "text-white" : "text-slate-900")}>Quiz History</h2>
            <p className={cn("text-slate-400", isDarkMode ? "text-slate-400" : "text-slate-500")}>Track your progress over time</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input 
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className={cn(
                  "w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2",
                  isDarkMode 
                    ? "bg-slate-900 border-slate-800 text-white focus:ring-indigo-500" 
                    : "bg-white border-slate-200 text-slate-900 focus:ring-indigo-400"
                )}
              />
              <LayoutDashboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>
            <button 
              onClick={() => setState('landing')} 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-medium shadow-sm hover:shadow-md",
                isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>
        </div>

        {Array.isArray(history) && history.length > 1 && (
          <div className={cn(
            "mb-12 p-8 rounded-[2rem] border",
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <h3 className={cn("text-lg font-bold mb-6", isDarkMode ? "text-white" : "text-slate-900")}>Performance Trend</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                      borderRadius: '12px',
                      color: isDarkMode ? '#f8fafc' : '#1e293b'
                    }}
                  />
                  <Bar dataKey="accuracy" fill={accentColor === 'indigo' ? '#6366f1' : '#10b981'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          {filteredHistory.length === 0 ? (
            <div className={cn(
              "text-center py-20 rounded-3xl border",
              isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <History className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No quiz history matches your search.</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const topics = item.topics ? (typeof item.topics === 'string' ? JSON.parse(item.topics) : item.topics) : [];
              return (
                <div key={item.id} className={cn(
                  "p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between group transition-all border gap-4",
                  isDarkMode 
                    ? "bg-slate-900 border-slate-800 hover:border-indigo-500/50" 
                    : "bg-white border-slate-200 shadow-sm hover:border-indigo-400"
                )}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className={cn("font-bold text-lg", isDarkMode ? "text-white" : "text-slate-900")}>{item.accuracy}% Accuracy</p>
                      {item.accuracy >= 80 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {item.level && (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                        )}>
                          {item.level}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mb-3">{new Date(item.created_at).toLocaleDateString()} • {item.total_questions} Questions</p>
                    {topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {topics.slice(0, 3).map((t: string, i: number) => (
                          <span key={i} className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-medium",
                            isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
                          )}>
                            {t}
                          </span>
                        ))}
                        {topics.length > 3 && <span className="text-[10px] text-slate-500">+{topics.length - 3} more</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right shrink-0">
                      <p className={cn("font-medium", isDarkMode ? "text-indigo-400" : "text-indigo-600")}>{item.correct}/{item.total_questions} Correct</p>
                      <p className="text-slate-500 text-xs">{formatTime(item.total_time)} total</p>
                    </div>
                    {item.detailed_report && (
                      <button 
                        onClick={() => {
                          const report = typeof item.detailed_report === 'string' ? JSON.parse(item.detailed_report) : item.detailed_report;
                          setSelectedHistoryReport(report);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                        title="View Detailed Report"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detailed Report Modal for History */}
        <AnimatePresence>
          {selectedHistoryReport && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedHistoryReport(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={cn(
                  "relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col",
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <div className={cn("p-6 border-b flex items-center justify-between", isDarkMode ? "border-slate-800" : "border-slate-100")}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className={cn("text-xl font-bold", isDarkMode ? "text-white" : "text-slate-900")}>Detailed Test Report</h3>
                      <p className="text-xs text-slate-500">Review your answers and explanations</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedHistoryReport(null)}
                    className={cn("p-2 rounded-full transition-all", isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {selectedHistoryReport.map((q, idx) => {
                    const isCorrect = q.userAnswer === q.correctAnswer;
                    return (
                      <div key={idx} className={cn(
                        "p-6 rounded-2xl border transition-all",
                        isCorrect 
                          ? (isDarkMode ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100")
                          : (q.userAnswer === null 
                              ? (isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200")
                              : (isDarkMode ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100"))
                      )}>
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                            isCorrect ? "bg-emerald-500 text-white" : (q.userAnswer === null ? "bg-slate-500 text-white" : "bg-red-500 text-white")
                          )}>
                            <span className="text-sm font-bold">{idx + 1}</span>
                          </div>
                          <div className="flex-1">
                            <p className={cn("text-lg font-medium mb-4", isDarkMode ? "text-white" : "text-slate-900")}>
                              {stripQuestionNumber(q.question)}
                            </p>
                            
                            <div className="grid md:grid-cols-2 gap-3 mb-4">
                              {q.options.map((opt: string, optIdx: number) => {
                                const isUserChoice = q.userAnswer === optIdx;
                                const isCorrectChoice = q.correctAnswer === optIdx;
                                
                                return (
                                  <div key={optIdx} className={cn(
                                    "p-3 rounded-xl border text-sm flex items-center justify-between",
                                    isCorrectChoice 
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                      : isUserChoice 
                                        ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-bold"
                                        : (isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-600")
                                  )}>
                                    <span>{opt}</span>
                                    {isCorrectChoice && <Check className="w-4 h-4" />}
                                    {isUserChoice && !isCorrectChoice && <X className="w-4 h-4" />}
                                  </div>
                                );
                              })}
                            </div>

                            <div className={cn(
                              "p-4 rounded-xl text-sm",
                              isDarkMode ? "bg-slate-800/50 text-slate-400" : "bg-slate-100 text-slate-600"
                            )}>
                              <p className="font-bold mb-1 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Explanation
                              </p>
                              <Markdown>{q.explanation || q.detailedExplanation}</Markdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500",
      isDarkMode ? "bg-slate-950 text-white" : "bg-white text-slate-900"
    )}>
      {/* Navbar */}
      <nav className={cn(
        "border-b backdrop-blur-xl sticky top-0 z-50",
        isDarkMode ? "border-white/10" : "border-slate-200 bg-white/80"
      )}>
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setState('landing')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Quiz Learner</span>
          </div>

          <div className="flex items-center gap-4">
            <SettingsButton onClick={() => setShowSettings(true)} />
            <ThemeToggle isDark={isDarkMode} toggle={() => setIsDarkMode(!isDarkMode)} />
            {state !== 'auth' && (
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-medium text-sm",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 hover:bg-white/10 text-red-400 hover:text-red-300" 
                    : "bg-white border-slate-200 hover:bg-slate-50 text-red-500 hover:text-red-600 shadow-sm"
                )}
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        currentKey={userApiKey}
        onSave={saveApiKey}
        onLogout={handleLogout}
        user={currentUser}
        isDark={isDarkMode}
        accentColor={accentColor}
        notifications={notificationsEnabled}
        onToggleNotifications={toggleNotifications}
        exportData={exportHistory}
        onUpgrade={() => { setShowSettings(false); setState('tier_selection'); }}
        history={history}
        onUpdateAccentColor={updateAccentColor}
        onResetUsage={handleResetUsage}
      />

      {/* Main Content */}
      <main className="relative">
        {/* Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {state === 'auth' && <AuthScreen onLogin={handleLogin} isDark={isDarkMode} accentColor={accentColor} />}
            {state === 'tier_selection' && renderTierSelection()}
            {state === 'landing' && renderLanding()}
            {state === 'parsing_config' && renderParsingConfig()}
            {state === 'processing' && renderProcessing()}
            {state === 'mode_selection' && renderModeSelection()}
            {state === 'quiz' && renderQuiz()}
            {state === 'results' && renderResults()}
            {state === 'history' && renderHistory()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      {state === 'landing' && (
        <footer className="py-12 border-t border-white/5 mt-20">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-500 text-sm">
              powered by SMKTech . build for modern learners
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
