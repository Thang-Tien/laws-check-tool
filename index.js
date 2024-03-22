const { Builder, By, until, Browser, Capabilities } = require("selenium-webdriver")
const xlsxToJson = require('./xlsx')
const fs = require('fs/promises');
const { Options } = require("selenium-webdriver/edge");
const utils = require('./utils');
const dotenv = require('dotenv');

// config env
dotenv.config({ path: ".env" });

// load data
var laws = xlsxToJson('./DanhSach_VB_BPĐ.xlsx');

const capabilities = Capabilities.edge();

// Không nên để eager vì tốc độ quá nhanh, web sẽ nhận diện là bot
capabilities.setPageLoadStrategy('normal');
let driver = new Builder().forBrowser(Browser.EDGE).withCapabilities(capabilities).build();

//access the website
driver.get('https://thuvienphapluat.vn/');

// login
driver.findElement(By.id("usernameTextBox")).sendKeys(`${process.env.USER_NAME}`);
driver.findElement(By.id("passwordTextBox")).sendKeys(`${process.env.PASSWORD}`);
// await driver.findElement(By.id("usernameTextBox")).sendKeys("cao.hl.thang@gmail.com")
// await driver.findElement(By.id("passwordTextBox")).sendKeys("12345678")
driver.findElement(By.id("loginButton")).click();

driver.wait(until.elementLocated(By.id('Support_HyperLink1')))
    .then(async () => {
        for (let i = 0; i < laws.length; i++) {
            var startTime = performance.now();
            var result = await find(laws[i]['Số hiệu VB, Ngày ban hành']);
            laws[i]['Màu'] = result[0];
            //laws[i][' Văn bản thay thế hoặc sđ, bs'] = result[1];
            laws[i] = utils.specialAddAttribute(laws[i], {" Văn bản thay thế hoặc sđ, bs": result[1]}, 2);
            await utils.sleep(1000);

            console.log(i + 2, result[0], result[1]);
            var endTime = performance.now();
            var executionTime = endTime - startTime;
            console.log(`Execution takes ${utils.msToTime(executionTime)}, time remaining: ${utils.msToTime(executionTime * (laws.length - i))} \n`);
            await fs.appendFile('./laws.json', `${JSON.stringify(laws[i])}, `, 'utf-8');
        }

        await fs.appendFile('./laws.json', `]`, 'utf-8');

    });

//driver.quit();


async function find(keyword) {
    try {

        // search
        await driver.get(`https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=${keyword}&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=20/03/1944&edate=21/03/2024&chlbg=21/03/1944&chlend=21/03/2034`);

        // access link
        var url = await driver.findElement(By.css('#block-info-advan > div:nth-child(2) > div:nth-child(1) > div.left-col > div.nq > p.nqTitle > a')).getAttribute('href');
        await driver.get(url);
        await driver.findElement(By.id('ctl00_Content_ctl00_spLuocDo')).click();

        // wait until site is loaded
        await driver.wait(until.elementsLocated(By.css('#viewingDocument > div:nth-child(11) > div.ds.fl')));

        // Check document code
        var currentDocumentCode = await driver.findElement(By.css('#viewingDocument > div:nth-child(2) > div.ds.fl')).getText();
        currentDocumentCode = currentDocumentCode.replaceAll('-', '/');
        var keywordCode = keyword.split(' ')[1].replaceAll('-', '/');

        if (currentDocumentCode != keywordCode) {
            return ['red', 'Không tồn tại'];
        }

        // Tình trạng
        var condition = await driver.findElement(By.css('#viewingDocument > div:nth-child(11) > div.ds.fl')).getText();
        //console.log(condition);

        // Nếu còn hiệu lực 
        if (condition.includes('Còn hiệu lực')) {
            // Sô lượng văn bản bổ sung
            var numberOfAdditionalDocument = await driver.findElement(By.css('#cmDiagram > table > tbody > tr > td > div.right.fl > div.rr.fl > div:nth-child(7) > b')).getText();
            //console.log(numberOfAdditionalDocument);

            // Nếu có văn bản bổ sung -> Bôi xanh, nhập mã của văn bản bổ sung gần nhất
            if (numberOfAdditionalDocument > 0) {
                const [additionalDocumentCode, newestEffectiveDate] = await checkDocument('additional');
                //console.log('Bôi xanh', additionalDocumentCode, newestEffectiveDate);
                return ['green', additionalDocumentCode];
            }
            // Không có văn bản bổ sung -> Nhập ok
            else {
                //console.log('OK');
                return ['white', 'OK'];
            }
        } else if (condition.includes('Hết hiệu lực')) {
            // Sô lượng văn bản thay thế
            var numberOfAdditionalDocument = await driver.findElement(By.css('#cmDiagram > table > tbody > tr > td > div.right.fl > div.rr.fl > div:nth-child(13) > b')).getText();

            // Có văn bản thay thế -> bôi vàng
            if (numberOfAdditionalDocument > 0) {
                const [replaceDocumentCode, newestEffectiveDate] = await checkDocument('replace');
                //console.log('Bôi vàng', replaceDocumentCode, newestEffectiveDate);
                return ['yellow', replaceDocumentCode];
            }
            // Không có -> Nhập 'Không có vbtt'
            else {
                //console.log('Không có văn bản thay thế');
                return ['white', 'Không có văn bản thay thế']
            }
        } else if (condition.includes('Không còn phù hợp')) {
            //console.log('Bôi đỏ, Không còn phù hợp');
            return ['red', 'Không còn phù hợp'];
        } else if (condition.includes('Chưa có hiệu lực pháp luật')) {
            //console.log('Chưa có hiệu lực pháp luật');
            return ['white', 'Chưa có hiệu lực pháp luật'];
        } else if (condition.includes('Không xác định')) {
            return ['red', 'Chưa có hiệu lực pháp luật'];
        } else {
            return ['red', '']
        }
    } catch (e) {
        //console.log("Error: ", e);
        return ['white', ''];
    }
}

async function checkDocument(type) {

    if (type == 'additional') {
        // Date của văn bản bổ sung
        var effectiveDateString;
        var effectiveDate;
        var newestEffectiveDate = new Date(1990, 1, 1, 7);
        // Code của văn bản bổ sung
        var additionalDocumentCode = '';

        // Sô lượng văn bản bổ sung
        var numberOfAdditionalDocument = await driver.findElement(By.css('#cmDiagram > table > tbody > tr > td > div.right.fl > div.rr.fl > div:nth-child(7) > b')).getText();

        for (let i = 0; i < numberOfAdditionalDocument; i++) {
            effectiveDateString = await driver.executeScript(`return document.querySelector('#amendDocument > div > div.dgc:nth-child(${i + 1}) > div:nth-child(2) > div > div > div:nth-child(8) > div:nth-child(2)').textContent;`);
            effectiveDateString = effectiveDateString.trim();
            //console.log(effectiveDateString);
            effectiveDate = new Date(parseInt(effectiveDateString.split('/')[2]), parseInt(effectiveDateString.split('/')[1]) - 1, parseInt(effectiveDateString.split('/')[0]), 7);
            if (effectiveDate > newestEffectiveDate) {
                additionalDocumentCode = await driver.executeScript(`return document.querySelector('#amendDocument > div > div.dgc:nth-child(${i + 1}) > div:nth-child(2) > div > div > div:nth-child(2) > div:nth-child(2)').textContent;`);
                additionalDocumentCode = additionalDocumentCode.trim();
                newestEffectiveDate = effectiveDate;
            }
        }

        return [additionalDocumentCode, newestEffectiveDate];
    } else if (type == 'replace') {
        // Date của văn bản thay thế
        var effectiveDateString;
        var effectiveDate;
        var newestEffectiveDate = new Date(1990, 1, 1, 7);
        // Code của văn bản thay thế
        var replaceDocumentCode = '';

        // Sô lượng văn bản thay thế
        var numberOfReplaceDocument = await driver.findElement(By.css('#cmDiagram > table > tbody > tr > td > div.right.fl > div.rr.fl > div:nth-child(13) > b')).getText();

        for (let i = 0; i < numberOfReplaceDocument; i++) {
            effectiveDateString = await driver.executeScript(`return document.querySelector('#replaceDocument > div > div.dgc:nth-child(${i + 1}) > div:nth-child(2) > div > div > div:nth-child(8) > div:nth-child(2)').textContent;`);
            effectiveDateString = effectiveDateString.trim();
            //console.log(effectiveDateString);
            effectiveDate = new Date(parseInt(effectiveDateString.split('/')[2]), parseInt(effectiveDateString.split('/')[1]) - 1, parseInt(effectiveDateString.split('/')[0]), 7);
            //console.log(effectiveDate)
            if (effectiveDate > newestEffectiveDate) {
                replaceDocumentCode = await driver.executeScript(`return document.querySelector('#replaceDocument > div > div.dgc:nth-child(${i + 1}) > div:nth-child(2) > div > div > div:nth-child(2) > div:nth-child(2)').textContent;`);
                replaceDocumentCode = replaceDocumentCode.trim();
                newestEffectiveDate = effectiveDate;
            }
        }

        return [replaceDocumentCode, newestEffectiveDate];
    }


}
