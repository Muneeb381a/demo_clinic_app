import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchWithRetry } from "../../utils/api";

// ── Thunks ──────────────────────────────────────────────────────────────────

export const fetchSymptoms = createAsyncThunk(
  "appData/fetchSymptoms",
  async (_, { getState, rejectWithValue }) => {
    // Skip if already loaded
    if (getState().appData.symptoms.length > 0) return null;
    try {
      return await fetchWithRetry("get", "/api/symptoms", "symptoms", null, (data) =>
        Array.isArray(data)
          ? data.map((s) => ({ value: String(s.id), label: s.name }))
          : []
      );
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchTests = createAsyncThunk(
  "appData/fetchTests",
  async (_, { getState, rejectWithValue }) => {
    if (getState().appData.tests.length > 0) return null;
    try {
      return await fetchWithRetry("get", "/api/tests", "tests", null, (data) =>
        Array.isArray(data)
          ? data.map((t) => ({ value: String(t.id), label: t.test_name || t.name || "Unknown" }))
          : []
      );
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchMedicines = createAsyncThunk(
  "appData/fetchMedicines",
  async (force = false, { getState, rejectWithValue }) => {
    // Allow force-refresh (e.g. after creating a new medicine)
    if (!force && getState().appData.medicines.length > 0) return null;
    // Clear sessionStorage so force=true actually hits the server
    if (force) {
      try { sessionStorage.removeItem("fc:medicines"); } catch {}
    }
    try {
      return await fetchWithRetry("get", "/api/medicines", "medicines", null, (data) =>
        Array.isArray(data)
          ? data.map((m) => ({
              value: String(m.id),
              label: `${m.form || ""} ${m.brand_name}${m.strength ? ` (${m.strength})` : ""}`.trim(),
              raw: m,
            }))
          : []
      );
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchNeuroOptions = createAsyncThunk(
  "appData/fetchNeuroOptions",
  async (_, { getState, rejectWithValue }) => {
    if (Object.keys(getState().appData.neuroOptions).length > 0) return null;
    try {
      return await fetchWithRetry(
        "get",
        "/api/neuro-options/all",
        "neuro-options-all",
        null,
        (data) => {
          const map = {};
          for (const [field, rows] of Object.entries(data)) {
            map[field] = (Array.isArray(rows) ? rows : []).map((opt) => ({
              value: String(opt.id),
              label: opt.value || "Unknown",
            }));
          }
          return map;
        }
      );
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ── Slice ────────────────────────────────────────────────────────────────────

const appDataSlice = createSlice({
  name: "appData",
  initialState: {
    symptoms: [],
    tests: [],
    medicines: [],
    neuroOptions: {},
    loading: {
      symptoms: false,
      tests: false,
      medicines: false,
      neuroOptions: false,
    },
    errors: {
      symptoms: null,
      tests: null,
      medicines: null,
      neuroOptions: null,
    },
  },
  reducers: {
    // Allow direct injection (e.g. after creating a new symptom)
    addSymptom(state, { payload }) {
      if (!state.symptoms.some((s) => s.value === String(payload.id))) {
        state.symptoms.push({ value: String(payload.id), label: payload.name });
      }
    },
    addMedicine(state, { payload }) {
      if (!state.medicines.some((m) => m.value === String(payload.id))) {
        state.medicines.push({
          value: String(payload.id),
          label: `${payload.form || ""} ${payload.brand_name}${payload.strength ? ` (${payload.strength})` : ""}`.trim(),
          raw: payload,
        });
      }
    },
    invalidateMedicines(state) {
      // Force next fetchMedicines to go to server
      state.medicines = [];
    },
  },
  extraReducers: (builder) => {
    // Symptoms
    builder
      .addCase(fetchSymptoms.pending, (state) => { state.loading.symptoms = true; state.errors.symptoms = null; })
      .addCase(fetchSymptoms.fulfilled, (state, { payload }) => {
        state.loading.symptoms = false;
        if (payload) state.symptoms = payload;
      })
      .addCase(fetchSymptoms.rejected, (state, { payload }) => {
        state.loading.symptoms = false;
        state.errors.symptoms = payload;
      });

    // Tests
    builder
      .addCase(fetchTests.pending, (state) => { state.loading.tests = true; state.errors.tests = null; })
      .addCase(fetchTests.fulfilled, (state, { payload }) => {
        state.loading.tests = false;
        if (payload) state.tests = payload;
      })
      .addCase(fetchTests.rejected, (state, { payload }) => {
        state.loading.tests = false;
        state.errors.tests = payload;
      });

    // Medicines
    builder
      .addCase(fetchMedicines.pending, (state) => { state.loading.medicines = true; state.errors.medicines = null; })
      .addCase(fetchMedicines.fulfilled, (state, { payload }) => {
        state.loading.medicines = false;
        if (payload) state.medicines = payload;
      })
      .addCase(fetchMedicines.rejected, (state, { payload }) => {
        state.loading.medicines = false;
        state.errors.medicines = payload;
      });

    // Neuro options
    builder
      .addCase(fetchNeuroOptions.pending, (state) => { state.loading.neuroOptions = true; state.errors.neuroOptions = null; })
      .addCase(fetchNeuroOptions.fulfilled, (state, { payload }) => {
        state.loading.neuroOptions = false;
        if (payload) state.neuroOptions = payload;
      })
      .addCase(fetchNeuroOptions.rejected, (state, { payload }) => {
        state.loading.neuroOptions = false;
        state.errors.neuroOptions = payload;
      });
  },
});

export const { addSymptom, addMedicine, invalidateMedicines } = appDataSlice.actions;
export default appDataSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectSymptoms = (state) => state.appData.symptoms;
export const selectTests = (state) => state.appData.tests;
export const selectMedicines = (state) => state.appData.medicines;
export const selectNeuroOptions = (state) => state.appData.neuroOptions;
export const selectAppDataLoading = (state) => state.appData.loading;
