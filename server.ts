import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
// Helper to hash password securely without extra external database dependencies
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Initialize environment variables
dotenv.config();

// =====================================================================
// Thermodynamic Simulator, Predictive Model, & Cryptographic Chain
// =====================================================================

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

// ---------------------------------------------------------------------
// Phase 1: Machine Learning Predictor (Newton's Cooling Kinetics)
// ---------------------------------------------------------------------
class VaccineTemperaturePredictor {
  private sampleIntervalMins = 5;
  private forecastSteps = 24; // 2 hours out = 24 steps of 5 mins
  private historySteps = 48;  // 4 hours history = 48 steps of 5 mins

  public predictTemperatureBreach(history: SensorReading[]) {
    const historySubset = history.slice(-this.historySteps);
    if (historySubset.length === 0) {
      return {
        predicted_temp: 4.0,
        breach_predicted: false,
        breach_type: "NONE",
        confidence: 0.0,
        current_trend: "STABLE",
      };
    }

    const fridgeTemps = historySubset.map((r) => r.fridge_temp);
    const ambientTemps = historySubset.map((r) => r.ambient_temp);
    const compressorStates = historySubset.map((r) => r.compressor_status);
    const powerStates = historySubset.map((r) => r.power_stability);
    const doorStates = historySubset.map((r) => r.door_open);

    const n = fridgeTemps.length;
    const recentWindow = Math.min(12, n); // Look at last 1 hour of trends

    // Least-squares regression to calculate recent slope
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    for (let i = 0; i < recentWindow; i++) {
      const x = i;
      const y = fridgeTemps[n - recentWindow + i];
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumXY += x * y;
    }

    const denominator = recentWindow * sumXX - sumX * sumX;
    const slope = Math.abs(denominator) > 1e-6 
      ? (recentWindow * sumXY - sumX * sumY) / denominator 
      : 0.0;

    const currentTemp = fridgeTemps[n - 1];
    const currentAmbient = ambientTemps[n - 1];
    const currentPower = powerStates[n - 1];
    const currentDoor = doorStates[n - 1];
    const currentCompressor = compressorStates[n - 1];

    // Thermodynamic Forecast Simulation
    let tempSim = currentTemp;
    let powerSim = currentPower;
    let doorSim = currentDoor;
    let compressorSim = currentCompressor;

    for (let step = 0; step < this.forecastSteps; step++) {
      const leakCoef = doorSim ? 0.18 : 0.03;
      let deltaSim = leakCoef * (currentAmbient - tempSim);

      if (compressorSim && powerSim) {
        deltaSim += -0.4; // Cooling power
      }

      tempSim += deltaSim;

      // Simple thermostat loop projection
      if (tempSim >= 5.5 && !doorSim && powerSim) {
        compressorSim = 1;
      } else if (tempSim <= 3.0) {
        compressorSim = 0;
      }
    }

    // Blend physics projection with linear momentum trend
    let projectedTemp = 0.6 * tempSim + 0.4 * (currentTemp + slope * this.forecastSteps);
    projectedTemp = Math.round(Math.max(-10.0, Math.min(45.0, projectedTemp)) * 100) / 100;

    let breachPredicted = false;
    let breachType = "NONE";
    const confidence = Math.round((0.5 + Math.min(0.45, Math.abs(slope) * 5)) * 100) / 100;

    if (projectedTemp > 8.0) {
      breachPredicted = true;
      breachType = "HIGH_TEMPERATURE";
    } else if (projectedTemp < 2.0) {
      breachPredicted = true;
      breachType = "LOW_TEMPERATURE";
    }

    return {
      predicted_temp: projectedTemp,
      breach_predicted: breachPredicted,
      breach_type: breachType,
      confidence,
      current_trend: slope > 0.01 ? "RISING" : slope < -0.01 ? "FALLING" : "STABLE",
    };
  }
}

// ---------------------------------------------------------------------
// Phase 2: Streaming Anomaly Detector (Glitch Filter)
// ---------------------------------------------------------------------
class StreamingAnomalyDetector {
  private lastValidTemp: number | null = null;

  public processReading(reading: SensorReading): SensorReading {
    const temp = reading.fridge_temp;
    let isAnomaly = false;
    let correctedTemp = temp;

    if (this.lastValidTemp !== null) {
      const tempDelta = Math.abs(temp - this.lastValidTemp);

      // Vaccine physical temperatures cannot drift by > 5°C in a 5-minute sampling interval
      // Or exceed realistic boundary bounds (-15°C to 45°C)
      if (tempDelta > 5.0 || temp < -15.0 || temp > 45.0) {
        isAnomaly = true;
        correctedTemp = this.lastValidTemp; // repair signal with last known good value
      } else {
        correctedTemp = temp;
      }
    } else {
      if (temp < -15.0 || temp > 45.0) {
        isAnomaly = true;
        correctedTemp = 4.0; // safe baseline fallback
      } else {
        correctedTemp = temp;
      }
    }

    if (!isAnomaly) {
      this.lastValidTemp = correctedTemp;
    }

    return {
      ...reading,
      fridge_temp: Math.round(correctedTemp * 100) / 100,
      is_anomaly: isAnomaly,
      original_temp: isAnomaly ? temp : null,
    };
  }

  public reset(lastValid: number | null = null) {
    this.lastValidTemp = lastValid;
  }
}

// ---------------------------------------------------------------------
// Phase 3: Cryptographic Audit Ledger
// ---------------------------------------------------------------------
class CryptographicLedger {
  public chain: LedgerBlock[] = [];
  private genesisHash = "0".repeat(64);

  public computeBlockHash(
    index: number,
    timestamp: string,
    prev_hash: string,
    data: LedgerBlock["data"]
  ): string {
    const payload = { index, prev_hash, timestamp, data };
    const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(canonicalString).digest("hex");
  }

  public appendReading(reading: SensorReading): LedgerBlock {
    const index = this.chain.length;
    const prev_hash = index > 0 ? this.chain[index - 1].block_hash : this.genesisHash;
    const timestamp = reading.timestamp;

    const data = {
      ambient_temp: reading.ambient_temp,
      fridge_temp: reading.fridge_temp,
      humidity: reading.humidity,
      compressor_status: reading.compressor_status,
      power_stability: reading.power_stability,
      door_open: reading.door_open,
    };

    const block_hash = this.computeBlockHash(index, timestamp, prev_hash, data);

    const block: LedgerBlock = {
      index,
      timestamp,
      prev_hash,
      data,
      block_hash,
    };

    this.chain.push(block);
    return block;
  }

  public verifyIntegrity() {
    if (this.chain.length === 0) {
      return {
        is_valid: true,
        error_index: -1,
        tampered_count: 0,
        tampered_indices: [] as number[],
        message: "Ledger is empty, chain intact.",
      };
    }

    let firstErrorIndex = -1;
    let tampered_count = 0;
    const tampered_indices: number[] = [];

    for (let idx = 0; idx < this.chain.length; idx++) {
      const block = this.chain[idx];

      // Recalculate hash to verify self-tampering
      const recomputedHash = this.computeBlockHash(
        block.index,
        block.timestamp,
        block.prev_hash,
        block.data
      );

      const isSelfTampered = block.block_hash !== recomputedHash;
      if (isSelfTampered) {
        tampered_count++;
        tampered_indices.push(block.index);
      }

      // 1. Verify index sequencing
      if (block.index !== idx) {
        if (firstErrorIndex === -1) {
          firstErrorIndex = idx;
        }
        if (!tampered_indices.includes(idx)) {
          tampered_indices.push(idx);
        }
      }

      // 2. Verify hash links
      const expectedPrev = idx === 0 ? this.genesisHash : this.chain[idx - 1].block_hash;
      if (block.prev_hash !== expectedPrev) {
        if (firstErrorIndex === -1) {
          firstErrorIndex = idx;
        }
        if (!tampered_indices.includes(idx)) {
          tampered_indices.push(idx);
        }
      }

      // 3. Recalculate hash mismatch as verification error
      if (isSelfTampered) {
        if (firstErrorIndex === -1) {
          firstErrorIndex = idx;
        }
      }
    }

    // Sort the tampered indices to ensure order
    tampered_indices.sort((a, b) => a - b);

    if (firstErrorIndex !== -1) {
      return {
        is_valid: false,
        error_index: firstErrorIndex,
        tampered_count: tampered_count || tampered_indices.length,
        tampered_indices: tampered_indices,
        message: `Data integrity alert! ${tampered_indices.length} block(s) detected with mismatch signatures (Block ${tampered_indices.map(i => `#${i}`).join(", ")}). Mismatch chain sequence begins at Block #${firstErrorIndex}.`,
      };
    }

    return {
      is_valid: true,
      error_index: -1,
      tampered_count: 0,
      tampered_indices: [],
      message: `Verification complete. Sequential audit of ${this.chain.length} blocks successful. Cryptographic data integrity fully intact.`,
    };
  }

  public tamperBlock(index: number, malformedTemp: number): boolean {
    if (index >= 0 && index < this.chain.length) {
      this.chain[index].data.fridge_temp = malformedTemp;
      return true;
    }
    return false;
  }

  public reset() {
    this.chain = [];
  }
}

// =====================================================================
// Active Real-Time Simulation State
// =====================================================================

let sensorHistory: SensorReading[] = [];
const ledger = new CryptographicLedger();
const predictor = new VaccineTemperaturePredictor();
const anomalyDetector = new StreamingAnomalyDetector();

let activeScenario: "NORMAL" | "DOOR_OPEN" | "POWER_OUTAGE" = "NORMAL";
let injectGlitchOnNextStep = false;

// Initialize with 48 readings (last 4 hours of normal operation at 5-minute steps)
function initializeSimulation() {
  sensorHistory = [];
  ledger.reset();
  anomalyDetector.reset(4.0);

  let currentInternal = 4.0;
  let currentHumidity = 55.0;
  let compressorOn = 0;

  const startTime = Date.now() - 48 * 5 * 60 * 1000;

  for (let i = 0; i < 48; i++) {
    const timestamp = new Date(startTime + i * 5 * 60 * 1000).toISOString();
    
    // diurnal cycle ambient temperature (fluctuates around 22°C to 27°C)
    const hourRad = (i * 5) / 60 * (2 * Math.PI / 24);
    const ambientTemp = Math.round((24.0 + 3.0 * Math.sin(hourRad - Math.PI / 2) + (Math.random() - 0.5) * 0.4) * 100) / 100;

    // normal thermostat operation (ranges between 3.0°C and 5.5°C)
    if (currentInternal >= 5.5) {
      compressorOn = 1;
    } else if (currentInternal <= 3.0) {
      compressorOn = 0;
    }

    const leakCoef = 0.03;
    const coolingPower = compressorOn ? -0.4 : 0.0;
    const deltaTemp = leakCoef * (ambientTemp - currentInternal) + coolingPower + (Math.random() - 0.5) * 0.1;

    currentInternal += deltaTemp;
    currentInternal = Math.max(1.0, Math.min(15.0, currentInternal));

    currentHumidity += (compressorOn ? 0.4 : -0.2) + (Math.random() - 0.5) * 0.4;
    currentHumidity = Math.max(40.0, Math.min(85.0, currentHumidity));

    const rawReading: SensorReading = {
      timestamp,
      ambient_temp: Math.round(ambientTemp * 100) / 100,
      fridge_temp: Math.round(currentInternal * 100) / 100,
      humidity: Math.round(currentHumidity * 100) / 100,
      compressor_status: compressorOn,
      power_stability: 1,
      door_open: 0,
    };

    // Filter through glitch detector
    const filtered = anomalyDetector.processReading(rawReading);
    sensorHistory.push(filtered);
    ledger.appendReading(filtered);
  }
}

// Initialize on boot
initializeSimulation();

// In-memory fallback database for user credentials
const localInMemoryUsers: Array<{ email: string; passwordHash: string }> = [
  { email: "admin@frost.org", passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" } // password: AdminPassword1!
];

// =====================================================================
// Express Server & API Route Mounts
// =====================================================================

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Authentication Configuration & Diagnostics
  app.get("/api/auth/config", (req, res) => {
    res.json({
      usingMongoDB: false,
      message: "Running in offline-first secure memory buffer mode."
    });
  });

  // Fetch registered accounts (excluding passwords) for audit logs
  app.get("/api/auth/users", async (req, res) => {
    try {
      const users = localInMemoryUsers.map(u => ({ email: u.email, createdAt: new Date() }));
      return res.json({ success: true, source: "In-Memory Secure Database", users });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Register a new ID & Password
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email ID and Password are required." });
    }

    const emailNorm = email.trim().toLowerCase();
    const passHash = hashPassword(password);

    try {
      const existing = localInMemoryUsers.find(u => u.email === emailNorm);
      if (existing) {
        return res.status(400).json({ success: false, error: "Account with this ID already exists." });
      }
      localInMemoryUsers.push({ email: emailNorm, passwordHash: passHash });
      return res.json({ success: true, message: "Account successfully stored in secure in-memory database." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Login authentication
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email ID and Password are required." });
    }

    const emailNorm = email.trim().toLowerCase();
    const passHash = hashPassword(password);

    try {
      const user = localInMemoryUsers.find(u => u.email === emailNorm && u.passwordHash === passHash);
      if (!user) {
        return res.status(401).json({ success: false, error: "Invalid Email ID or Passcode credential." });
      }
      return res.json({ success: true, email: user.email });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API REST Routes
  app.get("/api/status", (req, res) => {
    const prediction = predictor.predictTemperatureBreach(sensorHistory);
    const integrity = ledger.verifyIntegrity();

    res.json({
      status: "ok",
      activeScenario,
      sensorHistory: sensorHistory.slice(-50), // Send last 50 data points to UI
      prediction,
      integrity,
      ledgerLength: ledger.chain.length,
      recentBlocks: ledger.chain.slice(-25), // Send recent blocks for visual representation
    });
  });

  app.post("/api/step", (req, res) => {
    // Determine last state
    const lastReading = sensorHistory[sensorHistory.length - 1];
    let currentInternal = lastReading.fridge_temp;
    let currentHumidity = lastReading.humidity;
    let compressorOn = lastReading.compressor_status;

    const timestamp = new Date().toISOString();

    // calculate dynamic ambient temp based on time of day
    const now = new Date();
    const hourRad = (now.getHours() + now.getMinutes() / 60) * (2 * Math.PI / 24);
    const ambientTemp = Math.round((24.0 + 3.0 * Math.sin(hourRad - Math.PI / 2) + (Math.random() - 0.5) * 0.4) * 100) / 100;

    // Scenario variables
    const powerStable = activeScenario === "POWER_OUTAGE" ? 0 : 1;
    const doorOpen = activeScenario === "DOOR_OPEN" ? 1 : 0;

    // Compressor logic
    if (activeScenario === "NORMAL") {
      if (currentInternal >= 5.5) {
        compressorOn = 1;
      } else if (currentInternal <= 3.0) {
        compressorOn = 0;
      }
    } else if (activeScenario === "DOOR_OPEN") {
      compressorOn = 1; // Run continuously to try to fight heat leak
    } else if (activeScenario === "POWER_OUTAGE") {
      compressorOn = 0; // Disabled during power cut
    }

    // Thermodynamic delta temp
    const leakCoef = doorOpen ? 0.18 : 0.03;
    const coolingPower = (compressorOn && powerStable) ? -0.4 : 0.0;
    const deltaTemp = leakCoef * (ambientTemp - currentInternal) + coolingPower + (Math.random() - 0.5) * 0.1;

    currentInternal += deltaTemp;

    // Glitch injection behavior
    let readingTemp = currentInternal;
    if (injectGlitchOnNextStep) {
      readingTemp = -45.0; // Spurious severe hardware dropout glitch
      injectGlitchOnNextStep = false;
    }

    currentHumidity += (compressorOn ? 0.4 : -0.2) + (Math.random() - 0.5) * 0.4;
    currentHumidity = Math.max(30.0, Math.min(95.0, currentHumidity));

    const rawReading: SensorReading = {
      timestamp,
      ambient_temp: Math.round(ambientTemp * 100) / 100,
      fridge_temp: Math.round(readingTemp * 100) / 100,
      humidity: Math.round(currentHumidity * 100) / 100,
      compressor_status: compressorOn,
      power_stability: powerStable,
      door_open: doorOpen,
    };

    // Filter sensor glitches through streaming anomaly detector
    const filtered = anomalyDetector.processReading(rawReading);

    // Update history
    sensorHistory.push(filtered);
    if (sensorHistory.length > 200) {
      sensorHistory.shift(); // keep sliding window of history
    }

    // Append cryptographically sealed ledger record
    const block = ledger.appendReading(filtered);

    const prediction = predictor.predictTemperatureBreach(sensorHistory);
    const integrity = ledger.verifyIntegrity();

    res.json({
      success: true,
      newReading: filtered,
      newBlock: block,
      prediction,
      integrity,
    });
  });

  app.post("/api/set-scenario", (req, res) => {
    const { scenario } = req.body;
    if (["NORMAL", "DOOR_OPEN", "POWER_OUTAGE"].includes(scenario)) {
      activeScenario = scenario;
      res.json({ success: true, activeScenario });
    } else {
      res.status(400).json({ error: "Invalid scenario name" });
    }
  });

  app.post("/api/inject-glitch", (req, res) => {
    injectGlitchOnNextStep = true;
    res.json({ success: true, message: "Severe electrical drop spike will occur on next telemetry frame." });
  });

  app.post("/api/verify-ledger", (req, res) => {
    const integrity = ledger.verifyIntegrity();
    console.log(`[LEDGER AUDIT] Verify ledger called. Result: is_valid=${integrity.is_valid}, error_index=${integrity.error_index}, message="${integrity.message}"`);
    res.json({ success: true, integrity });
  });

  app.post("/api/tamper-ledger", (req, res) => {
    const { blockIndex, tamperedTemp } = req.body;
    console.log(`[LEDGER TAMPER] Tamper request received: blockIndex=${blockIndex}, tamperedTemp=${tamperedTemp}`);
    
    let targetIdx = ledger.chain.length - 5; // default to a historical block
    if (blockIndex !== undefined) {
      targetIdx = parseInt(blockIndex);
    }

    if (targetIdx < 0 || targetIdx >= ledger.chain.length) {
      console.error(`[LEDGER TAMPER] Invalid block index targetIdx=${targetIdx} for chain of length ${ledger.chain.length}`);
      return res.status(400).json({ error: "Invalid block index targeting." });
    }

    const originalTemp = ledger.chain[targetIdx].data.fridge_temp;
    const updateTemp = tamperedTemp !== undefined ? parseFloat(tamperedTemp) : 15.5;

    const success = ledger.tamperBlock(targetIdx, updateTemp);
    const integrity = ledger.verifyIntegrity();

    console.log(`[LEDGER TAMPER] Block #${targetIdx} mutated from ${originalTemp}°C to ${updateTemp}°C. Success=${success}. Integrity is_valid=${integrity.is_valid}, error_index=${integrity.error_index}`);

    res.json({
      success,
      tamperedBlockIndex: targetIdx,
      originalValue: originalTemp,
      tamperedValue: updateTemp,
      integrity,
    });
  });

  app.post("/api/reset", (req, res) => {
    activeScenario = "NORMAL";
    injectGlitchOnNextStep = false;
    initializeSimulation();
    const prediction = predictor.predictTemperatureBreach(sensorHistory);
    const integrity = ledger.verifyIntegrity();

    res.json({
      success: true,
      activeScenario,
      sensorHistory,
      prediction,
      integrity,
    });
  });

  // Serve static UI assets and Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Frost Ledger express/vite engine running on port ${PORT}`);
  });
}

startServer();
