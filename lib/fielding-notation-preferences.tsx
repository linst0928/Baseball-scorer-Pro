import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_FIELDING_NOTATION_FONT_SIZE,
  FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY,
  normalizeFieldingNotationFontSize,
} from "@/lib/baseball/fielding-notation-font-scale";

type FieldingNotationPreferencesContextValue = {
  fontSize: number;
  isReady: boolean;
  setFontSize: (value: number) => void;
};

const FieldingNotationPreferencesContext = createContext<FieldingNotationPreferencesContextValue | null>(null);

/**
 * 傳接放大檢視的閱讀偏好只保存於本機；不得寫入任何 Game 或 AtBatEvent。
 * 同時讀取 V07 的 small／standard／large 舊值，讓使用者的既有字級偏好可無痛沿用。
 */
export function FieldingNotationPreferencesProvider({ children }: { children: ReactNode }) {
  const [fontSize, setStoredFontSize] = useState(DEFAULT_FIELDING_NOTATION_FONT_SIZE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY)
      .then((stored) => {
        if (mounted) setStoredFontSize(normalizeFieldingNotationFontSize(stored));
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setFontSize = useCallback((value: number) => {
    const normalized = normalizeFieldingNotationFontSize(value);
    setStoredFontSize(normalized);
    void AsyncStorage.setItem(FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY, String(normalized)).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ fontSize, isReady, setFontSize }), [fontSize, isReady, setFontSize]);
  return <FieldingNotationPreferencesContext.Provider value={value}>{children}</FieldingNotationPreferencesContext.Provider>;
}

export function useFieldingNotationPreferences() {
  const context = useContext(FieldingNotationPreferencesContext);
  if (!context) throw new Error("useFieldingNotationPreferences 必須在 FieldingNotationPreferencesProvider 中使用");
  return context;
}
