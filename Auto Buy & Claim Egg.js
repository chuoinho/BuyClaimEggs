// ==UserScript==
// @name         Auto Buy & Claim Egg (by Boo)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Mua mèo tự động, xoa trứng.
// @author       Anh
// @match        *://*.cryptokitties.dapperlabs.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const config = {
        catList: [
            'page', 'berry', 'pages_gang', 'hybrid',
            'wild_west', 'frosty_fam', 'footballer',
            'the_purrfessionals', 'slumber_party',
            'crossbreed', 'golden', 'band', 'bands_mascot',
            'kaiju', 'plugged_in',
            'ascended_page', 'ascended_pages_gang', 'ascended_hybrid', 'ascended_frosty_fam',
            'ascended_footballer','ascended_slumber_party', 'ascended_the_purrfessionals'
        ],
        buy_cat: 'page',
        total: 3,
        buyDelay: 2,
        claimDelay: 2,
        apiBaseUrl: "https://zenegg-api.production.cryptokitties.dapperlabs.com/egg/api/den/",
        token: Telegram.WebView.initParams.tgWebAppData,
        errorLog: [],
        latestLog: '',
        isRunning: false
    };

    // Hàm gửi yêu cầu API POST, sử dụng GM_xmlhttpRequest để xử lý CORS
    const fetchAPI = async (endpoint, body = {}) => {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "POST",
                url: `${config.apiBaseUrl}${endpoint}`,
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "application/json",
                    "X-ID-Token": config.token,
                    "X-App-Version": new Date().toISOString().replace(/[-:.TZ]/g, '')
                },
                data: JSON.stringify(body),
                onload: response => {
                    let data;
                    try {
                        data = JSON.parse(response.responseText);
                    } catch (e) {
                        console.error('Parsing error:', e);
                        config.errorLog.push({
                            time: new Date().toISOString(),
                            type: endpoint,
                            message: e.message
                        });
                        return resolve({});
                    }
                    if (response.status !== 200) {
                        console.error(`❌ API Error at ${endpoint}: ${data.error || "Unknown error"}`);
                        config.errorLog.push({
                            time: new Date().toISOString(),
                            type: endpoint,
                            message: data.error || "Unknown error"
                        });
                    }
                    resolve(data);
                },
                onerror: error => {
                    console.error(`🚨 API Error at ${endpoint}:`, error);
                    config.errorLog.push({
                        time: new Date().toISOString(),
                        type: endpoint,
                        message: error.message
                    });
                    resolve({});
                }
            });
        });
    };

    // Hàm tạo độ trễ tính theo giây
    const delay = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

    // Hàm cập nhật hiển thị log trên giao diện
    const updateLog = message => {
        config.latestLog = message;
        const logDisplay = document.getElementById("logDisplay");
        if (logDisplay) {
            logDisplay.textContent = `📜 Log: ${message}`;
        }
    };

    // Hàm xử lý quy trình mua và xoa trứng
    const runScript = async () => {
        config.isRunning = true;
        console.log(`🚀 Running script! Buying cat: "${config.buy_cat}", Total: ${config.total}, Buy delay: ${config.buyDelay}s, Claim delay: ${config.claimDelay}s`);
        updateLog("Script bắt đầu chạy...");

        for (let i = 0; i < config.total; i++) {
            if (!config.isRunning) {
                updateLog("☹ Script đã bị dừng.");
                return;
            }

            // Mua trứng
            await fetchAPI("buy-fancy-egg", { cat_category: config.buy_cat, quantity: 1 });
            updateLog(`🥚 Đã mua ${i + 1}/${config.total} trứng`);
            await delay(config.buyDelay);

            if (!config.isRunning) {
                updateLog("☹ Script đã bị dừng.");
                return;
            }

            // xoa trứng và nhận thưởng
            const data = await fetchAPI("claim-tao");
            const claimed = data.claim?.zen_claimed || 0;
            updateLog(`✅ Đã xoa ${i + 1}/${config.total} lần trứng: +${claimed} ZEN`);
            await delay(config.claimDelay);
        }

        updateLog("✅ Hoàn thành!");
        config.isRunning = false;
    };

    // Hàm tạo field nhập liệu với label
    const createLabelInput = (labelText, defaultValue) => {
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.justifyContent = "space-between";
        wrapper.style.alignItems = "center";

        const label = document.createElement("label");
        label.textContent = labelText;
        label.style.fontSize = "13px";
        label.style.fontWeight = "bold";
        label.style.marginRight = "8px";

        const input = document.createElement("input");
        input.type = "number";
        input.value = defaultValue;
        input.min = 1;
        Object.assign(input.style, {
            width: "50px",
            textAlign: "center",
            padding: "3px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            background: "#f9f9f9"
        });

        wrapper.append(label, input);
        return { wrapper, input };
    };

    // Hàm tạo giao diện cho script
    const createUI = () => {
        const container = document.createElement("div");
        Object.assign(container.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            background: "#ffffff",
            padding: "10px",
            border: "1px solid #ccc",
            zIndex: "1000",
            borderRadius: "5px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            width: "200px",
            height: "230px",
            gap: "5px",
            overflow: "hidden"
        });

        const fragment = document.createDocumentFragment();

        // Dropdown chọn loại mèo
        const selectWrapper = document.createElement("div");
        Object.assign(selectWrapper.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        });

        const selectLabel = document.createElement("label");
        selectLabel.textContent = "Chọn mèo:";
        Object.assign(selectLabel.style, {
            fontSize: "13px",
            fontWeight: "bold",
            marginRight: "4px"
        });

        const select = document.createElement("select");
        Object.assign(select.style, {
            width: "90px",
            padding: "4px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            textAlign: "center"
        });
        config.catList.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            select.appendChild(option);
        });
        selectWrapper.append(selectLabel, select);

        // Các input cấu hình
        const { wrapper: totalWrapper, input: inputTotal } = createLabelInput("Số lần mua:", config.total);
        const { wrapper: buyDelayWrapper, input: inputBuyDelay } = createLabelInput("Chờ xoa (giây):", config.buyDelay);
        const { wrapper: claimDelayWrapper, input: inputClaimDelay } = createLabelInput("Chờ mua tiếp (giây):", config.claimDelay);

        // Nút chạy/dừng hợp nhất
        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = "🚀 Chạy";
        Object.assign(toggleButton.style, {
            background: "#28a745",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            padding: "4px 8px",
            borderRadius: "5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "0.2s"
        });

        // Xử lý khi nút được nhấn
        toggleButton.onclick = async () => {
            if (config.isRunning) {
                // Nếu đã chạy, nhấn sẽ dừng lại
                config.isRunning = false;
                updateLog("Đang dừng script...");
                toggleButton.innerHTML = "🚀 Chạy";
                console.log("Script dừng theo yêu cầu của người dùng.");
            } else {
                // Nếu chưa chạy, cập nhật cấu hình rồi chạy script
                config.buy_cat = select.value;
                config.total = parseInt(inputTotal.value, 10);
                config.buyDelay = parseInt(inputBuyDelay.value, 10);
                config.claimDelay = parseInt(inputClaimDelay.value, 10);
                toggleButton.innerHTML = "⏹ Dừng";
                await runScript();
                toggleButton.innerHTML = "🚀 Chạy";
            }
        };

        // Phần hiển thị log
        const logDisplay = document.createElement("div");
        logDisplay.id = "logDisplay";
        logDisplay.textContent = "Log: Chưa có hoạt động";
        Object.assign(logDisplay.style, {
            fontSize: "9px",
            fontStyle: "italic",
            color: "#555"
        });

        fragment.append(selectWrapper, totalWrapper, buyDelayWrapper, claimDelayWrapper, toggleButton, logDisplay);
        container.appendChild(fragment);
        document.body.appendChild(container);
    };

    window.addEventListener("load", createUI);
})();
