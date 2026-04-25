// utils/CustomErrorBoundary.js
import React, { Component } from "react";

export class CustomErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center flex-col">
          <p className="text-lg text-red-600">Error: {this.state.error.message}</p>
          <button
            onClick={() => this.props.navigate("/")}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}