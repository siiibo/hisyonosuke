const init = () => {
    initProperties();
}

const initProperties = () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
    const rows = sheet.getDataRange().getValues();
    let properties = {};
    for (let row of rows.slice(1)) properties[row[0]] = row[1];

    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteAllProperties();
    scriptProperties.setProperties(properties);
}

declare const global: any;
global.init = init;
