/**
 * 棒球場地圖資產的唯一管理處。
 *
 * 首頁守備配置必須使用使用者於 2026-08-21 指定的原始棒球場俯視圖；
 * 不應以同圖的別名檔案取代，避免靜態資產路徑與快取辨識不一致。
 */
export const HOME_DEFENSE_FIELD_IMAGE_PATH = "assets/images/istockphoto-1269757192-612x612.jpg";
export const HOME_DEFENSE_FIELD_IMAGE_SHA256 = "3e54016b59f580b01c1bfb4a207118ffac237cf6beefdb681b216472ce157b31";
export const HOME_DEFENSE_FIELD_IMAGE = require("../assets/images/istockphoto-1269757192-612x612.jpg");

/** 「球員維護」與「新增場次」模組使用的內外野守備位置空白示意圖。 */
export const COMMON_DEFENSE_BLANK_FIELD_IMAGE_PATH = "assets/images/內外野守備位置(空白).jpg";
export const COMMON_DEFENSE_BLANK_FIELD_IMAGE = require("../assets/images/內外野守備位置(空白).jpg");

/** 現場紀錄「壘包與跑壘紀錄」使用的內野守備位置空白示意圖。 */
export const LIVE_INFIELD_BLANK_FIELD_IMAGE_PATH = "assets/images/內野守備位置(空白).jpg";
export const LIVE_INFIELD_BLANK_FIELD_IMAGE = require("../assets/images/內野守備位置(空白).jpg");
