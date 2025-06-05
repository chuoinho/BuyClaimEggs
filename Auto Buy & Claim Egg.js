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

    // Cấu hình chung
    const config = {
        catList: [
            'page', 'berry', 'pages_gang', 'hybrid',
            'wild_west', 'frosty_fam', 'footballer',
            'the_purrfessionals', 'slumber_party',
            'crossbreed', 'golden', 'band', 'bands_mascot',
            'kaiju', 'plugged_in',
            'ascended_page', 'ascended_pages_gang', 'ascended_hybrid', 'ascended_frosty_fam', 'ascended_wild_west',
            'ascended_footballer', 'ascended_slumber_party', 'ascended_the_purrfessionals', 'ascended_band'
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

    // Hàm áp dụng style cho element
    const applyStyles = (element, styles) => {
        Object.assign(element.style, styles);
    };

    // Hàm gửi yêu cầu API POST sử dụng GM_xmlhttpRequest (để vượt qua CORS)
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

    // Hàm tạo độ trễ (tính bằng giây)
    const delay = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

    // Hàm cập nhật log trên giao diện
    const updateLog = message => {
        config.latestLog = message;
        const logDisplay = document.getElementById("logDisplay");
        if (logDisplay) {
            logDisplay.textContent = `📜 Log: ${message}`;
        }
    };

    // Hàm xử lý quy trình mua và xóa trứng
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

            // Xóa trứng và nhận thưởng
            const data = await fetchAPI("claim-tao");
            const claimed = data.claim?.zen_claimed || 0;
            updateLog(`✅ Đã xóa ${i + 1}/${config.total} lần trứng: +${claimed} ZEN`);
            await delay(config.claimDelay);
        }

        updateLog("✅ Hoàn thành!");
        config.isRunning = false;
    };

    // Hàm tạo một trường nhập liệu với label
    const createLabelInput = (labelText, defaultValue) => {
        const wrapper = document.createElement("div");
        applyStyles(wrapper, { display: "flex", justifyContent: "space-between", alignItems: "center" });

        const label = document.createElement("label");
        label.textContent = labelText;
        applyStyles(label, { fontSize: "13px", fontWeight: "bold", marginRight: "8px" });

        const input = document.createElement("input");
        input.type = "number";
        input.value = defaultValue;
        input.min = 1;
        applyStyles(input, {
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

    // Hàm tạo giao diện cho script với tính năng kéo thả và thu gọn/mở rộng
    const createUI = () => {
        // Container chính
        const container = document.createElement("div");
        applyStyles(container, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            background: "#ffffff",
            padding: "0",
            border: "1px solid #ccc",
            zIndex: "1000",
            borderRadius: "5px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            width: "220px"
        });

        // Header chứa tiêu đề và nút thu gọn/mở rộng
        const header = document.createElement("div");
        header.textContent = "Auto Buy & Claim Egg";
        applyStyles(header, {
            background: "#28a745",
            color: "white",
            padding: "8px",
            cursor: "move",
            borderTopLeftRadius: "5px",
            borderTopRightRadius: "5px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "14px"
        });

        // Nút thu gọn/mở rộng
        const toggleCollapseButton = document.createElement("button");
        toggleCollapseButton.textContent = "−";
        applyStyles(toggleCollapseButton, {
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: "16px",
            cursor: "pointer",
            lineHeight: "1"
        });
        header.appendChild(toggleCollapseButton);

        // Khối nội dung chứa các thành phần bên dưới header
        const content = document.createElement("div");
        applyStyles(content, {
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            overflow: "hidden"
        });

        // Dropdown chọn loại mèo
        const selectWrapper = document.createElement("div");
        applyStyles(selectWrapper, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        });
        const selectLabel = document.createElement("label");
        selectLabel.textContent = "Chọn mèo:";
        applyStyles(selectLabel, { fontSize: "13px", fontWeight: "bold", marginRight: "4px" });
        const select = document.createElement("select");
        applyStyles(select, {
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

        // Nút chạy/dừng
        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = "🚀 Chạy";
        applyStyles(toggleButton, {
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
        toggleButton.onclick = async () => {
            if (config.isRunning) {
                config.isRunning = false;
                updateLog("Đang dừng script...");
                toggleButton.innerHTML = "🚀 Chạy";
                console.log("Script dừng theo yêu cầu của người dùng.");
            } else {
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
        applyStyles(logDisplay, {
            fontSize: "9px",
            fontStyle: "italic",
            color: "#555"
        });

        // Lắp ráp các thành phần
        content.append(selectWrapper, totalWrapper, buyDelayWrapper, claimDelayWrapper, toggleButton, logDisplay);
        container.append(header, content);
        document.body.appendChild(container);

        // --- Xử lý kéo thả: ---
        header.addEventListener("mousedown", e => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            // Chuyển sang vị trí left/top
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.top}px`;
            container.style.bottom = "auto";
            container.style.right = "auto";

            const shiftX = e.clientX - rect.left;
            const shiftY = e.clientY - rect.top;

            const moveAt = (pageX, pageY) => {
                container.style.left = (pageX - shiftX) + "px";
                container.style.top = (pageY - shiftY) + "px";
            };

            const onMouseMove = event => moveAt(event.pageX, event.pageY);
            document.addEventListener("mousemove", onMouseMove);

            document.addEventListener("mouseup", function onMouseUp() {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            });
        });

        // --- Thu gọn/mở rộng giao diện ---
        let isCollapsed = false;
        toggleCollapseButton.addEventListener("click", e => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            content.style.display = isCollapsed ? "none" : "flex";
            toggleCollapseButton.textContent = isCollapsed ? "+" : "−";
        });
    };

    window.addEventListener("load", createUI);
})();
