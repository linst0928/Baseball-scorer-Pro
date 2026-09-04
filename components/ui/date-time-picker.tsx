import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Platform,
  Dimensions,
} from "react-native";

// Same colors as BRAND in index.tsx to ensure perfect visual integration
const THEME = {
  navy: "#123A68",
  blue: "#1D5FA7",
  sky: "#EAF3FB",
  muted: "#6A7A8F",
  line: "#D8E2ED",
  paper: "#F7FAFD",
  white: "#FFFFFF",
  ink: "#10243E",
};

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  style?: any;
}

/**
 * Helper to format a Date as YYYY-MM-DD in local time
 */
export function getSystemLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calendar DatePicker Component
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "選擇日期",
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Parse current value or fallback to current system date
  const selectedDate = useMemo(() => {
    if (!value) return new Date();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [value]);

  // Calendar states (focused year & month)
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth()); // 0-indexed

  // Format display text
  const displayText = value || getSystemLocalDateString();

  // Handle open modal
  const handleOpen = () => {
    const d = value ? new Date(value) : new Date();
    const validD = isNaN(d.getTime()) ? new Date() : d;
    setCurrentYear(validD.getFullYear());
    setCurrentMonth(validD.getMonth());
    setModalVisible(true);
  };

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)

    const list: Array<{ day: number | null; dateString: string | null }> = [];

    // Padding for previous month days
    for (let i = 0; i < firstDayIndex; i++) {
      list.push({ day: null, dateString: null });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(currentMonth + 1).padStart(2, "0");
      const dayStr = String(day).padStart(2, "0");
      list.push({
        day,
        dateString: `${currentYear}-${monthStr}-${dayStr}`,
      });
    }

    return list;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setModalVisible(false);
  };

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ];

  const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[styles.inputContainer, style]}
        accessibilityRole="button"
        accessibilityLabel={`日期選擇：${displayText}`}
      >
        <Text style={styles.inputText}>{displayText}</Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={handlePrevMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>◀</Text>
              </Pressable>
              <Text style={styles.calendarTitle}>
                {currentYear}年 {monthNames[currentMonth]}
              </Text>
              <Pressable onPress={handleNextMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>▶</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {weekLabels.map((lbl, idx) => (
                <Text
                  key={lbl}
                  style={[
                    styles.weekLabel,
                    (idx === 0 || idx === 6) && styles.weekendLabel,
                  ]}
                >
                  {lbl}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((item, idx) => {
                const isSelected = item.dateString === value;
                const isToday =
                  item.dateString === getSystemLocalDateString();

                return (
                  <Pressable
                    key={idx}
                    disabled={!item.day}
                    onPress={() => item.dateString && handleSelectDay(item.dateString)}
                    style={[
                      styles.dayCell,
                      !item.day && styles.emptyCell,
                      isSelected && styles.selectedDayCell,
                      isToday && !isSelected && styles.todayCell,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !item.day && styles.emptyDayText,
                        isSelected && styles.selectedDayText,
                        isToday && !isSelected && styles.todayText,
                      ]}
                    >
                      {item.day || ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footerRow}>
              <Pressable
                onPress={() => handleSelectDay(getSystemLocalDateString())}
                style={[styles.footerButton, styles.todayButton]}
              >
                <Text style={styles.todayButtonText}>帶入今天</Text>
              </Pressable>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.footerButton}
              >
                <Text style={styles.closeButtonText}>關閉</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

interface TimePickerProps {
  value: string; // HH:MM (24h)
  onChange: (time: string) => void;
  placeholder?: string;
  style?: any;
}

/**
 * 24-hour Digital Clock TimePicker Component
 */
export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  placeholder = "08:00",
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Parse current HH:MM or fallback to "08:00"
  const timeParts = useMemo(() => {
    const fallback = { hour: 8, minute: 0 };
    if (!value) return fallback;
    const parts = value.split(":");
    if (parts.length !== 2) return fallback;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return {
      hour: isNaN(h) || h < 0 || h > 23 ? 8 : h,
      minute: isNaN(m) || m < 0 || m > 59 ? 0 : m,
    };
  }, [value]);

  const [tempHour, setTempHour] = useState(timeParts.hour);
  const [tempMinute, setTempMinute] = useState(timeParts.minute);

  const displayTime = value || "08:00";

  const handleOpen = () => {
    setTempHour(timeParts.hour);
    setTempMinute(timeParts.minute);
    setModalVisible(true);
  };

  const handleConfirm = () => {
    const hrStr = String(tempHour).padStart(2, "0");
    const minStr = String(tempMinute).padStart(2, "0");
    onChange(`${hrStr}:${minStr}`);
    setModalVisible(false);
  };

  // Hour and Minute selections
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[styles.inputContainer, style]}
        accessibilityRole="button"
        accessibilityLabel={`時間選擇：${displayTime}`}
      >
        <Text style={styles.inputText}>{displayTime}</Text>
        <Text style={styles.calendarIcon}>🕒</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.timeModalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.timePickerTitle}>選擇時間 (24小時制)</Text>

            <View style={styles.digitalClockDisplay}>
              <Text style={styles.digitalClockText}>
                {String(tempHour).padStart(2, "0")}:{String(tempMinute).padStart(2, "0")}
              </Text>
            </View>

            <View style={styles.selectorsRow}>
              {/* Hours Column */}
              <View style={styles.selectorColumn}>
                <Text style={styles.columnHeader}>時</Text>
                <FlatList
                  data={hours}
                  keyExtractor={(item) => `hr-${item}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollList}
                  initialScrollIndex={Math.max(0, tempHour - 2)}
                  getItemLayout={(_, index) => ({
                    length: 40,
                    offset: 40 * index,
                    index,
                  })}
                  renderItem={({ item }) => {
                    const isSelected = item === tempHour;
                    return (
                      <Pressable
                        onPress={() => setTempHour(item)}
                        style={[
                          styles.timeOption,
                          isSelected && styles.timeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            isSelected && styles.timeOptionTextActive,
                          ]}
                        >
                          {String(item).padStart(2, "0")}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>

              <Text style={styles.dividerCol}>:</Text>

              {/* Minutes Column */}
              <View style={styles.selectorColumn}>
                <Text style={styles.columnHeader}>分</Text>
                <FlatList
                  data={minutes}
                  keyExtractor={(item) => `min-${item}`}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollList}
                  initialScrollIndex={Math.max(0, tempMinute - 2)}
                  getItemLayout={(_, index) => ({
                    length: 40,
                    offset: 40 * index,
                    index,
                  })}
                  renderItem={({ item }) => {
                    const isSelected = item === tempMinute;
                    return (
                      <Pressable
                        onPress={() => setTempMinute(item)}
                        style={[
                          styles.timeOption,
                          isSelected && styles.timeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            isSelected && styles.timeOptionTextActive,
                          ]}
                        >
                          {String(item).padStart(2, "0")}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>

            <View style={styles.timeFooterRow}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[styles.timeFooterBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={[styles.timeFooterBtn, styles.confirmBtn]}
              >
                <Text style={styles.confirmBtnText}>確定</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    height: 42,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 8,
    backgroundColor: THEME.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputText: {
    color: THEME.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  calendarIcon: {
    fontSize: 16,
    color: THEME.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 36, 62, 0.45)", // Beautiful elegant translucent backdrop
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.line,
    ...Platform.select({
      ios: {
        shadowColor: THEME.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 20px rgba(16, 36, 62, 0.15)",
      },
    }),
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.sky,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    fontSize: 11,
    color: THEME.blue,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.navy,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    paddingBottom: 6,
  },
  weekLabel: {
    width: "14%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: THEME.muted,
  },
  weekendLabel: {
    color: "#C83B44", // Red highlight for weekends
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 6,
  },
  dayCell: {
    width: "14%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  emptyCell: {
    backgroundColor: "transparent",
  },
  selectedDayCell: {
    backgroundColor: THEME.blue,
  },
  todayCell: {
    backgroundColor: THEME.sky,
    borderWidth: 1,
    borderColor: THEME.blue,
  },
  dayText: {
    fontSize: 13,
    fontWeight: "500",
    color: THEME.ink,
  },
  emptyDayText: {
    color: "transparent",
  },
  selectedDayText: {
    color: THEME.white,
    fontWeight: "700",
  },
  todayText: {
    color: THEME.blue,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 12,
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.sky,
  },
  todayButton: {
    backgroundColor: THEME.blue,
  },
  todayButtonText: {
    fontSize: 13,
    color: THEME.white,
    fontWeight: "600",
  },
  closeButtonText: {
    fontSize: 13,
    color: THEME.muted,
    fontWeight: "600",
  },

  // Time Picker Custom Styles
  timeModalSheet: {
    width: "100%",
    maxWidth: 280,
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.line,
    ...Platform.select({
      ios: {
        shadowColor: THEME.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 20px rgba(16, 36, 62, 0.15)",
      },
    }),
  },
  timePickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.navy,
    marginBottom: 12,
  },
  digitalClockDisplay: {
    backgroundColor: THEME.paper,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
  },
  digitalClockText: {
    fontSize: 28,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontWeight: "800",
    color: THEME.blue,
    letterSpacing: 2,
  },
  selectorsRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 160,
    width: "100%",
    justifyContent: "center",
    marginBottom: 16,
  },
  selectorColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.muted,
    marginBottom: 6,
  },
  scrollList: {
    paddingVertical: 40,
  },
  dividerCol: {
    fontSize: 24,
    fontWeight: "700",
    color: THEME.muted,
    paddingHorizontal: 12,
    height: "100%",
    lineHeight: 160,
    textAlign: "center",
  },
  timeOption: {
    height: 36,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginVertical: 2,
  },
  timeOptionActive: {
    backgroundColor: THEME.blue,
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: THEME.ink,
  },
  timeOptionTextActive: {
    color: THEME.white,
    fontWeight: "700",
  },
  timeFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 12,
    gap: 8,
  },
  timeFooterBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: THEME.sky,
  },
  confirmBtn: {
    backgroundColor: THEME.blue,
  },
  cancelBtnText: {
    fontSize: 13,
    color: THEME.muted,
    fontWeight: "600",
  },
  confirmBtnText: {
    fontSize: 13,
    color: THEME.white,
    fontWeight: "600",
  },
});
