# 現場記錄介面修正計畫：壘包與跑壘紀錄背景圖縮放與本次打者打席格放大

本計畫旨在解決使用者回報的兩個現場記錄介面 UI 調整需求：
1. 「現場記錄-壘包與跑壘紀錄」中的背景圖（棒球場俯視圖）在不同解析度平板／手機時容易被裁剪，需改為與介面框同比例縮放並完整呈現。
2. 「現場記錄-本次打者 · 早稻田打席格」內外圈與外框間距過大，需等比例放大其中的虛線、符號、事件等元素。

---

## 系統架構與修改點

```mermaid
graph TD
    A[使用者介面: app/(tabs)/index.tsx] --> B[LiveInfieldPanel: 壘包與跑壘紀錄]
    A --> C[CurrentAtBatPanel: 本次打者打席格]
    B --> D[ImageBackground: live-infield-background.jpg]
    C --> E[WasedaPersonalRecordCell: size=large]
    
    style B fill:#e1f5fe,stroke:#01579b
    style C fill:#e8f5e9,stroke:#2e7d32
    style D fill:#fff9c4,stroke:#fbc02d
    style E fill:#f3e5f5,stroke:#7b1fa2
```

---

## 詳細修正步驟

### 1. 修正「壘包與跑壘紀錄」背景圖比例與自適應
- **目標檔案**：[`app/(tabs)/index.tsx`](app/(tabs)/index.tsx:5775)
- **調整內容**：
  - 確保 `ImageBackground` 的 `resizeMode="contain"`。
  - 調整 `liveRunnerCross` 樣式的 `aspectRatio` 與容器約束，使其能隨螢幕解析度彈性等比例縮放（contain），確保棒球場內野俯視圖的四個壘包與外野草地邊緣完整顯示而不被裁切。

### 2. 修正「本次打者 · 早稻田打席格」等比例放大
- **目標檔案**：[`components/baseball/waseda-personal-record-cell.tsx`](components/baseball/waseda-personal-record-cell.tsx:367)
- **調整內容**：
  - 針對 `large` 尺寸（或專為 `size === "large"` 的打席格）引入專門的縮放比例（例如 `diamondStage` 放大尺寸從 68px 提升至 110~120px 左右）。
  - 同步放大內部 `diamond` 虛線菱形、`batterFirstBaseMark`、`outerMarks`、`innerMark` 以及跑壘／安打進壘線，消弭內外圈與外框間距過大的視覺落差。

---

## 驗證計畫
1. 檢視程式碼變更是否符合 React Native / NativeWind 規範。
2. 確認在各尺寸裝置（手機／平板）上，壘包與跑壘紀錄背景圖完整呈現，且本次打者打席格內部元素大小適中、排版精美。
