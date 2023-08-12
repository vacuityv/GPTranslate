initRules();


function initRules() {
}

chrome.scripting.getRegisteredContentScripts()
    .then(scripts => console.log("registered content scripts", scripts));


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "gpt",
        title: "Gpt翻译",
        contexts: ["page", "selection"],
    });
});

chrome.commands.onCommand.addListener(function(command) {
    if (command === "trsSelShortcut") {
        // 在这里执行你的操作
        // 例如，可以发送一个消息给扩展的内容脚本，执行一些操作
        console.log("trsSelShortcut");
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            // chrome.tabs.sendMessage(tabs[0].id, {action: "myAction"});
            chrome.scripting
                .executeScript({
                    target: {tabId: tabs[0].id},
                    func: processTrans,
                });
        });
    }
});


chrome.contextMenus.onClicked.addListener((item, tab) => {
    console.log(item);

    console.log(tab.id);
    console.log(item.selectionText);
    chrome.scripting
        .executeScript({
            target: {tabId: tab.id},
            func: processTrans,
        });
});

function processTrans() {
    var selection = window.getSelection();
    var text = selection.toString();
    var range = selection.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    var x = rect.right + 10;
    var y = rect.top;

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
    popup.textContent = selection.toString();

    chrome.storage.sync.get(['vacTransConfig'], async function (result) {
        if (JSON.stringify(result) !== '{}') {
            sourceJson = result;
        }
        var vacUserId = result.vacUserId;

        chrome.runtime.sendMessage( //goes to bg_page.js
            {
                "vacUserId": vacUserId,
                "content": text
            },
            data => {
                console.log("callack");
                console.log(data);
                txt = data.toString();
                txt = txt.replaceAll(/\n/g,"<br/>");
                popup.innerHTML = txt;
                document.body.appendChild(popup);
                document.addEventListener('click', function (event) {
                    console.log('鼠标点击事件已触发', event);
                    el = event.target; //鼠标每经过一个元素，就把该元素赋值给变量el
                    console.log( '当前鼠标在' , el,  '元素上' );
                    if (popup && el != popup) {
                        popup.remove();
                    }
                });
                // window.addEventListener('scroll', function() {
                //     if (popup) {
                //         popup.remove();
                //     }
                // });
            }
        );
    });
}


chrome.runtime.onMessage.addListener(
    function (reqBody, sender, onSuccess) {
        url = 'https://chat.vacuity.me/vac-chat-api/chat/ext/chromeTranslate'
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqBody),
        };
        fetch(url, options)
            .then(response => response.text())
            .then(text => {
                console.log("api callack")
                console.log(text);
                var resData = JSON.parse(text);
                onSuccess(resData.data.content);
            })
            .catch(error => {
                console.log("api error")
                console.log(error);
                onSuccess('网络错误' + error);
            });
        return true;
    }
);


function saveEdit(configJson) {
    chrome.storage.sync.set(configJson, function () {
    });
}



