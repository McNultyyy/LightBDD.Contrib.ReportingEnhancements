﻿var initialized = false;
var synchronizationCounter = -1000;

function Queryable(array) {
    this._source = array;
    this._where = function (value) { return true; };
    this.where = function (predicate) { this._where = predicate; return this; };
    this.do = function (action) {
        var srcLength = this._source.length;
        for (var i = 0; i < srcLength; ++i) {
            if (this._where(this._source[i]))
                action(this._source[i]);
        }
    };
    this.any = function () {
        var srcLength = this._source.length;
        for (var i = 0; i < srcLength; ++i) {
            if (this._where(this._source[i]))
                return true;
        }
        return false;
    };
    this.toArray = function (select) {
        var result = [];
        this.do(function (o) { result.push(select(o)); });
        return result;
    };
}

Object.prototype.asQueryable = function () {
    return new Queryable(this);
};

function checkAll(checkBoxClass, checked) {
    document.getElementsByTagName('input')
        .asQueryable()
        .where(function (b) { return b.classList.contains(checkBoxClass); })
        .do(function (b) { b.checked = checked; });
    updateOptionsLink();
    ++synchronizationCounter;
}

function sortTable(tableId, columnIdx, numeric, toggle) {
    var direction = toggle.dataset.dir === 'true';

    var sortMethod;
    var parseMethod;
    var checkMethod;
    if (numeric) {
        sortMethod = direction ? function (x, y) { return x[0] - y[0]; } : function (x, y) { return y[0] - x[0]; };
        parseMethod = function (x) { return parseFloat(x); };
        checkMethod = function (x) { return !isNaN(x); };
    } else {
        sortMethod = direction
            ? function (x, y) { return (x[0] > y[0]) ? 1 : ((x[0] < y[0]) ? -1 : 0); }
            : function (x, y) { return (x[0] < y[0]) ? 1 : ((x[0] > y[0]) ? -1 : 0); };
        parseMethod = function (x) { return x; };
        checkMethod = function (x) { return true; };
    }

    var table = document.getElementById(tableId);
    table.tHead.rows[0].cells.asQueryable().do(function (column) { delete column.dataset.dir; });
    toggle.dataset.dir = !direction;
    var tbody = table.tBodies[0];
    var store = [];
    tbody.rows.asQueryable()
        .do(function (row) {
            var sortnr = parseMethod(row.cells[columnIdx].textContent || row.cells[columnIdx].innerText);
            if (checkMethod(sortnr)) store.push([sortnr, row]);
        });
    store.sort(sortMethod);
    store.asQueryable().do(function (row) { tbody.appendChild(row[1]); });
    ++synchronizationCounter;
}

function applyFilter() {
    if (!initialized)
        return;

    var getFilterValues = function (elementsName) {
        return document.getElementsByName(elementsName)
            .asQueryable()
            .where(function (e) { return e.checked; })
            .toArray(function (e) { return e.dataset.filterValue; });
    };

    var applyTo = function (tag, className, filter) {
        document.getElementsByTagName(tag)
            .asQueryable()
            .where(function (e) { return e.classList.contains(className); })
            .do(filter);
    };

    var statusFilterValues = getFilterValues('statusFilter');
    var categoryFilterValues = getFilterValues('categoryFilter');

    var statusFilter = function (element) {
        return statusFilterValues.asQueryable()
            .where(function (s) { return element.classList.contains(s); })
            .any();
    };

    var childFilter = function (feature) {
        return feature.getElementsByTagName('div')
            .asQueryable()
            .where(function (ch) { return ch.classList.contains('scenario') && ch.dataset.filtered == 'true'; })
            .any();
    };

    var categoryFilter = null;

    if (categoryFilterValues.length == 0 || categoryFilterValues[0] === 'all') {
        categoryFilter = function (scenario) { return true; };
        childFilter = statusFilter;
    } else if (categoryFilterValues[0] === 'without') {
        categoryFilter = function (scenario) { return scenario.dataset.categories == ''; };
    } else {
        categoryFilter = function (scenario) {
            return categoryFilterValues.asQueryable()
                .where(function (c) { return scenario.dataset.categories.indexOf(c) >= 0; })
                .any();
        };
    }

    applyTo('div', 'scenario', function (scenario) {
        scenario.dataset.filtered = statusFilter(scenario) && categoryFilter(scenario);
        scenario.className = scenario.className; //IE fix
    });
    applyTo('article', 'feature', function (feature) {
        feature.dataset.filtered = childFilter(feature);
        feature.className = feature.className; //IE fix
    });
    updateOptionsLink();
    ++synchronizationCounter;
}

function updateOptionsLink() {
    if (!initialized)
        return;

    var options = [];

    var check = function (element, option, invert = true) {
        var value = document.getElementById(element).checked;
        if (invert && !value)
            options.push(option + '=0');
        if (!invert && value)
            options.push(option + '=1');
    };

    check('toggleFeatures', 'tf', false);
    check('toggleScenarios', 'ts', false);
    check('toggleSubSteps', 'tss', false);

    check('showPassed', 'fp');
    check('showBypassed', 'fb');
    check('showFailed', 'ff');
    check('showIgnored', 'fi');
    check('showNotRun', 'fn');

    document.getElementsByName('categoryFilter')
        .asQueryable()
        .where(function (c) { return c.checked; })
        .do(function (c) { options.push('cat=' + c.dataset.filterName); });

    var query = options.join('&');
    var current = location.search;
    var idx = current.indexOf('?');
    var link = (idx >= 0 ? current.substring(0, idx) : current) + '?' + query;

    document.getElementsByTagName('a').asQueryable()
        .where(function (a) { return a.classList.contains('shareable'); })
        .do(function (a) {
            var href = a.href;
            var i = href.indexOf('#');
            a.href = link + (i >= 0 ? href.substring(i) : '');
        });
}

function applyOptionsFromLink() {
    var getParam = function (param) {
        var regex = new RegExp("[\\?&]" + param + "=([^&#]*)");
        var results = regex.exec(location.search);
        return results === null ? null : decodeURIComponent(results[1]);
    };

    var applyToCheckbox = function (elementId, param, invert = true) {
        var element = document.getElementById(elementId);
        var value = getParam(param);
        element.checked = value === null ? !invert : (value==='0'); //set opposite value
        element.click(); //toggle it
    };

    applyToCheckbox('toggleFeatures', 'tf', false);
    applyToCheckbox('toggleScenarios', 'ts', false);
    applyToCheckbox('toggleSubSteps', 'tss', false);
    applyToCheckbox('showPassed', 'fp');
    applyToCheckbox('showBypassed', 'fb');
    applyToCheckbox('showFailed', 'ff');
    applyToCheckbox('showIgnored', 'fi');
    applyToCheckbox('showNotRun', 'fn');

    var cat = getParam('cat');

    if (cat !== null) {
        document.getElementsByName('categoryFilter')
            .asQueryable()
            .where(function (c) { return c.dataset.filterName === cat; })
            .do(function (c) { c.click(); });
    }

}

function applyLink(linkId, href) {
    var link = document.getElementById(linkId);
    if (link != null)
        link.href = href;
}

function initialize() {
    applyLink('bypassedDetails', '?ts=0&fp=0&ff=0&fi=0&fn=0#featureDetails');
    applyLink('failedDetails', '?ts=0&fp=0&fb=0&fi=0&fn=0#featureDetails');
    applyLink('ignoredDetails', '?ts=0&fp=0&fb=0&ff=0&fn=0#featureDetails');

    applyOptionsFromLink();
    initialized = true;
    applyFilter();
    synchronizationCounter = 0;
}

function toggleHappyPathsOnly(happyPathsOnly) {
    Array.from(
        Array.from(document.querySelectorAll('.scenario'))
            .filter(function (el) {
                return Array.from(el.querySelectorAll('.label'))
                    .filter(function (label) { return label.textContent == 'Happy Path' }).length === 0;
            })
    ).forEach((element) => element.classList.toggle('hide', happyPathsOnly));
}

function toggleDiagrams(showDiagrams) {
    Array.from(document.querySelectorAll('details.example-diagrams')).forEach((element) => element.toggleAttribute('open', showDiagrams));
}

function search_scenarios() {
    console.log("called search_scenarios");
    let input = document.getElementById('searchbar').value;
    input = input.toLowerCase().trim();
    console.log("input: " + input);

    if (input !== '') {
        checkAll('toggleF', true);
        document.getElementById('toggleFeatures').checked = true;
    }

    let searchTokens = parseSearchTokensIncludingQuotes(input);
    console.log("tokens: " + searchTokens);
    for (j = 0; j < searchTokens.length; j++)
        console.log("searchTokens[" + j + "]: " + searchTokens[j]);

    let feature = document.getElementsByClassName('feature');
    let scenario = document.getElementsByClassName('scenario');

    for (i = 0; i < feature.length; i++) {
        let tokenMiss = false;
        for (j = 0; j < searchTokens.length; j++) {
            if (!(feature[i].textContent.toLowerCase().includes(searchTokens[j]))) {
                tokenMiss = true;
                break;
            }
        }

        feature[i].style.display = tokenMiss ? "none" : "";
    }

    for (i = 0; i < scenario.length; i++) {
        let tokenMiss = false;
        for (j = 0; j < searchTokens.length; j++) {
            if (!(scenario[i].textContent.toLowerCase().includes(searchTokens[j]))) {
                tokenMiss = true;
                break;
            }
        }

        scenario[i].style.display = tokenMiss ? "none" : "";
    }
}

function parseSearchTokensIncludingQuotes(str) {
    let quoteTokens = str.match(/"(.*?)"/);
    quoteTokens = quoteTokens?.slice(1, quoteTokens.length) ?? [];
    console.log("Number of quoteTokens: " + quoteTokens.length);

    if (quoteTokens == null)
        quoteTokens = [];

    for (i = 0; i < quoteTokens.length; i++)
        str = str.replace('\"' + quoteTokens[i] + '\"', '');

    let simpleTokens = [];
    let rawWords = str.trim().split(" ");
    for (i = 0; i < rawWords.length; i++) {
        let token = rawWords[i].trim();
        simpleTokens.push(token);
    }

    tokens = quoteTokens.concat(simpleTokens);
    tokens = tokens.filter(x => x !== "");

    return tokens;
}
