# Matching-System 研訓院媒合系統

## 部署流程
- 建立tunnel
```
ssh -L 2245:192.168.7.201:22 cassie@10.3.101.59 -i id_rsa_cassie_AJP
```
- 建立ssh連線
```
ssh root@localhost -p 2245
appdev6i
```
- 上傳程式碼
```
git clone https://gitlab.turl.kaehsu.io/PinQi/matching-system.git
```
- 到指定資料夾
```
cd matching-system/
```
- 更新程式碼
```
proxychains git pull origin main
PinQi
```
- 創建一個tmux
```
tmux new-session -s matching
```
- 檢視指定的tmux
```
tmux attach -t matching
``` 

## 初次設定

- 下載相關套件
```
npm install
```
- 設定.env
- 建立資料表
```
npm run init-db
npx sequelize-cli db:migrate:undo:all 
npx sequelize-cli db:migrate 
npx sequelize-cli db:migrate --to <file name>>
npx sequelize-cli db:seed:all
npx sequelize-cli db:seed --seed <file name>
```

## 建立資料庫
- 建立tunnel
```
ssh -L 2246:192.168.7.202:5432 cassie@10.3.101.59 -i id_rsa_cassie_AJP
```
- 透過pgAdmin連接
```
Host: 127.0.0.1
Port: 2246
Username: postgres
Password: appdev6i
```
