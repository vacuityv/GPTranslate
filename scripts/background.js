


chrome.scripting.getRegisteredContentScripts()
    .then(scripts => console.log("registered content scripts", scripts));


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "gpt",
        title: "翻译选中",
        contexts: ["page", "selection"],
    });
});

chrome.commands.onCommand.addListener(function (command) {
    if (command === "trsSelShortcut") {
        // 在这里执行你的操作
        // 例如，可以发送一个消息给扩展的内容脚本，执行一些操作
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            // chrome.tabs.sendMessage(tabs[0].id, {action: "myAction"});
            chrome.storage.sync.get(['targetLanguage'], async function (result) {
                var targetLanguage = '中文简体';
                if (JSON.stringify(result) != '{}' && JSON.stringify(result['targetLanguage']) !== '{}') {
                    targetLanguage = result['targetLanguage']['text'];
                }
                chrome.scripting
                    .executeScript({
                        target: {tabId: tabs[0].id},
                        func: processTrans,
                        args: [tabs[0].id, targetLanguage],
                    });
            });

        });
    }
});


chrome.contextMenus.onClicked.addListener((item, tab) => {

    if (item.menuItemId === "gpt") {

        chrome.storage.sync.get(['targetLanguage'], async function (result) {
            var targetLanguage = '中文简体';
            if (JSON.stringify(result) != '{}' && JSON.stringify(result['targetLanguage']) !== '{}') {
                targetLanguage = result['targetLanguage']['text'];
            }
            chrome.scripting
                .executeScript({
                    target: {tabId: tab.id},
                    func: processTrans,
                    args: [tab.id, targetLanguage],
                });
        });
    }

});

function processTrans(tabId, targetLanguage) {
    var selection = window.getSelection();
    var text = selection.toString();
    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    var x = rect.right + 10;
    var y = rect.top;

    var windowWidth = window.innerWidth;
    console.log("x:", x)
    console.log("windowWidth:", windowWidth)
    if (windowWidth - x < 100) {
        x = windowWidth - 100;
    }

    var popup = document.createElement('div');
    popup.id = 'vac-trans-popup';
    popup.style.position = 'fixed';
    popup.style.top = y + 'px';
    popup.style.left = x + 'px';
    popup.style.padding = '10px';
    popup.style.maxWidth = '490px';
    // popup.style.background = 'rgba(128, 128, 128, 0.95)';
    popup.style.background = 'rgba(245, 245, 245, 0.95)';
    popup.style.border = '1px solid #cccccc';
    popup.style.boxShadow = '0px 15px 20px 0 rgba(238, 238, 238, 0.9)';
    popup.style.borderRadius = '5px';
    popup.style.zIndex = '9999';
    popup.display = 'none';
    document.body.appendChild(popup);

    console.log("tabId:", tabId)

    chrome.runtime.sendMessage( //goes to bg_page.js
        {
            "translateFrom": "chrome_sel",
            "content": text,
            "recordId": tabId,
            "targetLanguage": targetLanguage
        },
        data => {
        }
    );
}


chrome.runtime.onMessage.addListener(
    function (reqBody, sender, onSuccess) {

        if (reqBody.action == "chrome_sel") {
            onSuccess(reqBody);
            return true;
        }

        if (reqBody.hasOwnProperty('translateFrom')) {
            sendSocketMsg(reqBody)
        }
        return true;
    }
);





const TEN_SECONDS_MS = 5 * 1000;
let webSocket = null;
let readyState = -1;

// Make sure the Glitch demo server is running
// fetch('https://chrome-extension-websockets.glitch.me/', {mode: 'no-cors'});

// Toggle WebSocket connection on action button click
// Send a message every 10 seconds, the ServiceWorker will
// be kept alive as long as messages are being sent.

chrome.tabs.onCreated.addListener(function (tab) {
    checkSocket()
});

const onmessageWS = e => {
    data = e.data
    if (data === 'pong') {
        console.log(data)
        return
    }
    dataObj = JSON.parse(data)
    translateFrom = dataObj['translateFrom'];

    if (translateFrom === 'chrome_sel') {
        // chrome.runtime.sendMessage({action: 'chrome_sel', data: dataObj}, data => {
        //
        // });
        chrome.scripting
            .executeScript({
                target: {tabId: parseInt(dataObj.recordId)},
                func: processTranslateSel,
                args: [data],
            });
    } else if (translateFrom === 'chrome_all') {
        chrome.scripting
            .executeScript({
                target: {tabId: parseInt(dataObj.recordId)},
                func: processTranslatePage,
                args: [data],
            });
    }

}

function processTranslateSel(data) {
    console.log("processTranslateSel1:", data)
    dataObj = JSON.parse(data)
    console.log("processTranslateSel2:", dataObj.content)
    var popup = document.getElementById('vac-trans-popup')
    txt = dataObj['content'];
    txt = txt.replaceAll(/\n/g, "<br/>");
    innerHTML = popup.innerHTML;
    innerHTML = innerHTML + txt;
    popup.innerHTML = innerHTML;
    popup.display = true;
    document.addEventListener('click', function (event) {
        console.log('鼠标点击事件已触发', event);
        el = event.target; //鼠标每经过一个元素，就把该元素赋值给变量el
        console.log('当前鼠标在', el, '元素上');
        if (popup && el != popup) {
            popup.remove();
        }
    });
}

function processTranslatePage(data) {
    dataObj = JSON.parse(data)
    var node = document.getElementById(dataObj.nodeId)
    txt = dataObj['content'];
    callbackStrKey = dataObj['pageKey'];
    window.callbackStrMap[callbackStrKey] = window.callbackStrMap[callbackStrKey] + txt
    totalTxt = window.callbackStrMap[callbackStrKey]

    callbackStrSplit = totalTxt.split('|#|')
    nodeList = window.listMap[dataObj['nodeKey']]
    for (i = 1; i < callbackStrSplit.length; i++) {
        singleItem = callbackStrSplit[i].split('|##|')
        if (singleItem.length > 1) {
            nodeIndex = singleItem[0];
            nodeText = singleItem[1];
            nodeList[nodeIndex].textContent = nodeText
        }
    }
}

function checkSocket() {
    if (!webSocket) {
        connect();
        keepAlive();
    }
}

function connect() {
    // webSocket = new WebSocket('ws://127.0.0.1:8081/vac-chat-api/stream/chat/chat');
    webSocket = new WebSocket('wss://chat.vacuity.me/vac-chat-api/stream/chat/chat');

    webSocket.onopen = (event) => {
        // chrome.action.setIcon({ path: 'icons/socket-active.png' });
        console.log("webSocket.onopen")
    };

    webSocket.onmessage = onmessageWS

    webSocket.onclose = (event) => {
        // chrome.action.setIcon({ path: 'icons/socket-inactive.png' });
        console.log('websocket connection closed');
        webSocket = null;
    };
}

function disconnect() {
    if (webSocket) {
        webSocket.close();
    }
}

function keepAlive() {
    const keepAliveIntervalId = setInterval(
        () => {
            if (webSocket) {
                console.log('ping');
                webSocket.send('ping');
            } else {
                checkSocket()
            }
        },
        // It's important to pick an interval that's shorter than 30s, to
        // avoid that the service worker becomes inactive.
        TEN_SECONDS_MS
    );
}

function sendSocketMsg(msg) {
    checkSocket();
    const checkAliveIntervalId = setInterval(
        () => {
            if (webSocket.readyState === 1) {
                console.log("send:", JSON.stringify(msg))
                webSocket.send(JSON.stringify(msg))
                clearInterval(checkAliveIntervalId);
            }
        },
        100
    );
}

function saveTargetLanguage(index, value, text) {
    var targetLanguage = {
        'index': index,
        'value': value,
        'text': text
    }
    chrome.storage.sync.set({ 'targetLanguage': targetLanguage }, function () {
        console.log('Value is set to ' + text);
    });
}


