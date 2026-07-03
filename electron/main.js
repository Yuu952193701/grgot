const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Determine environment and set base path for data isolation
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let baseDir = '';

if (isDev) {
  baseDir = process.platform === 'win32' ? 'C:\\dev-data' : '/dev-data';
} else {
  baseDir = process.platform === 'win32' ? 'C:\\data' : '/data';
}

// Ensure the directory exists
try {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
} catch (e) {
  console.error(`Failed to create base directory ${baseDir}:`, e.message);
  // Fallback to app path or userData in case of write permission issues
  const USER_DATA_PATH = app.getPath('userData');
  baseDir = path.join(USER_DATA_PATH, isDev ? 'dev-data' : 'data');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

// Configuration load/save helper
const CONFIG_PATH = path.join(app.getPath('userData'), 'procurement_config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load configuration:', e);
    }
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save configuration:', e);
    return false;
  }
}

// Load current folder config
const config = loadConfig();
let DB_DIR = config.dbDir || path.join(baseDir, 'database');
let BACKUP_DIR = config.backupDir || path.join(baseDir, 'backups');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

try {
  ensureDirExists(DB_DIR);
  ensureDirExists(BACKUP_DIR);
} catch (e) {
  console.error('Failed to ensure directory exists:', e);
  DB_DIR = path.join(baseDir, 'database');
  BACKUP_DIR = path.join(baseDir, 'backups');
  ensureDirExists(DB_DIR);
  ensureDirExists(BACKUP_DIR);
}

let DB_FILE_PATH = path.join(DB_DIR, 'data.db');

// Main state database cache / fallback
let dbDriver = null;
let databaseType = "JSON-Storage (Resilient Mode)";

function initDatabaseEngine() {
  // Close existing database connection if open
  if (dbDriver) {
    try {
      if (databaseType === 'better-sqlite3' || databaseType === 'sqlite3') {
        dbDriver.close();
      }
    } catch (e) {
      console.error("Error closing database connection during re-init:", e);
    }
    dbDriver = null;
  }

  // Attempt to load SQLite driver (sqlite3 or better-sqlite3) dynamically
  try {
    // Try loading better-sqlite3
    const Database = require('better-sqlite3');
    dbDriver = new Database(DB_FILE_PATH);
    databaseType = "better-sqlite3";
    console.log(`SQLite Engine loaded successfully via better-sqlite3 at: ${DB_FILE_PATH}`);
    
    // Create schema tables for storage
    dbDriver.exec(`
      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )
    `);
  } catch (e) {
    console.warn("better-sqlite3 is not pre-installed or failed to load. Trying sqlite3...", e.message);
    try {
      const sqlite3 = require('sqlite3').verbose();
      dbDriver = new sqlite3.Database(DB_FILE_PATH);
      databaseType = "sqlite3";
      console.log(`SQLite Engine loaded successfully via sqlite3 at: ${DB_FILE_PATH}`);
      
      // Create schema
      dbDriver.serialize(() => {
        dbDriver.run(`
          CREATE TABLE IF NOT EXISTS system_state (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
          )
        `);
      });
    } catch (err) {
      console.warn("No native SQLite drivers loaded. Falling back to robust File System structured database at:", DB_FILE_PATH, err.message);
      databaseType = "JSON-Storage (Resilient Mode)";
      dbDriver = null;
    }
  }
}

// Initial initialization of database engine
initDatabaseEngine();

// In Fallback JSON-FS mode, we read and write key-value state to the data.db file as a secure JSON manifest
function readFallbackData() {
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error("Error reading fallback storage file:", e);
      return {};
    }
  }
  return {};
}

function writeFallbackData(data) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error("Error writing fallback storage file:", e);
    return false;
  }
}

// IPC Handlers
ipcMain.handle('load-all-data', async () => {
  console.log(`[IPC] Loading all database tables. Engine: ${databaseType}`);
  if (dbDriver && databaseType === 'better-sqlite3') {
    try {
      const rows = dbDriver.prepare('SELECT key, value FROM system_state').all();
      const result = {};
      rows.forEach(row => {
        result[row.key] = JSON.parse(row.value);
      });
      return result;
    } catch (err) {
      console.error("better-sqlite3 load data error, falling back:", err);
    }
  } else if (dbDriver && databaseType === 'sqlite3') {
    return new Promise((resolve) => {
      dbDriver.all('SELECT key, value FROM system_state', [], (err, rows) => {
        if (err || !rows) {
          console.error("sqlite3 load data error, returning empty", err);
          resolve({});
          return;
        }
        const result = {};
        rows.forEach(row => {
          try {
            result[row.key] = JSON.parse(row.value);
          } catch(e) {}
        });
        resolve(result);
      });
    });
  }
  
  // Fallback JSON File Database
  return readFallbackData();
});

ipcMain.handle('save-data', async (event, key, value) => {
  console.log(`[IPC] Saving table: ${key} (${Array.isArray(value) ? value.length : 'Object'} records)`);
  const serialized = JSON.stringify(value);
  const now = new Date().toISOString();
  
  if (dbDriver && databaseType === 'better-sqlite3') {
    try {
      const stmt = dbDriver.prepare('INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)');
      stmt.run(key, serialized, now);
      return true;
    } catch (err) {
      console.error("better-sqlite3 write error", err);
    }
  } else if (dbDriver && databaseType === 'sqlite3') {
    return new Promise((resolve) => {
      dbDriver.run(
        'INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, ?)',
        [key, serialized, now],
        (err) => {
          if (err) {
            console.error("sqlite3 write error", err);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }
  
  // Fallback JSON File Database writing
  const data = readFallbackData();
  data[key] = value;
  return writeFallbackData(data);
});

ipcMain.handle('create-backup', async (event, type) => {
  const todayStr = new Date().toISOString().split('T')[0];
  let filename = `backup_${todayStr}.db`;
  if (type === 'manual') {
    const now = new Date();
    const hrs = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const secs = now.getSeconds().toString().padStart(2, '0');
    filename = `backup_${todayStr}_manual_${hrs}${mins}${secs}.db`;
  }
  
  const destPath = path.join(BACKUP_DIR, filename);
  console.log(`[IPC] Performing auto-backup copy. Destination: ${destPath}`);
  
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      fs.copyFileSync(DB_FILE_PATH, destPath);
      
      // Keep only last 30 backups to save user disk space
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
        
      if (files.length > 30) {
        for (let i = 30; i < files.length; i++) {
          fs.unlinkSync(path.join(BACKUP_DIR, files[i].name));
          console.log(`[IPC] Rotated and deleted old backup file: ${files[i].name}`);
        }
      }
      return { success: true, filename };
    }
    return { success: false, filename: '', error: '数据库主文件 data.db 尚未创建' };
  } catch (err) {
    console.error("Error creating physical backup copy:", err);
    return { success: false, filename: '', error: err.message };
  }
});

ipcMain.handle('restore-backup', async (event, filename) => {
  const sourcePath = path.join(BACKUP_DIR, filename);
  console.log(`[IPC] Requesting database restore from: ${sourcePath}`);
  
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '备份文件不存在' };
    }
    
    // Close the SQLite connection temporarily if needed
    if (dbDriver) {
      if (databaseType === 'better-sqlite3') {
        dbDriver.close();
      } else if (databaseType === 'sqlite3') {
        await new Promise((res) => dbDriver.close((e) => res(e)));
      }
    }
    
    // Physical copy
    fs.copyFileSync(sourcePath, DB_FILE_PATH);
    console.log(`[IPC] Restored backup copy successful. Reopening database...`);
    
    // Re-initialize drivers
    if (databaseType === 'better-sqlite3') {
      const Database = require('better-sqlite3');
      dbDriver = new Database(DB_FILE_PATH);
    } else if (databaseType === 'sqlite3') {
      const sqlite3 = require('sqlite3').verbose();
      dbDriver = new sqlite3.Database(DB_FILE_PATH);
    }
    
    return { success: true };
  } catch (err) {
    console.error("Restore database error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-backup', async (event, filename) => {
  const filePath = path.join(BACKUP_DIR, filename);
  console.log(`[IPC] Deleting physical backup file: ${filePath}`);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Delete backup error:", err);
    return false;
  }
});

ipcMain.handle('get-backups', async () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(fullPath);
        let type = 'manual';
        if (f.includes('_manual_')) {
          type = 'manual';
        } else {
          type = 'auto';
        }
        
        let loadedData = "";
        try {
          if (databaseType === 'JSON-Storage (Resilient Mode)') {
            loadedData = fs.readFileSync(fullPath, 'utf-8');
          } else {
            loadedData = JSON.stringify({ description: "SQLite Native Backup Segment" });
          }
        } catch(e) {}

        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          formattedDate: f.substring(7, 17),
          type,
          size: `${(stats.size / 1024).toFixed(1)} KB`,
          data: loadedData
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
    return files;
  } catch (err) {
    console.error("Get backups error:", err);
    return [];
  }
});

ipcMain.handle('get-app-path-info', async () => {
  return {
    dbPath: DB_FILE_PATH,
    backupPath: BACKUP_DIR
  };
});

ipcMain.handle('get-db-config', async () => {
  const defaultDbDir = path.join(baseDir, 'database');
  const defaultBackupDir = path.join(baseDir, 'backups');
  return {
    dbDir: DB_DIR,
    backupDir: BACKUP_DIR,
    dbPath: DB_FILE_PATH,
    defaultDbDir,
    defaultBackupDir
  };
});

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
});

ipcMain.handle('migrate-database', async (event, newDbDir) => {
  console.log(`[IPC] Requesting database migration to: ${newDbDir}`);
  const oldDbPath = DB_FILE_PATH;
  const oldDbDir = DB_DIR;
  const oldBackupDir = BACKUP_DIR;
  const oldDatabaseType = databaseType;
  
  const newDbPath = path.join(newDbDir, 'data.db');
  const newBackupDir = path.join(newDbDir, 'backups');
  
  try {
    // 1. Create target directories if they don't exist
    if (!fs.existsSync(newDbDir)) {
      fs.mkdirSync(newDbDir, { recursive: true });
    }
    if (!fs.existsSync(newBackupDir)) {
      fs.mkdirSync(newBackupDir, { recursive: true });
    }
    
    // 2. Close current database connection
    if (dbDriver) {
      if (databaseType === 'better-sqlite3' || databaseType === 'sqlite3') {
        dbDriver.close();
      }
      dbDriver = null;
    }
    
    // 3. Copy the database file if it exists at oldDbPath
    if (fs.existsSync(oldDbPath)) {
      fs.copyFileSync(oldDbPath, newDbPath);
      console.log(`[IPC Migration] Copied database from ${oldDbPath} to ${newDbPath}`);
    }
    
    // Also copy existing backup files over to the new backups folder
    if (fs.existsSync(oldBackupDir)) {
      const backupFiles = fs.readdirSync(oldBackupDir).filter(f => f.startsWith('backup_') && f.endsWith('.db'));
      for (const f of backupFiles) {
        fs.copyFileSync(path.join(oldBackupDir, f), path.join(newBackupDir, f));
      }
      console.log(`[IPC Migration] Copied ${backupFiles.length} backup files to ${newBackupDir}`);
    }
    
    // 4. Update configuration file
    const config = loadConfig();
    config.dbDir = newDbDir;
    config.backupDir = newBackupDir;
    saveConfig(config);
    
    // 5. Update running variables
    DB_DIR = newDbDir;
    BACKUP_DIR = newBackupDir;
    DB_FILE_PATH = newDbPath;
    
    // 6. Re-initialize database engine
    initDatabaseEngine();
    
    return {
      success: true,
      dbDir: DB_DIR,
      backupDir: BACKUP_DIR,
      dbPath: DB_FILE_PATH
    };
    
  } catch (err) {
    console.error(`[IPC Migration Failure] Error migrating:`, err);
    
    // Rollback running path variables to old paths
    DB_DIR = oldDbDir;
    BACKUP_DIR = oldBackupDir;
    DB_FILE_PATH = oldDbPath;
    databaseType = oldDatabaseType;
    
    // Attempt to re-initialize database engine at old path
    try {
      initDatabaseEngine();
    } catch (reinitErr) {
      console.error(`[IPC Migration Rollback Failure] Error reinitializing old db:`, reinitErr);
    }
    
    return {
      success: false,
      error: `迁移失败: ${err.message}`
    };
  }
});

ipcMain.handle('open-db-folder', async () => {
  try {
    if (fs.existsSync(DB_DIR)) {
      await shell.openPath(DB_DIR);
      return { success: true };
    }
    return { success: false, error: '目录不存在' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('restore-default-db-location', async () => {
  const defaultDbDir = path.join(baseDir, 'database');
  console.log(`[IPC] Restoring default database location to: ${defaultDbDir}`);
  
  const oldDbPath = DB_FILE_PATH;
  const oldDbDir = DB_DIR;
  const oldBackupDir = BACKUP_DIR;
  const oldDatabaseType = databaseType;
  
  const defaultBackupDir = path.join(baseDir, 'backups');
  const defaultDbPath = path.join(defaultDbDir, 'data.db');
  
  try {
    if (!fs.existsSync(defaultDbDir)) {
      fs.mkdirSync(defaultDbDir, { recursive: true });
    }
    if (!fs.existsSync(defaultBackupDir)) {
      fs.mkdirSync(defaultBackupDir, { recursive: true });
    }
    
    if (dbDriver) {
      if (databaseType === 'better-sqlite3' || databaseType === 'sqlite3') {
        dbDriver.close();
      }
      dbDriver = null;
    }
    
    if (fs.existsSync(oldDbPath) && oldDbPath !== defaultDbPath) {
      fs.copyFileSync(oldDbPath, defaultDbPath);
    }
    
    if (fs.existsSync(oldBackupDir) && oldBackupDir !== defaultBackupDir) {
      const backupFiles = fs.readdirSync(oldBackupDir).filter(f => f.startsWith('backup_') && f.endsWith('.db'));
      for (const f of backupFiles) {
        fs.copyFileSync(path.join(oldBackupDir, f), path.join(defaultBackupDir, f));
      }
    }
    
    // Clear custom configuration
    const config = loadConfig();
    delete config.dbDir;
    delete config.backupDir;
    saveConfig(config);
    
    DB_DIR = defaultDbDir;
    BACKUP_DIR = defaultBackupDir;
    DB_FILE_PATH = defaultDbPath;
    
    initDatabaseEngine();
    
    return {
      success: true,
      dbDir: DB_DIR,
      backupDir: BACKUP_DIR,
      dbPath: DB_FILE_PATH
    };
  } catch (err) {
    console.error(`[IPC Default Restore Failure]`, err);
    DB_DIR = oldDbDir;
    BACKUP_DIR = oldBackupDir;
    DB_FILE_PATH = oldDbPath;
    databaseType = oldDatabaseType;
    try {
      initDatabaseEngine();
    } catch (e) {}
    return { success: false, error: `恢复默认位置失败: ${err.message}` };
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "采购进度桌面管理系统",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the web app
  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
