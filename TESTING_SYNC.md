# Doctor-Patient Data Sync - Testing Guide

## Overview
This guide helps you test the real-time synchronization between doctor portal and patient portal vitals updates.

## Setup

### Prerequisites
- Backend server running: `python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000`
- Frontend running: `npm run dev` or `bun run dev`
- Browser with console open (F12 for DevTools)

## Test Scenario 1: Real-Time Sync (EventSource)

### Step 1: Login as Doctor
1. Open http://localhost:5173 (or your frontend URL)
2. Click "Doctor Login"
3. Credentials: `user_id: DOC-4892`, `password: doctor123`
4. You should see the Doctor Dashboard with patient list

### Step 2: Login as Patient (In Another Tab/Window)
1. Open a new browser tab
2. Go to http://localhost:5173
3. Click "Patient Login"
4. Credentials: `user_id: alex.patient`, `password: patient123`
5. You should see the Patient Dashboard with vitals

### Step 3: Update Vitals in Doctor Portal
1. In the doctor tab, select patient "Alex Johnson" (PNX-84731)
2. Scroll to "Live Tracking Control Center" section
3. Change Heart Rate from `82` to `95`
4. Change Systolic BP from `135` to `148`
5. Click "Save & Sync Vitals" button
6. You should see a success message "Vitals updated! Changes are being synced to patient portal..."

### Step 4: Check Patient Portal
1. Switch to the patient tab
2. **Look for immediate updates** in the vitals display
3. You should see:
   - Heart Rate updated to `95` (approximately)
   - Systolic BP updated to `148` (approximately)
   - "Last synced" timestamp updated to current time
   - Connection status should show "Live push connected" if real-time works

### Step 5: Verify Real-Time Connection
1. In patient tab, check the "Live Tracking" section
2. If connection says "Live push connected" → Real-time sync working ✅
3. If connection says "Live sync reconnecting" → Fallback polling active (still works, but slower)

## Test Scenario 2: Manual Sync Button

### Step 1: Update vitals in doctor portal (same as above)

### Step 2: Click "Sync Now" in Patient Portal
1. Switch to patient tab
2. Click the "Sync Now" button in the Live Tracking section
3. Button should show "Syncing..." during refresh
4. After refresh, should show updated vitals immediately

## Test Scenario 3: Fallback Polling (When Real-Time Fails)

### Step 1: Open Patient Portal and Monitor Connection
1. Open browser DevTools console (F12)
2. Switch to patient tab
3. Look at the "Live Tracking" section

### Step 2: Update Vitals in Doctor Portal
1. Switch to doctor tab
2. Change vitals (e.g., Blood Sugar from `108` to `125`)
3. Click "Save & Sync Vitals"

### Step 3: Monitor Automatic Refresh
1. Switch back to patient tab
2. If EventSource connection fails, the fallback polling will trigger:
   - Connection status will show "Live sync reconnecting"
   - Data will refresh automatically every 10 seconds
   - Maximum wait time: 10 seconds to see changes

### Step 4: Check Console for Debugging
In browser DevTools console, you should see logs like:
```
EventSource connection timeout, starting fallback polling
```

This indicates the system has switched to fallback polling.

## Test Scenario 4: Verify Different Vitals Update

### Doctor Portal Changes:
1. Heart Rate: 82 → 92
2. Diastolic BP: 88 → 95
3. Blood Sugar: 108 → 118
4. Cholesterol: 195 → 210
5. Oxygen Level: 97 → 96

### Expected Patient Portal Results:
- All values should update to match (with ±1-2 variation due to synthetic data generation)
- All changes should be visible within 1 second (if real-time) or 10 seconds (if fallback)

## Troubleshooting

### Issue: Changes don't appear in patient portal
**Solution:**
1. Click "Sync Now" button manually - if this works, it's a connection issue
2. Check browser console (F12 → Console tab) for errors
3. Verify backend server is running and accessible
4. Check if you have the correct token in localStorage

### Issue: Changes appear but slowly
**Expected behavior:**
- If taking 1-2 seconds: Real-time sync is working (normal delay)
- If taking 10 seconds: Fallback polling is active (expected, more reliable)
- If taking >10 seconds: There might be a connection issue

### Issue: "Live sync reconnecting" keeps showing
**Solution:**
1. Verify the backend events endpoint is running: `curl http://localhost:8000/api/docs`
2. Check browser console for WebSocket/SSE errors
3. Fallback polling should still work - data will update every 10 seconds

## Performance Metrics

### Real-Time Sync (When Working)
- Detection latency: ~1 second (polling interval)
- Display latency: ~2 seconds total (includes network round-trip)
- Reliability: High (if connection stable)

### Fallback Polling
- Detection latency: ~10 seconds
- Reliability: Very High (will work even if real-time fails)

### Manual Sync
- Instant (depends on network)
- Use this for urgent updates

## Reverting to Original State

If you need to reset patient vitals to original values:

### Original Values (Alex Johnson - PNX-84731):
- Heart Rate: 82
- Systolic BP: 135
- Diastolic BP: 88
- Blood Sugar: 108
- Cholesterol: 195
- Oxygen Level: 97

## Key Improvements Made

1. **Faster polling** (2s → 1s in backend)
2. **Intelligent fallback** (10s polling when real-time fails)
3. **Manual refresh button** for immediate sync
4. **Better error handling** with reconnection attempts (up to 5 retries)
5. **Improved UI feedback** showing sync status and timestamps

## Testing Checklist

- [ ] Real-time sync working (changes visible within 1-2 seconds)
- [ ] Fallback polling working (changes visible within 10 seconds)
- [ ] Manual "Sync Now" button works instantly
- [ ] Connection status indicator shows correct state
- [ ] All vital values update correctly
- [ ] Multiple updates work sequentially
- [ ] Browser tab focus events trigger refresh
- [ ] No console errors during normal operation
