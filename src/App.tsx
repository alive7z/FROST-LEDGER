import React, { useState, useEffect, useRef } from "react";
// Icons removed for extreme minimalist simplicity

// Types corresponding to server.ts definitions
interface SensorReading {
  timestamp: string;
  ambient_temp: number;
  fridge_temp: number;
  humidity: number;
  compressor_status: number;
  power_stability: number;
  door_open: number;
  is_anomaly?: boolean;
  original_temp?: number | null;
}

interface LedgerBlock {
  index: number;
  timestamp: string;
  prev_hash: string;
  data: {
    ambient_temp: number;
    fridge_temp: number;
    humidity: number;
    compressor_status: number;
    power_stability: number;
    door_open: number;
  };
  block_hash: string;
}

interface PredictionData {
  predicted_temp: number;
  breach_predicted: boolean;
  breach_type: string;
  confidence: number;
  current_trend: "RISING" | "FALLING" | "STABLE";
}

interface IntegrityData {
  is_valid: boolean;
  error_index: number;
  message: string;
  tampered_count?: number;
  tampered_indices?: number[];
}

export default function App() {
  // Theme and Authorization States
  const [isWhiteTheme, setIsWhiteTheme] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem("frost_ledger_authorized") === "true";
  });
  const [authEmail, setAuthEmail] = useState<string>(() => {
    return localStorage.getItem("frost_ledger_email") || "";
  });
  const [inputEmail, setInputEmail] = useState<string>("");
  const [inputPasscode, setInputPasscode] = useState<string>("");
  const [inputPassword, setInputPassword] = useState<string>("");
  const [authMode, setAuthMode] = useState<"PASSCODE" | "CREDENTIALS">("CREDENTIALS");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [dbConfig, setDbConfig] = useState<{ usingMongoDB: boolean; message: string }>({
    usingMongoDB: false,
    message: "Verifying credentials database link..."
  });
  const [registeredUsers, setRegisteredUsers] = useState<Array<{ email: string; createdAt: string }>>([]);

  // Dynamic Enterprise Color Class Dictionary
  const monoTheme = {
    bg: isWhiteTheme ? "bg-[#F8FAFC] text-slate-900" : "bg-[#0F172A] text-slate-100",
    headerBg: isWhiteTheme ? "bg-[#F8FAFC]/95 border-b border-slate-200" : "bg-[#0F172A]/95 border-b border-slate-800",
    cardBg: isWhiteTheme ? "bg-white border border-slate-200 text-slate-900 shadow-sm" : "bg-[#1E293B]/50 border border-slate-800 text-slate-100",
    cardHover: isWhiteTheme ? "hover:border-slate-400 hover:bg-slate-50/50" : "hover:border-slate-700 hover:bg-[#1E293B]/80",
    sectionBg: isWhiteTheme ? "bg-slate-50 border border-slate-200" : "bg-[#1E293B]/60 border border-slate-800",
    sectionInnerBg: isWhiteTheme ? "bg-white border border-slate-200" : "bg-[#0F172A] border border-slate-850",
    textMuted: isWhiteTheme ? "text-slate-500" : "text-slate-400",
    textSubtle: isWhiteTheme ? "text-slate-400" : "text-slate-500",
    textTitle: isWhiteTheme ? "text-slate-900" : "text-slate-50",
    border: isWhiteTheme ? "border-slate-200" : "border-slate-800",
    borderStrong: isWhiteTheme ? "border-slate-300" : "border-slate-700",
    input: isWhiteTheme ? "bg-white border border-slate-300 text-slate-900 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]" : "bg-[#0F172A] border border-slate-800 text-slate-100 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]",
    buttonPrimary: "bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold shadow-sm",
    buttonSecondary: isWhiteTheme ? "bg-white border border-slate-200 hover:bg-slate-100 text-slate-800" : "bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-200",
    tabActive: "bg-[#2563EB] text-white shadow-sm",
    tabInactive: isWhiteTheme ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800",
    // Enterprise color scheme matching user request:
    textAccent: "text-[#0D9488] font-bold", // Clinical Teal
    textAccentMuted: isWhiteTheme ? "text-teal-700" : "text-teal-400",
    borderAccent: "border-[#0D9488]",
    bgAccent: "bg-[#0D9488] text-white",
    badgeSafe: "bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-bold", // Emerald Green
    badgeWarning: "bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] font-bold", // Amber
    badgeError: "bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] font-bold", // Coral Red
    badgeInfo: "bg-[#2563EB]/15 border border-[#2563EB]/30 text-[#2563EB] font-bold", // Blue
    glowBar: "bg-[#2563EB]", // Primary action brand color
  };

  const fetchAuthConfig = async () => {
    try {
      const response = await fetch("/api/auth/config");
      const data = await response.json();
      setDbConfig({
        usingMongoDB: data.usingMongoDB,
        message: data.message
      });
    } catch (error) {
      console.error("Failed to fetch auth database config.", error);
    }
  };

  const fetchRegisteredUsers = async () => {
    try {
      const response = await fetch("/api/auth/users");
      const data = await response.json();
      if (data.success) {
        setRegisteredUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch registered user log.", error);
    }
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!inputEmail.trim()) {
      setAuthError("Email address is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inputEmail.trim())) {
      setAuthError("Please enter a valid email address (e.g., user@domain.com).");
      return;
    }

    if (authMode === "PASSCODE") {
      if (!inputPasscode.trim()) {
        setAuthError("Access Passcode is required. (Hint: Enter standard code 'HLTH505')");
        return;
      }
      if (inputPasscode.trim().toUpperCase() !== "HLTH505" && inputPasscode.trim().toUpperCase() !== "FROST2026") {
        setAuthError("Incorrect system passcode. Security lockout protocol active.");
        return;
      }

      setAuthLoading(true);
      setTimeout(() => {
        setAuthLoading(false);
        setIsAuthorized(true);
        setAuthEmail(inputEmail.trim());
        localStorage.setItem("frost_ledger_authorized", "true");
        localStorage.setItem("frost_ledger_email", inputEmail.trim());
      }, 1200);
    } else {
      // In-Memory Secure Credentials Mode
      const pass = inputPassword.trim();
      if (!pass) {
        setAuthError("Password is required.");
        return;
      }
      if (pass.length < 6) {
        setAuthError("Password must be at least 6 characters.");
        return;
      }

      setAuthLoading(true);
      try {
        const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inputEmail.trim(),
            password: pass
          })
        });

        const data = await response.json();
        setAuthLoading(false);

        if (!response.ok || !data.success) {
          setAuthError(data.error || "Authentication failed.");
          return;
        }

        if (isRegistering) {
          setIsRegistering(false);
          setInputPassword("");
          setAuthError(null);
          // Let's reload users
          fetchRegisteredUsers();
          // Provide visual feedback
          alert(data.message || "Account successfully created! You can now log in.");
        } else {
          setIsAuthorized(true);
          setAuthEmail(data.email);
          localStorage.setItem("frost_ledger_authorized", "true");
          localStorage.setItem("frost_ledger_email", data.email);
        }
      } catch (err) {
        setAuthLoading(false);
        setAuthError("Failed to connect to the backend server. Please try again.");
      }
    }
  };

  const handleDeauthorize = () => {
    setIsAuthorized(false);
    setAuthEmail("");
    localStorage.removeItem("frost_ledger_authorized");
    localStorage.removeItem("frost_ledger_email");
    setInputEmail("");
    setInputPasscode("");
    setInputPassword("");
  };

  // State
  const [activeScenario, setActiveScenario] = useState<string>("NORMAL");
  const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([]);
  const [prediction, setPrediction] = useState<PredictionData>({
    predicted_temp: 4.0,
    breach_predicted: false,
    breach_type: "NONE",
    confidence: 0.95,
    current_trend: "STABLE",
  });
  const [integrity, setIntegrity] = useState<IntegrityData>({
    is_valid: true,
    error_index: -1,
    message: "Initializing audit checks...",
  });
  const [recentBlocks, setRecentBlocks] = useState<LedgerBlock[]>([]);
  const [ledgerLength, setLedgerLength] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "architecture" | "python-code">("dashboard");
  const [pythonCodeTab, setPythonCodeTab] = useState<"all" | "predictor" | "glitch" | "ledger">("all");
  
  // Simulation Loop Control
  const [isLiveTicking, setIsLiveTicking] = useState<boolean>(true);
  const [stepLoading, setStepLoading] = useState<boolean>(false);
  const [tamperingBlockIndex, setTamperingBlockIndex] = useState<number>(-1);
  const [tamperingValue, setTamperingValue] = useState<string>("12.5");
  const [latestGlitchLog, setLatestGlitchLog] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    status: "idle" | "verifying" | "success" | "compromised";
    message: string;
  }>({ status: "idle", message: "" });
  const [tamperAlertModal, setTamperAlertModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    tamperedList: string;
    count: number;
  } | null>(null);

  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current simulation state
  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/status");
      const data = await response.json();
      if (data.status === "ok") {
        setActiveScenario(data.activeScenario);
        setSensorHistory(data.sensorHistory);
        setPrediction(data.prediction);
        setIntegrity(data.integrity);
        setRecentBlocks(data.recentBlocks);
        setLedgerLength(data.ledgerLength);
      }
    } catch (error) {
      console.error("Failed to retrieve system status.", error);
    }
  };

  // Step simulation forward
  const stepSimulation = async () => {
    setStepLoading(true);
    try {
      const response = await fetch("/api/step", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        // Trigger alert if glitch was detected and repaired
        if (data.newReading.is_anomaly) {
          setLatestGlitchLog(
            `Anomaly Suppressed at ${new Date(data.newReading.timestamp).toLocaleTimeString()}: Raw reading of ${data.newReading.original_temp}°C was automatically intercepted and repaired to ${data.newReading.fridge_temp}°C by the digital filter.`
          );
        }
        
        // Refresh values
        setPrediction(data.prediction);
        setIntegrity(data.integrity);
        
        // Update arrays locally or refetch
        fetchStatus();
      }
    } catch (error) {
      console.error("Failed to cycle simulation step.", error);
    } finally {
      setStepLoading(false);
    }
  };

  // Set scenario (Normal, Door Open, Power Out)
  const handleSetScenario = async (scenario: string) => {
    try {
      const response = await fetch("/api/set-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await response.json();
      if (data.success) {
        setActiveScenario(data.activeScenario);
        fetchStatus();
      }
    } catch (error) {
      console.error("Failed to change simulation scenario.", error);
    }
  };

  // Inject a bad reading (Phase 2)
  const handleInjectGlitch = async () => {
    try {
      const response = await fetch("/api/inject-glitch", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setLatestGlitchLog("Glitch pre-staged! The next sensor packet will register a hardware dropout spike (-45.0°C). Watch the filter handle it!");
      }
    } catch (error) {
      console.error("Failed to stage anomaly injection.", error);
    }
  };

  // Trigger cyber tamper attack (Phase 3)
  const handleTamperLedger = async (idx?: number) => {
    const targetIdx = idx !== undefined ? idx : recentBlocks[recentBlocks.length - 5]?.index;
    if (targetIdx === undefined || targetIdx < 0) return;

    try {
      const response = await fetch("/api/tamper-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockIndex: targetIdx,
          tamperedTemp: parseFloat(tamperingValue)
        }),
      });
      const data = await response.json();
      if (data.success) {
        setIntegrity(data.integrity);
        const tamperedList = data.integrity.tampered_indices && data.integrity.tampered_indices.length > 0
          ? data.integrity.tampered_indices.map((idx: number) => `#${idx}`).join(", ")
          : `#${data.integrity.error_index}`;
        const count = data.integrity.tampered_count || 1;
        setVerificationStatus({
          status: "compromised",
          message: `⚠ Compromised! Tampered block(s): ${tamperedList} (${count} total)`
        });
        
        // Show the beautiful modal alert
        setTamperAlertModal({
          show: true,
          title: "🚨 Database Tampering Detected!",
          message: `A retroactive database alteration attack was executed on Block #${targetIdx}. The cryptographic validation chain immediately flagged the violation.`,
          tamperedList: tamperedList,
          count: count
        });

        // Try standard browser alert too
        try {
          window.alert(`⚠ ALERT: Database Tampering Detected!\n\nRetroactive alteration was executed on Block #${targetIdx}.\nCompromised block(s): ${tamperedList}\nTotal tampered records: ${count}`);
        } catch (e) {
          console.log("Iframe alert restrictions", e);
        }

        fetchStatus();
      }
    } catch (error) {
      console.error("Failed to inject tamper attack.", error);
    }
  };

  // Reset entire system state
  const handleReset = async () => {
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setActiveScenario(data.activeScenario);
        setSensorHistory(data.sensorHistory);
        setPrediction(data.prediction);
        setIntegrity(data.integrity);
        setLatestGlitchLog(null);
        setTamperingBlockIndex(-1);
        setVerificationStatus({ status: "idle", message: "" });
        fetchStatus();
      }
    } catch (error) {
      console.error("Failed to reset core system.", error);
    }
  };

  // Automated loop simulation (Live ticking)
  useEffect(() => {
    fetchStatus();
    fetchAuthConfig();
    fetchRegisteredUsers();
  }, [isAuthorized]);

  useEffect(() => {
    if (isLiveTicking) {
      tickIntervalRef.current = setInterval(() => {
        stepSimulation();
      }, 3500); // Step every 3.5 seconds
    } else {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    }
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [isLiveTicking]);

  // SVG Chart Dimensions & Computations
  const getChartDataPoints = () => {
    if (sensorHistory.length === 0) return "";
    const minVal = -2.0;
    const maxVal = 18.0;
    const range = maxVal - minVal;
    
    return sensorHistory.map((d, index) => {
      const x = (index / (sensorHistory.length - 1)) * 100; // percent width
      const y = 100 - ((d.fridge_temp - minVal) / range) * 100; // percent height (inverted)
      return `${x},${y}`;
    }).join(" ");
  };

  const getAmbientDataPoints = () => {
    if (sensorHistory.length === 0) return "";
    const minVal = -2.0;
    const maxVal = 18.0;
    const range = maxVal - minVal;
    
    return sensorHistory.map((d, index) => {
      const x = (index / (sensorHistory.length - 1)) * 100;
      // Map ambient temps which range ~18 to 30. We'll clip it or map it beautifully
      // To keep standard relative bounds, let's just render standard ambient curves
      const tempVal = d.ambient_temp;
      const y = 100 - ((tempVal - minVal) / range) * 100;
      return `${x},${y}`;
    }).join(" ");
  };

  const currentReading = sensorHistory[sensorHistory.length - 1];

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center font-sans antialiased bg-[#F8FAFC] text-slate-900 p-4">
        {/* Center Card */}
        <div className="w-full max-w-md border rounded-2xl p-6 md:p-8 bg-white border-slate-200 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold tracking-tight">System Authorization Gate</h2>
            <p className="text-xs mt-1.5 text-slate-500">
              Establish cryptographic session. Register or sign-in with credentials.
            </p>
          </div>

          <form onSubmit={handleAuthorize} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-bold tracking-wider uppercase mb-1.5 text-slate-500">
                Account Email Address
              </label>
              <input
                type="email"
                placeholder="e.g., user@domain.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                disabled={authLoading}
                className="w-full px-3.5 py-2 text-xs font-mono rounded-lg outline-none transition-all bg-white border border-slate-300 text-slate-900 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500">
                  Account Password
                </label>
                <span className="text-[9px] font-mono text-slate-500">Min 6 characters</span>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                disabled={authLoading}
                className="w-full px-3.5 py-2 text-xs font-mono rounded-lg outline-none transition-all bg-white border border-slate-300 text-slate-900 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-lg border text-xs font-mono bg-red-500/5 text-red-500 border-red-500/20">
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white disabled:opacity-50"
            >
              {authLoading ? (
                "NEGOTIATING SECURE SESSION..."
              ) : isRegistering ? (
                "CREATE SECURE ACCOUNT & STORE"
              ) : (
                "SIGN IN & VERIFY CREDENTIALS"
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError(null);
                }}
                className="text-[10px] font-mono uppercase tracking-wider underline hover:opacity-80 transition-all text-slate-600"
              >
                {isRegistering ? "Already have an account? Sign In" : "Need a new account? Register"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased selection:bg-neutral-500 selection:text-white transition-colors duration-300 ${monoTheme.bg}`}>

      {/* Primary Container */}
      <header className={`backdrop-blur-md sticky top-0 z-40 transition-colors duration-300 ${monoTheme.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold ${isWhiteTheme ? "bg-neutral-100 border-neutral-300 text-neutral-800" : "bg-neutral-900 border-neutral-800 text-neutral-100"}`} id="app_logo_icon">
              FROST
            </div>
            <div>
              <h1 className={`text-sm md:text-lg font-bold tracking-tight ${isWhiteTheme ? "text-neutral-900" : "text-neutral-50"}`} id="app_title_text">
                Frost Ledger Vaccine Temperature Predictor
              </h1>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-4">

            {/* Logged in Email & De-authorize Control */}
            <div className={`flex items-center gap-2 text-xs font-mono pl-3 border-l ${isWhiteTheme ? "border-neutral-200 text-neutral-600" : "border-neutral-800 text-neutral-400"}`}>
              <span className="truncate max-w-37.5 hidden md:inline">{authEmail}</span>
              <button
                onClick={handleDeauthorize}
                className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#EF4444] text-white hover:bg-red-700 transition-colors"
                title="Logout from Security Gateway"
              >
                LOG OUT
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Banner Alarm - Ledger Breach Detected (Highest Severity) */}
        {!integrity.is_valid && (
          <div className={`mb-6 p-4 border rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in ${
            isWhiteTheme ? "bg-neutral-950 border-neutral-900 text-white" : "bg-white border-white text-black"
          }`} id="tamper_alert_banner">
            <div className="flex items-start gap-3">
              <div className={`px-2 py-1 rounded text-xs font-mono font-bold mt-0.5 md:mt-0 ${
                isWhiteTheme ? "bg-white/10 text-white" : "bg-black/10 text-black"
              }`}>
                [ALERT]
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Ledger Integrity Failure Detected!</h3>
                <p className="text-xs mt-1 max-w-2xl font-mono leading-relaxed opacity-90">
                  {integrity.message}
                </p>
                <p className="text-[11px] mt-1 opacity-75">
                  The SHA-256 validation chain detected a total of <span className="font-bold">{integrity.tampered_count || (integrity.tampered_indices?.length || 1)} tampered database records</span>. Exact tampered block(s): <span className="font-bold underline text-red-500">{integrity.tampered_indices && integrity.tampered_indices.length > 0 ? integrity.tampered_indices.map(i => `#${i}`).join(", ") : `#${integrity.error_index}`}</span> (mismatch starts at Block #{integrity.error_index}).
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors self-end md:self-center ${
                isWhiteTheme ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"
              }`}
            >
              Re-Genesis & Recalculate
            </button>
          </div>
        )}

        {/* Tab 1: Dashboard Console */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* Row 1: System Telemetry Board */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="telemetry_cards_grid">
              
              {/* Card 1: Internal Temperature */}
              <div className={`${monoTheme.cardBg} ${monoTheme.cardHover} p-4 flex flex-col justify-between rounded-xl transition-colors`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium tracking-wide ${monoTheme.textMuted}`}>Internal Temperature</span>
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    currentReading && (currentReading.fridge_temp > 8.0 || currentReading.fridge_temp < 2.0)
                      ? monoTheme.badgeError
                      : monoTheme.badgeSafe
                  }`}>
                    TEMP
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-extrabold tracking-tight font-mono ${monoTheme.textTitle}`} id="current_fridge_temp_value">
                      {currentReading ? currentReading.fridge_temp.toFixed(1) : "--.-"}
                    </span>
                    <span className={`text-sm font-medium ${monoTheme.textMuted}`}>°C</span>
                  </div>
                  {/* Min/Max limits labels */}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded border ${
                      isWhiteTheme ? "bg-neutral-150 border-neutral-250 text-neutral-600" : "bg-neutral-900 border-neutral-800 text-neutral-400"
                    }`}>SAFE LIMIT: 2.0°C - 8.0°C</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={monoTheme.textMuted}>Thermostat Loop</span>
                  <span className={`font-mono font-semibold ${
                    currentReading && currentReading.compressor_status ? monoTheme.textAccent : monoTheme.textSubtle
                  }`}>
                    {currentReading && currentReading.compressor_status ? "COOLING (COMPRESSOR ON)" : "STANDBY (COMPRESSOR OFF)"}
                  </span>
                </div>
              </div>

              {/* Card 2: 2h Future Predictor */}
              <div className={`${monoTheme.cardBg} ${monoTheme.cardHover} ${
                prediction.breach_predicted ? "border-2 " + monoTheme.borderStrong : ""
              } p-4 flex flex-col justify-between rounded-xl transition-colors`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium tracking-wide ${monoTheme.textMuted}`}>2-Hour Forecast (ML)</span>
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    prediction.breach_predicted ? monoTheme.badgeWarning : monoTheme.badgeSafe
                  }`}>
                    MODEL
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight font-mono text-black" id="predicted_temp_value">
                      {prediction.predicted_temp.toFixed(1)}
                    </span>
                    <span className={`text-sm font-medium ${monoTheme.textMuted}`}>°C</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                    <span className={monoTheme.textSubtle}>CONFIDENCE:</span>
                    <span className={`font-bold px-1 py-0.5 rounded ${
                      isWhiteTheme ? "bg-neutral-200 text-neutral-900" : "bg-neutral-900 text-neutral-100"
                    }`}>{(prediction.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={monoTheme.textMuted}>Trajectory</span>
                  <span className={`font-mono font-semibold flex items-center gap-1 ${
                    prediction.current_trend !== "STABLE" ? monoTheme.textAccent : monoTheme.textSubtle
                  }`}>
                    {prediction.current_trend === "RISING" ? "▲ RISING FAST" : prediction.current_trend === "FALLING" ? "▼ COOLING FAST" : "● THERMALLY STABLE"}
                  </span>
                </div>
              </div>

              {/* Card 3: Cryptographic Chain Integrity */}
              <div className={`${monoTheme.cardBg} ${monoTheme.cardHover} ${
                !integrity.is_valid ? "border-2 " + monoTheme.borderStrong : ""
              } p-4 flex flex-col justify-between rounded-xl transition-colors`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium tracking-wide ${monoTheme.textMuted}`}>Ledger Integrity Audits</span>
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    !integrity.is_valid ? monoTheme.badgeError : monoTheme.badgeSafe
                  }`}>
                    {integrity.is_valid ? "SECURE" : "TAMPERED"}
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-extrabold tracking-tight font-mono ${
                      integrity.is_valid ? monoTheme.textTitle : monoTheme.textAccent + " line-through"
                    }`} id="ledger_integrity_status_text">
                      {integrity.is_valid ? "SECURE" : "TAMPERED!"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                    <span className={monoTheme.textSubtle}>CHAIN SIZE:</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                      isWhiteTheme ? "bg-neutral-200 text-neutral-900" : "bg-neutral-900 text-neutral-100"
                    }`}>{ledgerLength} BLOCKS</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                    <span className={monoTheme.textSubtle}>AUDIT:</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                      integrity.is_valid
                        ? (isWhiteTheme ? "bg-emerald-50 text-emerald-700" : "bg-emerald-950/40 text-emerald-400")
                        : (isWhiteTheme ? "bg-red-50 text-red-700 font-bold" : "bg-red-950/40 text-red-400 font-bold")
                    }`}>
                      {integrity.is_valid ? "0 TAMPERED RECORDS" : `${integrity.tampered_count || 1} TAMPERED BLOCK(S)`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={monoTheme.textMuted}>Sequential Chain</span>
                  <span className={`${monoTheme.textSubtle} font-mono text-[10px]`}>SHA-256 HASH CHAIN</span>
                </div>
              </div>

              {/* Card 4: Streaming Filter State */}
              <div className={`${monoTheme.cardBg} ${monoTheme.cardHover} p-4 flex flex-col justify-between rounded-xl transition-colors`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium tracking-wide ${monoTheme.textMuted}`}>Hardware Noise Filter</span>
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${monoTheme.badgeInfo}`}>
                    FILTER
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-extrabold tracking-tight font-mono ${monoTheme.textTitle}`}>
                      ACTIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                    <span className={monoTheme.textSubtle}>LATENCY:</span>
                    <span className={`font-bold px-1 py-0.5 rounded ${
                      isWhiteTheme ? "bg-neutral-200 text-neutral-900" : "bg-neutral-900 text-neutral-100"
                    }`}>&lt; 0.2ms (1GB Max)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={monoTheme.textMuted}>Streaming Mode</span>
                  <span className={`${monoTheme.textAccent} font-mono text-[10px]`}>GLITCH AUTO-SUPPRESS</span>
                </div>
              </div>

            </div>

            {/* Row 2: Live Simulator Scenario Control Center & Proactive Alert Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main Simulation controls (LHS 5 cols) */}
              <div className={`lg:col-span-5 ${monoTheme.cardBg} rounded-xl p-5`} id="simulation_control_panel">
                <div className={`flex items-center justify-between mb-4 pb-2 border-b ${monoTheme.border}`}>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-bold tracking-wide uppercase ${monoTheme.textTitle}`}>IoT Simulation Cockpit</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLiveTicking ? "bg-neutral-500" : "bg-neutral-300"}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveTicking ? (isWhiteTheme ? "bg-neutral-900" : "bg-white") : "bg-neutral-500"}`}></span>
                    </span>
                    <span className={`text-[10px] font-mono ${monoTheme.textSubtle}`}>{isLiveTicking ? "LIVE TICKING" : "PAUSED"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Live ticks control */}
                  <div className={`${monoTheme.sectionBg} p-3 rounded-lg flex items-center justify-between`}>
                    <div>
                      <h4 className={`text-xs font-semibold ${monoTheme.textTitle}`}>Continuous Data Ingestion</h4>
                      <p className={`text-[10px] mt-0.5 ${monoTheme.textMuted}`}>Automatically stream sensor readings every 3.5 seconds</p>
                    </div>
                    <button
                      onClick={() => setIsLiveTicking(!isLiveTicking)}
                      className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-all border ${
                        isLiveTicking 
                          ? monoTheme.buttonPrimary 
                          : monoTheme.buttonSecondary
                      }`}
                    >
                      {isLiveTicking ? "PAUSE" : "RESUME"}
                    </button>
                  </div>

                  {/* Manual Step & Reset */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={stepSimulation}
                      disabled={stepLoading}
                      className={`px-3 py-2 disabled:opacity-50 rounded-lg text-xs font-medium font-mono flex items-center justify-center gap-1.5 transition-colors ${monoTheme.buttonSecondary}`}
                    >
                      {stepLoading ? "Ingesting..." : "Step Telemetry (+5m)"}
                    </button>
                    <button
                      onClick={handleReset}
                      className={`px-3 py-2 rounded-lg text-xs font-medium font-mono flex items-center justify-center gap-1.5 transition-colors ${monoTheme.buttonSecondary}`}
                    >
                      Factory Reset Engine
                    </button>
                  </div>

                  {/* Scenario Injectors */}
                  <div>
                    <span className={`text-[10px] font-mono font-bold tracking-wider block uppercase mb-1.5 ${monoTheme.textSubtle}`}>Thermodynamic Simulation Scenarios</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleSetScenario("NORMAL")}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium tracking-wide transition-all ${
                          activeScenario === "NORMAL"
                            ? monoTheme.buttonPrimary
                            : monoTheme.buttonSecondary
                        }`}
                        id="scenario_normal_btn"
                      >
                        Normal Operation
                      </button>
                      <button
                        onClick={() => handleSetScenario("DOOR_OPEN")}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium tracking-wide transition-all ${
                          activeScenario === "DOOR_OPEN"
                            ? monoTheme.buttonPrimary
                            : monoTheme.buttonSecondary
                        }`}
                        id="scenario_door_open_btn"
                      >
                        Door Left Open
                      </button>
                      <button
                        onClick={() => handleSetScenario("POWER_OUTAGE")}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium tracking-wide transition-all ${
                          activeScenario === "POWER_OUTAGE"
                            ? monoTheme.buttonPrimary
                            : monoTheme.buttonSecondary
                        }`}
                        id="scenario_power_out_btn"
                      >
                        Power Outage
                      </button>
                    </div>
                    <p className={`text-[10px] mt-2 italic ${monoTheme.textMuted}`}>
                      {activeScenario === "NORMAL" && "Thermostat active. Maintains temperature inside the optimal 2°C - 8°C cold range automatically."}
                      {activeScenario === "DOOR_OPEN" && "Door left ajar triggers extreme convection leaks. The fridge temp will slowly climb, forecasting an eventual breach."}
                      {activeScenario === "POWER_OUTAGE" && "Total electrical power outage cuts compressor functionality. Temperature slowly rises based on passive thermal conduction."}
                    </p>
                  </div>

                  {/* Hardware glitch injector */}
                  <div className={`pt-2 border-t ${monoTheme.border}`}>
                    <span className={`text-[10px] font-mono font-bold tracking-wider block uppercase mb-1.5 ${monoTheme.textSubtle}`}>Phase 2: Signal Integrity Hardware Test</span>
                    <button
                      onClick={handleInjectGlitch}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-semibold font-mono flex items-center justify-center gap-1.5 transition-all ${monoTheme.buttonPrimary}`}
                      id="inject_glitch_btn"
                    >
                      Stage Sudden -45°C Sensor Glitch
                    </button>
                    <p className={`text-[10px] mt-1.5 ${monoTheme.textMuted}`}>
                      Fires an extreme static noise packet. The live stream will process it, and our anomaly detector will automatically repair the telemetry, preventing false high-priority alarms.
                    </p>
                  </div>
                </div>
              </div>

              {/* Proactive Alerts & Directives (RHS 7 cols) */}
              <div className={`lg:col-span-7 ${monoTheme.cardBg} rounded-xl p-5 flex flex-col justify-between`} id="alert_directives_panel">
                <div>
                  <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${monoTheme.border}`}>
                    <h3 className={`text-sm font-bold tracking-wide uppercase ${monoTheme.textTitle}`}>Proactive Alert Directives</h3>
                  </div>

                  {prediction.breach_predicted ? (
                    <div className="space-y-4 animate-fade-in" id="proactive_breach_alert_box">
                      {/* Active Alert Flag */}
                      <div className={`p-3 border rounded-lg flex items-start gap-3 ${
                        isWhiteTheme ? "bg-neutral-100 border-neutral-300 text-neutral-900" : "bg-neutral-900/60 border-neutral-800 text-neutral-100"
                      }`}>
                        <span className={`text-xs font-mono font-bold mt-0.5 ${monoTheme.textAccent}`}>[!]</span>
                        <div>
                          <h4 className={`text-xs font-bold uppercase tracking-wide ${monoTheme.textTitle}`}>Warning: Predictive Temperature Breach Triggered</h4>
                          <p className={`text-[11px] mt-1 ${monoTheme.textAccentMuted}`}>
                            Thermodynamic forecasting predicts a vaccine thermal boundary breach ({prediction.breach_type === "HIGH_TEMPERATURE" ? "above 8.0°C" : "below 2.0°C"}) will occur in approximately <span className="font-bold underline">120 minutes</span>.
                          </p>
                          <div className={`mt-2 flex items-center gap-3 text-[10px] font-mono ${monoTheme.textSubtle}`}>
                            <span>Predicted Temp: <strong className={monoTheme.textAccent}>{prediction.predicted_temp.toFixed(1)}°C</strong></span>
                            <span>Slope: <strong className={monoTheme.textTitle}>{prediction.current_trend}</strong></span>
                            <span>Model Confidence: <strong className={monoTheme.textAccent}>{(prediction.confidence * 100).toFixed(0)}%</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* On-Site Worker Actions */}
                      <div className={`${monoTheme.sectionBg} p-4 rounded-lg`}>
                        <span className={`text-[10px] font-mono font-bold tracking-wider block uppercase mb-2 ${monoTheme.textAccent}`}>On-Site Emergency Response Checklist</span>
                        <ul className={`space-y-2 text-xs ${monoTheme.textAccentMuted}`}>
                          <li className="flex items-start gap-2">
                            <span className={`font-bold font-mono ${monoTheme.textAccent}`}>01.</span>
                            <span>
                              <strong>Secure Backup Coolers:</strong> Immediate pre-chill of auxiliary vaccine transport cases with frozen gel packs or dry ice.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className={`font-bold font-mono ${monoTheme.textAccent}`}>02.</span>
                            <span>
                              <strong>Prepare Relocation:</strong> If prediction reaches 90% confidence or temperature breaches 7.0°C, relocate all Pfizer, Moderna, and flu vaccine inventory to backup thermal containers.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className={`font-bold font-mono ${monoTheme.textAccent}`}>03.</span>
                            <span>
                              {prediction.breach_type === "HIGH_TEMPERATURE" ? (
                                <span><strong>Check Compressor Power & Seal:</strong> Ensure the fridge door is completely sealed. Inspect thermal rubber gaskets and verify compressor current draw.</span>
                              ) : (
                                <span><strong>Thermostat recalibration:</strong> Thermostat failsafe fault detected. Immediately disengage active cooling loops manually to avoid freezing vials.</span>
                              )}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center flex flex-col items-center justify-center space-y-2" id="normal_status_alert_box">
                      <div className={`px-3 py-1.5 rounded-md font-mono text-xs font-bold ${monoTheme.badgeSafe}`}>
                        SYSTEM SECURE
                      </div>
                      <h4 className={`text-xs font-semibold uppercase tracking-wider mt-2 ${monoTheme.textTitle}`}>All Biological Storage Systems Secure</h4>
                      <p className={`text-[11px] max-w-md ${monoTheme.textMuted}`}>
                        The ML predictor predicts a stable temperature curve over the next 120 minutes. Current thermal trend is fully within normal regulatory bounds (2.0°C - 8.0°C).
                      </p>
                    </div>
                  )}
                </div>

                {/* Glitch Logging Console Footer */}
                <div className={`mt-4 pt-3 border-t ${monoTheme.border} text-xs font-mono`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${monoTheme.textSubtle}`}>Telemetry Stream Logs (Glitch Events)</span>
                    <span className={`text-[10px] ${monoTheme.textSubtle}`}>Streaming Filter Ready</span>
                  </div>
                  <div className={`p-2 rounded-lg text-[10px] leading-relaxed max-h-24 overflow-y-auto ${monoTheme.sectionInnerBg} ${monoTheme.textAccentMuted}`}>
                    {latestGlitchLog ? (
                      <div className={monoTheme.textAccent}>
                        {latestGlitchLog}
                      </div>
                    ) : (
                      <span className={monoTheme.textSubtle}>No hardware telemetry anomalies reported in the current session. Filter is running live on background threads.</span>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Row 3: Real-Time Historical Chart Viewer */}
            <div className={`${monoTheme.cardBg} p-5`} id="telemetry_chart_panel">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold tracking-wide uppercase ${monoTheme.textTitle}`}>Real-Time Temperature Stream VS Ambient Bounds</h3>
                </div>
                <div className={`flex items-center gap-4 text-xs font-mono ${monoTheme.textMuted}`}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-[#0D9488]" />
                    <span className="text-[10px]">Internal Temp (°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-0.5 ${isWhiteTheme ? "bg-slate-400" : "bg-slate-600"}`} />
                    <span className="text-[10px]">Ambient Room Temp (°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 border-t border-dashed border-[#EF4444]/60" />
                    <span className="text-[10px]">Safe Bounds (2.0°C - 8.0°C)</span>
                  </div>
                </div>
              </div>

              {/* Chart Body */}
              <div className={`relative h-64 rounded-lg overflow-hidden flex items-end px-1.5 pt-6 ${monoTheme.sectionInnerBg}`}>
                
                {/* Y-axis grid lines & markers */}
                <div className={`absolute left-2 top-2 bottom-2 w-full pointer-events-none flex flex-col justify-between text-[9px] font-mono ${monoTheme.textSubtle}`}>
                  <div className={`border-b w-full pb-0.5 flex justify-between pr-4 ${isWhiteTheme ? "border-slate-200/50" : "border-slate-900/50"}`}>
                    <span>16.0°C</span>
                  </div>
                  <div className="border-b border-dashed border-[#EF4444]/30 w-full pb-0.5 flex justify-between pr-4">
                    <span className="text-[#EF4444] font-bold">8.0°C (CRITICAL UPPER LIMIT)</span>
                  </div>
                  <div className={`border-b w-full pb-0.5 flex justify-between pr-4 ${isWhiteTheme ? "border-slate-200/50" : "border-slate-900/50"}`}>
                    <span>5.0°C</span>
                  </div>
                  <div className="border-b border-dashed border-[#EF4444]/30 w-full pb-0.5 flex justify-between pr-4">
                    <span className="text-[#EF4444] font-bold">2.0°C (CRITICAL LOWER LIMIT)</span>
                  </div>
                  <div className={`border-b w-full pb-0.5 flex justify-between pr-4 ${isWhiteTheme ? "border-slate-200/50" : "border-slate-900/50"}`}>
                    <span>0.0°C</span>
                  </div>
                </div>

                {/* SVG Curves */}
                {sensorHistory.length > 0 ? (
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Ambient Room temperature path (Grey) */}
                    <polyline
                      fill="none"
                      stroke={isWhiteTheme ? "#94a3b8" : "#475569"}
                      strokeWidth="0.8"
                      strokeOpacity="0.6"
                      points={getAmbientDataPoints()}
                    />
                    
                    {/* Fridge internal temperature path (Teal/Coral based on breach) */}
                    <polyline
                      fill="none"
                      stroke={prediction.breach_predicted ? "#EF4444" : "#0D9488"}
                      strokeWidth={prediction.breach_predicted ? "2.2" : "1.8"}
                      strokeDasharray={prediction.breach_predicted ? "2,2" : "none"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={getChartDataPoints()}
                    />
                  </svg>
                ) : (
                  <div className={`absolute inset-0 flex items-center justify-center text-xs font-mono ${monoTheme.textMuted}`}>
                    Awaiting initial telemetric frames...
                  </div>
                )}
              </div>

              {/* Chart footer timelines */}
              <div className={`flex justify-between items-center text-[9px] font-mono mt-2 px-1 ${monoTheme.textMuted}`}>
                <span>-4 hours (48 readings)</span>
                <span className={`px-2 py-0.5 rounded border ${isWhiteTheme ? "bg-neutral-100 border-neutral-200" : "bg-neutral-900 border-neutral-800"}`}>Telemetry Frame Frequency: 5 Mins / Sample</span>
                <span>Real-Time Current</span>
              </div>
            </div>

            {/* Row 4: Cryptographic Block Ledger Chain Visualizer */}
            <div className={`${monoTheme.cardBg} p-5`} id="block_ledger_panel">
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-2 border-b gap-3 ${monoTheme.border}`}>
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold tracking-wide uppercase ${monoTheme.textTitle}`}>Cryptographic Audit Ledger (Sequential Block Chain)</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {verificationStatus.status !== "idle" && (
                    <div className={`text-[11px] font-mono px-2.5 py-1 rounded border flex items-center gap-2 ${
                      verificationStatus.status === "verifying"
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                        : verificationStatus.status === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                    }`}>
                      {verificationStatus.status === "verifying" && (
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      <span>{verificationStatus.message}</span>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setVerificationStatus({ status: "verifying", message: "Scanning hashes..." });
                      try {
                        const res = await fetch("/api/verify-ledger", { method: "POST" });
                        const d = await res.json();
                        setIntegrity(d.integrity);
                        if (d.integrity.is_valid) {
                          setVerificationStatus({
                            status: "success",
                            message: `✓ Chain verified! ${d.integrity.ledgerLength || "Ledger"} blocks intact.`
                          });
                          
                          setTamperAlertModal({
                            show: true,
                            title: "✅ Ledger Integrity Verified",
                            message: `All sequential blocks have been successfully audited. The cryptographic signature validation check completed with zero discrepancies found.`,
                            tamperedList: "None",
                            count: 0
                          });

                          try {
                            window.alert(`✓ Ledger Integrity Verified!\n\nAll sequential blocks successfully audited. Zero cryptographic mismatches detected.`);
                          } catch (e) {
                            console.log("Iframe alert restrictions", e);
                          }

                          setTimeout(() => {
                            setVerificationStatus({ status: "idle", message: "" });
                          }, 5000);
                        } else {
                          const tamperedList = d.integrity.tampered_indices && d.integrity.tampered_indices.length > 0
                            ? d.integrity.tampered_indices.map((idx: number) => `#${idx}`).join(", ")
                            : `#${d.integrity.error_index}`;
                          const count = d.integrity.tampered_count || 1;
                          
                          setVerificationStatus({
                            status: "compromised",
                            message: `⚠ Compromised! Tampered block(s): ${tamperedList} (${count} total)`
                          });

                          setTamperAlertModal({
                            show: true,
                            title: "🚨 Cryptographic Audit Failure!",
                            message: `The sequential cryptographic chain scan detected database alteration violations. Data integrity check failed.`,
                            tamperedList: tamperedList,
                            count: count
                          });

                          try {
                            window.alert(`⚠ AUDIT FAILURE: Cryptographic Integrity Violated!\n\nAltered database record(s) detected: ${tamperedList}\nTotal tampered records: ${count}\nMismatch sequence starts at Block #${d.integrity.error_index}.`);
                          } catch (e) {
                            console.log("Iframe alert restrictions", e);
                          }
                        }
                      } catch (error) {
                        setVerificationStatus({ status: "compromised", message: "Error verifying chain." });
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors border ${monoTheme.buttonPrimary}`}
                  >
                    Verify Chain Integrity
                  </button>
                </div>
              </div>

              {/* Block chain grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-x-auto pb-2" id="blockchain_blocks_list">
                {recentBlocks.map((block, idx) => {
                  const isBlockTampered = !integrity.is_valid && (
                    (integrity.tampered_indices && integrity.tampered_indices.includes(block.index)) || 
                    integrity.error_index === block.index
                  );
                  const isBlockPostTampered = !integrity.is_valid && block.index > integrity.error_index && !isBlockTampered;

                  return (
                    <div 
                      key={block.index} 
                      className={`relative rounded-xl p-3 flex flex-col justify-between transition-all ${
                        isBlockTampered 
                          ? (isWhiteTheme ? "bg-neutral-950 border border-neutral-900 text-white shadow-md" : "bg-white border border-white text-black shadow-md")
                          : isBlockPostTampered 
                            ? (isWhiteTheme ? "bg-neutral-50 border border-dashed border-neutral-300 text-neutral-400 opacity-60" : "bg-neutral-900/30 border border-dashed border-neutral-800 text-neutral-500 opacity-60")
                            : (isWhiteTheme ? "bg-neutral-100/40 border border-neutral-200 hover:border-neutral-400 text-neutral-900" : "bg-neutral-900/40 border border-neutral-850 hover:border-neutral-700 text-neutral-100")
                      }`}
                    >
                      {/* Link line to previous block */}
                      {idx > 0 && (
                        <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-px hidden sm:block pointer-events-none ${
                          isWhiteTheme ? "bg-neutral-300" : "bg-neutral-800"
                        }`} />
                      )}

                      <div>
                        {/* Header block indices */}
                        <div className={`flex items-center justify-between text-[10px] font-mono border-b pb-1.5 mb-2 ${
                          isBlockTampered 
                            ? (isWhiteTheme ? "border-white/20" : "border-black/20") 
                            : (isWhiteTheme ? "border-neutral-200" : "border-neutral-800")
                        }`}>
                          <span className="font-bold">
                            BLOCK #{block.index}
                          </span>
                          <span className="opacity-75">
                            {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        {/* Block Core Telemetry */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="opacity-60 font-mono text-[10px]">FRIDGE TEMP:</span>
                            <span className={`font-mono font-bold ${isBlockTampered ? "underline" : ""}`}>
                              {block.data.fridge_temp.toFixed(2)}°C
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60 font-mono text-[10px]">AMBIENT:</span>
                            <span className="font-mono">{block.data.ambient_temp.toFixed(1)}°C</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60 font-mono text-[10px]">HUMIDITY:</span>
                            <span className="font-mono">{block.data.humidity.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Cryptographic Hash Blocks footer */}
                      <div className={`mt-3 pt-2 border-t text-[9px] font-mono space-y-1 ${
                        isBlockTampered 
                          ? (isWhiteTheme ? "border-white/20" : "border-black/20") 
                          : (isWhiteTheme ? "border-neutral-200" : "border-neutral-800")
                      }`}>
                        <div className="flex justify-between opacity-65">
                          <span>PREV:</span>
                          <span>{block.prev_hash.substring(0, 10)}...</span>
                        </div>
                        <div className="flex justify-between opacity-65">
                          <span>HASH:</span>
                          <span className={isBlockTampered ? "font-bold line-through" : ""}>
                            {block.block_hash.substring(0, 10)}...
                          </span>
                        </div>
                      </div>

                      {/* Malicious Tamper Button (Allows auditing test) */}
                      <div className="mt-3.5">
                        <button
                          onClick={() => {
                            setTamperingBlockIndex(block.index);
                            handleTamperLedger(block.index);
                          }}
                          className="w-full py-1 text-[9px] font-mono font-bold rounded transition-colors bg-[#2563EB] hover:bg-[#1d4ed8] text-white border border-[#2563EB]"
                        >
                          Tamper Reading
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Attack simulator panel */}
              <div className={`p-5 rounded-xl mt-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 border ${monoTheme.sectionBg} ${monoTheme.border}`}>
                <div className="flex items-start gap-3 max-w-xl">
                  <div className={`px-2 py-1 rounded text-xs font-mono font-bold mt-0.5 ${monoTheme.badgeWarning}`}>
                    [TAMPER]
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wide ${monoTheme.textTitle}`}>Attack Sandbox: Alter Ledger Archives</h4>
                    <p className={`text-[11px] mt-0.5 ${monoTheme.textMuted}`}>
                      Select a block index and target value below to execute a retroactive database alteration attack. This will instantly break the SHA-256 chain and trigger cryptographic alarms.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`flex items-center rounded-lg px-2.5 py-1.5 border ${monoTheme.sectionInnerBg} ${monoTheme.border}`}>
                    <span className={`text-[10px] font-mono mr-2 ${monoTheme.textMuted}`}>BLOCK INDEX:</span>
                    <select
                      value={tamperingBlockIndex === -1 && recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1].index : tamperingBlockIndex}
                      onChange={(e) => setTamperingBlockIndex(parseInt(e.target.value))}
                      className="bg-transparent text-xs font-mono focus:outline-none border-none text-red-500 font-bold"
                    >
                      {recentBlocks.map(block => (
                        <option key={block.index} value={block.index} className={isWhiteTheme ? "text-neutral-900 bg-white" : "text-white bg-neutral-950"}>
                          Block #{block.index} ({block.data.fridge_temp.toFixed(1)}°C)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className={`flex items-center rounded-lg px-2.5 py-1.5 border ${monoTheme.sectionInnerBg} ${monoTheme.border}`}>
                    <span className={`text-[10px] font-mono mr-2 ${monoTheme.textMuted}`}>TAMPER TEMP:</span>
                    <input
                      type="text"
                      value={tamperingValue}
                      onChange={(e) => setTamperingValue(e.target.value)}
                      className={`w-12 bg-transparent text-xs font-mono focus:outline-none font-bold ${monoTheme.textAccent}`}
                    />
                    <span className={`text-[10px] font-mono ${monoTheme.textMuted}`}>°C</span>
                  </div>

                  <button
                    onClick={() => {
                      const idx = tamperingBlockIndex === -1 && recentBlocks.length > 0 
                        ? recentBlocks[recentBlocks.length - 1].index 
                        : tamperingBlockIndex;
                      handleTamperLedger(idx);
                    }}
                    className="px-4 py-1.5 text-xs font-bold font-mono rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors border border-red-600 shadow-sm"
                  >
                    Execute Tamper Attack
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}



        {/* Tab 3: Python Code Viewers removed */}
        {false && (
          <div className={`${monoTheme.cardBg} rounded-2xl p-6 space-y-4 animate-fade-in`} id="python_code_panel">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${monoTheme.border}`}>
              <div>
                <h2 className={`text-xl font-extrabold tracking-tight ${monoTheme.textTitle}`}>
                  Executable Python Codebase
                </h2>
                <p className={`text-xs mt-1 ${monoTheme.textMuted}`}>
                  Full reference implementation of Phases 1 to 3, fully compliant with lightweight constraints (1GB RAM).
                </p>
              </div>
              <div className={`flex items-center gap-1.5 p-1 border rounded-lg ${monoTheme.sectionBg} ${monoTheme.border}`}>
                <button
                  onClick={() => setPythonCodeTab("all")}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${pythonCodeTab === "all" ? (isWhiteTheme ? "bg-neutral-900 text-white font-bold" : "bg-white text-black font-bold") : `${monoTheme.textMuted} hover:text-neutral-500`}`}
                >
                  FULL FILE
                </button>
                <button
                  onClick={() => setPythonCodeTab("predictor")}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${pythonCodeTab === "predictor" ? (isWhiteTheme ? "bg-neutral-900 text-white font-bold" : "bg-white text-black font-bold") : `${monoTheme.textMuted} hover:text-neutral-500`}`}
                >
                  PREDICTOR
                </button>
                <button
                  onClick={() => setPythonCodeTab("glitch")}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${pythonCodeTab === "glitch" ? (isWhiteTheme ? "bg-neutral-900 text-white font-bold" : "bg-white text-black font-bold") : `${monoTheme.textMuted} hover:text-neutral-500`}`}
                >
                  GLITCH FILTER
                </button>
                <button
                  onClick={() => setPythonCodeTab("ledger")}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${pythonCodeTab === "ledger" ? (isWhiteTheme ? "bg-neutral-900 text-white font-bold" : "bg-white text-black font-bold") : `${monoTheme.textMuted} hover:text-neutral-500`}`}
                >
                  CRYPT LEDGER
                </button>
              </div>
            </div>

            <div className="relative">
              <div className={`absolute right-3 top-3 text-[10px] font-mono flex items-center gap-1 border px-2 py-1 rounded-md ${monoTheme.sectionInnerBg} ${monoTheme.border} ${monoTheme.textMuted}`}>
                <span>frost_ledger_backend.py</span>
              </div>
              
              <pre className={`p-4 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-125 overflow-y-auto border ${monoTheme.sectionBg} ${monoTheme.border} ${monoTheme.textAccentMuted}`}>
                {pythonCodeTab === "all" && `#!/usr/bin/env python3
"""
Frost Ledger HLTH-505 Vaccine Temperature Prediction
Phases 1-3 Backend System: Mock Data, ML Prediction, Anomaly Detection, & Hash Chain Ledger
"""

import datetime
import hashlib
import json
import math
import random

# [Thermodynamic Time-Series Simulator]
def generate_sensor_reading(timestamp, prev_internal, ambient, compressor_on, power_stable, door_open, humidity):
    cooling_power = -0.4  # Cooling rate (°C per 5 min)
    leak_coef = 0.18 if door_open else 0.03
    effective_compressor = compressor_on and power_stable

    delta_temp = leak_coef * (ambient - prev_internal)
    if effective_compressor:
        delta_temp += cooling_power
    
    new_internal = prev_internal + delta_temp + random.normalvariate(0, 0.05)
    return {
        "timestamp": timestamp.isoformat(),
        "ambient_temp": round(ambient, 2),
        "fridge_temp": round(new_internal, 2),
        "humidity": round(humidity, 2),
        "compressor_status": 1 if compressor_on else 0,
        "power_stability": 1 if power_stable else 0,
        "door_open": 1 if door_open else 0
    }
`}

                {pythonCodeTab === "predictor" && `class VaccineTemperaturePredictor:
    """
    Lightweight, thermodynamic predictive model.
    Takes the last 4 hours (48 readings) of sensor data and predicts
    if a breach (Temp > 8.0°C or Temp < 2.0°C) will occur 2 hours in the future.
    """
    def __init__(self, sample_interval_mins=5):
        self.sample_interval = sample_interval_mins
        self.forecast_steps = int(120 / sample_interval_mins) # 2 hours = 24 steps
        self.history_steps = int(240 / sample_interval_mins)  # 4 hours = 48 steps

    def predict_temperature_breach(self, history):
        history_subset = history[-self.history_steps:] if len(history) >= self.history_steps else history
        if not history_subset:
            return {"predicted_temp": 4.0, "breach_predicted": False}

        fridge_temps = [r["fridge_temp"] for r in history_subset]
        ambient_temps = [r["ambient_temp"] for r in history_subset]
        
        # Linear slope gradient over the last hour (12 steps)
        recent_window = min(12, len(fridge_temps))
        sum_x = sum_y = sum_xx = sum_xy = 0.0
        for i in range(recent_window):
            x = i
            y = fridge_temps[-recent_window + i]
            sum_x += x
            sum_y += y
            sum_xx += x * x
            sum_xy += x * y
        
        slope = (recent_window * sum_xy - sum_x * sum_y) / (recent_window * sum_xx - sum_x**2) if (recent_window * sum_xx - sum_x**2) != 0 else 0

        # Thermodynamic simulator loop step forward
        temp_sim = fridge_temps[-1]
        for step in range(self.forecast_steps):
            # thermodynamic passive decay projection
            leak_coef = 0.03
            delta_sim = leak_coef * (ambient_temps[-1] - temp_sim)
            temp_sim += delta_sim

        # Blend trend slope with thermodynamic decay
        projected_temp = round(0.6 * temp_sim + 0.4 * (fridge_temps[-1] + slope * self.forecast_steps), 2)
        breach_predicted = projected_temp > 8.0 or projected_temp < 2.0
        
        return {
            "predicted_temp": projected_temp,
            "breach_predicted": breach_predicted,
            "breach_type": "HIGH_TEMPERATURE" if projected_temp > 8.0 else ("LOW_TEMPERATURE" if projected_temp < 2.0 else "NONE")
        }
`}

                {pythonCodeTab === "glitch" && `def streaming_anomaly_detector(readings_generator):
    """
    A memory-efficient streaming generator that filters out sudden single-point
    sensor glitches (e.g. electrical dropouts resulting in spurious -50°C readings)
    without retaining massive history. Uses lightweight streaming calculations (<1GB RAM, <2s execution).
    """
    last_valid_temp = None
    
    for reading in readings_generator:
        temp = reading["fridge_temp"]
        is_anomaly = False
        
        if last_valid_temp is not None:
            temp_delta = abs(temp - last_valid_temp)
            # If temp spikes > 5°C or is wildly out of limits, label it anomalous
            if temp_delta > 5.0 or temp < -15.0 or temp > 45.0:
                is_anomaly = True
                corrected_temp = last_valid_temp # Repair signal with previous good reading
            else:
                corrected_temp = temp
        else:
            corrected_temp = temp if -15.0 <= temp <= 45.0 else 4.0

        filtered_reading = reading.copy()
        filtered_reading["fridge_temp"] = round(corrected_temp, 2)
        filtered_reading["is_anomaly"] = is_anomaly
        
        if not is_anomaly:
            last_valid_temp = corrected_temp
            
        yield filtered_reading
`}

                {pythonCodeTab === "ledger" && `class CryptographicLedger:
    """
    Tamper-proof sequential ledger storing vaccine storage telemetry blocks.
    Each block hashes the current reading and links securely with the previous block's hash.
    Provides complete immutable chain verification.
    """
    def __init__(self):
        self.chain = []
        self._genesis_hash = "0" * 64

    def create_block(self, reading):
        index = len(self.chain)
        prev_hash = self.chain[-1]["block_hash"] if index > 0 else self._genesis_hash
        timestamp = reading["timestamp"]

        payload = {
            "index": index,
            "prev_hash": prev_hash,
            "timestamp": timestamp,
            "data": {
                "ambient_temp": reading["ambient_temp"],
                "fridge_temp": reading["fridge_temp"],
                "humidity": reading["humidity"],
                "compressor_status": reading["compressor_status"],
                "power_stability": reading["power_stability"]
            }
        }

        canonical_string = json.dumps(payload, sort_keys=True)
        block_hash = hashlib.sha256(canonical_string.encode('utf-8')).hexdigest()

        return {
            "index": index,
            "timestamp": timestamp,
            "prev_hash": prev_hash,
            "data": payload["data"],
            "block_hash": block_hash
        }

    def verify_integrity(self):
        for idx, block in enumerate(self.chain):
            if block["index"] != idx: return False
            expected_prev = "0" * 64 if idx == 0 else self.chain[idx - 1]["block_hash"]
            if block["prev_hash"] != expected_prev: return False
            
            payload = {
                "index": block["index"],
                "prev_hash": block["prev_hash"],
                "timestamp": block["timestamp"],
                "data": block["data"]
            }
            canonical_string = json.dumps(payload, sort_keys=True)
            if block["block_hash"] != hashlib.sha256(canonical_string.encode('utf-8')).hexdigest():
                return False # Tampered!
        return True
`}
              </pre>
            </div>
            
            <div className={`p-4 rounded-xl flex items-center justify-between border ${monoTheme.sectionBg} ${monoTheme.border}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold ${monoTheme.textAccent}`}>[i]</span>
                <span className={`text-xs ${monoTheme.textAccentMuted}`}>
                  You can inspect the full python codebase in the project directory at <code>/python/frost_ledger_backend.py</code>.
                </span>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className={`border-t py-8 mt-12 text-xs ${isWhiteTheme ? "bg-neutral-100 text-neutral-500 border-neutral-200" : "bg-neutral-950 text-neutral-500 border-neutral-900"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={monoTheme.textSubtle}>Vaccine Temperature Security Protocol - Cold Chain Cryptographic Ledger Prototype</span>
          </div>
          <div className={`flex items-center gap-4 font-mono text-[10px] ${monoTheme.textMuted}`}>
            <span>SYSTEM STATE: ACTIVE</span>
            <span>MEMORY LIMIT: 1GB MAX</span>
            <span>AUDIT INTEGRITY: SECURE</span>
          </div>
        </div>
      </footer>

      {/* Custom Modal Alert */}
      {tamperAlertModal && tamperAlertModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" id="custom_tamper_modal">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${
            isWhiteTheme ? "bg-white border-neutral-200 text-neutral-900" : "bg-neutral-900 border-neutral-800 text-neutral-100"
          }`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full shrink-0 ${
                tamperAlertModal.count > 0 
                  ? "bg-rose-500/10 text-rose-500 animate-pulse" 
                  : "bg-emerald-500/10 text-emerald-500"
              }`}>
                {tamperAlertModal.count > 0 ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-6 tracking-tight mb-2">
                  {tamperAlertModal.title}
                </h3>
                <p className="text-sm opacity-80 mb-4 leading-relaxed">
                  {tamperAlertModal.message}
                </p>
                
                {tamperAlertModal.count > 0 ? (
                  <div className={`rounded-xl p-3.5 mb-4 border font-mono text-xs ${
                    isWhiteTheme ? "bg-red-50/50 border-red-100" : "bg-red-950/20 border-red-900/30"
                  }`}>
                    <div className="flex justify-between mb-1">
                      <span className="opacity-60">TAMPERED BLOCKS:</span>
                      <span className="font-bold text-red-500 underline">{tamperAlertModal.tamperedList}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">TOTAL COMPROMISED:</span>
                      <span className="font-bold text-red-500">{tamperAlertModal.count} Block(s)</span>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl p-3.5 mb-4 border font-mono text-xs ${
                    isWhiteTheme ? "bg-emerald-50/50 border-emerald-100" : "bg-emerald-950/20 border-emerald-900/30"
                  }`}>
                    <div className="flex justify-between">
                      <span className="opacity-60">CHAIN STATUS:</span>
                      <span className="font-bold text-emerald-500">100% SECURE & VALID</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setTamperAlertModal(null)}
                className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 ${
                  tamperAlertModal.count > 0
                    ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
                    : isWhiteTheme
                      ? "bg-neutral-900 hover:bg-neutral-800 text-white focus:ring-neutral-500"
                      : "bg-white hover:bg-neutral-100 text-black focus:ring-white"
                }`}
              >
                Acknowledge Protocol Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
