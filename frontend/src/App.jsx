import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Auth from "./(auth)/Auth";
import VirtualAgent from "./AgentAvatar/VirtualAgent";
import Dashboard from "./Dashboard";
import Protected from "./(auth)/Protected";
import MapScreen from "./Map/map";

const ARScene = React.lazy(() => import("./Map/(ar)/ui"));

export default function App() {
  return (
    <View style={styles.app}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </View>
  );
}

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Atlas route render failed", error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const message = this.state.error instanceof Error ? this.state.error.message : "The view failed to render.";
      const title = this.props.title || "Atlas view failed to render";

      return (
        <View style={styles.errorBoundary}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={styles.errorAction}>
            <Text style={styles.errorActionText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppRoutes() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const showAgent = path !== "/" && path !== "/ar";

  return (
    <>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route
          path="/Dashboard"
          element={
            <ProtectedRouteBoundary resetKey={location.pathname} title="Dashboard failed to render">
              <Dashboard />
            </ProtectedRouteBoundary>
          }
        />
        <Route
          path="/Map"
          element={
            <ProtectedRouteBoundary resetKey={location.pathname} title="Map failed to render">
              <MapScreen />
            </ProtectedRouteBoundary>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRouteBoundary resetKey={location.pathname} title="Map failed to render">
              <MapScreen />
            </ProtectedRouteBoundary>
          }
        />
        <Route
          path="/ar"
          element={
            <ProtectedRouteBoundary resetKey={location.pathname} title="AR guidance failed to render">
              <React.Suspense fallback={<RouteLoading title="Loading AR guidance" />}>
                <ARScene />
              </React.Suspense>
            </ProtectedRouteBoundary>
          }
        />
      </Routes>
      {showAgent ? <VirtualAgent /> : null}
    </>
  );
}

function ProtectedRouteBoundary({ children, resetKey, title }) {
  return (
    <RouteErrorBoundary resetKey={resetKey} title={title}>
      <Protected>{children}</Protected>
    </RouteErrorBoundary>
  );
}

function RouteLoading({ title }) {
  return (
    <View style={styles.loadingView}>
      <Text style={styles.loadingText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    minHeight: "100vh",
    backgroundColor: "#eef4f1",
  },
  errorBoundary: {
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#eef4f1",
  },
  errorTitle: {
    color: "#143431",
    fontSize: 24,
    fontWeight: "800",
  },
  errorMessage: {
    maxWidth: 560,
    color: "#6b7c77",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  errorAction: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#143431",
  },
  errorActionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  loadingView: {
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#091513",
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
