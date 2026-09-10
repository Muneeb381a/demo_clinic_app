import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./store/index";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

const Fallback = () => (
  <div style={{ padding: 24, fontFamily: "system-ui", color: "#334155" }}>
    <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
    <p>The page hit an unexpected error. Reload to try again.</p>
    <button onClick={() => window.location.reload()} style={{ marginTop: 8 }}>Reload</button>
  </div>
);

createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<Fallback />}>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </Sentry.ErrorBoundary>
)
