import React, { useState, useEffect } from "react";
import { ConnectionForm } from "./components/ConnectionForm";
import { CollectionList } from "./components/CollectionList";
import { SettingsManager } from "./components/SettingsManager";
import { getAllCollections } from "./lib/apiHandlers";
import {
  testDirectusConnection,
  savePresetConfiguration,
} from "./lib/connectionTest";
import { DirectusClient } from "./lib/DirectusClient";
import type { OperationStatus, Collection } from "./types";
// Removed client-side verifyCode - now using server-side API

function App() {
  const isLocalUrl = (url: string) => {
    const normalized = url.trim().toLowerCase();
    return (
      normalized.startsWith("http://localhost") ||
      normalized.startsWith("https://localhost") ||
      normalized.startsWith("http://127.0.0.1") ||
      normalized.startsWith("https://127.0.0.1")
    );
  };
  // Check if session is valid (with expiration)
  const checkSessionValidity = (): boolean => {
    if (typeof window === "undefined") return false;

    const sessionData = sessionStorage.getItem("migration-session");
    if (!sessionData) return false;

    try {
      const session = JSON.parse(sessionData);
      const now = Date.now();

      // Check if session has expired
      if (session.expiresAt && now > session.expiresAt) {
        sessionStorage.removeItem("migration-session");
        return false;
      }

      return session.authenticated === true;
    } catch {
      sessionStorage.removeItem("migration-session");
      return false;
    }
  };

  const [isAuthed, setIsAuthed] = useState<boolean>(checkSessionValidity);
  const [loginCode, setLoginCode] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const [sourceEnvironment, setSourceEnvironment] = useState<string>(
    localStorage.getItem("sourceEnvironment") || ""
  );
  const [sourceUrl, setSourceUrl] = useState<string>(
    localStorage.getItem("sourceUrl") || ""
  );
  const [sourceToken, setSourceToken] = useState<string>("");
  const [targetEnvironment, setTargetEnvironment] = useState<string>(
    localStorage.getItem("targetEnvironment") || ""
  );
  const [targetUrl, setTargetUrl] = useState<string>(
    localStorage.getItem("targetUrl") || ""
  );
  const [targetToken, setTargetToken] = useState<string>("");

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [operationStatus, setOperationStatus] =
    useState<OperationStatus | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<{
    source?: { success: boolean; message: string; loading: boolean };
    target?: { success: boolean; message: string; loading: boolean };
  }>({});

  // One-time cleanup: remove any previously stored tokens from localStorage
  useEffect(() => {
    localStorage.removeItem("sourceToken");
    localStorage.removeItem("targetToken");
  }, []);

  // Save non-sensitive connection info to localStorage when they change
  useEffect(() => {
    localStorage.setItem("sourceEnvironment", sourceEnvironment);
    localStorage.setItem("sourceUrl", sourceUrl);
    localStorage.setItem("targetEnvironment", targetEnvironment);
    localStorage.setItem("targetUrl", targetUrl);
  }, [sourceEnvironment, sourceUrl, targetEnvironment, targetUrl]);

  // Check session expiration periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (!checkSessionValidity()) {
        setIsAuthed(false);
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const trimmed = loginCode.trim();

      if (!trimmed || trimmed.length !== 4) {
        throw new Error("Please enter a 4-digit code");
      }

      // Call server-side API to verify code
      // Use relative path for Vercel deployment
      const apiUrl = "/api/verify-code";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            data.message || "Too many attempts. Please try again later."
          );
        }
        throw new Error(data.error || "Invalid or expired code");
      }

      if (data.success && data.sessionToken) {
        // Store session with expiration
        const sessionData = {
          authenticated: true,
          expiresAt: data.expiresAt,
          createdAt: Date.now(),
        };

        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "migration-session",
            JSON.stringify(sessionData)
          );
        }

        setIsAuthed(true);
        setLoginCode(""); // Clear the code after successful login
      } else {
        throw new Error("Authentication failed");
      }
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const setLoadingState = (key: string, state: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: state }));
  };

  const handleConnect = async () => {
    if (!sourceUrl || !sourceToken || !targetUrl || !targetToken) {
      setOperationStatus({
        type: "error",
        message: "Please fill in all connection details",
      });
      return;
    }

    setLoadingState("connect", true);
    setOperationStatus({
      type: "info",
      message: "Connecting to Directus instances...",
    });

    try {
      // Test both connections
      const [sourceTestResult, targetTestResult] = await Promise.all([
        testDirectusConnection(sourceUrl, sourceToken),
        testDirectusConnection(targetUrl, targetToken),
      ]);

      if (!sourceTestResult.success) {
        throw new Error(
          `Source connection failed: ${sourceTestResult.message}`
        );
      }

      if (!targetTestResult.success) {
        throw new Error(
          `Target connection failed: ${targetTestResult.message}`
        );
      }

      // Create clients for data fetching
      const sourceClient = new DirectusClient(sourceUrl, sourceToken);
      const targetClient = new DirectusClient(targetUrl, targetToken);

      // Get collections from both instances
      const [sourceCollectionsResult, targetCollectionsResult] =
        await Promise.all([
          getAllCollections(sourceUrl, sourceToken),
          getAllCollections(targetUrl, targetToken),
        ]);

      const sourceCollections = sourceCollectionsResult.success
        ? sourceCollectionsResult.collections || []
        : [];
      const targetCollections = targetCollectionsResult.success
        ? targetCollectionsResult.collections || []
        : [];

      // Combine and deduplicate collections
      const allCollections = [
        ...sourceCollections,
        ...targetCollections,
      ].filter(
        (collection, index, self) =>
          index ===
          self.findIndex((c) => c.collection === collection.collection)
      );

      setCollections(allCollections);
      setIsConnected(true);
      setOperationStatus({
        type: "success",
        message: `Successfully connected! Found ${allCollections.length} collections.`,
      });
    } catch (error: any) {
      setOperationStatus({
        type: "error",
        message: error.message || "Failed to connect to Directus instances",
      });
    } finally {
      setLoadingState("connect", false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setCollections([]);
    setOperationStatus(null);
  };

  const handleLoadSettings = (settings: {
    sourceEnvironment: string;
    sourceUrl: string;
    sourceToken: string;
    targetEnvironment: string;
    targetUrl: string;
    targetToken: string;
  }) => {
    setSourceEnvironment(settings.sourceEnvironment);
    setSourceUrl(settings.sourceUrl);
    setSourceToken(settings.sourceToken);
    setTargetEnvironment(settings.targetEnvironment);
    setTargetUrl(settings.targetUrl);
    setTargetToken(settings.targetToken);
  };

  const handleClearAll = () => {
    setSourceEnvironment("");
    setSourceUrl("");
    setSourceToken("");
    setTargetEnvironment("");
    setTargetUrl("");
    setTargetToken("");
    setIsConnected(false);
    setCollections([]);
    setOperationStatus(null);
  };

  const handleRefreshCollections = async () => {
    if (!sourceUrl || !sourceToken || !targetUrl || !targetToken) {
      setOperationStatus({
        type: "error",
        message: "Please fill in all connection details",
      });
      return;
    }

    setLoadingState("refresh_collections", true);
    setOperationStatus({ type: "info", message: "Refreshing collections..." });

    try {
      const [sourceCollectionsResult, targetCollectionsResult] =
        await Promise.all([
          getAllCollections(sourceUrl, sourceToken),
          getAllCollections(targetUrl, targetToken),
        ]);

      const sourceCollections = sourceCollectionsResult.success
        ? sourceCollectionsResult.collections || []
        : [];
      const targetCollections = targetCollectionsResult.success
        ? targetCollectionsResult.collections || []
        : [];

      const allCollections = [
        ...sourceCollections,
        ...targetCollections,
      ].filter(
        (collection, index, self) =>
          index ===
          self.findIndex((c) => c.collection === collection.collection)
      );

      setCollections(allCollections);
      setOperationStatus({
        type: "success",
        message: `Collections refreshed (${allCollections.length} found).`,
      });
    } catch (error: any) {
      setOperationStatus({
        type: "error",
        message: error.message || "Failed to refresh collections",
      });
    } finally {
      setLoadingState("refresh_collections", false);
    }
  };

  const handleStatusUpdate = (status: OperationStatus | null) => {
    setOperationStatus(status);
  };

  const handleTestConnection = async (type: "source" | "target") => {
    const url = type === "source" ? sourceUrl : targetUrl;
    const token = type === "source" ? sourceToken : targetToken;

    if (!url || !token) {
      setOperationStatus({
        type: "error",
        message: `Please fill in ${type} URL and token before testing`,
      });
      return;
    }

    // Set loading state
    setTestResults((prev) => ({
      ...prev,
      [type]: { success: false, message: "", loading: true },
    }));

    try {
      const result = await testDirectusConnection(url, token);

      setTestResults((prev) => ({
        ...prev,
        [type]: {
          success: result.success,
          message: result.message,
          loading: false,
        },
      }));

      // Also show in main status
      setOperationStatus({
        type: result.success ? "success" : "error",
        message: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${
          result.message
        }`,
      });
    } catch (error: any) {
      setTestResults((prev) => ({
        ...prev,
        [type]: {
          success: false,
          message: `Test failed: ${error.message}`,
          loading: false,
        },
      }));
    }
  };

  const handleSavePreset = async (type: "source" | "target") => {
    const environment =
      type === "source" ? sourceEnvironment : targetEnvironment;
    const url = type === "source" ? sourceUrl : targetUrl;
    const token = type === "source" ? sourceToken : targetToken;

    if (!environment || !url || !token) {
      setOperationStatus({
        type: "error",
        message: `Please fill in ${type} environment name, URL and token before saving`,
      });
      return;
    }

    const result = savePresetConfiguration({
      name: `${environment}-${type}`,
      environment,
      url,
      token,
      type,
    });

    setOperationStatus({
      type: result.success ? "success" : "error",
      message: result.message,
    });

    // Refresh the form to show new preset in dropdown
    if (result.success) {
      // Force re-render by updating a state
      setSourceEnvironment((prev) => prev);
    }
  };

  if (!isAuthed) {
    return (
      <div
        className="container"
        style={{ maxWidth: "480px", margin: "4rem auto" }}
      >
        <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1>Optical Migration Tool</h1>
          <p style={{ marginTop: "0.5rem", color: "#6b7280" }}>
            Enter 4-digit access code from your authenticator device.
          </p>
        </header>

        <form
          onSubmit={handleLoginSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            style={{
              textAlign: "center",
              letterSpacing: "0.4em",
              fontSize: "1.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />

          {loginError && (
            <div style={{ color: "#dc2626", fontSize: "0.875rem" }}>
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loginLoading || loginCode.length !== 4}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "0.75rem 1.5rem",
              border: "none",
              borderRadius: "8px",
              cursor:
                loginLoading || loginCode.length !== 4
                  ? "not-allowed"
                  : "pointer",
              opacity: loginLoading || loginCode.length !== 4 ? 0.6 : 1,
              fontSize: "0.95rem",
              fontWeight: 500,
              marginTop: "0.25rem",
            }}
          >
            {loginLoading ? "Verifying..." : "Unlock Tool"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1>Optical Migration Tool</h1>
        <p>Transfer data between Optical instances</p>
      </header>

      {!isConnected ? (
        <div>
          {(isLocalUrl(sourceUrl) || isLocalUrl(targetUrl)) && (
            <SettingsManager
              currentSettings={{
                sourceEnvironment,
                sourceUrl,
                sourceToken,
                targetEnvironment,
                targetUrl,
                targetToken,
              }}
              onLoadSettings={handleLoadSettings}
              onClearAll={handleClearAll}
            />
          )}

          <ConnectionForm
            sourceEnvironment={sourceEnvironment}
            sourceUrl={sourceUrl}
            sourceToken={sourceToken}
            targetEnvironment={targetEnvironment}
            targetUrl={targetUrl}
            targetToken={targetToken}
            onSourceEnvironmentChange={setSourceEnvironment}
            onSourceUrlChange={setSourceUrl}
            onSourceTokenChange={setSourceToken}
            onTargetEnvironmentChange={setTargetEnvironment}
            onTargetUrlChange={setTargetUrl}
            onTargetTokenChange={setTargetToken}
            onConnect={handleConnect}
            onTestConnection={handleTestConnection}
            onSavePreset={handleSavePreset}
            loading={loading.connect}
            testResults={testResults}
            isLocal={isLocalUrl}
          />
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
              padding: "1.5rem",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "#1e293b" }}>
                Connected Successfully
              </h2>
              <p style={{ margin: "0.5rem 0 0 0", color: "#64748b" }}>
                Source: {sourceUrl} | Target: {targetUrl}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                padding: "0.75rem 1.5rem",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              Disconnect
            </button>
          </div>

          <CollectionList
            collections={collections}
            sourceUrl={sourceUrl}
            sourceToken={sourceToken}
            targetUrl={targetUrl}
            targetToken={targetToken}
            onStatusUpdate={handleStatusUpdate}
            onRefreshCollections={handleRefreshCollections}
            loading={loading}
            setLoading={setLoadingState}
          />
        </div>
      )}
    </div>
  );
}

export default App;
