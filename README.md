# Mincraft-tps
依赖数据库，把我的世界的服务器的tps做成图表
### 创建数据库
`CREATE DATABASE your_database_name CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
### 表机构
`CREATE TABLE tps_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_timestamp TIMESTAMP(3) NOT NULL,
    tps DECIMAL(5, 2) NOT NULL,
    mspt DECIMAL(7, 2) NOT NULL
);`
### 索引
`CREATE INDEX idx_record_timestamp ON tps_history (record_timestamp);`
