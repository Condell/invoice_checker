let fs = require('fs');
let PDFParser = require("pdf2json");
const chokidar = require('chokidar');
const querystring = require('querystring');
const handlebars = require('handlebars');
const moment = require('moment');

//'C:\Users\cody.jewell\AppData\Local\Temp'
//'C:/Users/CODY~1.JEW/AppData/Local/Temp/'


const watcher = chokidar.watch('C:/Users/cody.jewell/AppData/Local/Temp', {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 3000,
        pollInterval: 100
    },
    usePolling: true,
    //interval: 15000,
});

// Add functionality to click and see part of PDF



watcher.on('add', (path, stats) => {
    //log(`File ${path} has been added`);

    if (path.endsWith('.pdf')) {
        //console.log('found pdf')
        pdfFinal(path)
        //console.log(stats)
        //allPDFs.push(path);
        //console.log(allErrorsForRoute)
    }
});



function pdfFinal(directory) {
    let pdfParser = new PDFParser();

    pdfParser.loadPDF(directory);

    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
        //console.log("Page #1:");
        //console.log(pdfData.formImage.Pages[0].Texts[1].R);
        console.log('Parsing PDF...');

        //console.log(pdfData.formImage.Pages[0].Texts)

        let rawText = [];
        for (let i = 0; i < pdfData.formImage.Pages.length; i++) {
            pdfData.formImage.Pages[i].Texts.forEach(element => {

                //console.log(element.)

                let singleString = querystring.decode(element.R[0].T);
                //console.log(querystring.decode(element.R[0].T))
                //console.log(singleString);
                rawText.push(singleString);
            });
        }
        //console.log(rawText)


        //console.log(JSON.stringify(pdfData));
        //let jsonPdf = JSON.stringify(rawText);
        //console.log(jsonPdf)


        let CSIndexLocationList = [];
        let stringKeys = [];
        // make for each function to find ALL 'CS' indexes.
        rawText.forEach((element, index) => {
            let keys = Object.keys(element)
            stringKeys.push(keys[0])
            if (keys.includes('CS') || keys.includes('LB') || keys.includes('PC')) {
                CSIndexLocationList.push(index);
            }

        });
        //console.log(CSIndexLocationList)
        //console.log(stringKeys)
        let entries = [];
        let invoice = '';
        let routeIndex = (stringKeys.findIndex(findRouteIndex) + 1);
        let route = stringKeys[routeIndex]

        CSIndexLocationList.forEach((value) => {
            let tempArray = stringKeys.slice(value - 2);
            let itemNo = tempArray.find(findItemNo);
            let entry = {};
            let ordered = Number.parseInt(tempArray[0].trim());
            let shipped = Number.parseInt(tempArray[1].trim());
            let itemDesc = tempArray.find(findItemDesc);

            // CHANGE invoiceNumber to 2 for production, use 1 for development.
            // Using 2 for production means we get the actual invoice number, using 1 in production means that we WON'T get the actual invoice number, just the word "INVOICE" as there are different elements in the array depending on if we use the "DRAFT" version or we monitor the "FINAL" version for errors.
            let invoiceNumber = stringKeys[2];

            let pageNumber = tempArray.find(findPageNumber)

            entry.itemNumber = itemNo;
            entry.itemDescription = itemDesc;
            entry.ordered = ordered;
            entry.shipped = shipped;
            entry.invoiceNumber = invoiceNumber;
            entry.pageNumber = pageNumber;
            let spaceIndex = pageNumber.search(new RegExp(' '))
            let pgNum = pageNumber.slice(spaceIndex + 1)
            //console.log(pgNum)
            let link = 'file:///' + directory + '#page=' + pgNum;

            // -- WORKS -- console.log(querystring.unescape(link))

            //fs.readlinkSync(link)
            //console.log(link)

            // turn pageNumber into number
            // find index of first space character in pageNumber, then select next index unti end of string.
            // append to directory variable
            // recode it so it is  a clickable link.

            entry.link = link;

            entries.push(entry);
            //console.log(itemNo)
            invoice = invoiceNumber;
            //console.log(tempArray)
        })
        //console.log(entries)


        let errorsOnly = entries.filter(findErrors);
        console.log('Invoice #' + invoice + ' contains ' + errorsOnly.length + ' errors!')
        errorsOnly.forEach((element, index) => {
            //console.log(element)
            console.log('\tError #' + (index + 1) + ': ');
            console.log(element)
            console.log('\n')
        })

        //console.log(errorsOnly)


        let source = `<ul>
                {{#each errors}}
                    <li>
                        <p>Error #{{@index}}</p>
                        <a href={{this.link}}>{{this.link}}</a>
                    </li>
                {{/each}}
            </ul>`;
        //import source from './html/htmlFile.html'
        //let compiled = Handlebars.precompile(template)
        let template = handlebars.compile(source);
        let context = {
            errors: errorsOnly
        };
        let html = template(context);

        let dir = "./" + route + "_" + moment().format("MM-DD-YYYY");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        fs.writeFileSync(dir + '/' + invoice + ".html", html)
        fs.writeFileSync(dir + '/' + invoice + ".json",
            JSON.stringify(errorsOnly));
        //fs.openSync("./" + route + '/' + invoice + ".html")
    })
}


function findItemNo(element, index) {
    //console.log(element)
    //let regex = '/.-/g';
    if (element.includes('-')) {
        //console.log(index)
        return true;
    };
}


function findRouteIndex(element, index) {
    if (element == 'DELIVERY') {
        return true;
    }
}


function findItemDesc(element, index) {
    // NOTE: The item description in the PDF seems to always be 40 characters long.
    if (element.length > 11) {
        return true;
    }
}


function findPageNumber(element, index) {
    if (element.includes('Page')) {
        return true;
    }
}


function findErrors(element, index) {
    if (element.ordered != element.shipped) {
        return true;
    }
}