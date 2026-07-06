# 森林迷宮大冒險 🐿️ (Kids Maze Game)

🚀 **本專案已自動部署至 GitHub Pages！**
*   **遊戲網址**：[https://kuanfu256-bot.github.io/kids-maze-game/](https://kuanfu256-bot.github.io/kids-maze-game/)
*   **儲存庫網址**：[https://github.com/kuanfu256-bot/kids-maze-game](https://github.com/kuanfu256-bot/kids-maze-game)

這是一個特別為**國小學童**設計的網頁版迷宮遊戲。玩家將操控一隻可愛的小松鼠（🐿️），在森林迷宮中尋找美味的松果（🌰），並避開牆壁回到溫馨的樹屋（🏡）。

本專案無須下載任何安裝檔，只要透過瀏覽器打開網頁即可即開即玩，支援電腦鍵盤以及平板/手機的觸控螢幕。

---

## 🎮 遊戲特色
1. **動態迷宮生成**：每次重新開始或切換難度時，系統會自動生成全新且保證有解的迷宮（採用 DFS 演算法）。
2. **適合兒童的視覺與音效**：使用圓潤可愛的字型、明亮溫馨的糖果配色，並內建通關時的拉炮粒子特效與 Web Audio API 自製小音效。
3. **難度分級**：
   - **簡單 (10x10)**：適合低年級，路線單純寬敞。
   - **中等 (15x15)**：適合中年級，具備適度的思考挑戰。
   - **困難 (20x20)**：適合高年級，挑戰空間感與解題速度。
4. **雙重操作支援**：
   - **電腦版**：使用鍵盤方向鍵（`↑` `↓` `←` `→`）或 `W`, `A`, `S`, `D` 進行移動。
   - **平板/手機版**：螢幕下方設有虛擬方向鍵（D-pad），方便手指觸碰滑動。
5. **星星評分系統**：根據通關時間與松果收集狀況，給予 1 至 3 顆星星評價。

---

## 🚀 部署至您的 GitHub 並開啟線上遊玩

本專案完全由靜態網頁檔案（`index.html`, `style.css`, `game.js`）組成，非常適合使用免費的 **GitHub Pages** 來託管。請跟著以下步驟操作：

### 第一步：在 GitHub 上建立新的儲存庫 (Repository)
1. 登入您的 GitHub 帳號。
2. 點選右上角的 **「+」**，選擇 **New repository**。
3. 輸入儲存庫名稱（例如：`kids-maze-game`）。
4. 設定為 **Public**（公開，才能使用免費的 GitHub Pages）。
5. **不要**勾選 "Add a README file"、"Add .gitignore" 或 "Choose a license"（因為本地已經有檔案了）。
6. 點選 **Create repository**。

### 第二步：將本機專案上傳至 GitHub
在您的電腦中開啟終端機（如 Git Bash 或 PowerShell），切換至本專案目錄 `C:\Users\NoName\.gemini\antigravity\scratch\kids-maze-game`，執行以下指令：

```bash
# 1. 初始化本地 Git 儲存庫
git init

# 2. 將所有檔案加入暫存區
git add .

# 3. 提交變更
git commit -m "Initial commit: 建立兒童迷宮網頁版"

# 4. 將預設分支名稱命名為 main
git branch -M main

# 5. 連結到剛剛建立的 GitHub 儲存庫（請將 YOUR_USERNAME 換成您的 GitHub 帳號，kids-maze-game 換成您的專案名稱）
git remote add origin https://github.com/YOUR_USERNAME/kids-maze-game.git

# 6. 推送至 GitHub
git push -u origin main
```

### 第三步：啟用 GitHub Pages (免費網站託管)
1. 在 GitHub 上打開您剛剛推送上去的專案頁面。
2. 點選上方選單的 ⚙️ **Settings** (設定)。
3. 在左側側邊欄中尋找 **Pages**（位於 Code and automation 區段）。
4. 在 **Build and deployment** 下的 **Branch**，將預設的 `None` 修改為 `main`。
5. 右側的資料夾維持 `/ (root)`，點選 **Save** (儲存)。
6. 稍等約 1 到 2 分鐘，重新整理頁面，GitHub 就會為您產生一個專屬網址（例如：`https://YOUR_USERNAME.github.io/kids-maze-game/`）。

這時候，您就可以將這個網址分享給國小的小朋友們，讓他們在任何裝有瀏覽器的裝置上點開遊玩了！

---

## 🛠️ 開發技術
- **HTML5 Canvas**：用於高性能的迷宮格線、角色與松果繪製，以及過關灑花動畫。
- **CSS3 Flexbox / Grid & Media Queries**：打造自適應平板與電腦的響應式控制介面與虛擬搖桿。
- **Web Audio API**：完全在瀏覽器端動態合成音頻（無須外連音效檔，避免加載失敗），實現乾淨好聽的踩踏聲、吃松果音效及勝利凱歌。
