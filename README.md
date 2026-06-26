# FROST LEDGER

FROST Ledger is a cold-chain vaccine temperature monitoring system that combines predictive modeling, anomaly detection, and cryptographic ledger verification.

## Overview

This application monitors refrigerator and ambient conditions, predicts temperature breaches, detects anomalies, and validates data integrity.

## Features

- Real-time sensor monitoring for ambient and refrigerator temperature
- Two-hour temperature breach prediction
- Anomaly detection for abnormal readings and possible tampering
- Ledger integrity verification using SHA-256 hashing
- Email-based authentication
- Light and dark theme support

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm
- Python 3.8 or later (optional)

### Installation

```bash
cd "/Users/sumitsinghbagdwal/Downloads/FROST LEDGER"
npm install
```

Create a `.env` file in the project root with the environment variables required by the application.

### Running in Development

```bash
npm run dev
```

The application runs on `http://localhost:3000` by default.

## Authentication

The application uses email verification to authenticate users before granting access to the dashboard.

## Prediction and Anomaly Detection

The system uses thermodynamic modeling and trend analysis to forecast temperature behavior and identify abnormal readings. It monitors:

- fridge temperature
- ambient temperature
- compressor state
- door status
- power stability

## Ledger Integrity

Sensor readings are recorded in a hash chain. Each block in the chain includes a hash reference to the previous block, enabling detection of tampering.

## API Endpoints

The backend exposes these endpoints:

- `GET /api/sensor-history` — returns recent sensor readings
- `GET /api/predict` — returns prediction results
- `GET /api/ledger` — returns the ledger chain data
- `POST /api/verify-ledger` — validates ledger integrity
- `POST /api/send-verification-email` — sends authentication email
- `POST /api/verify-email` — verifies the authentication code

## Development Notes

- Frontend components are implemented in `src/App.tsx`
- Backend API logic is implemented in `server.ts`
- Python backend logic is available in `python/frost_ledger_backend.py`