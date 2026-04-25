import { configureStore } from "@reduxjs/toolkit";
import appDataReducer from "./slices/appDataSlice";
import dashboardReducer from "./slices/dashboardSlice";

const store = configureStore({
  reducer: {
    appData: appDataReducer,
    dashboard: dashboardReducer,
  },
});

export default store;
