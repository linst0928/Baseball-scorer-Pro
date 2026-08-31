import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");
const readProjectFile = (relativePath: string) => readFileSync(resolve(projectRoot, relativePath), "utf8");

describe("Android 橫式與設定配色回饋", () => {
  it("同時以 Expo 建置設定與執行期鎖定維持橫式介面", () => {
    const appConfig = readProjectFile("app.config.ts");
    const rootLayout = readProjectFile("app/_layout.tsx");

    expect(appConfig).toContain('orientation: "landscape"');
    expect(appConfig).toContain('"expo-screen-orientation"');
    expect(appConfig).toContain('"initialOrientation": "LANDSCAPE"');
    expect(appConfig).toContain('"./plugins/with-android-landscape"');
    expect(rootLayout).toContain('ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)');
    expect(rootLayout).toContain('if (state === "active") void lockLandscape()');
    expect(rootLayout).toContain('ScreenOrientation.addOrientationChangeListener');
    expect(rootLayout).toContain('orientationSubscription.remove()');
  });

  it("Android 原生設定、設定中心與新增比賽精靈會共同提供建置核對與鍵盤避讓", () => {
    const appConfig = readProjectFile("app.config.ts");
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(appConfig).toContain('version: "1.1.2"');
    expect(appConfig).toContain('softwareKeyboardLayoutMode: "resize"');
    expect(appConfig).toContain("versionCode: 149");
    expect(appConfig).toContain('buildIdentifier: "1.1.2-20260827-V04"');
    expect(appConfig).toContain('buildDate: "2026-08-27"');
    expect(homeScreen).toContain("建置識別碼");
    expect(homeScreen).toContain("建置日期");
    expect(homeScreen).toContain("KeyboardAvoidingView");
    expect(homeScreen).toContain('keyboardShouldPersistTaps="handled"');
    expect(homeScreen).toContain('keyboardDismissMode="on-drag"');
    expect(homeScreen).toContain('returnKeyType="done"');
    expect(homeScreen).toContain("commitPitchLimitThresholds");
    expect(homeScreen).toContain("useCompactPitchLimitLayout");
    expect(homeScreen).toContain("wizardScrollContentWithPitchLimit");
    expect(homeScreen).toContain("wizardPitchLimitFieldFocused");
  });

  it("單場整體紀錄工作台採用棒次主列、固定三格可擴充承接列與逐局共享打席格的動態投影", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");
    const teamSheet = readProjectFile("components/baseball/waseda-scorebook-team-sheet.tsx");
    const projection = readProjectFile("lib/baseball/waseda-scorebook-projection.ts");

    expect(homeScreen).toContain("<WasedaScorebookTeamSheet");
    expect(teamSheet).toContain("先發 1–9 棒為直向主列");
    expect(teamSheet).toContain("每棒次固定預留三格球員承接欄");
    expect(teamSheet).toContain("單一棒次使用一組三格球員承接列；換人時增加列，但逐局打席格仍由整個棒次共用");
    expect(projection).toContain("maxPlateAppearances");
    expect(projection).toContain("while (order.entries.length < 3)");
    expect(projection).toContain("appearanceIndex");
    expect(teamSheet).toContain("const sharedSlotCount");
    expect(teamSheet).toContain("const displayedEntries = order.entries.slice(0, Math.max(3, order.entries.length))");
    expect(teamSheet).toContain("const SLOT_HEIGHT = 70");
    expect(teamSheet).toContain("const INNING_WIDTH = 92");
    expect(teamSheet).toContain("不保留粗框外側空白");
    expect(teamSheet).toContain("const activeEntry");
    expect(teamSheet).toContain("sharedEntryLane");
    expect(teamSheet).toContain("getScorebookSubstitutionMarker");
    expect(teamSheet).toContain("replacementBadge={appearance.replacementBadge}");
    expect(teamSheet).toContain("defenseTimeline");
    expect(teamSheet).toContain("守備轉換時間線");
    expect(projection).toContain("pitchingChangeByEventId");
    expect(projection).toContain("ScorebookPitchingChangeBadge");
    expect(projection).toContain('code: "PH"');
    expect(projection).toContain('code: "PR"');
    expect(projection).toContain('code: "PF"');
    expect(homeScreen).toContain("<ScorebookGameSelector");
    expect(homeScreen).toContain("<ScorebookDisplayEditor");
    expect(homeScreen).toContain("onLongPressAtBatEvent");
    expect(homeScreen).toContain("onLongPressEntry");
    expect(homeScreen).toContain("onLongPressBlankSlot");
    expect(homeScreen).toContain("FormalBlankSlotLiveWorkflowModal");
    expect(homeScreen).toContain("onApplyFormalBlankSlotCorrection");
    expect(homeScreen).toContain("onApplyFormalAtBatReplacement");
    expect(homeScreen).toContain("正式重建預覽");
    expect(homeScreen).toContain("確認正式重建");
    expect(homeScreen).toContain("不死三振 K+");
    expect(homeScreen).toContain("正式補登｜現場紀錄流程");
    expect(homeScreen).toContain('["pitches", "逐球"]');
    expect(homeScreen).toContain('["fielding", "傳球"]');
    expect(teamSheet).toContain("先攻打擊");
    expect(teamSheet).toContain("打序");
    expect(teamSheet).toContain("每棒次固定預留三格球員承接欄");
    expect(teamSheet).toContain("右側每局由整個棒次共用實際打席格");
    expect(teamSheet).toContain('size="compact"');
    expect(teamSheet).toContain("長按修改第${order.battingOrder}棒第${entryIndex + 1}格球員");
    expect(teamSheet).toContain("長按修改第${order.battingOrder}棒第${entryIndex + 1}格守備位置");
    expect(teamSheet).toContain("sharedDefenseEditTarget");
    expect(teamSheet).toContain("const substitutionInnings");
    expect(teamSheet).toContain("const visibleInnings");
    expect(teamSheet).toContain("僅替換局：");
    expect(teamSheet).toContain("inningQuickViewToggle");
    expect(teamSheet).toContain('ellipsizeMode="tail"');
    expect(teamSheet).toContain("sharedEntryRoleChip: { width: 28");
    expect(teamSheet).toContain("sharedEntryHandoff: { width: 44");
    expect(projection).toContain("handoffPitchNumber?: number");
    expect(projection).toContain('handoffPitchNumber: substitution.handoffPitchNumber');
    expect(homeScreen).toContain("initialHandoffPitchNumber={pitchDraft.total}");
    expect(homeScreen).toContain("const [handoffPitchNumber, setHandoffPitchNumber]");
    expect(homeScreen).toContain("第 N 球交接");
    expect(homeScreen).toContain("精確交接：{handoffSummary}");
    expect(homeScreen).toContain("handoffPitchNumber: parsedHandoffPitchNumber");
  });

  it("新增場次精靈在橫式裝置會取得明確可用高度，並保留可收縮的鍵盤安全捲動與導覽區", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain('wizardModalSheet: { height: "96%", width: "100%", alignSelf: "stretch", flexShrink: 1, minHeight: 0');
    expect(homeScreen).toContain('wizardKeyboardAvoiding: { flex: 1, minHeight: 0, flexShrink: 1 }');
    expect(homeScreen).toContain('wizardScrollContent: { flexGrow: 1, paddingBottom: 18 }');
    expect(homeScreen).toContain('wizardNavigation: { flexShrink: 0, flexDirection: "row"');
    expect(homeScreen).toContain('behavior={Platform.OS === "ios" ? "padding" : "height"}');
    expect(homeScreen).toContain('keyboardShouldPersistTaps="handled"');
    expect(homeScreen).toContain('keyboardDismissMode="on-drag"');
  });

  it("設定中心以誠實的建置前檢查動畫導引用戶進入 Publish，而非將裝置端動畫誤稱為 APK 已完成", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const [apkBuildGuideStage");
    expect(homeScreen).toContain('"正在檢查 APK 建置前置條件"');
    expect(homeScreen).toContain("ActivityIndicator");
    expect(homeScreen).toContain("startApkBuildGuide");
    expect(homeScreen).toContain("按下 Publish");
    expect(homeScreen).toContain("實際的「建置中／成功／失敗」狀態");
  });

  it("原生 Android 外掛直接將 MainActivity 固定為 landscape", () => {
    const landscapePlugin = readProjectFile("plugins/with-android-landscape.js");

    expect(landscapePlugin).toContain('mainActivity.$["android:screenOrientation"] = "landscape"');
    expect(landscapePlugin).toContain('"orientation"');
    expect(landscapePlugin).toContain('"screenSize"');
  });

  it("GitHub Actions 在推送與合併請求時執行 TypeScript 與 Vitest", () => {
    const androidWorkflow = readProjectFile(".github/workflows/build.yml");

    expect(androidWorkflow).toContain("pnpm check");
    expect(androidWorkflow).toContain("pnpm test");
    expect(androidWorkflow).toContain("pnpm exec expo prebuild --platform android --clean --no-install");
    expect(androidWorkflow).toContain('android:screenOrientation="landscape"');
  });

  it("首頁提供低高度的方向鎖定中診斷標記並持續讀取橫式鎖定狀態", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain('label: "方向鎖定中"');
    expect(homeScreen).toContain("ScreenOrientation.getOrientationLockAsync()");
    expect(homeScreen).toContain("ScreenOrientation.addOrientationChangeListener");
    expect(homeScreen).toContain("ScreenOrientation.removeOrientationChangeListener(subscription)");
    expect(homeScreen).toContain("orientationDiagnosticPill");
    expect(homeScreen).toContain("orientationDiagnosticText: { color: BRAND.navy, fontSize: 8");
  });

  it("方向診斷旁提供可重新套用橫式鎖定的緊湊控制項", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const relockLandscape");
    expect(homeScreen).toContain("ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)");
    expect(homeScreen).toContain("orientationRelockPill");
    expect(homeScreen).toContain('accessibilityLabel="重新鎖定橫式方向"');
    expect(homeScreen).toContain("void relockLandscape()");
  });

  it("建立球隊時會以不分大小寫的名稱檢查阻擋重複隊名", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const hasDuplicateTeamName");
    expect(homeScreen).toContain('toLocaleLowerCase("zh-Hant")');
    expect(homeScreen).toContain('Alert.alert("此隊名已存在"');
  });

  it("既有球隊支援新增、完整編輯及確認刪除球員資料", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const addPlayer = useCallback");
    expect(homeScreen).toContain("const deletePlayer = useCallback");
    expect(homeScreen).toContain('label="＋ 新增球員"');
    expect(homeScreen).toContain('label="編輯完整資料"');
    expect(homeScreen).toContain('Alert.alert("刪除球員"');
    expect(homeScreen).toContain("PreferredPositionFieldPicker selectedPositions={playerEditor.preferredPositions}");
    expect(homeScreen).toContain("同一球隊的球員背號不可重複");
  });

  it("設定中心切換配色時會更新可見工作台外框並提供觸覺回饋", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const themedChrome = useMemo");
    expect(homeScreen).toContain("interfacePalette.background");
    expect(homeScreen).toContain("interfacePalette.surface");
    expect(homeScreen).toContain("themedChrome.topBar");
    expect(homeScreen).toContain("themedChrome.bottomNav");
    expect(homeScreen).toContain("Haptics.selectionAsync()");
  });

  it("所有介面模式會橋接至共用色票、主容器與橫式導覽列", () => {
    const useColors = readProjectFile("hooks/use-colors.ts");
    const screenContainer = readProjectFile("components/screen-container.tsx");
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(useColors).toContain('useThemeContext');
    expect(useColors).toContain('...interfacePalette');
    expect(useColors).toContain('tint: interfacePalette.primary');
    expect(screenContainer).toContain('backgroundColor: interfacePalette.background');
    expect(homeScreen).toContain('topBar: { backgroundColor: interfacePalette.primary');
    expect(homeScreen).toContain('const { interfacePalette } = useThemeContext();');
    expect(homeScreen).toContain('active ? interfacePalette.primary : interfacePalette.muted');
  });

  it("提供跟隨系統模式與完整語意調色盤縮圖", () => {
    const themeProvider = readProjectFile("lib/theme-provider.tsx");
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(themeProvider).toContain('"system"');
    expect(themeProvider).toContain('label: "跟隨系統"');
    expect(themeProvider).toContain('interfaceColorMode === "system"');
    expect(themeProvider).toContain('mode === "system" ? systemScheme');
    expect(homeScreen).toContain("function InterfacePalettePreview");
    expect(homeScreen).toContain("<InterfacePalettePreview palette={previewPalette} />");
    expect(homeScreen).toContain("interfacePalettePreviewStatusRow");
    expect(homeScreen).toContain("const palettePreviewForMode");
    expect(homeScreen).toContain('INTERFACE_COLOR_MODES.map');
  });

  it("非原廠主題為背景、表面、文字、邊框與三種狀態色建立獨立完整色票", () => {
    const themeProvider = readProjectFile("lib/theme-provider.tsx");

    expect(themeProvider).toContain("export function resolveInterfacePalette");
    for (const mode of ["vivid", "colorful", "deep", "grayscale", "custom"] as const) {
      expect(themeProvider).toContain(`if (resolvedMode === \"${mode}\")`);
    }
    for (const token of ["background", "surface", "foreground", "muted", "border", "success", "warning", "error"]) {
      expect(themeProvider).toContain(`${token}:`);
    }
    expect(themeProvider).toContain("mixHex(primary");
  });

  it("設定中心的可見卡片、輸入欄與建置狀態均使用目前介面調色盤", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("settingsTheme.section");
    expect(homeScreen).toContain("settingsTheme.input");
    expect(homeScreen).toContain("settingsTheme.statusCard");
    expect(homeScreen).toContain("settingsTheme.apkCard");
    expect(homeScreen).toContain("color={interfacePalette.primary}");
    expect(homeScreen).toContain("backgroundColor: interfacePalette.error");
  });

  it("橫式球員詳情擴大守位摘要，棒次選取列同時呈現背號、姓名與投打縮寫", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("numberOfLines={2} style={styles.playerPreferredPositionsText}");
    expect(homeScreen).toContain('playerPreferredPositionsReadout: { flexBasis: 216');
    expect(homeScreen).toContain('battingNumberOption: { minWidth: 112');
    expect(homeScreen).toContain("#{player.number} {player.name} {playerHandAbbr(player)}");
    expect(homeScreen).toContain("從下方球員選項選擇");
  });

  it("工作台次要卡片與棒次球員選項皆使用完整調色盤及清楚的選取按壓回饋", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("function FieldCard");
    expect(homeScreen).toContain("function FullPreview");
    expect(homeScreen).toContain("const { interfacePalette } = useThemeContext();");
    expect(homeScreen).toContain("backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border");
    expect(homeScreen).toContain("interfacePalette.foreground");
    expect(homeScreen).toContain("interfacePalette.muted");
    expect(homeScreen).toContain("accessibilityState={{ selected: isAssigned }}");
    expect(homeScreen).toContain("shadowOpacity: isAssigned ? 0.28 : 0");
    expect(homeScreen).toContain("transform: [{ scale: 0.96 }]");
    expect(homeScreen).toContain("✓ ");
    expect(homeScreen).toContain("已選：{activeBattingPlayer");
  });

  it("完整預覽的逐球欄優先顯示正式修正，未修正時才回退原始逐球或 notation", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const correctedPitchMarks = event.recordCorrection?.pitchMarks?.trim();");
    expect(homeScreen).toContain("const originalPitchMarks = (event.pitches.locations ?? []).map((pitch) => getWasedaPitchMark(pitch.outcome)).join(\"\");");
    expect(homeScreen).toContain("const pitchMarks = correctedPitchMarks || originalPitchMarks || event.notation;");
    expect(homeScreen).toContain("{pitchMarks}");
  });

  it("現場紀錄標題列提供可關閉的首頁主版符號速查表，且彈窗使用目前完整介面調色盤", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain('onOpenSymbolReference={() => setShowSymbolReference(true)}');
    expect(homeScreen).toContain('accessibilityLabel="開啟早稻田符號對照表"');
    expect(homeScreen).toContain("function SymbolReferenceModal");
    expect(homeScreen).toContain('accessibilityLabel="關閉符號對照表"');
    expect(homeScreen).toContain("WASEDA_SYMBOL_CATEGORIES.map");
    expect(homeScreen).toContain("WASEDA_SYMBOL_REFERENCE.filter");
    expect(homeScreen).toContain("backgroundColor: interfacePalette.background");
    expect(homeScreen).toContain("borderColor: interfacePalette.border");
    expect(homeScreen).toContain("color: interfacePalette.foreground");
  });

  it("首頁、新手教學與現場紀錄均開啟同一份首頁主版早稻田符號速查表", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain('onOpenSymbolReference={() => setShowSymbolReference(true)}');
    expect(homeScreen).toContain('onOpenSymbols={() => { completeTutorial(); setShowSymbolReference(true); }}');
    expect(homeScreen).not.toContain('router.push("/symbols")');
    expect(homeScreen).toContain("早稻田符號速查");
    expect(homeScreen).toContain("WASEDA SCOREKEEPING");
    expect(homeScreen).toContain("早稻田符號速查表");
    expect(homeScreen).toContain("依 1189LAB 對齊，由「位置」開始查詢");
  });

  it("共用符號速查表以首頁主版的搜尋、分類與緊湊雙欄卡呈現完整說明", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain('accessibilityLabel="搜尋早稻田符號"');
    expect(homeScreen).toContain("const [selectedCategory");
    expect(homeScreen).toContain("WASEDA_SYMBOL_CATEGORIES.map");
    expect(homeScreen).toContain('symbolReferenceCard: { width: "49.5%"');
    expect(homeScreen).toContain("symbolReferenceDescription");
    expect(homeScreen).toContain("symbolReferencePlacement");
    expect(homeScreen).toContain("範例：{item.example}");
    expect(homeScreen).toContain("item.description");
    expect(homeScreen).toContain("找不到符合的符號");
    expect(homeScreen).toContain("accessibilityLabel={`${item.mark}，${item.title}，${item.placement}；${item.description}");
  });

  it("現場紀錄開啟的共用符號表置中於近全高可視區，首列符號卡可由內部清單立即檢視", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("styles.symbolReferenceBackdrop");
    expect(homeScreen).toContain('symbolReferenceBackdrop: { flex: 1, alignItems: "center", justifyContent: "center"');
    expect(homeScreen).toContain('symbolReferenceSheet: { width: "98%", maxWidth: 1320, height: "94%", minHeight: 0, alignSelf: "center"');
    expect(homeScreen).toContain('symbolReferenceViewport: { flex: 1, minHeight: 126');
    expect(homeScreen).toContain('contentContainerStyle={styles.symbolReferenceViewportContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled');
    expect(homeScreen).toContain('symbolReferenceCard: { width: "49.5%", minHeight: 78');
  });

  it("小螢幕符號對照表支援雙指縮放、單指拖曳與可回復的一鍵重設控制", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("PanResponder.create");
    expect(homeScreen).toContain("雙指縮放、放大後可橫向拖曳");
    expect(homeScreen).toContain('accessibilityLabel="縮小符號對照表"');
    expect(homeScreen).toContain('accessibilityLabel="放大符號對照表"');
    expect(homeScreen).toContain('accessibilityLabel="重設符號對照表檢視"');
    expect(homeScreen).toContain("Math.max(0.48, Math.min(2.2, nextZoom))");
    expect(homeScreen).toContain("symbolReferenceViewport: { flex: 1, minHeight: 126, borderWidth: 1, borderRadius: 12 }");
  });

  it("匯出視窗僅為已核對的內建場次顯示基本比分與逐局 CSV 入口", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");
    const fuxingData = readProjectFile("lib/baseball/fuxing2026Data.ts");
    const exportUtility = readProjectFile("lib/baseball/export.ts");

    expect(homeScreen).toContain("canExportVerifiedScoreCsv={isFuxing2026VerifiedScoreGame(activeGame)}");
    expect(homeScreen).toContain('label="匯出核對 CSV"');
    expect(homeScreen).toContain("shareGameScoreCsv");
    expect(homeScreen).toContain("未包含未核對的逐球或個人統計");
    expect(fuxingData).toContain("FUXING_2026_VERIFIED_SCORE_GAME_IDS");
    expect(fuxingData).toContain("isFuxing2026VerifiedScoreGame");
    expect(exportUtility).toContain("buildGameScoreCsv");
    expect(exportUtility).toContain("shareGameScoreCsv");
    expect(exportUtility).toContain("text/csv;charset=utf-8");
  });

  it("設定中心明確顯示本機資料保存，且主畫面不含 OAuth 或雲端同步呼叫", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("const OFFLINE_MODE = true");
    expect(homeScreen).toContain('AsyncStorage.getItem(STORAGE_KEY)');
    expect(homeScreen).toContain('AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))');
    expect(homeScreen).toContain('本機資料儲存');
    expect(homeScreen).toContain('本機已保存');
    expect(homeScreen).toContain('此版本尚未部署雲端同步');
    expect(homeScreen).toContain('accessibilityLabel="本機資料保存說明"');
    expect(homeScreen).not.toMatch(/startOAuthLogin|trpc\.sync|cloudSnapshot|cloudSave|syncToCloudNow|useAuth\(/);
  });

  it("首頁工具列與歡迎列使用棒球計分圖示，取代文字記號標誌", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain('require("../../assets/images/baseball-scorecard-logo.png")');
    expect(homeScreen).toContain('style={styles.brandMarkImage}');
    expect(homeScreen).toContain('style={styles.miniAvatarImage}');
    expect(homeScreen).toContain('accessibilityLabel="Baseball Scorer 記分圖示"');
    expect(homeScreen).toContain('isDarkInterface && styles.brandMarkDark');
    expect(homeScreen).toContain('isDarkInterface && styles.miniAvatarDark');
    expect(homeScreen).toContain('brandMarkDark: { borderWidth: 1.5');
    expect(homeScreen).toContain('miniAvatarDark: { borderWidth: 1.5');
  });

  it("逐步紀錄在成功寫入與復原時提供不阻擋操作的短暫視覺回饋", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");

    expect(homeScreen).toContain("function OperationFeedbackToast");
    expect(homeScreen).toContain('announceOperationFeedback("success", "換人已寫入"');
    expect(homeScreen).toContain('announceOperationFeedback("restore", "已回復上一筆紀錄"');
    expect(homeScreen).toContain('announceOperationFeedback("success", "特殊紀錄已寫入"');
    expect(homeScreen).toContain('accessibilityLiveRegion="polite"');
    expect(homeScreen).toContain("duration: 160");
    expect(homeScreen).toContain("2500");
    expect(homeScreen).toContain("pointerEvents=\"none\"");
  });

  it("單場整體紀錄移除右側舊補登與換人控制，僅保留長按打席格的安全補正入口", () => {
    const homeScreen = readProjectFile("app/(tabs)/index.tsx");
    const start = homeScreen.indexOf("function SingleGameRecord");
    const end = homeScreen.indexOf("function GameRecordDetailModal");
    const singleGameRecord = homeScreen.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(singleGameRecord).not.toContain("補登打席");
    expect(singleGameRecord).not.toContain("現場紀錄修改");
    expect(singleGameRecord).not.toContain("新增換人");
    expect(singleGameRecord).toContain("onOpenCorrection");
    expect(homeScreen).toContain("選擇修改方式");
    expect(homeScreen).toContain("預覽修改結果");
    expect(homeScreen).toContain("isRecordCorrectionUnlocked(game, event)");
  });
});
