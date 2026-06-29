import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import { requestNotificationPermission } from "../firebase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/accounts/profile/");
      setUser(response.data);
    } catch (error) {
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  };

  const registerPushToken = async () => {
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await api.post("/notifications/register-token/", {
          token,
          device_name: navigator.userAgent.slice(0, 100),
        });
      }
    } catch (error) {
      console.log("Push token registration failed:", error);
    }
  };

  const login = async (email, password) => {
    const response = await api.post("/accounts/login/", { email, password });
    localStorage.setItem("access_token", response.data.access);
    localStorage.setItem("refresh_token", response.data.refresh);
    await fetchProfile();
    registerPushToken();
    return response.data;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      await api.post("/accounts/logout/", { refresh_token: refreshToken });
    } catch (error) {
      // Continue logout even if API call fails
    } finally {
      localStorage.clear();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        login,
        logout,
        fetchProfile,
        registerPushToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
