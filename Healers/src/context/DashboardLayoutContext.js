import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthContext } from "./AuthContext";

export const DASHBOARD_LAYOUTS = {
  CLASSIC: "classic", 
  MODERN: "modern", 
};

const DEFAULT_LAYOUT = DASHBOARD_LAYOUTS.CLASSIC;
const storageKey = (userId) => `admin_dashboard_layout:${userId}`;

const DashboardLayoutContext = createContext({
  layout: DEFAULT_LAYOUT,
  ready: false,
  setLayout: () => {},
  toggleLayout: () => {},
});

export function DashboardLayoutProvider({ children }) {
  const { user } = useContext(AuthContext);
  const userId = user?.id || user?._id;

  const [layout, setLayoutState] = useState(DEFAULT_LAYOUT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setReady(false);

      if (!userId) {
        setLayoutState(DEFAULT_LAYOUT);
        setReady(true);
        return;
      }

      try {
        const saved = await AsyncStorage.getItem(storageKey(userId));
        const valid = Object.values(DASHBOARD_LAYOUTS).includes(saved);

        if (!cancelled) {
          setLayoutState(valid ? saved : DEFAULT_LAYOUT);
        }
      } catch (error) {
        console.log("Load dashboard layout error:", error);
        if (!cancelled) setLayoutState(DEFAULT_LAYOUT);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setLayout = useCallback(
    async (next) => {
      setLayoutState(next);

      if (!userId) return;

      try {
        await AsyncStorage.setItem(storageKey(userId), next);
      } catch (error) {
        console.log("Save dashboard layout error:", error);
      }
    },
    [userId],
  );

  const toggleLayout = useCallback(() => {
    setLayout(
      layout === DASHBOARD_LAYOUTS.CLASSIC
        ? DASHBOARD_LAYOUTS.MODERN
        : DASHBOARD_LAYOUTS.CLASSIC,
    );
  }, [layout, setLayout]);

  const value = useMemo(
    () => ({ layout, ready, setLayout, toggleLayout }),
    [layout, ready, setLayout, toggleLayout],
  );

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export const useDashboardLayout = () => useContext(DashboardLayoutContext);