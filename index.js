// index.js (Final Corrected Version)

// 首先，从.env 文件加载环境变量
require('dotenv').config();

// 导入所有必需的库
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');

// --- 1. 数据库连接 ---
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- 2. 数据采集与存储的核心函数 ---
async function fetchAndStoreTps() {
  try {
    const response = await axios.get(process.env.SOURCE_API_URL);
    const data = response.data;

    const tps = parseFloat(data.tps);
    const mspt = parseFloat(data.mspt);
    const lastUpdated = new Date(data.lastUpdated);

    if (isNaN(tps) || isNaN(mspt) || isNaN(lastUpdated.getTime())) {
      console.error('从 API 收到了无效数据:', data);
      return;
    }

    const sql = 'INSERT INTO tps_history (record_timestamp, tps, mspt) VALUES (?,?,?)';
    const values = [lastUpdated, tps, mspt];

    await pool.execute(sql, values);
    
    console.log(`成功存储数据: ${lastUpdated.toISOString()} | TPS: ${tps}, MSPT: ${mspt}`);

  } catch (error) {
    if (error.response) {
      console.error(`API 错误: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      console.error('网络错误: 未收到源 API 的响应。');
    } else {
      console.error('执行 fetchAndStoreTps 时出错:', error.message);
    }
  }
}

// --- 3. 自动化定时任务 ---
cron.schedule('*/10 * * * * *', () => {
  console.log('定时任务触发: 开始获取并存储 TPS 数据...');
  fetchAndStoreTps();
});

console.log('TPS 数据记录服务已启动，并已设定为每 10 秒运行一次。');

// --- 4. API 服务器 ---
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/api/tps/history', async (req, res) => {
  const period = req.query.period || '24h'; 

  let interval;
  let groupByFormat;

  switch (period) {
    case '7d':
      interval = '7 DAY';
      groupByFormat = '%Y-%m-%d %H:00:00';
      break;
    case '30d':
      interval = '30 DAY';
      groupByFormat = '%Y-%m-%d %H:00:00';
      break;
    case '24h':
    default:
      interval = '24 HOUR';
      groupByFormat = '%Y-%m-%d %H:%i:00';
      break;
  }

  try {
    const sql = `
      SELECT
        DATE_FORMAT(record_timestamp,?) AS time_group,
        AVG(tps) AS avg_tps,
        MIN(tps) AS min_tps,
        MAX(tps) AS max_tps
      FROM
        tps_history
      WHERE
        record_timestamp >= NOW() - INTERVAL ${interval}
      GROUP BY
        time_group
      ORDER BY
        time_group ASC;
    `;

    const [rows] = await pool.execute(sql, [groupByFormat]);

    const formattedData = rows.map(row => ({
      timestamp: row.time_group,
      tps: {
        average: parseFloat(row.avg_tps),
        min: parseFloat(row.min_tps),
        max: parseFloat(row.max_tps)
      }
    }));
    
    res.json(formattedData);

  } catch (error) {
    console.error('API 在获取历史数据时出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.listen(PORT, () => {
  console.log(`API 服务器已启动，正在监听端口: http://localhost:${PORT}`);
});
