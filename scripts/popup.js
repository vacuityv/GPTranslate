document.getElementById("target-language").addEventListener("change", updateTargetLanguage);

window.onload = function () {
    initTargetLanguage();
}

// targetLanguage
async function initTargetLanguage() {

    chrome.storage.sync.get(['targetLanguage'], async function (result) {
        if (JSON.stringify(result) != '{}' && JSON.stringify(result['targetLanguage']) !== '{}') {
            var sourceJson = result['targetLanguage'];
            var selectValue = sourceJson['value'];
            document.getElementById("target-language").value = selectValue;
        }
    });


}

function updateTargetLanguage() {
    var tarSelect = document.getElementById("target-language");

    var index = tarSelect.selectedIndex;
    var value = tarSelect.options [index].value;
    var text = tarSelect.options [index].text;
    saveTargetLanguage(index, value, text);
}




