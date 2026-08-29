import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), 'build-state.json');
const BUILD_INFO_FILE = path.join(process.cwd(), 'build-info.json');
const APP_CONFIG_PATH = path.join(process.cwd(), 'app.config.ts');

// 取得當天日期 YYYYMMDD
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const todayStr = `${year}${month}${day}`;

// 讀取或初始化狀態
let state = {
  major: 1,
  minor: 1,
  aa: 2,
  lastDate: "20260827",
  serial: 4,
  versionCode: 149
};

if (fs.existsSync(STATE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state = { ...state, ...data };
  } catch (e) {
    console.error("讀取 build-state.json 失敗，使用預設值", e);
  }
}

// 根據邏輯更新版本：
// 1.1.AA.日期-VBB
// 1. 大改版次 (major)
// 2. 小改版次 (AA，一日一個版次遞加)
// 3. 修改當天日期 (日期)
// 4. 流水號 (VBB，由00開始遞加至隔日歸零)

if (todayStr !== state.lastDate) {
  // 隔日：日期不同，小改版次 AA 遞加 1，流水號 serial 歸零 00
  state.aa += 1;
  state.serial = 0;
  state.lastDate = todayStr;
} else {
  // 當日：流水號 serial 遞加 1
  state.serial += 1;
}

state.versionCode += 1;

const serialStr = String(state.serial).padStart(2, '0');
const buildIdentifier = `${state.major}.${state.minor}.${state.aa}.${todayStr}-V${serialStr}`;
const version = `${state.major}.${state.minor}.${state.aa}`;
const buildDate = `${year}-${month}-${day}`;

// 寫入 build-state.json
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

// 寫入 build-info.json 供 app.config.ts 讀取
const buildInfo = {
  version,
  versionCode: state.versionCode,
  buildIdentifier,
  buildDate
};
fs.writeFileSync(BUILD_INFO_FILE, JSON.stringify(buildInfo, null, 2), 'utf8');

console.log(`[Build Version Updated]`);
console.log(`- Version: ${version}`);
console.log(`- VersionCode: ${state.versionCode}`);
console.log(`- Build Identifier: ${buildIdentifier}`);
console.log(`- Build Date: ${buildDate}`);
