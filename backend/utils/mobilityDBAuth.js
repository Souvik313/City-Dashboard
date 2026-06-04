
import axios from "axios";

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Returns a valid Mobility Database access token.
 * Automatically refreshes using the refresh token when expired.
 * Call this before every Mobility Database API request.
 */
export const getMobilityDBToken = async () => {
  // Return cached token if still valid (with 2 min safety buffer)
  if (
    cachedToken &&
    tokenExpiresAt &&
    Date.now() < tokenExpiresAt - 2 * 60 * 1000
  ) {
    console.log("Using cached Mobility DB token");
    return cachedToken;
  }

  const refreshToken = process.env.MOBILITY_DB_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      "MOBILITY_DB_REFRESH_TOKEN is not set in environment variables"
    );
  }

  try {
    console.log("Refreshing Mobility DB access token...");

    const res = await axios.post(
      "https://api.mobilitydatabase.org/v1/tokens",
      { refresh_token: refreshToken },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    const { access_token, expires_in } = res.data;

    if (!access_token) {
      throw new Error("No access_token in Mobility DB response");
    }

    // Cache the token
    cachedToken = access_token;
    // expires_in is in seconds — default to 3600 (1 hour) if not provided
    tokenExpiresAt = Date.now() + (expires_in ?? 3600) * 1000;

    console.log(
      `✅ Mobility DB token refreshed, expires in ${expires_in ?? 3600}s`
    );

    return cachedToken;

  } catch (err) {
    // Clear cache on failure so next call retries
    cachedToken = null;
    tokenExpiresAt = null;

    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message;

    throw new Error(`Failed to get Mobility DB token: ${message}`);
  }
};

/**
 * Manually invalidates the cached token.
 * Call this if you get a 401 from any Mobility DB API call.
 */
export const invalidateMobilityDBToken = () => {
  cachedToken = null;
  tokenExpiresAt = null;
  console.log("Mobility DB token cache cleared");
};