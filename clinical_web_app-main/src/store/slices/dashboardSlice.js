import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchWithRetry } from "../../utils/api";

export const fetchDashboardStats = createAsyncThunk(
  "dashboard/fetchStats",
  async (force = false, { getState, rejectWithValue }) => {
    const { lastFetched } = getState().dashboard;
    const STALE_MS = 60_000; // re-fetch after 1 minute
    if (!force && lastFetched && Date.now() - lastFetched < STALE_MS) return null;
    // Clear sessionStorage so fetchWithRetry doesn't serve stale cached data
    try { sessionStorage.removeItem("fc:dashboard-stats"); } catch {}
    try {
      return await fetchWithRetry("get", "/api/dashboard/stats", "dashboard-stats");
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    counts: {},
    recent_patients: [],
    upcoming_followups: [],
    monthly_trend: [],
    top_medicines: [],
    top_symptoms: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
  reducers: {
    invalidateDashboard(state) {
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (payload) {
          state.counts = payload.counts || {};
          state.recent_patients = payload.recent_patients || [];
          state.upcoming_followups = payload.upcoming_followups || [];
          state.monthly_trend = payload.monthly_trend || [];
          state.top_medicines = payload.top_medicines || [];
          state.top_symptoms = payload.top_symptoms || [];
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchDashboardStats.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      });
  },
});

export const { invalidateDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;

export const selectDashboard = (state) => state.dashboard;
